# Naming review page - report

Folder: `D:\workspace\GameBuilder\plans\ui-mockups\naming-review\`
Open: `index.html` (self-contained, double-click). No change under `app/`.

## Files
- `index.html` - review page (generated; do not edit by hand)
- `naming-proposal.json` - 57 nodes, 295 ports, ids unchanged
- `new-names.mjs` - the proposal (only changed rows). Edit this, then `node build.mjs`
- `template.html`, `build.mjs` - generator (reads live `node-names.ts`, inlines real `node-cards.css`)
- `shot.mjs` + `shots/` (top, full, cards, flagged PNG)

## Counts
| | Changed | Total |
|---|---|---|
| Nodes | 8 | 57 |
| Ports | 162 (161 Vietnamese, 89 English) | 295 |
| Items | 170 | 352 |

Note: the table in `node-names.ts` has 295 port rows (not ~296). `is4-6` / `step4-6` follow `extraNames` and are not rows.
Node changes are few on purpose: most node names were already clear/standard (marked "giữ").
Nodes changed: go-to (Di chuyển, user decision 2b), touch (Va chạm / Collision), map-range (Quy đổi khoảng), ui-dialog (Hộp thoại / Dialog), nearest-item (Tìm đồ gần nhất), spawner (Tạo đối tượng), sequence (Chuỗi bước), ui-pick (Bấm vào đối tượng).
teleport and moving-platform untouched (user decision).
35 outputs are tagged "1 nhịp" (pulse) on the page: Khi … / Bắt đầu … / Kết thúc ….
No new Vietnamese name exceeds 18 chars (old: 2 did). No "Vừa", "Mới", "(vật)", "(1 nhịp)" remain.

## 15 most impactful renames
1. touch.a / touch.b: Vật chính / Vật kia -> Đối tượng A / B
2. touch node: Chạm nhau -> Va chạm (Collision)
3. touch.began / ended: Mới chạm / Vừa rời -> Bắt đầu chạm / Kết thúc chạm (Enter / Exit)
4. go-to node: Đi tới -> Di chuyển
5. go-to.target (+2): Đích (vật) -> Điểm đến (same word in teleport, route-follow)
6. go / on (go-to, chase, fight, patrol, route-follow, moving + rotating platform, portal, camera): Cho đi / Hoạt động / Chạy -> Bật (Enable). 8 nodes, one word
7. counter: Cộng 1 / Trừ 1 / Về đầu -> Tăng 1 / Giảm 1 / Đặt lại (Increment / Decrement / Reset)
8. Về đầu / Làm lại từ đầu / Đếm lại (counter, sequence, timer) -> Đặt lại: one Reset word
9. map-range node: Đổi thang số -> Quy đổi khoảng; ports Số vào/ra -> Giá trị vào/ra
10. All `self` outputs (block, item, character, vehicle, portal, platforms): Vật thể/Nhân vật/Xe/Bệ/Cổng... -> Đối tượng (Self)
11. block / item: Ẩn đi (1 nhịp) / Hiện lại (1 nhịp) -> Ẩn / Hiện
12. All "Vừa …" pulses (about 35 outputs) -> Khi … / On …
13. who / Ai / Vật / Vật nhìn inputs (sensors, teleport, ui-pick, nearest-item) -> Đối tượng
14. sequence: Việc 1-3 / Xong việc -> Bước 1-3 / Sang bước kế (Step / Next)
15. ui-dialog: Hộp hỏi -> Hộp thoại; Chọn 1-3 -> Khi chọn 1-3

## Card widths (real CSS, measured in Chromium at 1280, system font fallback)
Card min-width is 168px, so most cards do not grow at all.
| Card | Current | ① Tên (English) 1 line | ② English small, line 2 |
|---|---|---|---|
| Di chuyển (go-to) | 168 | 193 (+25) | 168 (+0) |
| Va chạm (touch) | 168 | 183 (+15) | 168 (+0) |
| Hẹn giờ (timer) | 168 | 168 (+0) | 168 (+0) |
| Vật thể (block) | 168 | 168 (+0) | 168 (+0) |

① caveat: the help "?" button sits on the header corner without taking room, and in ① the title text runs under it. Overlap is about 13-20px. A real implementation needs about +21 to +28px extra, so go-to ~221px, touch ~211px, timer/block ~189px.
② never grows (the real `.wc-sub` is clipped and never adds width). English was fully visible on all 4 cards. Long English subtitles (e.g. "Enter / Exit Vehicle") would be clipped with "…" in ② because the card keeps its width.

## Risks
- Truncation: ① shows English clipped/under "?" unless header padding-right is added. Only 4 cards were measured; longer ones such as "Bấm vào đối tượng (Click Object)" or "Lên / Xuống xe (Enter / Exit Vehicle)" will be wider still.
- Font: "Be Vietnam Pro" is not bundled (no @font-face), so the app uses the system fallback. Widths above use the same fallback; on Mac/Android they differ a bit.
- Layout: boards laid out before keep node positions, but cards that grow under ① may overlap neighbours (go-to +25px).
- Content that quotes old names will go stale: lessons, handbook (`app/src/handbook/content-*.ts`), tutorial copy, node `description` strings (they say "Mới chạm", "Cho đi", "Đích (vật)", "Việc 1" etc.), tests that look up labels. Not checked or changed here. Renaming needs a text sweep.
- `node-names.ts` `was` / `wasEn` aliases must be extended (add old names so palette search still finds them), and `extraNames` (is4-6, step4-6) must follow Bước.
- "Đối tượng" is more abstract than "Vật" for a young non-coder. Unverified with real users.
- Unity-style "Stay" is a per-frame event in engines but a held state here: left as is (user listed Enter/Stay/Exit as standard).
- Pulse tags are inferred from port names, not from code. Real timer `done` seems held for a tick when repeat is on; kept "Hết giờ".

## Open questions
1. route-follow `go` ("Chạy") vs `on` ("Bật"): `go` only matters in leg mode; I kept "Chạy" / Go. Want a clearer word (e.g. "Xuất phát")?
2. sequence: switch Việc -> Bước everywhere (Chuỗi bước, Bước 1-3)? Cost: lesson/handbook text.
3. ① or ②? (② keeps today's footprint; ① is wider and needs header padding.)
4. "Bật" for every enable input (including moving-platform "Chạy" and go-to "Cho đi") OK, or keep "Chạy" for machines?
5. "Quy đổi khoảng" for Map Range, or a more literal "Đổi khoảng số"?
6. Should port labels also show English on the card (currently tooltip only)? Not in scope of 1c, not shown.
7. touch EN: Object A / Object B (consistent with Distance) vs Self / Other (Unity)?

Status: DONE_WITH_CONCERNS
