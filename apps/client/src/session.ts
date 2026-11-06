import { Client, type Room } from '@colyseus/sdk';
import { BUILD_VERSION, MAP_VERSION, PROTOCOL_VERSION, PublicRoomState, type Credential, type RoomCommand } from '@ga-com/protocol';
import type { Profile } from '@ga-com/game-core';
export const errorText: Record<string, string> = {
  ROOM_NOT_FOUND: 'Phòng không còn tồn tại. Máy chủ có thể đã khởi động lại.', ROOM_CLOSED: 'Phòng đã đóng.', ROOM_FULL: 'Phòng đã đủ 8 chỗ.', SERVER_FULL: 'Máy chủ đã đủ 10 phòng.', UNAUTHORIZED: 'Không thể xác thực phiên này.', SESSION_REPLACED: 'Tab mới đã tiếp quản. Tab này đã dừng điều khiển.', NOT_HOST: 'Chỉ chủ phòng được thực hiện thao tác này.', INVALID_PHASE: 'Thao tác không phù hợp với trạng thái phòng.', INVALID_PAYLOAD: 'Thông tin chưa hợp lệ. Hãy kiểm tra lại.', RATE_LIMITED: 'Thao tác quá nhanh. Hãy thử lại sau.', VERSION_MISMATCH: 'Phiên bản không tương thích. Hãy tải lại trang.', SERVER_SHUTDOWN: 'Máy chủ đã dừng.', NEED_PLAYERS: 'Cần ít nhất 2 người online để bắt đầu.',
};
interface SavedRoom { credential: Credential; instanceId: string; roomId: string }
export class GameSession {
  room: Room<PublicRoomState> | null = null;
  credential: Credential | null = null;
  code = '';
  status = 'idle';
  error = '';
  private instanceId = '';
  private stopped = false;
  private retryTimer: ReturnType<typeof setTimeout> | undefined;
  private retryCount = 0;
  private profile!: Profile;
  onChange: () => void = () => undefined;
  private client = new Client(location.origin);
  async connect(profile: Profile, code?: string) {
    this.stopped = false; this.profile = profile; this.status = 'connecting'; this.error = ''; this.onChange();
    try {
      let saved: SavedRoom | undefined;
      if (code) { try { saved = JSON.parse(localStorage.getItem(`ga-com:${code}`) ?? 'null') ?? undefined; } catch { /* Ignore corrupt local storage. */ } }
      const response = await fetch(`/api/rooms${code ? `/${encodeURIComponent(code)}/join` : ''}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ protocolVersion: PROTOCOL_VERSION, buildVersion: BUILD_VERSION, mapVersion: MAP_VERSION, profile, secret: saved?.credential.secret }) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.code);
      this.credential = payload.credential; this.instanceId = payload.instanceId; this.code = payload.code;
      localStorage.setItem(`ga-com:${this.code}`, JSON.stringify({ credential: this.credential, instanceId: this.instanceId, roomId: payload.reservation.room.roomId }));
      const room = await this.client.consumeSeatReservation<PublicRoomState>(payload.reservation, PublicRoomState);
      if (this.stopped) { await room.leave(); return; }
      this.bind(room); history.replaceState(null, '', `/room/${this.code}`);
    } catch (error) { this.error = error instanceof Error ? error.message : 'CONNECTION_FAILED'; this.status = 'error'; this.onChange(); throw error; }
  }
  command(command: Omit<Extract<RoomCommand, { type: 'updateProfile' }>, 'requestId' | 'generation'> | Omit<Extract<RoomCommand, { type: 'configureMatch' }>, 'requestId' | 'generation'> | { type: 'startMatch' | 'returnToLobby' | 'leaveRoom' }) {
    if (this.status !== 'connected' || !this.credential) return;
    this.room?.send('command', { ...command, requestId: crypto.randomUUID(), generation: this.credential.generation });
  }
  leave() { this.command({ type: 'leaveRoom' }); this.dispose(); history.replaceState(null, '', '/'); }
  dispose() { this.stopped = true; clearTimeout(this.retryTimer); const old = this.room; this.room = null; old?.removeAllListeners(); void old?.leave(); this.status = 'idle'; this.onChange(); }
  private bind(room: Room<PublicRoomState>) {
    this.room?.removeAllListeners(); this.room = room;
    room.reconnection.enabled = false;
    this.status = 'connected'; this.error = ''; this.retryCount = 0;
    room.onStateChange(() => this.onChange());
    room.onMessage('identity', (credential: Credential) => { this.credential = credential; this.onChange(); });
    room.onMessage('ack', () => undefined);
    room.onMessage('inputAck', () => undefined);
    room.onMessage('event', () => undefined);
    room.onMessage('error', ({ code }: { code: string }) => {
      this.error = code;
      if (['SESSION_REPLACED', 'ROOM_CLOSED', 'SERVER_SHUTDOWN', 'UNAUTHORIZED'].includes(code)) { this.stopped = true; this.status = 'error'; clearTimeout(this.retryTimer); }
      this.onChange();
    });
    room.onLeave(code => {
      if (this.stopped || code === 4000 || code === 4001 || code === 4002) { if (code === 4001) { this.error = 'SESSION_REPLACED'; this.status = 'error'; this.onChange(); } return; }
      this.status = 'reconnecting'; this.onChange(); this.scheduleRetry(room.reconnectionToken);
    });
    this.onChange();
  }
  private scheduleRetry(token: string) {
    const delay = Math.min(5000, 500 * 2 ** this.retryCount++) * (0.85 + Math.random() * 0.3);
    this.retryTimer = setTimeout(() => { void this.retry(token); }, delay);
  }
  private async retry(token: string) {
    if (this.stopped) return;
    try {
      const health = await fetch('/health', { signal: AbortSignal.timeout(5000) }).then(r => r.json());
      if (health.instanceId !== this.instanceId) { this.stopped = true; this.error = 'ROOM_NOT_FOUND'; this.status = 'error'; this.onChange(); return; }
      try { const room = await this.client.reconnect<PublicRoomState>(token, PublicRoomState); if (this.stopped) { await room.leave(); return; } this.bind(room); }
      catch { await this.connect(this.profile, this.code); }
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      if (['ROOM_NOT_FOUND', 'ROOM_CLOSED', 'UNAUTHORIZED', 'ROOM_FULL', 'VERSION_MISMATCH'].includes(code)) { this.stopped = true; this.error = code; this.status = 'error'; this.onChange(); return; }
      if (!this.stopped) { this.status = 'reconnecting'; this.onChange(); this.scheduleRetry(token); }
    }
  }
}
