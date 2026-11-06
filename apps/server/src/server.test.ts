import { afterEach, expect, test } from 'vitest';
import { Client, type Room } from '@colyseus/sdk';
import { BUILD_VERSION, MAP_VERSION, PROTOCOL_VERSION, PublicRoomState, type Credential, type RoomInfo } from '@ga-com/protocol';
import { createGameServer } from './server.js';
const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
const handshake = { protocolVersion: PROTOCOL_VERSION, buildVersion: BUILD_VERSION, mapVersion: MAP_VERSION, profile: { displayName: 'An', color: 0, hair: 0, accessory: 0 } };
async function join(origin: string, code?: string, secret?: string) {
  const response = await fetch(`${origin}/api/rooms${code ? `/${code}/join` : ''}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...handshake, secret }) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.code);
  const room = await new Client(origin).consumeSeatReservation<PublicRoomState>(payload.reservation, PublicRoomState);
  room.onMessage('*', () => undefined);
  cleanups.push(async () => { await room.leave(); });
  return { room, credential: payload.credential as Credential, code: payload.code as string };
}
function command(room: Room<PublicRoomState>, credential: Credential, type: string, extra = {}) {
  room.send('command', { type, generation: credential.generation, requestId: crypto.randomUUID(), ...extra });
}
test('two SDK clients share schema, start a match and receive immutable results over one origin', async () => {
  let now = 0;
  const server = createGameServer({ now: () => now });
  const origin = await server.listen(0, '127.0.0.1'); cleanups.push(() => server.close());
  expect(await fetch(`${origin}/health`).then(r => r.json())).toMatchObject({ ready: true, protocolVersion: 1 });
  const first = await join(origin); const second = await join(origin, first.code);
  await expect.poll(() => first.room.state.connections).toBe(2);
  await expect.poll(() => second.room.state.phase).toBe('lobby');
  const bad = await fetch(`${origin}/api/rooms/${first.code}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...handshake, protocolVersion: 999 }) }).then(r => r.json());
  expect(bad.code).toBe('VERSION_MISMATCH');
  command(first.room, first.credential, 'startMatch');
  await expect.poll(() => second.room.state.players.size).toBe(2);
  now = 180000;
  await expect.poll(() => first.room.state.phase).toBe('results');
  const result = (JSON.parse(first.room.state.info) as RoomInfo).result;
  expect(result?.winner).toBeNull();
  command(first.room, first.credential, 'returnToLobby');
  await expect.poll(() => second.room.state.phase).toBe('lobby');
  expect(second.room.state.players.size).toBe(0);
});
test('a full eight-client room supports authenticated takeover without taking a ninth seat', async () => {
  const server = createGameServer(); const origin = await server.listen(0, '127.0.0.1'); cleanups.push(() => server.close());
  const first = await join(origin);
  for (let i = 1; i < 8; i++) await join(origin, first.code);
  await expect(join(origin, first.code)).rejects.toThrow('ROOM_FULL');
  const replacement = await join(origin, first.code, first.credential.secret);
  expect(replacement.credential.playerId).toBe(first.credential.playerId);
  await expect.poll(() => replacement.room.state.connections).toBe(8);
  expect((JSON.parse(replacement.room.state.info) as RoomInfo).members).toHaveLength(8);
});
