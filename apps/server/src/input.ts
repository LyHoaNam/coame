import { inputSchema } from '@ga-com/protocol';
import type { z } from 'zod';
export type InputFrame = z.infer<typeof inputSchema>;
export class TokenBucket {
  private tokens: number;
  private at: number;
  constructor(private burst: number, private refill: number, now: number) { this.tokens = burst; this.at = now; }
  take(now: number) { this.tokens = Math.min(this.burst, this.tokens + Math.max(0, now - this.at) / 1000 * this.refill); this.at = now; if (this.tokens < 1) return false; this.tokens--; return true; }
}
export class InputQueue {
  private pending: { input: InputFrame; at: number }[] = [];
  private receivedSeq = -1;
  handledSeq = -1;
  readonly rate: TokenBucket;
  constructor(now: number) { this.rate = new TokenBucket(60, 45, now); }
  push(value: unknown, now: number) {
    if (!this.rate.take(now)) throw new Error('RATE_LIMITED');
    if (JSON.stringify(value).length > 1024) throw new Error('INVALID_PAYLOAD');
    const parsed = inputSchema.safeParse(value);
    if (!parsed.success) throw new Error('INVALID_PAYLOAD');
    if (parsed.data.seq <= this.receivedSeq) return;
    this.receivedSeq = parsed.data.seq;
    if (this.pending.length === 8) this.handledSeq = this.pending.shift()!.input.seq;
    this.pending.push({ input: parsed.data, at: now });
  }
  next(now: number) {
    while (this.pending.length) {
      const frame = this.pending.shift()!; this.handledSeq = frame.input.seq;
      if (now - frame.at <= 250) return frame.input;
    }
    return undefined;
  }
  clear() { if (this.pending.length) this.handledSeq = this.pending.at(-1)!.input.seq; this.pending = []; }
}
