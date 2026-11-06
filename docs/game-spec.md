# Game văn phòng tranh món ăn

Trạng thái: đặc tả sản phẩm đã được người dùng xác nhận và làm rõ qua Q1–Q33 ngày 2026-11-06. Chưa có game chạy; kiến trúc và cấu hình chơi thử nằm trong [technical-spec.md](./technical-spec.md).

## Mục tiêu và phạm vi

Game 3D trên trình duyệt máy tính cho nhóm bạn hoặc đồng nghiệp chọn món cho một bữa ăn. Mỗi phòng có 2–8 người. Ưu tiên vui và bất ngờ, đồng thời để di chuyển và chiến đấu tạo lợi thế. Không cần tài khoản, không tích hợp đặt đồ ăn, chưa hỗ trợ điều khiển điện thoại.

## Luồng phòng

1. Chủ phòng tạo phòng, nhận link và mã mời.
2. Mọi người nhập tên, chọn ngoại hình rồi chờ tại sảnh.
3. Chủ phòng cấu hình danh sách món và thời lượng, bắt đầu khi có ít nhất hai người.
4. Thi đấu đến hết thời gian; người đến muộn chờ trận tiếp theo.
5. Hiện kết quả. Chủ phòng có thể mở trận mới trong cùng phòng; điểm được đặt lại, ngoại hình được giữ.

Trong trận, giữ chỗ cho toàn bộ người tham gia lúc bắt đầu, kể cả người mất mạng hoặc đã rời. Người mới chỉ được vào chờ nếu còn chỗ; tổng số chỗ thi đấu được giữ và người chờ không vượt 8.

Người chờ xem trận qua camera theo người chơi, có thể đổi người theo dõi, thấy đồng hồ và bảng xếp hạng nhưng không có nhân vật trên sân. Về sảnh thì được chọn ngoại hình và tham gia trận sau.

Ở sảnh hoặc màn hình kết quả, người mất mạng được giữ chỗ 60 giây; bấm Rời phòng giải phóng chỗ ngay. Chỉ người đang kết nối được tham gia khi trận mới bắt đầu; người offline quay lại sau đó vào chờ nếu còn chỗ. Kết quả trận cũ không bị sửa.

Thời lượng từ 1 đến 10 phút, mặc định 3 phút. Danh sách có 2–8 món, tên tối đa 30 ký tự, không trống hoặc trùng. Có danh sách mẫu; món tự nhập dùng biểu tượng có sẵn và tên, không tải ảnh.

Thời lượng, danh sách món, tên và ngoại hình bị khóa trong trận; có thể sửa ở sảnh trước trận tiếp theo. Chủ phòng không thể sửa điểm, tăng sức mạnh hoặc kết thúc sớm để công nhận người thắng.

Tên trùng trong phòng được thêm số phân biệt. Lưu tên và ngoại hình tại trình duyệt.

## Tính điểm và kết quả

- Chạm vật phẩm để tự động nhặt. Mỗi vật phẩm thuộc về đúng một người và cộng một lượt cho món tương ứng.
- Khi nhiều người cùng chạm trong cùng một nhịp, người gần tâm vật phẩm nhất được nhặt; bằng khoảng cách thì ưu tiên thứ tự vào trận. Quy tắc này xác định người sở hữu trước khi cấp thứ tự sự kiện nhặt.
- Không có túi đồ hay bước xác nhận nhặt.
- Xét tất cả cặp người chơi–món ăn: cặp có số lượt nhặt cao nhất thắng.
- Ví dụ An có 5 pizza và 4 sushi, Bình có 6 bún bò: Bình thắng với bún bò.
- Nếu nhiều cặp cùng điểm cao nhất, cặp đạt mốc điểm đó sớm hơn thắng; áp dụng cả khi một người có nhiều món đồng điểm.
- Khi các lượt nhặt xảy ra trong cùng một nhịp mô phỏng, dùng thứ tự sự kiện của server để phân xử lượt nào trước; không dùng giờ từ máy người chơi.
- Nếu không ai nhặt được gì, hiển thị “Chưa chọn được món”, không tự bốc thăm.
- Điểm của người rời phòng vẫn hợp lệ trong trận hiện tại.
- Hết giờ, dừng chiến đấu và nhặt đồ; hiển thị người thắng, món thắng và bảng kết quả.

