import { randomUUID, randomBytes } from 'node:crypto';
import { Room, ServerError, type Client, matchMaker } from '@colyseus/core';
import { createMatch, DEFAULT_CONFIG, OFFICE_MAP, stepMatch, type Match, type PlayerInput } from '@ga-com/game-core';
import { commandSchema, handshakeSchema, PROTOCOL_VERSION, MAP_VERSION, PublicRoomState, PlayerState, ItemState, NpcState, type Credential, type RoomInfo } from '@ga-com/protocol';
import { RoomLifecycle } from './lifecycle.js';
import { InputQueue, TokenBucket } from './input.js';

interface Binding extends Credential { queue: InputQueue; commandRate: TokenBucket; malformed: number[] }
export interface RoomServices { now: () => number; register: (room: OfficeRoom) => void; unregister: (code: string) => void }
export class OfficeRoom extends Room<{ state: PublicRoomState }> {
  state = new PublicRoomState();
  lifecycle!: RoomLifecycle;
  private services!: RoomServices;
  private match: Match | null = null;
  private config = structuredClone(DEFAULT_CONFIG);
  private bindings = new Map<string, Binding>();
  private pending = new Map<string, Credential>();
  private requests = new Map<string, Map<string, { requestId: string; code: string }>>();
  private serial: Promise<unknown> = Promise.resolve();
  private reconnecting = new Map<string, { reject: (reason?: unknown) => void }>();
  private closedSessions = new Map<string, () => void>();
  onCreate(options: { code: string; services: RoomServices }) {
    if (!options.services) throw new ServerError(403, 'UNAUTHORIZED');
    this.services = options.services; this.lifecycle = new RoomLifecycle(this.services.now());
    this.state.code = options.code; this.maxClients = 8; this.autoDispose = false;
    this.maxMessagesPerSecond = 120; this.setSeatReservationTime(5); this.setPatchRate(50);
    this.services.register(this);
    this.onMessage('command', (client, value: unknown) => { void this.serialize(() => this.command(client, value)); });
    this.onMessage('input', (client, value: unknown) => {
      const binding = this.bindings.get(client.sessionId);
      if (!binding) return;
      try {
        this.lifecycle.authorize(binding.playerId, binding.generation);
        binding.queue.push(value, this.services.now());
      } catch (error) { this.reject(client, error); }
    });
    this.setFixedTimestep(({ dt }) => this.step(dt), 30);
    this.publish();
  }
  serialize<T>(action: () => T | Promise<T>): Promise<T> {
    const next = this.serial.then(action); this.serial = next.catch(() => undefined); return next;
  }
  reserve(raw: unknown) {
    return this.serialize(async () => {
      const parsed = handshakeSchema.safeParse(raw);
      if (!parsed.success) throw new Error('INVALID_PAYLOAD');
      const options = parsed.data;
      if (options.protocolVersion !== PROTOCOL_VERSION || options.mapVersion !== MAP_VERSION) throw new Error('VERSION_MISMATCH');
      const credential = this.lifecycle.join(options.profile, options.secret, this.services.now());
      for (const [sessionId, binding] of this.bindings) if (binding.playerId === credential.playerId) {
        const old = this.clients.find(c => c.sessionId === sessionId);
        const waiting = this.reconnecting.get(sessionId);
        if (old || waiting) {
          const closed = new Promise<void>(resolve => this.closedSessions.set(sessionId, resolve));
          if (old) { old.send('error', { code: 'SESSION_REPLACED' }); old.leave(4001); }
          waiting?.reject(new Error('SESSION_REPLACED'));
          await closed;
        }
      }
      const ticket = randomBytes(32).toString('hex'); this.pending.set(ticket, credential);
      this.clock.setTimeout(() => this.pending.delete(ticket), 5000);
      const rooms = await matchMaker.findRoomsByIds([this.roomId]);
      const room = rooms.get(this.roomId);
      if (!room) throw new Error('ROOM_CLOSED');
      const reservation = await matchMaker.reserveSeatFor(room, { ticket });
      return { reservation, credential, code: this.state.code };
    });
  }
  onAuth(_client: Client, options: { ticket?: string }) {
    const credential = options.ticket && this.pending.get(options.ticket);
    if (!credential) throw new ServerError(403, 'UNAUTHORIZED');
    this.pending.delete(options.ticket!);
    this.lifecycle.authorize(credential.playerId, credential.generation);
    return credential;
  }
  onJoin(client: Client, _options: unknown, credential: Credential) {
    this.lifecycle.connect(credential.playerId, credential.generation, this.services.now());
    this.bindings.set(client.sessionId, { ...credential, queue: new InputQueue(this.services.now()), commandRate: new TokenBucket(10, 5, this.services.now()), malformed: [] });
    const player = this.match?.players.find(p => p.playerId === credential.playerId); if (player) player.lastAttackSeq = 0;
    client.send('identity', credential); this.publish();
  }
  async onDrop(client: Client) {
    const binding = this.bindings.get(client.sessionId);
    if (!binding) return;
    if (this.lifecycle.members.get(binding.playerId)?.generation !== binding.generation) return;
    binding.queue.clear(); this.lifecycle.disconnect(binding.playerId, binding.generation, this.services.now()); this.publish();
    try {
      const reconnect = this.allowReconnection(client, 5); this.reconnecting.set(client.sessionId, { reject: reason => reconnect.reject(reason) });
      await reconnect;
      this.lifecycle.authorize(binding.playerId, binding.generation);
    } catch { /* Authenticated HTTP rebind remains available after reservation expiry. */ }
    finally { this.reconnecting.delete(client.sessionId); }
  }
  onReconnect(client: Client) {
    const binding = this.bindings.get(client.sessionId);
    if (!binding) return;
    this.lifecycle.connect(binding.playerId, binding.generation, this.services.now()); binding.queue = new InputQueue(this.services.now());
    const player = this.match?.players.find(p => p.playerId === binding.playerId); if (player) player.lastAttackSeq = 0;
    this.publish();
  }
  onLeave(client: Client) {
    const binding = this.bindings.get(client.sessionId);
    if (binding) this.lifecycle.disconnect(binding.playerId, binding.generation, this.services.now());
    this.bindings.delete(client.sessionId);
    this.closedSessions.get(client.sessionId)?.(); this.closedSessions.delete(client.sessionId);
    this.publish();
  }
  onDispose() { this.services.unregister(this.state.code); }
  onUnhandledMessage(client: Client) { this.reject(client, new Error('INVALID_PAYLOAD')); }
  private command(client: Client, value: unknown) {
    const binding = this.bindings.get(client.sessionId);
    if (!binding) return;
    const parsed = commandSchema.safeParse(value);
    if (!parsed.success) { this.reject(client, new Error('INVALID_PAYLOAD')); return; }
    const command = parsed.data;
    try {
      this.lifecycle.authorize(binding.playerId, command.generation);
      if (!binding.commandRate.take(this.services.now())) throw new Error('RATE_LIMITED');
      let cache = this.requests.get(binding.playerId);
      if (!cache) { cache = new Map(); this.requests.set(binding.playerId, cache); }
      const prior = cache.get(command.requestId);
      if (prior) { client.send('ack', prior); return; }
      switch (command.type) {
        case 'updateProfile': this.lifecycle.updateProfile(binding.playerId, command.profile); break;
        case 'configureMatch': this.lifecycle.requireHost(binding.playerId, 'lobby'); this.config = command.config; break;
        case 'startMatch': {
          const roster = this.lifecycle.start(binding.playerId, this.services.now());
          this.match = createMatch(this.config, roster, OFFICE_MAP, randomBytes(4).readUInt32LE(), this.services.now(), randomUUID());
          for (const b of this.bindings.values()) b.queue.clear();
          break;
        }
        case 'returnToLobby': this.lifecycle.returnToLobby(binding.playerId, this.services.now()); this.match = null; for (const b of this.bindings.values()) b.queue.clear(); break;
        case 'leaveRoom': this.lifecycle.disconnect(binding.playerId, binding.generation, this.services.now(), true); this.bindings.delete(client.sessionId); client.leave(4000); break;
      }
      const ack = { requestId: command.requestId, code: 'OK' }; cache.set(command.requestId, ack);
      if (cache.size > 128) cache.delete(cache.keys().next().value!);
      client.send('ack', ack); this.publish();
    } catch (error) { this.reject(client, error, command.requestId); }
  }
  private step(dt: number) {
    const now = this.services.now(); this.lifecycle.advance(now);
    if (this.lifecycle.closed) { this.broadcast('error', { code: 'ROOM_CLOSED' }); void this.disconnect(); return; }
    if (!this.match || this.match.result) return;
    const inputs: Record<string, PlayerInput> = {};
    for (const client of this.clients) {
      const binding = this.bindings.get(client.sessionId);
      if (!binding || this.lifecycle.members.get(binding.playerId)?.generation !== binding.generation) continue;
      const input = binding.queue.next(now);
      if (input && input.matchId === this.match.matchId && input.generation === binding.generation && this.lifecycle.roster.has(binding.playerId)) inputs[binding.playerId] = input;
    }
    stepMatch(this.match, inputs, dt, now);
    if (this.match.result) this.lifecycle.finish(now);
    this.publish();
    for (const event of this.match.events) this.broadcast('event', event);
    for (const client of this.clients) {
      const binding = this.bindings.get(client.sessionId);
      const player = this.match.players.find(p => p.playerId === binding?.playerId);
      if (binding && player) client.send('inputAck', { generation: binding.generation, matchId: this.match.matchId, tick: this.match.tick, seq: binding.queue.handledSeq, x: player.x, z: player.z, yaw: player.yaw, hp: player.hp, serverTimeMs: now });
    }
  }
  private publish() {
    this.state.phase = this.lifecycle.phase; this.state.hostPlayerId = this.lifecycle.hostPlayerId;
    this.state.connections = [...this.lifecycle.members.values()].filter(m => m.connected).length; this.state.serverTimeMs = this.services.now();
    this.state.matchId = this.match?.matchId ?? ''; this.state.tick = this.match?.tick ?? 0; this.state.endAt = this.match?.endAt ?? 0;
    const info: RoomInfo = { members: this.lifecycle.publicMembers(), config: this.config, scores: this.match?.scores ?? [], result: this.match?.result ?? null };
    this.state.info = JSON.stringify(info);
    if (!this.match) { this.state.players.clear(); this.state.items.clear(); this.state.npcs.clear(); return; }
    for (const npc of this.match.npcs) {
      let projected = this.state.npcs.get(npc.npcId);
      if (!projected) { projected = new NpcState(); this.state.npcs.set(npc.npcId, projected); }
      Object.assign(projected, { npcId: npc.npcId, x: npc.x, z: npc.z, yaw: npc.yaw, mode: npc.mode, hitAt: npc.hitAt });
    }
    for (const player of this.match.players) {
      let projected = this.state.players.get(player.playerId);
      if (!projected) { projected = new PlayerState(); this.state.players.set(player.playerId, projected); }
      for (const key of ['playerId', 'x', 'z', 'yaw', 'hp', 'respawnAt', 'protectedUntil', 'color', 'hair', 'accessory'] as const) Object.assign(projected, { [key]: player[key] });
    }
    const ids = new Set(this.match.items.map(i => String(i.itemId)));
    for (const id of this.state.items.keys()) if (!ids.has(id)) this.state.items.delete(id);
    for (const item of this.match.items) {
      let projected = this.state.items.get(String(item.itemId));
      if (!projected) { projected = new ItemState(); this.state.items.set(String(item.itemId), projected); }
      Object.assign(projected, { itemId: item.itemId, foodId: item.foodId, x: item.x, z: item.z, landedAt: item.landedAt, expiresAt: item.expiresAt });
    }
  }
  private reject(client: Client, error: unknown, requestId?: string) {
    const code = error instanceof Error ? error.message : 'INVALID_PAYLOAD'; client.send('error', { code, requestId });
    if (code === 'INVALID_PAYLOAD') {
      const binding = this.bindings.get(client.sessionId);
      if (binding) { const now = this.services.now(); binding.malformed = binding.malformed.filter(at => now - at < 10000); binding.malformed.push(now); if (binding.malformed.length >= 3) client.leave(4002); }
    }
  }
}
