import { distance, isWalkable, type OfficeMap, type Point } from './movement.js';
interface Grid { points: Map<string, Point>; neighbors: Map<string, string[]> }
const grids = new WeakMap<OfficeMap, Grid>();
const keyOf = (p: Point) => `${Math.round(p.x * 2)},${Math.round(p.z * 2)}`;
function gridFor(map: OfficeMap): Grid {
  const cached = grids.get(map); if (cached) return cached;
  const points = new Map<string, Point>(), neighbors = new Map<string, string[]>();
  for (let x = -map.width / 2 + 0.5; x < map.width / 2; x += 0.5) for (let z = -map.depth / 2 + 0.5; z < map.depth / 2; z += 0.5) {
    const point = { x, z }; if (isWalkable(point, map, 0.4)) points.set(keyOf(point), point);
  }
  for (const [key, p] of points) neighbors.set(key, [{ x: p.x + 0.5, z: p.z }, { x: p.x - 0.5, z: p.z }, { x: p.x, z: p.z + 0.5 }, { x: p.x, z: p.z - 0.5 }].map(keyOf).filter(k => points.has(k)));
  const grid = { points, neighbors }; grids.set(map, grid); return grid;
}
export function findPath(start: Point, end: Point, map: OfficeMap): Point[] {
  const grid = gridFor(map);
  const closest = (p: Point) => [...grid.points].reduce<[string, number]>((best, [key, point]) => { const d = distance(p, point); return d < best[1] ? [key, d] : best; }, ['', Infinity])[0];
  const source = grid.points.has(keyOf(start)) ? keyOf(start) : closest(start);
  const target = grid.points.has(keyOf(end)) ? keyOf(end) : closest(end);
  if (!source || !target) return [];
  const open = new Set([source]), from = new Map<string, string>(), costs = new Map([[source, 0]]);
  const heuristic = (key: string) => distance(grid.points.get(key)!, grid.points.get(target)!);
  while (open.size) {
    let current = '', best = Infinity;
    for (const key of open) { const score = costs.get(key)! + heuristic(key); if (score < best) { current = key; best = score; } }
    if (current === target) {
      const path = [grid.points.get(current)!];
      while (from.has(current)) { current = from.get(current)!; path.unshift(grid.points.get(current)!); }
      return path;
    }
    open.delete(current);
    for (const neighbor of grid.neighbors.get(current) ?? []) {
      const cost = costs.get(current)! + 0.5;
      if (cost >= (costs.get(neighbor) ?? Infinity)) continue;
      costs.set(neighbor, cost); from.set(neighbor, current); open.add(neighbor);
    }
  }
  return [];
}
