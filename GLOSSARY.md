# Game văn phòng tranh món ăn

Thuật ngữ dựa trên đặc tả sản phẩm đã xác nhận trong `docs/game-spec.md`.

## Ngôn ngữ

**Phòng**:
Không gian chung mà người chơi tham gia bằng link hoặc mã mời, có thể tổ chức nhiều trận liên tiếp.
_Avoid_: Trận, ván khi nói về toàn bộ vòng đời phòng

**Trận**:
Một lượt thi đấu có thời lượng và danh sách món cố định, kết thúc bằng kết quả riêng.
_Avoid_: Phòng

**Chủ phòng**:
Người có quyền cấu hình và bắt đầu trận; khi người này rời hoặc mất kết nối, quyền được chuyển cho người đang online có thời điểm vào phòng ban đầu sớm nhất.

**Người tham gia trận**:
Người thuộc danh sách thi đấu được xác định khi trận bắt đầu; mất kết nối hoặc rời phòng không xóa tư cách này trong trận hiện tại.
_Avoid_: Người đang online khi nói về danh sách thi đấu

**Người chờ**:
Người vào phòng sau khi trận đã bắt đầu và chưa được thi đấu trong trận đó.
_Avoid_: Người tham gia trận

**Chỗ trong phòng**:
Một suất trong giới hạn tám người của phòng; trong trận, chỗ của người tham gia trận được giữ tới hết trận và người chờ chỉ được nhận các chỗ còn lại.

**Món**:
Một lựa chọn ăn uống trong danh sách của trận, ví dụ pizza hoặc bún bò.
_Avoid_: Vật phẩm khi nói về lựa chọn ăn uống

**Vật phẩm**:
Một đơn vị đồ ăn xuất hiện trên bản đồ, tương ứng với một món và chỉ được một người nhặt một lần.
_Avoid_: Món khi cần phân biệt từng đơn vị xuất hiện trên bản đồ

**Cặp người chơi–món**:
Một người chơi và một món cụ thể, với số lượt nhặt riêng dùng để xét thắng và phân xử hòa.
_Avoid_: Tổng điểm người chơi khi nói về tiêu chí thắng

**Bất động**:
Trạng thái khi người chơi hết máu, phải chờ hồi sinh và được miễn sát thương.
_Avoid_: Rời trận, mất kết nối

**Bảo vệ sau hồi sinh**:
Khoảng miễn sát thương sau khi hồi sinh, kết thúc sớm khi người chơi chủ động đánh.
