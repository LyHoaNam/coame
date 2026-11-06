# Tách mô phỏng gameplay khỏi rendering và transport

Ngày 2026-11-06, người dùng chốt workspace có client, server, `game-core` và `protocol`. Luật và mô phỏng nằm trong `game-core`, không phụ thuộc React, Three.js hoặc Colyseus; server dùng phần này để quyết định trạng thái chính thức. Thông điệp, kiểm tra dữ liệu và schema đồng bộ nằm ở `protocol`.

Chấp nhận thêm lớp chuyển đổi giữa trạng thái gameplay và dữ liệu đồng bộ thay vì viết toàn bộ luật trực tiếp trên schema Colyseus. Đổi lại có thể kiểm thử luật không cần trình duyệt, GPU hoặc mạng; việc thay đổi hình ảnh ít ảnh hưởng luật. Q12 đã chốt dự đoán chuyển động phía client dùng phần movement chung; chi tiết nằm trong [spec kỹ thuật](../technical-spec.md).
