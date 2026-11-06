import { BALANCE, type DomainEvent, type Match, type Participant, type PlayerInput } from './model.js';
import { distance, lineClear, moveBy, type Body } from './movement.js';
import { npcHits } from './npc.js';
export function emit(match: Match, type: DomainEvent['type'], entityId: string, at: number) {
  match.events.push({ matchId: match.matchId, eventSeq: match.nextEventSeq++, type, entityId, at });
}
export function inAttackArc(attacker: Body, target: Body, match: Match) {
  const length = distance(attacker, target);
  const dot = length < 1e-8 ? 1 : ((target.x - attacker.x) * Math.sin(attacker.yaw) + (target.z - attacker.z) * Math.cos(attacker.yaw)) / length;
  return length <= BALANCE.attackRange && dot >= Math.cos(BALANCE.attackHalfAngle) - 1e-10 && lineClear(attacker, target, match.map);
}
export function advancePlayerDeadlines(match: Match, dt: number, now: number) {
  for (const player of match.players) {
    if (player.hp === 0 && player.respawnAt <= now) {
      const others = [...match.players.filter(p => p.playerId !== player.playerId), ...match.npcs];
      const ranked = match.map.spawnPoints.map((p, index) => ({ p, index, distance: Math.min(...others.map(other => distance(p, other))) })).sort((a, b) => b.distance - a.distance || a.index - b.index);
      Object.assign(player, ranked[0]!.p, { hp: BALANCE.hp, protectedUntil: player.respawnAt + BALANCE.protectionMs, respawnAt: 0, knockUntil: 0 });
      emit(match, 'respawn', player.playerId, now);
    }
    if (player.hp > 0 && player.knockUntil > now) Object.assign(player, moveBy(player, player.knockX * dt, player.knockZ * dt, match.map));
  }
}
export interface Hit { attacker: Body; target: Participant; damage: number }
export function applyHits(match: Match, hits: Hit[], now: number) {
  for (const { attacker, target, damage } of hits) {
    target.hp = Math.max(0, target.hp - damage);
    const dx = target.x - attacker.x, dz = target.z - attacker.z, length = Math.hypot(dx, dz) || 1;
    target.knockX = dx / length * BALANCE.knockDistance / (BALANCE.knockMs / 1000);
    target.knockZ = dz / length * BALANCE.knockDistance / (BALANCE.knockMs / 1000);
    target.knockUntil = now + BALANCE.knockMs;
    emit(match, 'hit', target.playerId, now);
  }
  for (const player of match.players) if (player.hp === 0 && player.respawnAt === 0) {
    player.respawnAt = now + BALANCE.respawnMs; player.protectedUntil = 0;
    emit(match, 'knockout', player.playerId, now);
  }
}
export function combat(match: Match, inputs: Record<string, PlayerInput>, now: number) {
  const attackers: Participant[] = [];
  for (const player of match.players) {
    const input = inputs[player.playerId];
    if (!input || input.attackSeq <= player.lastAttackSeq) continue;
    player.lastAttackSeq = input.attackSeq; // A rejected click never queues for later.
    if (player.hp === 0 || player.nextAttackAt > now) continue;
    player.protectedUntil = 0; player.nextAttackAt = now + BALANCE.playerCooldownMs;
    attackers.push(player); emit(match, 'attack', player.playerId, now);
  }
  const hits: Hit[] = npcHits(match, now);
  for (const attacker of attackers) {
    const candidates = [...match.players.filter(p => p !== attacker && p.hp > 0 && p.protectedUntil <= now), ...match.npcs];
    const id = (p: typeof candidates[number]) => 'playerId' in p ? p.playerId : p.npcId;
    const target = candidates.filter(p => inAttackArc(attacker, p, match)).sort((a, b) => distance(attacker, a) - distance(attacker, b) || id(a).localeCompare(id(b)))[0];
    if (target && 'playerId' in target) hits.push({ attacker, target, damage: BALANCE.playerDamage });
    else if (target) {
      const dx = target.x - attacker.x, dz = target.z - attacker.z, length = Math.hypot(dx, dz) || 1;
      target.knockX = dx / length * BALANCE.knockDistance / (BALANCE.knockMs / 1000); target.knockZ = dz / length * BALANCE.knockDistance / (BALANCE.knockMs / 1000); target.knockUntil = now + BALANCE.knockMs;
    }
  }
  applyHits(match, hits, now);
}
