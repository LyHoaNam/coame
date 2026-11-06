import { expect, test } from 'vitest';
import { findPath, OFFICE_MAP, isWalkable, distance } from './index.js';
test('NPC paths route around desks through walkable cells and connect every spawn', () => {
  const path = findPath({ x: -6, z: -6 }, { x: -6, z: 0 }, OFFICE_MAP);
  expect(path.length).toBeGreaterThan(12);
  expect(path.every(p => isWalkable(p, OFFICE_MAP))).toBe(true);
  expect(distance(path.at(-1)!, { x: -6, z: 0 })).toBeLessThan(0.6);
  for (const point of OFFICE_MAP.spawnPoints) expect(findPath(OFFICE_MAP.spawnPoints[0]!, point, OFFICE_MAP).length).toBeGreaterThan(0);
});