## Điều khiển và nhân vật

- Camera 3D từ trên xuống, góc nghiêng cố định, theo nhân vật; chưa có xoay camera.
- WASD để di chuyển, chạy chéo không tăng tốc; nhân vật nhìn theo con trỏ chiếu xuống sàn, độc lập hướng chạy. Chuột trái đánh theo hướng nhìn, mỗi click yêu cầu một đòn; không tự đánh liên tục khi giữ chuột.
- Chọn từ 8 màu trang phục, 3 kiểu tóc và 3 lựa chọn phụ kiện gồm cả không phụ kiện.
- Ngoại hình không ảnh hưởng chỉ số.
- Không có nhảy, vũ khí hoặc kỹ năng bổ sung trong bản đầu.

## Chiến đấu và hồi sinh

| Thuộc tính | Giá trị ban đầu |
| --- | --- |
| Máu tối đa | 100 |
| Sát thương đòn người chơi | 20 |
| Khoảng cách tối thiểu giữa hai đòn | 0,6 giây |
| Số mục tiêu mỗi đòn | Tối đa một mục tiêu phía trước |
| Thời gian bất động khi hết máu | 8 giây |
| Bảo vệ sau hồi sinh | 3 giây |

Đòn đánh đẩy lùi nhẹ; không làm rơi hoặc cướp điểm. Không tự hồi máu. Khi hết máu, nhân vật bất động và miễn sát thương; sau 8 giây hồi sinh đầy máu tại vị trí an toàn. Chủ động đánh sẽ kết thúc bảo vệ sau hồi sinh sớm.

Chọn tối đa một mục tiêu gần nhất trong vùng đánh phía trước, không đánh xuyên bàn hoặc tường. Server xét trúng đòn theo trạng thái hiện tại, không tua lại theo giờ client; ở mạng trễ, animation vung tay có thể xuất hiện mà không gây sát thương. Tầm/góc đánh và các thông số ban đầu được ghi tập trung trong spec kỹ thuật để chơi thử.

Người bất động không được nhặt món. Người được bảo vệ sau hồi sinh vẫn được chạy và nhặt mà không mất bảo vệ. Người chơi/NPC không chặn đường nhau bằng thân; vẫn bị chặn bởi vật cản. Đẩy lùi gặp vật cản thì dừng.

Các đòn hợp lệ cùng nhịp được xét trước khi áp dụng sát thương, cho phép cùng đánh gục nhau. Người vừa bị hạ không nhặt món trong nhịp đó. Hồi sinh tại điểm bố trí trước, ưu tiên xa NPC/người khác; nếu không có điểm đạt khoảng cách mong muốn, dùng điểm tốt nhất và vẫn hồi sinh đúng hạn.

Không chia đội, cho phép nhắm đánh người dẫn đầu và liên minh tạm thời.

## NPC

- 1 NPC khi có 2–4 người, 2 NPC khi có 5–8 người; lấy số người khi bắt đầu trận và giữ nguyên tới hết trận.
- Bất tử, đi tuần, đuổi người gần nhất trong phạm vi phát hiện.
- Bỏ đuổi khi người chơi chạy đủ xa.
- Không nhắm người bất động hoặc đang được bảo vệ.
- Mỗi đòn gây 7 sát thương, tối đa một đòn/giây, có động tác báo trước để né.
- Người chơi đánh NPC có thể đẩy chúng lùi.
- NPC đi vòng nội thất; khi bắt đầu báo đòn thì khóa hướng đánh. Tới lúc ra đòn phải kiểm tra lại tầm và vật cản để người chơi có thể né.

## Đồ ăn xuất hiện

