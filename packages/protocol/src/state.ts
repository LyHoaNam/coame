import { schema, t, type SchemaType } from '@colyseus/schema';
import type { MatchConfig, MatchResult, RosterEntry, Score } from '@ga-com/game-core';
export interface PublicMember extends RosterEntry { connected: boolean; joinedOrder: number; role: 'participant' | 'waiter' }
export interface RoomInfo { members: PublicMember[]; config: MatchConfig; scores: Score[]; result: MatchResult | null }
export const PlayerState = schema({
  playerId: t.string().default(''), x: t.number().default(0), z: t.number().default(0), yaw: t.number().default(0), hp: t.number().default(100),
  respawnAt: t.number().default(0), protectedUntil: t.number().default(0), color: t.number().default(0), hair: t.number().default(0), accessory: t.number().default(0),
});
export type PlayerState = SchemaType<typeof PlayerState>;
export const ItemState = schema({ itemId: t.number().default(0), foodId: t.string().default(''), x: t.number().default(0), z: t.number().default(0), landedAt: t.number().default(0), expiresAt: t.number().default(0) });
export const NpcState = schema({ npcId: t.string().default(''), x: t.number().default(0), z: t.number().default(0), yaw: t.number().default(0), mode: t.string().default('patrol'), hitAt: t.number().default(0) });
export const PublicRoomState = schema({
  phase: t.string().default('lobby'), connections: t.number().default(0), serverTimeMs: t.number().default(0),
  code: t.string().default(''), hostPlayerId: t.string().default(''), matchId: t.string().default(''), tick: t.number().default(0), endAt: t.number().default(0),
  info: t.string().default(''), players: t.map(PlayerState), items: t.map(ItemState), npcs: t.map(NpcState),
});
export type PublicRoomState = SchemaType<typeof PublicRoomState>;
export interface Credential { playerId: string; secret: string; generation: number }
export interface InputAck { generation: number; matchId: string; tick: number; seq: number; x: number; z: number; yaw: number; hp: number; serverTimeMs: number }
