# Kế hoạch kiểm chứng và nghiệm thu

Ngày chốt: 2026-11-06. Trạng thái: kế hoạch; chưa chạy test hoặc đo game. Cơ sở: [spec sản phẩm](./game-spec.md), [spec kỹ thuật](./technical-spec.md), [protocol](./network-protocol.md).

## 1. Phân công loại bằng chứng

| Loại | Công cụ dự kiến | Chứng minh |
| --- | --- | --- |
| Luật thuần | Vitest, clock/RNG đưa từ ngoài | Tính điểm, thứ tự pha, geometry, deadline và tie-break |
| Tích hợp server | Vitest + server/SDK thật | Authority, lifecycle, schema, tranh chấp và cleanup |
| Trình duyệt | Playwright nhiều context/client độc lập | UI, kết nối, input, reconnect và nhất quán kết quả |
| Load server | 80 client headless có hành vi | CPU, tick time, RSS, băng thông và ổn định nhiều phòng |
| Máy client thật | Chrome/Edge profiler, frame metrics | FPS, GPU/render budget và đồng thời đủ 8 entity |
| Người chơi thật | Chơi thử 2/4/8 người | Chất lượng hình ảnh, dễ hiểu, cảm giác điều khiển và cân bằng |

Không thay bằng chứng nhiều người bằng bot vẽ trên cùng client. Không dùng load headless để kết luận FPS hoặc mức độ vui. Unit test lấy đầu vào/kết quả theo luật, không chỉ mirror hàm implementation. Dùng test clock để vượt mốc thời gian trong integration; heartbeat, visibility và thực mạng vẫn cần ca trình duyệt/LAN.

## 2. Ma trận chức năng

| ID | Tình huống | Kết quả bắt buộc | Loại chính |
| --- | --- | --- | --- |
| V01 | Tạo/join bằng code/link, tên trùng, cấu hình sai | Cùng phòng; tên phân biệt; món/thời lượng/role được kiểm tra server | Integration + browser |
| V02 | 8 roster có người offline, người thứ 9 join; 6 roster + 2 waiter | Không vượt 8 chỗ; reconnect dùng chỗ cũ; waiter không có entity | Integration |
| V03 | Reload, mất mạng, reconnect sau transport reservation hết hạn | Khôi phục player/HP/score/deadline bằng stable identity, không reset hình phạt | Integration + browser |
| V04 | Tab mới tiếp quản khi phòng đủ 8; callback close của tab cũ tới muộn | Chỉ một controller; tab cũ không retry tranh quyền, tab mới không bị offline | Integration + browser |
| V05 | Host rời, tất cả offline, reconnect khác thứ tự, room trống 5 phút | Chọn host theo luật; null khi không ai online; đóng đúng deadline; autoDispose không đóng sớm | Integration |
| V06 | Disconnect ở lobby/results, grace 60 giây, rời chủ động, start khi còn người offline | Giữ/giải phóng chỗ đúng phase; chỉ online vào roster mới, result cũ không đổi | Integration |
| V07 | Hai người cùng nhặt; nhiều item cùng tick; bằng khoảng cách | Một owner/item; nearest rồi matchJoinOrder; eventSeq ổn định theo item order | Core + integration |
| V08 | Cặp người–món thắng, hòa trong/giữa người, tổng điểm cao nhưng không thắng | Cùng comparator HUD/result; count rồi reachedEventSeq; không dùng tổng điểm | Core |
| V09 | 0 item, người đã rời có điểm cao nhất | Winner null hoặc người cũ đúng luật; không tự bốc thăm | Core + browser |
| V10 | Warning/landing/expiry, seed, reachable placement, số roster cố định | Đầu trận báo ngay; nhặt sau 1,5 s; hết hạn sau 15 s từ landing; không xuyên vật cản | Core + integration |
| V11 | Đúng deadline, input dồn sát cuối trận, returnToLobby gửi lặp | Chốt đúng một result; không damage/pickup thêm, command idempotent | Core + integration |
| V12 | WASD chéo, collision góc bàn, knockback vào tường, spam input | Không tăng tốc chéo/qua message count, không xuyên vật cản, nhân vật không chặn nhau | Core + browser |
| V13 | Hai đòn đủ hạ cùng tick, hạ trước pha nhặt | Có thể cùng hạ; người bị hạ không nhặt; không phụ thuộc callback order | Core + integration |
| V14 | Tầm/góc, target nearest, NPC cùng vùng, bàn che, spam click/cooldown | Tối đa một mục tiêu; không xuyên vật cản; không vượt sát thương/cooldown | Core + integration |
| V15 | Bất động 8 s, bảo vệ 3 s, chủ động đánh, item dưới chân | Miễn damage đúng pha; bất động không nhặt, bảo vệ được nhặt; đánh kết thúc bảo vệ | Core + integration |
| V16 | Tất cả spawn gần người khác/NPC, reconnect qua respawn deadline | Chọn điểm tốt nhất ngoài vật cản, không hoãn hồi sinh; không reset đồng hồ | Core + integration |
| V17 | NPC bị che, mục tiêu né windup, target bất động/bảo vệ, knockback | A* đi vòng, hướng khóa, miss khi ngoài tầm; không spam hit hoặc mất cooldown | Core + manual |
| V18 | RTT 100/200 ms, jitter, packet delay, mất focus, stale input, pause host | Hội tụ authoritative; dừng stale move; không replay vô hạn, không kéo dài deadline | Integration + browser |
| V19 | Input/command NaN, quá dài, role sai, trận cũ, generation cũ, rate limit | Bỏ/từ chối có lý do; không crash, không tự cấp điểm/quyền, không lộ secret | Integration |
| V20 | Ba trận liên tiếp, đổi danh sách món, reconnect từ trận cũ | Không còn entity/timer/score/FX/input cũ; identity/ngoại hình đúng luật | Integration + browser |
| V21 | Camera che khuất, waiter đổi mục tiêu, không có target | Người chơi nhận ra bản thân; occlusion chỉ đổi render; có góc camera dự phòng | Browser + manual |
| V22 | Mute, refresh, reconnect, event lặp, hủy scene | Âm thanh không lặp sai; mute lưu; GPU/audio/listener được dọn | Browser + profiling |
| V23 | Build chạy LAN, tắt internet, restart server, protocol mismatch | Asset local; room cũ mất có thông báo; version sai không chạy schema sai | Hai máy thật + browser |

