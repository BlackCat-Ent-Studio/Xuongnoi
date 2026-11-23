# Xưởng Nối — hướng dẫn nhanh

## Mở chương trình
1. Mở PowerShell, gõ:
   ```
   cd D:\workspace\GameBuilder\app
   npm install
   npm run dev
   ```
   (`npm install` chỉ cần chạy lần đầu.)
2. Mở trình duyệt vào **http://localhost:5173**
3. Tắt: bấm `Ctrl + C` trong cửa sổ PowerShell.

## Màn hình
- **Trái:** danh sách khối — bấm hoặc kéo khối ra bảng.
- **Giữa:** bảng nối dây — kéo từ chấm bên phải khối (đầu ra) sang chấm bên trái khối khác (đầu vào).
  - Màu dây: **xanh lá** = đúng/sai, **xanh dương** = số, **cam** = vật thể. Chỉ nối được cùng màu.
  - Kéo chỗ trống để di chuyển bảng, lăn chuột để phóng to/thu nhỏ, phím `Delete` để xóa.
- **Phải trên:** màn hình game — ở chế độ Sửa có thể kéo nhân vật/khối để đặt vị trí.
- **Phải dưới:** chỉnh thông số của khối đang chọn.
- **Thanh trên:** Tạo mới · Chơi/Sửa · Lưu · Mở · Góc nhìn.

## Thử ngay
Bấm **Mở** → chọn một bảng mẫu → **Chơi**:
- **Hái sao (nhìn ngang):** phím mũi tên để đi, `Space` để nhảy. Nhặt 5 sao để thắng, rơi xuống là thua.
- **Nhặt đồ (nhìn từ trên):** phím `W A S D` để đi. Nhặt 5 món trong 30 giây.
- **Nhảy bục (3D):** `W A S D` để đi, `Space` để nhảy, kéo chuột để xoay camera.

Bài đang làm được tự lưu — tắt trình duyệt mở lại vẫn còn. Bấm **Lưu** để tải ra file.
