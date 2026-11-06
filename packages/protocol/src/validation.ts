import { z } from 'zod';
const unicodeText = (max: number) => z.string().max(max * 4).transform(s => s.normalize('NFC').trim()).refine(s => [...s].length > 0 && [...s].length <= max);
export const profileSchema = z.object({ displayName: unicodeText(24), color: z.number().int().min(0).max(7), hair: z.number().int().min(0).max(2), accessory: z.number().int().min(0).max(2) }).strict();
export const configSchema = z.object({
  durationSeconds: z.number().int().min(60).max(600),
  foods: z.array(z.object({ id: z.string().regex(/^[a-zA-Z0-9_-]{1,32}$/), name: unicodeText(30), icon: z.enum(['pizza', 'bowl', 'rice', 'burger', 'noodles', 'salad', 'bread', 'drink']) }).strict()).min(2).max(8),
}).strict().refine(config => new Set(config.foods.map(f => f.name.toLocaleLowerCase('vi'))).size === config.foods.length && new Set(config.foods.map(f => f.id)).size === config.foods.length);
export const handshakeSchema = z.object({ protocolVersion: z.number().int(), buildVersion: z.string().max(64), mapVersion: z.string().max(64), profile: profileSchema, secret: z.string().regex(/^[a-f0-9]{64}$/).optional() }).strict();
const requestId = z.string().min(1).max(64);
const generation = z.number().int().positive();
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('updateProfile'), requestId, generation, profile: profileSchema }).strict(),
  z.object({ type: z.literal('configureMatch'), requestId, generation, config: configSchema }).strict(),
  z.object({ type: z.enum(['startMatch', 'returnToLobby', 'leaveRoom']), requestId, generation }).strict(),
]);
export type RoomCommand = z.infer<typeof commandSchema>;
export const inputSchema = z.object({ matchId: z.string().max(64), generation, seq: z.number().int().nonnegative().max(2147483647), clientTick: z.number().int().nonnegative().max(2147483647), moveX: z.number().min(-1).max(1), moveZ: z.number().min(-1).max(1), aimYaw: z.number().finite().min(-Math.PI).max(Math.PI), attackSeq: z.number().int().nonnegative().max(2147483647) });
