# Deploy Xưởng Nối + Xưởng Bot lên VPS .40 — 2026-11-04 03:51

## Quyết định user
- 1b: web CÔNG KHAI, không mật khẩu. User đã được báo MEGA PACK (570 MB, Unity Asset Store) không được phân phát lại; user nói "tôi kiểm soát được, chịu toàn bộ trách nhiệm".
- 2a: một tên miền `xuongnoi.wanmeivn.com`; `/` = Xưởng Nối, `/giai-do.html` = Xưởng Bot.
- 3a: merge feat/free-board vào main trước khi build.
- 4: user tự tạo DNS A `xuongnoi` → 160.191.3.40 trên dnspro.vn.

## Cách làm
- Web tĩnh (vite build, 2 trang). Build trên laptop → tar → MỘT kết nối ssh `vps40` → `/srv/xuong-noi/releases/<ts>/` + symlink `/srv/xuong-noi/current`.
- Caddy: thêm 1 khối `xuongnoi.wanmeivn.com { root /srv/xuong-noi/current; file_server; encode }`, backup Caddyfile, validate dưới user caddy (validate bằng root làm hỏng quyền log), `systemctl reload caddy` (không restart). 5 site cũ không đổi.
- Không mở port, không đổi SSH (luật chủ máy). Chỉ dùng alias `vps40`.
- Rollback: trỏ lại symlink về release trước; gỡ hẳn = xoá khối Caddy + reload.

## Rủi ro
- Bản quyền pack model (user chấp nhận).
- Trước khi có DNS, Caddy chưa lấy được chứng chỉ HTTPS (tự thử lại sau).
- 570 MB tải lần đầu chậm với người chơi; pack model chưa thử trên GPU thật.
