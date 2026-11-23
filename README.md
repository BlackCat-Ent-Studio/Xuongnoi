# Xưởng Nối

Trình mô phỏng robot và tự động hóa cho trường học: học sinh kéo "mảnh ghép" lên bảng, nối dây, rồi bấm Chạy để xem máy hoạt động trong cảnh 2D hoặc 3D. Kèm theo là trò giải đố "Xưởng Bot".

- Bản đang chạy: https://xuongnoi.wanmeivn.com (Xưởng Nối) và https://xuongnoi.wanmeivn.com/giai-do.html (Xưởng Bot)
- Bản đang chạy ứng với commit `82a0cbe` trên nhánh `main` (bản phát hành `261124-0155`, ngày 24/11/2026)

## Chạy trên máy

Cần Node.js 24 trở lên.

```
cd app
npm install
npm run dev -- --port 5173 --strictPort
```

Mở http://localhost:5173 (Xưởng Nối) hoặc http://localhost:5173/giai-do.html (Xưởng Bot).

Các lệnh khác, chạy trong `app/`:

| Lệnh | Việc |
|---|---|
| `npm run build` | Kiểm kiểu rồi tạo bộ file phát hành |
| `npx vitest run --testTimeout 300000` | Chạy toàn bộ bộ kiểm thử (khoảng 5000 bài, 10 đến 50 phút tùy máy) |

## Trong kho có gì

| Thư mục / file | Nội dung |
|---|---|
| `app/src` | Mã nguồn: `engine`, `world` (vật lý), `nodes` (83 mảnh ghép), `circuits` (bảng mạch lồng nhau), `render`, `editor`, `samples` (bài mẫu), `handbook` (sổ tay), `tutorial` (bài học), `puzzle` (Xưởng Bot) |
| `app/tests` | Bộ kiểm thử |
| `app/public/models` | Bộ mô hình 3D (xem mục giấy phép bên dưới) |
| `HANDOFF.md` | Nhật ký bàn giao: trạng thái mới nhất ở mục A5, quy trình làm việc ở mục 4, lỗi và cách sửa ở mục 5 |
| `plans/` | Kế hoạch, báo cáo của từng đợt làm, trang xem trước hình, ảnh chụp kiểm tra |

## Các nhánh

| Nhánh | Nội dung |
|---|---|
| `main` | Bản chính, cũng là bản đang chạy trên mạng (cộng thêm các commit tài liệu và mô hình) |
| `feat/sorting-grid-lock` | Việc đang làm dở, chưa gộp: lồng chứa, đèn báo và khóa lỗ trong bài mẫu sàn lưới |
| `feat/apk` | Bản đóng gói Android, đang tạm ngưng |
| `spike/deck`, `spike/grid`, `spike/w0` | Các bản đo thử, cố ý không gộp |
| `archive/*-261029` | Ảnh chụp ba thư mục làm việc cũ ngày 29/10/2026, giữ để tra cứu |
| Các nhánh `feat/*`, `fix/*` còn lại | Đã gộp hết vào `main`, giữ để xem lịch sử |

## Những thứ không có trong kho, và lý do

| Thứ | Lý do |
|---|---|
| `app/node_modules`, `app/dist` | Tự sinh ra bằng `npm install` và `npm run build` |
| `.claude/`, `ClaudeKit/`, `.agents/` | Công cụ và cấu hình của trợ lý lập trình trên máy làm việc, không phải một phần của sản phẩm |
| `game-builder-garage-full-extract.zip` (4,4 GB) | Tài liệu tham khảo của bên thứ ba, không phải mã của dự án; GitHub cũng không nhận file trên 100 MB |

## Giấy phép bộ mô hình 3D

`app/public/models` là bộ MEGA PACK WORLD đã mua. Giấy phép không cho phát tán lại bộ mô hình, nên kho này phải giữ ở chế độ riêng tư.

## Việc chưa xong

Xem `HANDOFF.md` mục A5: phần lồng và khóa lỗ trong bài mẫu, tầng dưới của xưởng (xe kéo, bến, xe tải), cảnh nhà kho trong bài mẫu, đo tốc độ trên máy thật.
