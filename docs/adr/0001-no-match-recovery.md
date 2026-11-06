# Chấp nhận mất phòng khi server khởi động lại trong bản đầu

Bản đầu chạy local và có thể phục vụ qua LAN công ty. Người dùng xác nhận ngày 2026-11-06 rằng server khởi động lại có thể hủy các trận và phòng đang chạy; người chơi tạo phòng mới. Chưa xây cơ chế lưu và phục hồi trận qua sự cố để giảm phạm vi vận hành, chấp nhận mất tiến trình trận; yêu cầu reconnect của người chơi khi server vẫn chạy giữ nguyên.

Quyết định này chốt mức phục hồi cần cung cấp. Lựa chọn lưu trạng thái trận trong RAM, chưa dùng database, được chốt tiếp tại Q7 và ghi trong [spec kỹ thuật](../technical-spec.md). Việc cần phục hồi trận sau sự cố trong tương lai sẽ yêu cầu thiết kế lại lưu trữ và vòng đời phòng.
