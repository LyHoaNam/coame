# Kế hoạch triển khai

Ngày chốt: 2026-11-06. Thiết kế đã được xác nhận qua Q1–Q33. Hiện repo chỉ có tài liệu và ảnh tham chiếu; chưa có mã nguồn, manifest, lockfile hoặc lệnh chạy game.

## Cơ sở

- [Luật sản phẩm](./game-spec.md).
- [Kiến trúc, stack và thông số](./technical-spec.md).
- [Hợp đồng kết nối](./network-protocol.md).
- [Kế hoạch kiểm chứng và nghiệm thu](./validation-plan.md).
- [Thuật ngữ](../GLOSSARY.md), [giới hạn phục hồi](./adr/0001-no-match-recovery.md), [ranh giới core](./adr/0002-game-core-boundary.md).

Các tài liệu trên là nguồn quyết định; kế hoạch này chỉ mô tả thứ tự công việc và điều kiện kết thúc. Không coi một mốc đạt chỉ vì đã tạo file hoặc UI hiển thị được.

## Mốc 1 — Workspace và một kết nối LAN thật

Khởi tạo npm workspaces với apps/client, apps/server, packages/game-core và packages/protocol. Baseline Node 24 LTS, Colyseus 0.18; chọn stable dependency tương thích, kiểm tra engines/peer dependencies và khóa phiên bản. Tạo TypeScript strict, ESLint, Prettier, Vitest, Playwright cùng bộ lệnh dev/build/start/typecheck/lint/test/test:e2e. Tạo hướng dẫn cài đặt đúng với scripts thực tế.

Dựng React shell, Three.js canvas tối giản và server phục vụ bản build/WS cùng origin. Dev proxy riêng. GET /health và log build/protocol version; client suy ra endpoint từ origin, không hardcode localhost. Smoke test serialize/schema của SDK server/client đã cài.

Hoàn thành khi build sạch, một máy khác trong LAN mở được trang và kết nối WebSocket tới máy host, không tải CDN hoặc font bên ngoài. Ghi cấu hình máy, trình duyệt, IP/port sử dụng và bằng chứng kết nối; kiểm tra offline internet chỉ sau khi dependency/build đã sẵn sàng. Nếu mạng công ty chặn truy cập, ghi lỗi cụ thể và giữ mốc chưa đạt LAN.

## Mốc 2 — Identity, phòng và vòng đời

Tạo/join bằng link/mã, profile, 8 chỗ, 10 phòng, host và ba phase. Tách stable player identity khỏi framework session; secret theo phòng, connection generation, chống tab cũ ngắt tab mới. Tắt autoDispose của framework, quản lý phòng trống 5 phút, grace ngoài trận 60 giây và chỗ roster trong trận.

Hiện sảnh và quyền host. Có cả đường reconnect transport và đường authenticated rebind khi reservation hết hạn. Serialize join/start/leave và kiểm thử tiếp quản tab khi đủ 8 người. Chưa thêm database hoặc cloud.

Hoàn thành khi các ca V01–V05 trong validation-plan qua, đặc biệt đủ 8 chỗ, chủ phòng mất mạng, tab mới thay tab cũ, record người cũ còn nhưng không chiếm thêm chỗ. Có integration test kiểm tra thời hạn bằng clock có kiểm soát thay vì chờ thật nhiều phút.

## Mốc 3 — Movement và prediction nền tảng

Tạo định nghĩa văn phòng tối giản, collider, lưới đi được và spawn point chung. Implement stepMovement thuần, fixed input 30 Hz, state patch 20 Hz; prediction/reconciliation theo protocol. Không phụ thuộc model đẹp để chứng minh multiplayer.

Thêm input timeout, focus/visibility, UI không làm phát đòn vào canvas, đẩy body khỏi vật cản và smoothing hiển thị. Kiểm chứng ack/tick mapping trước khi mở rộng simulation. Tách server clock/deadline khỏi render FPS.

Hoàn thành khi hai client độc lập thấy nhau di chuyển, chạy chéo không tăng tốc, không xuyên bàn, không tăng tốc khi spam gói; ở RTT 100/200 ms vẫn hội tụ về cùng state. Tab nền dừng input trong giới hạn đã chốt, không gây replay dài hoặc tự chạy bù. Nếu prediction API không phù hợp, xử lý adapter và giữ cùng hợp đồng thay vì tắt prediction âm thầm.

## Mốc 4 — Một trận trọn vẹn có kết quả

Khóa roster/config khi start; spawn warning/landing/expiry, random seed server, pickup atomic, comparator theo cặp người–món và result bất biến. HUD có thời gian, bảng xếp hạng đúng luật và chi tiết món của bản thân. Người chờ có chế độ xem; có màn hình kết quả và returnToLobby.