- Khoảng 3 giây có một đợt rơi; khởi điểm `ceil(số người tham gia lúc bắt đầu trận / 2)` vật phẩm mỗi đợt. Mất mạng/rời đi hoặc có người vào chờ không làm đổi lượng rơi trong trận; công thức có thể điều chỉnh sau chơi thử.
- Đợt đầu báo vị trí ngay khi bắt đầu trận, chạm đất sau 1,5 giây; các đợt tiếp theo báo cách nhau 3 giây.
- Các món có xác suất xuất hiện ngang nhau, một món có thể rơi nhiều lần.
- Vị trí ngẫu nhiên nhưng phải đi tới được, không nằm trong vật cản.
- Báo vị trí trước 1,5 giây để người chơi tranh giành.
- Chỉ nhặt được sau khi chạm đất; món không được nhặt biến mất sau 15 giây tính từ lúc chạm đất. Hết trận hủy cả món còn lại và các đợt đang báo.

## Bản đồ, hình ảnh và âm thanh

Một văn phòng cố định theo phong cách 3D hoạt hình low-poly. Bàn, ghế và máy tính là vật cản; có nhiều đường đi vòng, tránh phòng chỉ có một cửa dễ bị chặn. Không phá hoặc ném đồ. Vật cản che nhân vật sẽ mờ đi.

Nhân vật theo hướng chibi low-poly có tạo dáng, tổng thể dễ nhận diện như [ảnh tham chiếu](./references/character-style.png), không chỉ ghép các khối đơn giản. Có animation đứng, chạy, đánh, bất động và hồi sinh. Duyệt một mẫu nhân vật và một góc văn phòng ở camera/kích thước lúc chơi trước khi sản xuất toàn bộ asset. Món tự nhập dùng model vật phẩm chung kèm biểu tượng và tên, không yêu cầu model riêng theo món.

Có âm thanh nhặt món, đánh và kết thúc trận; có nút tắt tiếng. Không có máu me.

## HUD

- Bảng xếp hạng realtime ở góc màn hình.
- Mỗi dòng gồm tên người chơi, món có số lượt cao nhất và số lượt của món đó.
- Thứ tự áp dụng luật thắng và luật hòa; tổng số vật phẩm không phải điểm xếp hạng.
- Có bảng riêng xem toàn bộ số món bản thân đã nhặt.
- Hiển thị máu, đồng hồ trận, thời gian chờ hồi sinh và trạng thái bảo vệ.

## Mất kết nối và vòng đời phòng

- Người mất kết nối đứng tại chỗ, vẫn có thể bị đánh; trận tiếp tục chạy.
- Chuyển tab hoặc mất focus sẽ thả điều khiển, không tạm dừng trận hoặc làm mất quyền chủ phòng. Server dừng di chuyển nếu input cũ quá 250 ms; đây là ngưỡng khác với phát hiện mất kết nối, khởi điểm khoảng 10 giây.
- Quay lại bằng cùng trình duyệt sẽ giữ nhân vật, điểm, máu và thời gian bất động; tải lại không giúp hồi máu hoặc né hình phạt. Mở thêm tab cùng phiên thì tab mới tiếp quản, tab cũ ngừng điều khiển và hiện thông báo.
- Chủ phòng rời hoặc mất kết nối: chuyển quyền cho người đang online có thời điểm vào phòng ban đầu sớm nhất, cả ở sảnh và trong trận. Chủ cũ quay lại không tự lấy lại quyền.
- Không ai kết nối trong 5 phút thì đóng phòng.

## Cân bằng sau chơi thử

Các giá trị sát thương, hồi sinh và nhịp rơi là cấu hình ban đầu. Cần kiểm chứng việc tập trung đánh người dẫn đầu, thời gian phải chờ, giá trị của chiến đấu so với chạy nhặt và ảnh hưởng của ngẫu nhiên trong trận ngắn.

Nghiệm thu gồm luật tự động, nhiều trình duyệt độc lập, kết nối LAN thật, duyệt hình ảnh và chơi thử thực tế 2/4/8 người. Tải 10 phòng/80 client mô phỏng ít nhất 30 phút được đo riêng với FPS trên máy client; xem [validation-plan.md](./validation-plan.md). Các mục tiêu chưa phải kết quả đã đạt.
