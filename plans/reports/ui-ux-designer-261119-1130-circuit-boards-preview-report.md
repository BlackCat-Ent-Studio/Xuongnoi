# Bảng mạch lồng nhau – preview report (2026-11-19)

Mock only. Nothing in `app/` touched.

- Page: `plans/previews/circuit-boards-261119/index.html` (one file, 76 KB, inline CSS/JS, no network)
- Shots + audit: `plans/previews/circuit-boards-261119/shots/` (32 PNG, `audit.json`)
- Tools: `plans/previews/circuit-boards-261119/tools/shoot-circuit-boards.mjs` (screenshots + audits), `patch-after-review-1.mjs` (record of fixes after first visual pass)

## What is clickable

| # | Requirement | Where |
|---|---|---|
| 1 | 4 levels, crumb, Mở / double-click, Esc / "Quay ra" | Xưởng (18 blocks, 25 wires) › Trạm nạp › Tay máy › Khớp vai. Also Xe AGV, Cửa thả, Băng chuyền, Cân / quét open. Level ladder "Tầng n · …" next to crumb |
| 2 | Kiểu khối A / B / C | Crumb bar, applies everywhere incl. side-panel preview |
| 3 | Chân vào / Chân ra | Edge cards inside a circuit: rename inline, change type (button cycles Đúng/Sai → Số → Vật thể), reorder, delete, "Thêm chân vào/ra". Side panel "Nhìn từ bên ngoài" updates while typing; parent blocks update on exit |
| 4 | Instance settings | Click "Xe AGV 3": Vị trí xuất phát, Màu, Tốc độ (all editable) + note "Sửa mạch Xe AGV sẽ đổi cả 8 xe" |
| 5 | Chạy thử máy này | Button in crumb bar (inside a circuit) or side panel. 2 layouts: "Cột bên trái" / "Dải bên dưới". Inputs by switch / number box, outputs live, schematic sim tagged "minh hoạ" (AGV, Tay máy have own scene; others share a conveyor scene) |
| 6 | Thư viện bảng mạch | Right panel tab. Xe AGV ×8, Tay máy ×1, Trạm nạp ×1, Cửa thả ×6 (+ Băng chuyền ×1, Cân / quét ×1). "Đặt thêm" and drag-to-board add a copy, count updates. Xuất / Nhập / Mạch mới = toast only |
| 7 | Theme + mode | Top bar: Xám dịu / Tối, Học sinh / Giáo viên |
| 8 | Chạy | Top bar. Running dashes + spark on live wires, value chips, status lights rotate ("Đang chở", "Chờ lệnh"…), Bộ đếm counts. Entering "Xe AGV 3" while running shows its own live wires + banner |

## The 3 looks

- **A · Bo mạch**: dark teal board, mono uppercase name, black header-pin sockets straddling the edge with the type-shaped pin inside, LED, trace + mounting-hole details. Most "electronics" feel; heaviest visually; name text smallest.
- **B · Thẻ thiết bị**: same family as node cards (light card, teal tinted header, rounded-square icon, status dot + word, "Mở" button). Calmest, status word always readable. Tallest.
- **C · Chip gọn**: dark IC body with notch and metal legs, one name row + pin row, status = dot only (no word). ~25% shorter than B, fits most on screen.

All three keep: in-pins left / out-pins right on the same row, 3 port shapes, "Mở" button, per-copy colour dot on the icon.

## Shots (1366×768 unless noted)

01–03 factory look B / A / C · 04–05 instance settings (before / after edit) · 06 library · 07 running · 08 running inside Xe AGV 3 · 09 Tầng 3 Trạm nạp · 10 Tầng 2 Tay máy · 11 Tầng 1 Khớp vai · 12 Xe AGV circuit · 13 pin edit (rename + add) · 14 factory after pin edit · 15–16 bench layouts 1 / 2 · 17 bench Tay máy · 18–19 Giáo viên · 20–25 dark (look B, A, C running, inside AGV, bench, library) · 30–36 at 1920×1080 (3 looks, Trạm nạp in A and C, both bench layouts)

## Measured (script, all 32 states)

- Text contrast vs surface under it: light min **4.68:1** (white on "Vật thể" header, 2780 texts), dark min **5.63:1** (716 texts). 0 texts under 4.5.
- Pure white surfaces: 0. Page errors: 0. Non-file requests: 0. Horizontal page scroll: none at 1366 and 1920.
- Hit areas in Học sinh: 0 controls under 34 px at 100% zoom.
- Board zoom at 1366×768: factory 75–79%, inside circuits 76–98%, bench 70–73%. At 1920×1080: 100% everywhere.

## Not verified / limits

- Hit areas are measured at 100% board zoom. At 1366×768 the factory auto-fits to ~76%, so "Mở" on a block is ~27 px tall on screen. Same behaviour as zooming the real board; needs a decision (Q5).
- Contrast audit skips SVG text in the "minh hoạ" scene and ignores the decorative trace gradient of look A; checked those by eye only.
- No manual zoom / pan in the mock (auto-fit only). Drag from library tested by code path "Đặt thêm", not by real mouse drag.
- Only Chromium, no touch, no real keyboard-only walkthrough beyond Esc.
- Factory wiring (which AGV serves which cửa) and bench logic are illustrative, not a spec.
- Style source `ui-c-board.css` is at `app/src/editor/theme/`, not `editor/graph/` as in the brief.
- Playwright is not installed in `app/`; the script was run from an earlier session's temp folder with `CHROME=` pointing at an installed Chromium.

## Questions for the owner (recommendation marked)

1. **Kiểu khối**: a) A Bo mạch, b) B Thẻ thiết bị, c) C Chip gọn, d) B on Tầng 3–4 and C when zoomed out. → **1b**; reads like the existing cards, status word visible. 1d later if boards get crowded.
2. **Bố cục bàn thử**: a) Cột bên trái, b) Dải bên dưới. → **2b**; bigger sim, pins read left-to-right like the circuit; at 1366 both leave the board ~70%.
3. **Thư viện ở đâu**: a) tab in right panel (as mocked), b) own left panel always visible, c) inside the existing piece palette as a group "Bảng mạch". → **3c** for the real app (one place to drag from); 3a is only the mock's shortcut.
4. **Sửa mạch khi đang ở trong một bản sao**: a) edit directly, banner warns "đổi cả 8 xe" (as mocked), b) ask once "Sửa cả 8 xe / Tách riêng xe này", c) read-only until "Sửa mạch" pressed. → **4a** for Giáo viên, **4c** for Học sinh.
5. **Xưởng lớn trên màn 1366**: a) auto-fit and accept small blocks, b) blocks collapse to name-only chips below 80% zoom, c) group repeats ("Xe AGV ×8" as one stacked block that expands). → **5c**; also removes most of the 25 wires.
6. **Tầng 1 (linh kiện)**: a) own view with crumb (as mocked), b) no view, selecting a card just shows properties in the side panel. → **6b**; the extra level adds a click and nothing to see.
