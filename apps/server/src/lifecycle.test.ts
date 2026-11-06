import { expect, test } from 'vitest';
import { RoomLifecycle } from './lifecycle.js';
const profile = { displayName: 'An', color: 0, hair: 0, accessory: 0 };
test('eight seats permit an authenticated takeover, and an old close cannot disconnect the new generation', () => {
  const room = new RoomLifecycle(0);
  const first = room.join(profile, undefined, 0);
  room.connect(first.playerId, first.generation, 0);
  for (let i = 1; i < 8; i++) { const m = room.join(profile, undefined, 0); room.connect(m.playerId, m.generation, 0); }
  expect(() => room.join(profile, undefined, 0)).toThrow('ROOM_FULL');
  const replacement = room.join(profile, first.secret, 10);
  room.connect(replacement.playerId, replacement.generation, 10);
  room.disconnect(first.playerId, first.generation, 20);
  expect(room.members.get(first.playerId)?.connected).toBe(true);
  expect(room.publicMembers()).toHaveLength(8);
  expect(new Set(room.publicMembers().map(m => m.displayName)).size).toBe(8);
});
test('host transfers without reverting, grace expires, empty room closes after five minutes', () => {
  const room = new RoomLifecycle(0);
  const first = room.join(profile, undefined, 0); room.connect(first.playerId, first.generation, 0);
  const second = room.join(profile, undefined, 0); room.connect(second.playerId, second.generation, 0);
  room.disconnect(first.playerId, first.generation, 100);
  expect(room.hostPlayerId).toBe(second.playerId);
  const rebound = room.join(profile, first.secret, 200); room.connect(rebound.playerId, rebound.generation, 200);
  expect(room.hostPlayerId).toBe(second.playerId);
  room.disconnect(first.playerId, rebound.generation, 300);
  room.disconnect(second.playerId, second.generation, 300);
  room.advance(60300);
  expect(room.publicMembers()).toHaveLength(0);
  expect(room.closed).toBe(false);
  room.advance(300300);
  expect(room.closed).toBe(true);
});
