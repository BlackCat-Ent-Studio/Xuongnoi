# Brainstorm — Xưởng Bot giải đố thành game (2026-11-01 13:57)

## Quyết định đã chốt (user)
- Hướng A: ghép vào Xưởng Nối, chạy bằng động cơ + mảnh ghép thật. Mọi mảnh ghép dùng lại được.
- 1a: nút "Chơi giải đố" trong Xưởng Nối + link riêng (`/giai-do.html`).
- 2: mỗi màn tự chọn góc nhìn, từ 2D lên 3D (2d-side, 2d-top, 3d + Máy quay khoá: tilted/top).
- 3: nhân vật theo hoàn cảnh từng màn.
- 4a: thêm 4 nhân vật vào "Kiểu dáng" của Nhân vật: robot-wheel, robot-legs, cat-chibi, cat-quad.
- 5: 8 màn dễ → khó (bảng dưới). 6 (mặc định): Robot Bánh Xe dùng kiểu "Chắn bùn". 7b: Chibi giữ vòng cổ cũ.
- 8a: thẻ có sẵn chỉ hiện cổng cần. 9a: chạy localhost trước. 10 (mặc định): Phím bấm/Cần điều khiển để sau. 12b: cho chỉnh vài thông số ở màn cần.
- Sao: ⭐ giải được, ⭐⭐ không gợi ý, ⭐⭐⭐ ≤ par mảnh và không gợi ý.
- Giao diện: theo mockup `plans/ui-mockups/puzzle-phone/` (đã duyệt): thẻ giống bảng lớn + dây dòng điện y chang, nối dây chạm-chạm.

## 8 màn
| # | id | Góc nhìn | Nhân vật | Mảnh chính |
|---|---|---|---|---|
| 1 | bot-dau-tien | 2D ngang | robot-legs | Đi tới |
| 2 | cua-kho | 2D ngang | robot-legs | Cảm biến chạm, Công tắc nhớ |
| 3 | nhat-sao | 2D từ trên | cat-chibi | Cảm biến chạm, Bộ đếm, So sánh |
| 4 | hai-nut-mot-cua | 2D ngang | robot-legs + robot-wheel | Và |
| 5 | du-ba-thung | 3D chéo | robot-wheel | Cảm biến vùng, Bộ đếm, So sánh |
| 6 | ne-linh-gac | 3D từ trên | cat-chibi; lính = cat-quad | Khoảng cách, So sánh, Không |
| 7 | cau-nhap-nhay | 3D chéo | robot-wheel | Hẹn giờ, Công tắc nhớ (Đảo), Và |
| 8 | xuong-tong-hop | 3D chéo | cả 4 | tổng hợp |

## Hợp đồng chung (commit trước khi chia agent)
- `app/src/puzzle/types.ts`: PuzzleLevel, TrayPiece, EditableParam, PuzzleAnswer, PUZZLE_LOOKS.
- `app/src/puzzle/run-level.ts`: buildPlayGraph, runLevel (headless), starsFor, piecesUsed. Thắng = node win-lose khoá trong `base`.
- `app/src/puzzle/levels/level-0N.ts` (stub null) + `levels/index.ts` (PUZZLE_LEVELS).

## Chia agent (worktree riêng, không đụng file của nhau)
- A chars: `render/character-styles/*` (+ thumbnails nếu cần), `nodes/character.ts` (options look), handbook trang Nhân vật.
- B shell: `app/src/puzzle/ui/**`, `app/giai-do.html`, `src/puzzle-main.ts`, vite multi-page, nút trong menu Xưởng Nối.
- C levels 1–4: `levels/level-01..04.ts`, `tests/puzzle/levels-1-4.test.ts`.
- D levels 5–8: `levels/level-05..08.ts`, `tests/puzzle/levels-5-8.test.ts`.

## Kiểm tra
- Mỗi màn: đáp án → win; trống / thiếu dây then chốt → không win. tsc, vitest, build. Playwright chụp từng màn.

## Ngoài phạm vi
Phím ảo, tự làm màn ("Lưu thành màn giải đố"), âm thanh, deploy.

## Rủi ro
Màn 6–7 phụ thuộc thời gian (cân chỉnh); robot-wheel ~25k tam giác; FPS máy thật chưa đo.
