export interface Point { x: number; z: number }
export interface Body extends Point { yaw: number }
export interface Intent { moveX: number; moveZ: number; aimYaw: number }
export interface Obstacle extends Point { id: string; width: number; depth: number }
export interface OfficeMap { width: number; depth: number; obstacles: Obstacle[]; spawnPoints: Point[] }
export const OFFICE_MAP: OfficeMap = {
  width: 24, depth: 18,
  obstacles: [-6, 0, 6].flatMap((x, column) => [-3.5, 3.5].map((z, row) => ({ id: `desk-${column}-${row}`, x, z, width: 3, depth: 1.6 }))),
  spawnPoints: [{ x: -10, z: -7 }, { x: 10, z: 7 }, { x: 10, z: -7 }, { x: -10, z: 7 }, { x: 0, z: -7 }, { x: 0, z: 7 }, { x: -10, z: 0 }, { x: 10, z: 0 }],
};
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.z - b.z);
export function isWalkable(p: Point, map: OfficeMap, radius = 0.35): boolean {
  if (Math.abs(p.x) > map.width / 2 - radius || Math.abs(p.z) > map.depth / 2 - radius) return false;
  return !map.obstacles.some(o => {
    const dx = Math.max(Math.abs(p.x - o.x) - o.width / 2, 0);
    const dz = Math.max(Math.abs(p.z - o.z) - o.depth / 2, 0);
    return dx * dx + dz * dz < radius * radius;
  });
}
export function moveBy(body: Body, dx: number, dz: number, map: OfficeMap): Body {
  const result = { ...body };
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.1));
  for (let i = 0; i < steps; i++) {
    const nextX = { ...result, x: result.x + dx / steps };
    if (isWalkable(nextX, map)) result.x = nextX.x;
    const nextZ = { ...result, z: result.z + dz / steps };
    if (isWalkable(nextZ, map)) result.z = nextZ.z;
  }
  return result;
}
export function stepMovement(body: Body, intent: Intent, map: OfficeMap, dt: number, speed = 4): Body {
  const length = Math.max(1, Math.hypot(intent.moveX, intent.moveZ));
  return { ...moveBy(body, intent.moveX / length * speed * dt, intent.moveZ / length * speed * dt, map), yaw: intent.aimYaw };
}
export function lineClear(a: Point, b: Point, map: OfficeMap): boolean {
  // Slab intersection with each rectangle; grazing a surface blocks a hit.
  return !map.obstacles.some(o => {
    let near = 0, far = 1;
    for (const [start, delta, min, max] of [[a.x, b.x - a.x, o.x - o.width / 2, o.x + o.width / 2], [a.z, b.z - a.z, o.z - o.depth / 2, o.z + o.depth / 2]]) {
      if (start === undefined || delta === undefined || min === undefined || max === undefined) continue;
      if (Math.abs(delta) < 1e-10) { if (start < min || start > max) return false; }
      else { const t1 = (min - start) / delta, t2 = (max - start) / delta; near = Math.max(near, Math.min(t1, t2)); far = Math.min(far, Math.max(t1, t2)); if (near > far) return false; }
    }
    return true;
  });
}
