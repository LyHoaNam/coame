import { expect, test } from 'vitest';
import { createMatch, stepMatch, rankPairs, OFFICE_MAP } from './index.js';
const roster = [{ playerId: 'an', displayName: 'An', color: 0, hair: 0, accessory: 0 }, { playerId: 'binh', displayName: 'Bình', color: 1, hair: 1, accessory: 1 }];
const config = { durationSeconds: 60, foods: [{ id: 'pizza', name: 'Pizza', icon: 'pizza' }, { id: 'sushi', name: 'Sushi', icon: 'rice' }] };
test('ranking compares player–food pairs, never total pickups, and breaks ties by reached event', () => {
  const rows = rankPairs([
    { playerId: 'an', foodId: 'pizza', count: 5, reachedEventSeq: 10 },
    { playerId: 'an', foodId: 'sushi', count: 4, reachedEventSeq: 11 },
    { playerId: 'binh', foodId: 'pizza', count: 6, reachedEventSeq: 12 },
    { playerId: 'binh', foodId: 'sushi', count: 6, reachedEventSeq: 13 },
  ]);
  expect(rows[0]).toMatchObject({ playerId: 'binh', foodId: 'pizza', count: 6 });
});
test('warning lands after 1.5s, one owner wins a tied pickup, and deadline freezes result', () => {
  const match = createMatch(config, roster, OFFICE_MAP, 42, 1000, 'match-1');
  expect(match.items).toHaveLength(1);
  const item = match.items[0]!;
  for (const player of match.players) Object.assign(player, { x: item.x, z: item.z });
  stepMatch(match, {}, 1 / 30, 2499);
  expect(match.scores).toHaveLength(0);
  stepMatch(match, {}, 1 / 30, 2500);
  expect(match.scores).toEqual([{ playerId: 'an', foodId: item.foodId, count: 1, reachedEventSeq: 1 }]);
  stepMatch(match, {}, 1 / 30, 61000);
  const result = structuredClone(match.result);
  stepMatch(match, {}, 1 / 30, 99999);
  expect(match.result).toEqual(result);
  expect(match.items).toHaveLength(0);
  expect(result?.winner?.playerId).toBe('an');
});
test('simultaneous attacks can knock out both players before pickup, respawn stays on the original deadline', () => {
  const match = createMatch(config, roster, OFFICE_MAP, 42, 0, 'combat');
  Object.assign(match.players[0]!, { x: 0, z: 0, yaw: Math.PI / 2, hp: 20 });
  Object.assign(match.players[1]!, { x: 1, z: 0, yaw: -Math.PI / 2, hp: 20 });
  Object.assign(match.items[0]!, { x: 0, z: 0, landedAt: 0 });
  stepMatch(match, { an: { moveX: 0, moveZ: 0, aimYaw: Math.PI / 2, attackSeq: 1 }, binh: { moveX: 0, moveZ: 0, aimYaw: -Math.PI / 2, attackSeq: 1 } }, 1 / 30, 100);
  expect(match.players.map(p => p.hp)).toEqual([0, 0]);
  expect(match.scores).toHaveLength(0);
  stepMatch(match, {}, 1 / 30, 8099);
  expect(match.players[0]!.hp).toBe(0);
  stepMatch(match, {}, 1 / 30, 8100);
  expect(match.players.map(p => [p.hp, p.protectedUntil])).toEqual([[100, 11100], [100, 11100]]);
});
