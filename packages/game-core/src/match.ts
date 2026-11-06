import { BALANCE, type Match, type MatchConfig, type PlayerInput, type RosterEntry } from './model.js';
import { distance, isWalkable, lineClear, stepMovement, type OfficeMap } from './movement.js';
import { finalizeMatch } from './scoring.js';
import { advancePlayerDeadlines, combat, emit } from './combat.js';
import { advanceNpcs, createNpcs } from './npc.js';

function random(match: Match): number {
  let x = match.randomState;
  x ^= x << 13; x ^= x >>> 17; x ^= x << 5;
  match.randomState = x >>> 0;
  return match.randomState / 4294967296;
}
function spawnItems(match: Match, at: number) {
  for (let i = 0; i < Math.ceil(match.roster.length / 2); i++) {
    let position = match.map.spawnPoints[0]!;
    for (let attempt = 0; attempt < 100; attempt++) {
      const candidate = { x: (random(match) - 0.5) * (match.map.width - 1), z: (random(match) - 0.5) * (match.map.depth - 1) };
      if (isWalkable(candidate, match.map, 0.5)) { position = candidate; break; }
    }
    const food = match.config.foods[Math.floor(random(match) * match.config.foods.length)]!;
    match.items.push({ ...position, yaw: 0, itemId: match.nextItemId++, foodId: food.id, announcedAt: at, landedAt: at + BALANCE.warningMs, expiresAt: at + BALANCE.warningMs + BALANCE.itemLifetimeMs });
  }
}
export function createMatch(config: MatchConfig, roster: RosterEntry[], map: OfficeMap, seed: number, nowMs: number, matchId: string): Match {
  const match: Match = {
    matchId, config: structuredClone(config), roster: structuredClone(roster), map, tick: 0, startAt: nowMs, endAt: nowMs + config.durationSeconds * 1000, nextSpawnAt: nowMs + BALANCE.spawnMs,
    players: roster.map((entry, index) => ({ ...entry, ...map.spawnPoints[index % map.spawnPoints.length]!, yaw: 0, matchJoinOrder: index, hp: BALANCE.hp, respawnAt: 0, protectedUntil: 0, nextAttackAt: 0, lastAttackSeq: 0, knockX: 0, knockZ: 0, knockUntil: 0 })),
    npcs: [], items: [], scores: [], result: null, events: [], randomState: seed >>> 0 || 1, nextItemId: 1, nextEventSeq: 1, skippedSpawns: 0,
  };
  match.npcs = createNpcs(match);
  spawnItems(match, nowMs);
  return match;
}
export function stepMatch(match: Match, inputs: Record<string, PlayerInput>, dt: number, nowMs: number): Match {
  match.events = [];
  if (match.result) return match;
  if (nowMs >= match.endAt) { finalizeMatch(match); emit(match, 'match-ended', match.matchId, nowMs); return match; }
  match.tick++;
  match.items = match.items.filter(item => item.expiresAt > nowMs);
  advancePlayerDeadlines(match, dt, nowMs);
  if (nowMs >= match.nextSpawnAt) {
    const skipped = Math.floor((nowMs - match.nextSpawnAt) / BALANCE.spawnMs);
    match.skippedSpawns += skipped;
    const at = match.nextSpawnAt + skipped * BALANCE.spawnMs;
    spawnItems(match, at); match.nextSpawnAt = at + BALANCE.spawnMs;
  }
  for (const player of match.players) {
    const input = inputs[player.playerId];
    if (input && player.hp > 0) Object.assign(player, stepMovement(player, input, match.map, dt));
  }
  advanceNpcs(match, dt, nowMs);
  combat(match, inputs, nowMs);
  for (const item of [...match.items]) {
    if (item.landedAt > nowMs) continue;
    const winner = match.players.filter(p => p.hp > 0 && distance(p, item) <= BALANCE.pickupRadius && lineClear(p, item, match.map))
      .sort((a, b) => distance(a, item) - distance(b, item) || a.matchJoinOrder - b.matchJoinOrder)[0];
    if (!winner) continue;
    const eventSeq = match.nextEventSeq++;
    let score = match.scores.find(s => s.playerId === winner.playerId && s.foodId === item.foodId);
    if (!score) { score = { playerId: winner.playerId, foodId: item.foodId, count: 0, reachedEventSeq: 0 }; match.scores.push(score); }
    score.count++; score.reachedEventSeq = eventSeq;
    match.events.push({ matchId: match.matchId, eventSeq, type: 'pickup', entityId: winner.playerId, at: nowMs });
    match.items = match.items.filter(other => other.itemId !== item.itemId);
  }
  return match;
}
