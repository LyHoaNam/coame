import { OFFICE_MAP, stepMovement, type Body, type PlayerInput } from '@ga-com/game-core';
import type { InputAck } from '@ga-com/protocol';
export class MovementPrediction {
  body: Body | null = null;
  private pending: { seq: number; input: PlayerInput }[] = [];
  private lastAck = -1;
  reset(body?: Body) { this.body = body ? { ...body } : null; this.pending = []; this.lastAck = -1; }
  send(seq: number, input: PlayerInput, alive: boolean) {
    if (!this.body || !alive) return;
    if (this.pending.length >= 120) { this.pending = []; return; }
    this.pending.push({ seq, input: { ...input } });
    this.body = stepMovement(this.body, input, OFFICE_MAP, 1 / 30);
  }
  acknowledge(ack: InputAck) {
    if (ack.tick < this.lastAck) return;
    this.lastAck = ack.tick; this.pending = this.pending.filter(frame => frame.seq > ack.seq);
    this.body = { x: ack.x, z: ack.z, yaw: ack.yaw };
    if (ack.hp === 0) { this.pending = []; return; }
    for (const frame of this.pending) this.body = stepMovement(this.body, frame.input, OFFICE_MAP, 1 / 30);
  }
}
