# Hợp đồng kết nối và đồng bộ

Ngày chốt: 2026-11-06. Các mặc định chi tiết được chọn theo Q33; chưa phải API đã hiện thực. Kiến trúc và luật tham chiếu tại [technical-spec.md](./technical-spec.md), [game-spec.md](./game-spec.md).

## 1. Transport và phiên bản

HTTP phục vụ client và thao tác tạo/join phòng, WebSocket qua cùng origin cho gameplay. Client lấy location.origin; dev dùng proxy tới server. Lan chạy bản build qua HTTP/WS; khi triển khai HTTPS sau này, suy ra WSS theo scheme.

Handshake có protocolVersion, buildVersion, mapVersion. Protocol/map không tương thích trả VERSION_MISMATCH và yêu cầu tải lại; không cố giải mã schema khác phiên bản. Mỗi connection có connectionGeneration, mỗi match có matchId; lệnh trận cũ/tab cũ bị từ chối. Thông tin version không là cơ chế xác thực.

## 2. Join và identity

1. Tạo phòng nhận roomId, mã mời, playerId và room-scoped reconnect secret qua kênh riêng.
2. Join kiểm tra mã, schema, tên/ngoại hình, capacity và reconnect secret nếu có. Định danh được server cấp, không nhận playerId tự khai làm bằng chứng.
3. Reconnect secret dùng giá trị ngẫu nhiên mật mã tối thiểu 128 bit, tồn tại tới khi room đóng. Lưu localStorage theo origin và roomId; không đặt trong URL, schema public hoặc log.
4. Dùng secret hợp lệ để rebind vào người cũ; chỗ và phase vẫn kiểm tra theo luật đã chốt. Hết chỗ ngoài trận không biến secret thành quyền chiếm chỗ.
5. Tăng connectionGeneration trước khi ngắt tab cũ. Mỗi callback/message kiểm tra generation; callback close của tab cũ không làm tab mới offline. Tab bị thay hiện SESSION_REPLACED và ngừng reconnect tự động.
6. Token reconnect Colyseus chỉ phục vụ transport, không thay secret ổn định của ứng dụng. Cập nhật token khi framework rotate; khi reservation hết hạn, join có xác thực secret để rebind người cũ. Refresh phải đăng ký lại listener.

Colyseus có autoDispose/reserved seat riêng; adapter đặt autoDispose=false, maxClients=8, quản lý số chỗ ứng dụng và dọn reservation theo lifecycle. Các đường join/rebind phải được serialize, không tạo hai member cho một secret hoặc đếm chỗ hai lần. Framework có thể yêu cầu giải phóng/tiếp quản transport cũ trước khi nhận socket mới khi đã đủ maxClients; kiểm thử tiếp quản tab lúc đủ 8 người là điều kiện bắt buộc.

Reconnect retry dùng backoff 0,5 → 1 → 2 → tối đa 5 giây có jitter; dừng khi bị thay phiên, room đóng, server instance đổi hoặc lỗi vĩnh viễn. UI giữ màn hình reconnect, không reset entity cục bộ như người mới. Không tự tạo phòng thay cho phòng mất. Các timeout dựa trên server; client timeout không chốt kết quả.

