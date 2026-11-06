import type { Body, OfficeMap, Point } from './movement.js';
export interface Profile { displayName: string; color: number; hair: number; accessory: number }
export interface RosterEntry extends Profile { playerId: string }
export interface Food { id: string; name: string; icon: string }
export interface MatchConfig { durationSeconds: number; foods: Food[] }
export const DEFAULT_CONFIG: MatchConfig = { durationSeconds: 180, foods: [{ id: 'pizza', name: 'Pizza', icon: 'pizza' }, { id: 'bunbo', name: 'Bún bò', icon: 'bowl' }, { id: 'sushi', name: 'Sushi', icon: 'rice' }] };
export interface Score { playerId: string; foodId: string; count: number; reachedEventSeq: number }
export interface Participant extends RosterEntry, Body {
  matchJoinOrder: number; hp: number; respawnAt: number; protectedUntil: number; nextAttackAt: number; lastAttackSeq: number;
  knockX: number; knockZ: number; knockUntil: number;
}
export interface Item extends Body { itemId: number; foodId: string; announcedAt: number; landedAt: number; expiresAt: number }
export interface Npc extends Body { npcId: string; mode: 'patrol' | 'chase' | 'windup'; targetId: string; hitAt: number; nextAttackAt: number; repathAt: number; patrolIndex: number; path: Point[]; knockX: number; knockZ: number; knockUntil: number }
export interface MatchResult { resultId: string; matchId: string; winner: Score | null; scores: Score[]; roster: RosterEntry[]; foods: Food[] }
export interface DomainEvent { matchId: string; eventSeq: number; type: 'pickup' | 'attack' | 'hit' | 'knockout' | 'respawn' | 'match-ended'; entityId: string; at: number }
export interface Match {
  matchId: string; config: MatchConfig; roster: RosterEntry[]; map: OfficeMap; tick: number; startAt: number; endAt: number; nextSpawnAt: number;
  players: Participant[]; npcs: Npc[]; items: Item[]; scores: Score[]; result: MatchResult | null; events: DomainEvent[];
  randomState: number; nextItemId: number; nextEventSeq: number; skippedSpawns: number;
}
export interface PlayerInput { moveX: number; moveZ: number; aimYaw: number; attackSeq: number }
export const BALANCE = { speed: 4, radius: 0.35, hp: 100, playerDamage: 20, playerCooldownMs: 600, attackRange: 1.4, attackHalfAngle: Math.PI / 4, knockDistance: 0.5, knockMs: 150, respawnMs: 8000, protectionMs: 3000, pickupRadius: 0.6, spawnMs: 3000, warningMs: 1500, itemLifetimeMs: 15000 } as const;
