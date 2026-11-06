# Game văn phòng tranh món ăn

Game 3D trên trình duyệt cho nhóm 2–8 người tranh món ăn trong văn phòng. Bản đầu dự kiến chạy trên máy local và truy cập qua LAN công ty.

**Trạng thái ngày 2026-11-06:** đã chốt thiết kế qua Q1–Q33; repo hiện có tài liệu và ảnh tham chiếu, chưa có mã nguồn, dependency hoặc lệnh chạy game.

## Tài liệu

| Tài liệu | Nội dung |
| --- | --- |
| [Spec sản phẩm](./docs/game-spec.md) | Luồng phòng, luật thắng, combat, NPC và trải nghiệm |
| [Spec kỹ thuật](./docs/technical-spec.md) | Stack, kiến trúc, dữ liệu, mô phỏng, asset và vận hành LAN |
| [Hợp đồng mạng](./docs/network-protocol.md) | Identity, reconnect, input, snapshot, prediction và validation |
| [Kế hoạch triển khai](./docs/implementation-plan.md) | Bảy mốc có điều kiện hoàn thành |
| [Kế hoạch kiểm chứng](./docs/validation-plan.md) | Ma trận test, LAN, tải, FPS, duyệt mẫu và chơi thử |
| [Glossary](./GLOSSARY.md) | Thuật ngữ thống nhất |
| [ADR 0001](./docs/adr/0001-no-match-recovery.md) | Chấp nhận mất phòng/trận khi server restart |
| [ADR 0002](./docs/adr/0002-game-core-boundary.md) | Tách luật gameplay khỏi rendering và transport |

Stack đã chốt: TypeScript, React + CSS, Three.js, Vite, Node.js LTS, Colyseus; npm workspaces, Vitest và Playwright. Server quyết định gameplay, state trận trong RAM; mô phỏng trên mặt phẳng và hiển thị 3D chibi low-poly.

Mục tiêu 10 phòng/80 người, hướng tới 60 FPS và tối thiểu 30 FPS trên máy tham chiếu cần được kiểm chứng khi triển khai. Bước tiếp theo trong kế hoạch là khởi tạo workspace và chứng minh một kết nối LAN thật.