Hoàn thành khi các ca scoring/spawn/deadline/reset qua; hai client tranh một item chỉ một người được điểm; hòa cùng tick được xử lý theo thứ tự đã chốt; kết quả người đã rời vẫn hợp lệ; không nhặt sau deadline. Chạy ít nhất ba trận liên tiếp, không còn item/event/timer cũ.

## Mốc 5 — Combat, NPC và hồi sinh

Combat theo hướng chuột, một mục tiêu gần nhất, kiểm tra vật cản/cooldown, gom đòn trước khi áp damage. Knockback, bất động, hồi sinh, bảo vệ và quyền nhặt theo thứ tự tick. NPC A* đi vòng nội thất, state machine với windup khóa hướng, giới hạn repath. Hồi sinh từ điểm bố trí trước, không hoãn quá thời gian chốt.

Hoàn thành khi các ca combat/NPC/respawn qua cả ở server integration và trình duyệt. Có ca cùng hạ nhau, đánh xuyên tường bị chặn, đẩy lùi vào tường, reconnect qua mốc hồi sinh và người đang bảo vệ chủ động đánh. NPC không bị kẹt đường đi trong map mẫu.

## Mốc 6 — Duyệt hình ảnh và hoàn thiện nội dung

Tìm asset đáp ứng phong cách tham chiếu và quyền sử dụng. Ghi attribution ngay khi đưa asset đầu tiên vào repo. Tạo một nhân vật GLB với các animation và một góc văn phòng, thử ở camera/gameplay size thật. Cung cấp preview để người dùng duyệt trước khi nhân rộng; quyết định duyệt mẫu đã được yêu cầu trong Q9, không thay bằng tự đánh giá của người triển khai.

Sau khi mẫu đạt, hoàn thiện một văn phòng, 8 màu, 3 kiểu tóc, 3 phụ kiện gồm không phụ kiện, NPC/food đồng nhất. Thêm occlusion fade, nhận diện bản thân, warning/hit/respawn effects, audio/mute, UI đầy đủ và preset low graphics. Dùng manifest để build/copy asset và decoder local; dọn GPU/audio/listener khi hủy game.

Hoàn thành khi mẫu được duyệt và toàn cảnh vẫn đạt tính đọc rõ ở kích thước chơi. Không dùng hộp/cầu placeholder để công bố hoàn thành phần hình ảnh. Kiểm tra nguồn/license và không còn tài nguyên internet bắt buộc lúc chơi.

## Mốc 7 — Nghiệm thu LAN và chơi thử

Chạy toàn bộ kiểm tra đã quy định ở validation-plan, không thêm bài kiểm tra chỉ để lặp lại implementation. Load 10 phòng × 8 client ít nhất 30 phút; dùng client headless có movement/attack/reconnect, không chỉ socket idle. Đo render riêng trên máy tham chiếu với phòng đầy; ghi RTT, tick time, CPU, RSS, băng thông và frame time. Báo số đợt spawn/catch-up bị bỏ nếu có, không che overload.

Chơi thử thực tế 2/4/8 người, ít nhất ba trận liên tiếp. Đánh giá tấn công người dẫn đầu, thời gian chờ hồi sinh, khả năng nhận diện món, NPC và giá trị chạy nhặt so với đánh. Điều chỉnh thông số chơi thử giữa các trận, ghi config/version và chạy lại các ca bị ảnh hưởng; không đổi luật đã chốt mà không nêu rõ.

Hoàn thành khi đủ bằng chứng chức năng, duyệt hình ảnh, LAN và hiệu năng; hướng dẫn cài/build/start/stop/troubleshoot khớp bản thực tế. Báo rõ ca chưa chạy hoặc chưa đạt. Không công bố sức chứa/FPS dựa chỉ trên spec hoặc bot test; hosting public là công việc riêng.

## Quản lý thay đổi khi triển khai

Chi tiết Q33 được chọn trong ràng buộc; cập nhật spec khi implementation làm rõ một interface hoặc thay baseline. Điều chỉnh budget/tần số/cân bằng dựa trên bằng chứng phải được ghi, phân biệt với thay luật. Giữ core không phụ thuộc rendering/transport và giữ result authoritative.

Mỗi mốc báo kết quả, bằng chứng liên quan và việc còn thiếu. Một dependency, asset hoặc bài đo chưa thực hiện là điều kiện kiểm chứng chưa đạt, không phải quyết định thiết kế đang chờ phỏng vấn thêm.
