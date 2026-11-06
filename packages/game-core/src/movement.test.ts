import { expect, test } from 'vitest';
import { OFFICE_MAP, stepMovement, type Body } from './index.js';
test('diagonal movement covers four metres per second and slides without crossing desks', () => {
  const body: Body = { x: 0, z: 0, yaw: 0 };
  for (let i = 0; i < 30; i++) Object.assign(body, stepMovement(body, { moveX: 1, moveZ: 1, aimYaw: 1 }, { ...OFFICE_MAP, obstacles: [] }, 1 / 30));
  expect(Math.hypot(body.x, body.z)).toBeCloseTo(4);
  const map = { ...OFFICE_MAP, obstacles: [{ id: 'desk', x: 2, z: 0, width: 2, depth: 4 }] };
  const blocked = stepMovement({ x: 0, z: 0, yaw: 0 }, { moveX: 1, moveZ: 0, aimYaw: 0 }, map, 1);
  expect(blocked.x).toBeLessThanOrEqual(0.65);
  expect(blocked.x).toBeGreaterThan(0.4);
});