## 3. Đo tải server

- Chạy ít nhất 30 phút, 10 phòng × 8 client. Client có movement/attack, tranh item, reconnect và quay vòng trận; không chỉ mở socket idle.
- Có lượt chạy 1/3/10 phút, 2/8 món, reset liên tiếp; log seed/config/build để tái hiện. Áp RTT khoảng 100 ms, có lượt 200 ms và jitter; khi dùng mô phỏng mạng ghi rõ đó là RTT khứ hồi.
- Ghi CPU, RSS/heap, event-loop delay, simulation tick duration p50/p95/p99, queue depth, byte/s, socket errors, số catch-up/spawn bỏ và số phòng/result bất nhất.
- Ngưỡng khởi điểm Q33: dưới tải mục tiêu, simulation tick duration p95 < 33,3 ms và p99 < 66,7 ms; không có backlog tăng vô hạn, crash, double pickup, result lệch hoặc deadline kéo dài do input. Báo mọi overload; không coi drop lịch spawn liên tục là đã đạt trải nghiệm.
- So sánh heap sau warm-up/GC tương đương và nhiều lần reset để phát hiện tăng giữ lại theo số trận. Không suy ra leak chỉ từ RSS tăng một thời điểm; điều tra entity/timer/listener/queue còn bị giữ.
- Kết luận gắn với máy host cụ thể và tải thực đã chạy. Nếu chưa đủ 80 client hoặc 30 phút, ghi mức đã chạy và điều kiện còn thiếu.

## 4. Đo client và duyệt hình ảnh

Ghi model máy, CPU/GPU, RAM, OS, browser version, resolution, graphics preset và pixel ratio. Host và client có thể cùng máy nhưng phải báo rõ CPU contention. Chọn máy tham chiếu thực tế trước khi đánh giá; chưa có máy nào được xác nhận trong giai đoạn thiết kế.

Đo ít nhất 3 phút sau warm-up trong phòng 8 người, đủ NPC, item, animation và góc nhìn nhiều nội thất. Mục tiêu 60 FPS; điều kiện tối thiểu 30 FPS ở low preset được cụ thể thành frame time p95 <= 33,3 ms trong đoạn steady-state. Báo thêm p99, stutter, loading và các đoạn ngoài steady-state thay vì che chúng bằng trung bình. GPU tích hợp và WebGL2 phải được kiểm tra thật.

Duyệt mẫu gồm một nhân vật và góc văn phòng ở camera gameplay: thấy hình khối/tổng thể như ảnh tham chiếu, phân biệt người/NPC/đồ ăn, đọc hướng đánh và dấu rơi, animation chạy/đánh hợp lý. Có preview cận cảnh bổ trợ nhưng không thay góc chơi. Người dùng duyệt mẫu trước nhân rộng; asset/license được ghi trong ATTRIBUTION khi được chọn.

## 5. Chơi thử và báo cáo

Chơi thật 2/4/8 người, kiểm tra trận ngắn/dài và ít/nhiều món; mỗi nhóm chạy ít nhất 3 trận liên tiếp. Ghi nhận thời gian tìm được bản thân, hiểu cách thắng, độ rõ cảnh báo, NPC kẹt, cảm giác bị hội đồng và chờ hồi sinh. Kết quả test tự động không thay phản hồi này.

Báo cáo nghiệm thu phải có commit/build nếu đã có Git, config/version, phần cứng, network setup, test result, số người thật/client mô phỏng, thời lượng chạy, preview mẫu đã duyệt và lỗi chưa giải quyết. Phân biệt rõ đạt / chưa đạt / chưa chạy. Chỉ công bố hoàn thành khi có bằng chứng tương ứng; bản thiết kế hiện tại không phải bằng chứng game đã chạy.
