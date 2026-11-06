import { randomBytes, randomUUID } from 'node:crypto';
import type { Profile, RosterEntry } from '@ga-com/game-core';

export interface Member extends RosterEntry {
  secret: string; joinedOrder: number; generation: number; connected: boolean;
  hasSeat: boolean; seatDeadline: number; leftVoluntarily: boolean;
}
export class RoomLifecycle {
  readonly members = new Map<string, Member>();
  phase: 'lobby' | 'playing' | 'results' = 'lobby';
  hostPlayerId = '';
  roster = new Set<string>();
  closed = false;
  private emptyDeadline: number;
  private joinOrder = 0;
  constructor(now: number) { this.emptyDeadline = now + 300000; }

  join(profile: Profile, secret: string | undefined, now: number) {
    this.advance(now);
    if (this.closed) throw new Error('ROOM_CLOSED');
    let member = secret ? [...this.members.values()].find(m => m.secret === secret) : undefined;
    if (secret && !member) throw new Error('UNAUTHORIZED');
    if (!member?.hasSeat && this.publicMembers().length >= 8) throw new Error('ROOM_FULL');
    if (!member) {
      member = { ...profile, displayName: this.uniqueName(profile.displayName), playerId: randomUUID(), secret: randomBytes(32).toString('hex'), joinedOrder: this.joinOrder++, generation: 0, connected: false, hasSeat: true, seatDeadline: now + 60000, leftVoluntarily: false };
      this.members.set(member.playerId, member);
    }
    member.generation++;
    member.hasSeat = true;
    member.leftVoluntarily = false;
    member.seatDeadline = now + 60000;
    return { playerId: member.playerId, secret: member.secret, generation: member.generation };
  }
  connect(id: string, generation: number, now: number) {
    const member = this.authorize(id, generation);
    member.connected = true; member.seatDeadline = Infinity;
    this.emptyDeadline = Infinity;
    this.electHost();
    this.advance(now);
  }
  authorize(id: string, generation: number) {
    const member = this.members.get(id);
    if (!member || member.generation !== generation) throw new Error('SESSION_REPLACED');
    return member;
  }
  disconnect(id: string, generation: number, now: number, voluntary = false) {
    const member = this.members.get(id);
    if (!member || member.generation !== generation) return;
    member.connected = false; member.leftVoluntarily = voluntary;
    member.seatDeadline = now + (voluntary ? 0 : 60000);
    if (this.phase === 'playing' && this.roster.has(id)) member.seatDeadline = Infinity;
    this.electHost();
    if (![...this.members.values()].some(m => m.connected) && this.emptyDeadline === Infinity) this.emptyDeadline = now + 300000;
    this.advance(now);
  }
  start(id: string, now: number): RosterEntry[] {
    this.requireHost(id, 'lobby'); this.advance(now);
    const online = [...this.members.values()].filter(m => m.connected).sort((a, b) => a.joinedOrder - b.joinedOrder);
    if (online.length < 2) throw new Error('NEED_PLAYERS');
    this.roster = new Set(online.map(m => m.playerId)); this.phase = 'playing';
    for (const member of this.members.values()) { member.hasSeat = this.roster.has(member.playerId); member.seatDeadline = member.hasSeat ? Infinity : 0; }
    return online.map(({ playerId, displayName, color, hair, accessory }) => ({ playerId, displayName, color, hair, accessory }));
  }
  finish(now: number) {
    if (this.phase !== 'playing') return;
    this.phase = 'results';
    for (const member of this.members.values()) if (member.hasSeat && !member.connected) member.seatDeadline = now + (member.leftVoluntarily ? 0 : 60000);
    this.advance(now);
  }
  returnToLobby(id: string, now: number) { this.requireHost(id, 'results'); this.phase = 'lobby'; this.roster.clear(); this.advance(now); }
  updateProfile(id: string, profile: Profile) {
    if (this.phase !== 'lobby') throw new Error('INVALID_PHASE');
    const member = this.members.get(id);
    if (!member?.connected) throw new Error('UNAUTHORIZED');
    Object.assign(member, profile, { displayName: this.uniqueName(profile.displayName, id) });
  }
  requireHost(id: string, phase: typeof this.phase) {
    if (this.hostPlayerId !== id) throw new Error('NOT_HOST');
    if (this.phase !== phase) throw new Error('INVALID_PHASE');
  }
  advance(now: number) {
    for (const member of this.members.values()) if (!member.connected && member.seatDeadline <= now) member.hasSeat = false;
    if (this.emptyDeadline <= now) this.closed = true;
  }
  publicMembers() {
    return [...this.members.values()].filter(m => m.hasSeat).map(({ playerId, displayName, color, hair, accessory, connected, joinedOrder }) => ({ playerId, displayName, color, hair, accessory, connected, joinedOrder, role: this.roster.has(playerId) ? 'participant' as const : 'waiter' as const }));
  }
  private electHost() {
    if (this.members.get(this.hostPlayerId)?.connected) return;
    this.hostPlayerId = [...this.members.values()].filter(m => m.connected).sort((a, b) => a.joinedOrder - b.joinedOrder)[0]?.playerId ?? '';
  }
  private uniqueName(name: string, except?: string) {
    const used = new Set([...this.members.values()].filter(m => m.playerId !== except).map(m => m.displayName.toLocaleLowerCase('vi')));
    let candidate = name, suffix = 2;
    while (used.has(candidate.toLocaleLowerCase('vi'))) { const tail = ` (${suffix++})`; candidate = [...name].slice(0, 24 - tail.length).join('') + tail; }
    return candidate;
  }
}
