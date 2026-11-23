# Rename overhaul report (2026-11-05)

Branch `feat/rename`, worktree `D:\workspace\GameBuilder-rename`, commit `dea7db8` (from main b91878b).
Dev server for the user: http://localhost:5243 (left running, started from the worktree).

## What changed
- `new-names.mjs` already held all final answers (1a-4a, go-to = "Di chuyển"); rebuilt with `node build.mjs`, `naming-proposal.json` and `index.html` are in sync (161 vi / 89 en port changes, 8 node renames).
- `app/src/nodes/node-names.ts`: 8 node names + 162 ports (ids untouched). Node aliases: `was` now accepts `string | string[]`, so old names stay searchable (go-to "Đi tới", sequence "Chuỗi việc", touch "Chạm nhau" + "Cảm biến chạm", ui-dialog "Hộp hỏi", spawner "Tạo vật mới" + "Sinh vật thể", ui-pick "Bấm vào vật", nearest-item "Tìm vật gần nhất", map-range "Đổi thang số"). Old English terms for touch ("Collision / Touch") and ui-dialog ("Dialog / Choice") kept as `wasEn`. Ports have no alias mechanism: skipped. Extra sequence ports 4-6 now "Bước 4-6".
- Node definition labels (`nodes/*.ts`, 153 label strings + 4 template labels) aligned with the new names (display is overridden by node-names anyway).
- Enable ports: go-to / chase / fight "Cho đi", patrol "Hoạt động", moving-platform / rotating-platform "Chạy" are all "Bật". Checked in code: route-follow "Chạy" (`go`) is a per-leg start trigger, NOT an enable (enable is its `on` = "Bật"), so it stays "Chạy". Timer "Chạy" became "Bắt đầu" per proposal.
- Text sweep, about 750 edits in 118 files: node descriptions, handbook (content, boards), lessons (all `text-vi*`, `lesson*`), puzzle levels 1-7 hints, `guide-script.ts`, `board-state.ts`, `start-wire-steps.ts` table, comments that quote names, tests. "Việc" became "Bước" in all sequence text and params (`Số bước (2-6)`, `Lặp lại từ bước 1`). Short forms used in prose were also fixed ("Đích" to "Điểm đến", "Ngang"/"Dọc" to "Trục ngang"/"Trục dọc", "Còn"/"Cần" to "Giây còn lại"/"Giây cần thiết", "Ngắm vào" to "Mục tiêu", "Ẩn đi"/"Hiện lại" to "Ẩn"/"Hiện", "Nơi đến" to "Điểm đến", "Đổi màu" to "Đặt màu").
- Param labels that quoted a port: go-to / teleport position now "Vị trí đến (khi không nối Điểm đến)".
- Context-sensitive: quoted "Nhân vật"/"Vật thể"/"Xe"/"Ai"/"Có"/"Chạy"/"Bấm" edited per case (output side to "Đối tượng", input side kept). Enter-exit legacy port "Bấm" is now "Bấm (cũ)" in lesson text (lessons still wire that port).
- CSS (`editor/graph/node-cards.css`): `.wc-sub` 11px/600/.72 alpha to 12px/700/.9 alpha, line-height fixed to 13.2px (the old computed value) so the header height does not grow. Card sizes in the browser: 168 wide, same heights as before the tweak (103/259/181/129/285/77); `estimateNodeSize` untouched. Port rows show Vietnamese only, English stays in the tooltip.
- New test: palette search finds the 8 renamed nodes by their old names. Test expectations updated: node-names, nearest-item, route-follow-objects, course-pack-c, groups-model (`Nhân vật · Đối tượng`), plus prose in several test titles.

## Verification
| Check | Result |
|---|---|
| `npx tsc --noEmit -p .` | clean |
| vitest, whole suite, split in two runs because other agents' vitest runs starve the machine (a single run did not finish in 20+ min) | run 1: tests/nodes, engine, io, handbook, render, helpers, registry: 72 files, 1166 tests pass. Run 2: tests/editor, puzzle, tutorial, world: 94 of 95 files, 1575 of 1576 pass; the 1 failure was the group-port label expectation, fixed, file re-run green (with node-names.test: 19 tests pass) |
| solid-off-unchanged baseline, step-break samples, all lesson/level sim tests | green in the runs above (names are display only; ids/params untouched) |
| `git diff --stat` equals `--stat -w` | yes (CRLF preserved) |
| Playwright on :5243 | editor sample "Nhặt sao": cards show new names + English line (Va chạm / Collision, Bộ đếm / Counter, ...), ports "Đối tượng", "Đối tượng A/B", "Khi nhấn phím", "Tăng 1", "Đặt lại", "Đã đạt mục tiêu". Palette search "Đi tới" returns go-to, "Chạm nhau" returns touch, "Chuỗi việc" returns sequence, "Hộp hỏi" returns ui-dialog. Handbook page opened (Cần điều khiển, example text uses new names). Puzzle /giai-do.html level 3: board cards + guide bubble render; no page errors |

Shots: `D:\workspace\GameBuilder\plans\reports\shots-rename\` (01 editor, 02 palette search, 03 handbook, 04 puzzle level 3, 05 puzzle hint, plus 04a/04b list screens). Script: `plans/browser-scripts/rename-check.mjs`.

## Intentional leftovers (old words still in the source)
- Node names that did not change and port names that did not change: "Nhân vật" (character node, plus the input port of Khiêng đồ / Tương tác / Cầm dụng cụ / Lên-Xuống xe / Máu), "Vật thể", "Đồ vật", "Xe" (node names; cargo input "Xe").
- "Chạy" of Chạy theo tuyến (leg trigger, see above); "Có"/"Không" yes/no option labels and dialog default answers; camera option "Đứng yên", go-to param "Đứng yên bao lâu".
- Free text typed on handbook/lesson boards (HUD labels `Số màu`, `Còn (giây)`, `Góc (độ)`, `Đang có`, 'Đã đủ gần cờ!'): these are the board author's own words, not port names.
- Verb uses of "Đi tới" in lesson titles and sentences ("Đi tới đích", "Đi tới thùng đó") and "Chọn 1 mở cổng" / "Đếm lại mãi mãi" step titles: plain Vietnamese, not names.
- Archived level code `puzzle/levels/archive/slot-patrol.ts` (own port labels "Hoạt động", "Vừa tới ..."), item output "Đang cầm tay" (not in the proposal).
- `HANDOFF.md` and `plans/` mockups (history, not product text).
- `node-names.ts` itself keeps old names in `was` aliases.

## NOT verified
- Only the Vietnamese-first card view was looked at in two screenshots; I did not inspect every node card at 100% zoom, so ellipsis of long new names ("Đã đến điểm đến 2", "Hide while on") on 168px cards is not checked one by one.
- Touch devices / phone layout, 3D editor modes and puzzle levels other than 3 were not opened in a browser; their text comes from the same tables and passed the unit tests.
- Texts rewritten by pattern (about 750) were reviewed from grep context, not read one by one in the running UI; a few awkward phrasings may remain (for example "Đối tượng" repeated in handbook examples such as `"Đối tượng" của Xe → "Đối tượng"`).
- The handbook page for go-to / sequence was not opened in the browser (only Cần điều khiển).
