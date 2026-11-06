import type { Match, Npc } from './model.js';
import { distance, moveBy, stepMovement } from './movement.js';
import { findPath } from './navigation.js';
import { inAttackArc, type Hit } from './combat.js';

export function advanceNpcs(match: Match, dt: number, now: number) {
  for (const npc of match.npcs) {
    if (npc.knockUntil > now) Object.assign(npc, moveBy(npc, npc.knockX * dt, npc.knockZ * dt, match.map));
    if (npc.mode === 'windup') continue;
    const eligible = match.players.filter(p => p.hp > 0 && p.protectedUntil <= now);
    let target = eligible.find(p => p.playerId === npc.targetId && distance(npc, p) <= 9);
    target ??= eligible.filter(p => distance(npc, p) <= 6).sort((a, b) => distance(npc, a) - distance(npc, b) || a.matchJoinOrder - b.matchJoinOrder)[0];
    npc.targetId = target?.playerId ?? ''; npc.mode = target ? 'chase' : 'patrol';
    const destination = target ?? match.map.spawnPoints[npc.patrolIndex % match.map.spawnPoints.length]!;
    if (target) {
      npc.yaw = Math.atan2(target.x - npc.x, target.z - npc.z);
      if (npc.nextAttackAt <= now && inAttackArc(npc, target, match)) { npc.mode = 'windup'; npc.hitAt = now + 500; npc.path = []; continue; }
    } else if (distance(npc, destination) < 0.6) npc.patrolIndex++;
    if (npc.repathAt <= now) { npc.path = findPath(npc, destination, match.map); npc.repathAt = now + 250; }
    while (npc.path[0] && distance(npc, npc.path[0]) < 0.15) npc.path.shift();
    const next = npc.path[0];
    if (next) {
      const length = distance(npc, next);
      const moveX = (next.x - npc.x) / length, moveZ = (next.z - npc.z) / length;
      Object.assign(npc, stepMovement(npc, { moveX, moveZ, aimYaw: Math.atan2(moveX, moveZ) }, match.map, Math.min(dt, length / 3), 3));
    }
  }
}
export function npcHits(match: Match, now: number): Hit[] {
  const hits: Hit[] = [];
  for (const npc of match.npcs) {
    if (npc.mode !== 'windup' || npc.hitAt > now) continue;
    npc.mode = 'chase'; npc.nextAttackAt = now + 1000;
    const target = match.players.filter(p => p.hp > 0 && p.protectedUntil <= now && inAttackArc(npc, p, match)).sort((a, b) => distance(npc, a) - distance(npc, b) || a.matchJoinOrder - b.matchJoinOrder)[0];
    if (target) hits.push({ attacker: npc, target, damage: 7 });
  }
  return hits;
}
export function createNpcs(match: Match): Npc[] {
  return Array.from({ length: match.roster.length <= 4 ? 1 : 2 }, (_, i) => ({ npcId: `npc-${i}`, x: i ? 4 : -4, z: 0, yaw: 0, mode: 'patrol', targetId: '', hitAt: 0, nextAttackAt: 0, repathAt: match.startAt + i * 125, patrolIndex: i * 2, path: [], knockX: 0, knockZ: 0, knockUntil: 0 }));
}