Cơ sở: [Colyseus room reference](https://docs.colyseus.io/room), [reconnection](https://docs.colyseus.io/room/reconnection). Việc tách stable secret và rebind là thiết kế ứng dụng để đáp ứng yêu cầu của project, không phải bảo đảm có sẵn từ transport token.

## 3. Lệnh quản lý phòng

Tên trong bảng là hợp đồng logic; adapter ánh xạ vào route/message framework ở mốc nền tảng.

| Lệnh | Dữ liệu chính | Điều kiện |
| --- | --- | --- |
| createRoom | protocolVersion, displayName, appearance | Còn room capacity; server cấp ID/mã/secret |
| joinRoom | roomCode, profile hoặc reconnect credential | Còn chỗ hoặc trở lại chỗ đã giữ; nhận role theo phase |
| updateProfile | requestId, displayName, appearanceIds | Chỉ ở sảnh; tên sau trim không trống, tối đa 24 ký tự Unicode |
| configureMatch | requestId, durationSeconds, foods | Chủ phòng ở sảnh, 60–600 giây, 2–8 món hợp lệ |
| startMatch | requestId | Chủ phòng ở sảnh, ít nhất 2 người online; serialize roster/config snapshot |
| returnToLobby | requestId | Chủ phòng ở kết quả; không chạy trong trận |
| leaveRoom | requestId | Dừng input; chỗ xử lý theo phase, không xóa kết quả |

Các lệnh trong phòng có requestId được dedupe trong bộ nhớ giới hạn 128 request gần nhất mỗi người; gửi lại startMatch/returnToLobby không bắt đầu hoặc reset trận hai lần. Trả ack hoặc error có cùng requestId. Tên món normalize Unicode NFC, trim, so trùng không phân biệt hoa thường, tối đa 30 ký tự Unicode. Không bỏ dấu tiếng Việt khi so trùng. Tên trùng người chơi được server thêm hậu tố số phân biệt; render mọi tên bằng text, không HTML. Các ID ngoại hình/icon thuộc allowlist asset manifest, không phải URL do người dùng cấp.

## 4. Input gameplay

Một frame intent mỗi fixed step 30 Hz, kể cả khi đứng yên; không gửi theo render FPS. Payload logic:

```ts
type InputFrame = {
  matchId: string;
  seq: number;             // nguyên, tăng dần trong connection epoch
  clientTick: number;      // dùng căn lịch input; không cấp quyền thời gian
  moveX: number;           // hữu hạn, [-1, 1]
  moveZ: number;           // hữu hạn, [-1, 1]
  aimYaw: number;          // hữu hạn, normalize theo radian
  attackSeq: number;       // tăng khi click; dùng chống xử lý click trùng
};
```

Không có position, velocity, HP, damage, score hoặc client dt trong payload được chấp nhận. Server chuẩn hóa movement, kiểm tra role, generation, matchId, cooldown và trạng thái. attackSeq lặp lại không tạo thêm đòn; command bị từ chối do cooldown không được lưu chờ để tự đánh khi cooldown hết. Chỉ dự đoán movement; sát thương và kết quả nhặt chờ server.

Input có seq trùng/cũ bị bỏ. Queue đầu vào giới hạn 8 frame; frame không được phép tích lũy rồi làm nhân vật di chuyển nhiều bước hơn số tick server. Dùng scheduling/input API fixed timestep Colyseus thay vì tự chạy một bước cho mỗi message. Giữ mapping giữa clientTick, tick server và frame được áp dụng; ack phải phản ánh frame được xử lý hoặc loại bỏ, không chỉ frame đã nhận.

Nếu input cũ quá 250 ms, dừng movement và không tái diễn click cũ. Khi mất focus/visibility, client gửi neutral input và dừng phát lệnh đánh; client vẫn duy trì kết nối nếu trình duyệt cho phép. Server heartbeat/ping kiểm tra liveness độc lập với chuyển động, ngưỡng khởi điểm khoảng 10 giây. Khi lấy lại focus, lấy baseline mới và gửi trạng thái phím hiện tại, không phát lại một chuỗi phím bị giữ trong tab nền.

## 5. Snapshot và sự kiện

| Kênh | Nội dung |
| --- | --- |
| Full state | Khi join/reconnect: room phase, config, roster/chỗ, participant, NPC, item, server time và result |
| State patch 20 Hz | Thay đổi dữ liệu authoritative; tick, serverTimeMs, endAt, public entity state |
| Private input ack | connection epoch, matchId, tick/input baseline, lastHandledInputSeq và trạng thái nhân vật tại baseline |
| Event | matchId + eventSeq + eventType + entity IDs + thời điểm/vị trí cần cho animation/SFX |
| Command ack/error | requestId, code và dữ liệu cần UI khôi phục |

Public schema giữ HP, vị trí, hướng, state/deadline, score và item status. Kết quả đáng tin nằm trong state, không chỉ trong message thoáng qua. Các sự kiện attack/hit/knockout/respawn/pickup/match-ended dùng ID để client dedupe trong bộ đệm hữu hạn. Không giả định patch chứa mọi giá trị trung gian: đánh và hồi sinh giữa hai patch vẫn cần event để thể hiện đúng. Reconnect nhận current state, không replay SFX cũ.

Snapshot không chứa input queue, reconnect secret hoặc seed server. Nếu dùng decoder nén GLB, tất cả decoder file cũng phục vụ local. WebSocket transport có thứ tự nhưng state patch và event vẫn cần match/epoch để loại dữ liệu cũ sau reset.

## 6. Prediction và reconciliation

Ưu tiên Colyseus 0.18 fixed input/Predict primitives, bọc sau network adapter; game-core vẫn giữ movement function thuần. Kiểm chứng client/server cùng dt và collision map trước khi thêm combat/NPC. Không tái hiện damage, score, item consumption hoặc SFX trong bước replay movement.

Client lưu frame đã gửi chưa được server xử lý; nhận baseline authoritative thì khôi phục body, bỏ frame đã xử lý/loại và replay phần còn hợp lệ theo mapping tick. Không coi seq là thời lượng hoặc coalesce frame rồi replay với dt khác server. Bộ đệm tối đa 120 frame; quá giới hạn, reconnect hoặc lệch epoch thì bỏ prediction cũ và lấy lại baseline.

Body logic hiệu chỉnh ngay. Độ lệch hiển thị nhỏ được làm mượt trong khoảng 100 ms, lệch trên 1 m hoặc teleport/respawn thì snap và xóa visual offset. Render correction không sửa vị trí dùng cho gameplay. Các ngưỡng này là mặc định kỹ thuật có thể chỉnh sau đo.

Người khác/NPC nội suy với buffer khởi điểm 100 ms, giữ tối đa 1 giây snapshot. Khi thiếu mẫu, extrapolate movement tối đa 100 ms rồi giữ vị trí và hiện kết nối không ổn định; không tự phán đoán score hoặc hit. Sau reconnect lấy full state và xây lại buffer. Đồng hồ HUD dùng ước lượng offset từ mẫu ping/serverTime; kết quả vẫn đợi phase/results server.

Không dùng rewind/lag compensation cho combat bản đầu. Aim/range xét tại server hiện tại; client có thể thấy swing nhưng không gây damage khi mục tiêu đã ra khỏi tầm. Đây là trade-off đã xác nhận Q30.

## 7. Validation, giới hạn và lỗi

Mặc định Q33: input payload tối đa 1 KiB, command quản lý phòng tối đa 8 KiB, giới hạn aggregate từng socket trước giải mã sâu. Input trung bình 30 frame/s, cho phép burst ngắn bằng token bucket 60 token và refill 45/s; room command 5/s burst 10. Schema chặn NaN/Infinity, số ngoài miền, chuỗi quá dài và message không biết. Sau 3 payload malformed trong 10 giây có thể đóng kết nối; một lần bị rate limit hợp lệ trả lỗi và không làm sai state. Giới hạn create/join theo IP khởi điểm 60 request/phút, burst 80 để tránh cản 80 người chung NAT vào một lượt; đo lại trong thử tải.

| Code | Hành vi UI |
| --- | --- |
| ROOM_NOT_FOUND / ROOM_CLOSED | Báo phòng không còn; cho tạo/join phòng khác |
| ROOM_FULL / SERVER_FULL | Báo hết chỗ, không tự chiếm chỗ hoặc tạo phòng |
| UNAUTHORIZED / SESSION_REPLACED | Dừng lệnh/retry; hiển thị lý do |
| NOT_HOST / INVALID_PHASE | Đồng bộ lại controls/phase từ server |
| INVALID_PAYLOAD / RATE_LIMITED | Báo thao tác không hợp lệ hoặc chờ thử lại |
| VERSION_MISMATCH | Đề nghị tải lại bản client; giữ thông báo lỗi nếu vẫn lệch |
| SERVER_SHUTDOWN | Dừng input, báo server đã dừng; không tự công nhận thắng |

Các thông số giới hạn là cấu hình, không được làm sai luật reconnect hoặc ngắt người chơi chỉ vì chuyển tab. Health/log cung cấp đủ roomId, matchId và reason để điều tra, không đưa credential vào thông báo hoặc log.
