import express from 'express';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { randomInt, randomUUID } from 'node:crypto';
import { Server, matchMaker } from '@colyseus/core';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { BUILD_VERSION, PROTOCOL_VERSION, MAP_VERSION, handshakeSchema } from '@ga-com/protocol';
import { OfficeRoom } from './office-room.js';
import { TokenBucket } from './input.js';

export function createGameServer(options: { now?: () => number; maxRooms?: number } = {}) {
  const now = options.now ?? (() => performance.now());
  const maxRooms = options.maxRooms ?? Number(process.env.MAX_ROOMS ?? 10);
  const app = express();
  const http = createServer(app);
  const rooms = new Map<string, OfficeRoom>();
  const instanceId = randomUUID();
  let ready = true;
  const server = new Server({ transport: new WebSocketTransport({ server: http, maxPayload: 8192, pingInterval: 3000, pingMaxRetries: 3 }), greet: false, gracefullyShutdown: false });
  // New seat reservations pass through the serialized, authenticated API.
  matchMaker.controller.exposedMethods = ['reconnect'];
  server.define('office', OfficeRoom);
  app.use(express.json({ limit: '8kb' }));
  const ipBuckets = new Map<string, { rate: TokenBucket; seen: number }>();
  app.use('/api', (req, res, next) => {
    const at = now(), ip = req.socket.remoteAddress ?? 'unknown';
    for (const [key, bucket] of ipBuckets) if (at - bucket.seen > 120000) ipBuckets.delete(key);
    let bucket = ipBuckets.get(ip);
    if (!bucket) { if (ipBuckets.size >= 4096) { res.status(429).json({ code: 'RATE_LIMITED' }); return; } bucket = { rate: new TokenBucket(80, 1, at), seen: at }; ipBuckets.set(ip, bucket); }
    bucket.seen = at;
    if (!ready) { res.status(503).json({ code: 'SERVER_SHUTDOWN' }); return; }
    if (!bucket.rate.take(at)) { res.status(429).json({ code: 'RATE_LIMITED' }); return; }
    next();
  });
  let creating: Promise<unknown> = Promise.resolve();
  app.post('/api/rooms', async (req, res) => {
    const action = creating.then(async () => {
      const parsed = handshakeSchema.safeParse(req.body);
      if (!parsed.success) throw new Error('INVALID_PAYLOAD');
      if (parsed.data.protocolVersion !== PROTOCOL_VERSION || parsed.data.mapVersion !== MAP_VERSION) throw new Error('VERSION_MISMATCH');
      if (parsed.data.secret) throw new Error('UNAUTHORIZED');
      if (rooms.size >= maxRooms) throw new Error('SERVER_FULL');
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let code: string;
      do { code = Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join(''); } while (rooms.has(code));
      await matchMaker.createRoom('office', { code, services: { now, register: (room: OfficeRoom) => rooms.set(code, room), unregister: (roomCode: string) => rooms.delete(roomCode) } });
      return rooms.get(code)!.reserve(parsed.data);
    });
    creating = action.catch(() => undefined);
    try { res.json({ ...await action, instanceId }); } catch (error) { res.status(400).json({ code: error instanceof Error ? error.message : 'INVALID_PAYLOAD' }); }
  });
  app.post('/api/rooms/:code/join', async (req, res) => {
    const room = rooms.get(String(req.params.code).toUpperCase());
    if (!room) { res.status(404).json({ code: 'ROOM_NOT_FOUND' }); return; }
    try { res.json({ ...await room.reserve(req.body), instanceId }); } catch (error) { res.status(400).json({ code: error instanceof Error ? error.message : 'INVALID_PAYLOAD' }); }
  });
  app.get('/health', (_req, res) => res.json({ ready, instanceId, buildVersion: BUILD_VERSION, protocolVersion: PROTOCOL_VERSION, mapVersion: MAP_VERSION, rooms: rooms.size, connections: [...rooms.values()].reduce((sum, room) => sum + room.state.connections, 0) }));
  const staticRoot = fileURLToPath(new URL('../../client/dist/', import.meta.url));
  app.use(express.static(staticRoot));
  app.get(['/', '/room/:code'], (_req, res) => res.sendFile(`${staticRoot}index.html`));
  return {
    async listen(port: number, host: string) {
      await Promise.race([server.listen(port, host), new Promise<never>((_resolve, reject) => http.once('error', reject))]);
      const address = http.address();
      if (!address || typeof address === 'string') throw new Error('Missing TCP address');
      return `http://${host}:${address.port}`;
    },
    async close() { ready = false; for (const room of rooms.values()) room.broadcast('error', { code: 'SERVER_SHUTDOWN' }); await server.gracefullyShutdown(false); },
  };
}
