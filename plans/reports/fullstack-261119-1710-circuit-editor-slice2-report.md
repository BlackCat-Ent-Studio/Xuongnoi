# Bảng mạch – editor, slice 2 – implementation report

Worktree `D:\workspace\GameBuilder-circuit-editor`, branch `feat/circuit-editor-2` (base main `e45c0ed`), 8 commits, head `b9c75cd`, working tree clean. Not merged. Nothing in `D:\workspace\GameBuilder` touched except this report and `plans/reports/shots-circuit-editor-2/`.

Status: **DONE_WITH_CONCERNS** – a to i built and checked in a real browser; g untouched. Concerns at the end.

## What works (every line was run in the browser script below)

| | Item | State |
|---|---|---|
| a | Bàn thử "Chạy thử máy này" | Button in the path bar of an entered circuit. A strip opens under the board (same tab, full width; the floating game window moves up so it never covers it). Header: "Bàn thử: tên", "Chạy thử / Dừng", "Đặt lại", "Thoát bàn thử". Three columns: Chân vào (bool = switch + "Nhấn" hold button, số = stepper, also typed while running), Thông số mở (value the circuit holds; numbers by stepper, others shown with "Sửa"), Chân ra (live pills, 10 times a second). The game view shows and runs only that circuit (`expandCircuitAlone`). Works in Học sinh view-only too. |
| a | Object pins, honestly | Cannot be driven by hand: row says "Cần nối ở bảng ngoài" (tooltip explains). To try them: any card inside can be switched to "Chỉ để chạy thử" in its panel (dashed frame + tag "Chạy thử"), then wired to the port the pin leads to; the row then says "Thẻ chạy thử … đang cấp". Bench cards and their wires are never in a copy (`benchIds`, unit-tested on the flat graph). A pin not wired inside says "Chưa nối bên trong". |
| a | How pins are driven | Only general pieces: a bool pin gets a "Phím bấm" card with a made-up key, a number pin a "Số cố định" card; they exist only in the graph handed to the game, never in the board or the save file (checked: saved text has no trace). |
| b | Live values inside a copy | While the whole board runs, entering a copy shows that copy's values on wire badges and number pills (pin wires included: what arrives from outside). The note under the path bar says "Đang chạy: dòng điện của Xe AGV 3" (nested: "Trạm › Tay máy"). Another copy of the same circuit shows its own values (checked: copy 1 running vs copy 8 never started). Opened from the list (no copy chosen): no values, and the note says why. On the bench: "Đang chạy thử: dòng điện của riêng bảng mạch này". |
| h | Card ids | New cards (palette, paste/duplicate, copies of circuits) skip ids of notes and groups. Test proves the old clash on the shipped boards (note `n1`) and the fix on every shipped board; boards without a clash number exactly as before. |
| c | Xuất / Nhập one circuit | Row button "Xuất ra tệp" downloads `<tên>.bangmach.json` (the circuit + every circuit inside it). "Nhập từ tệp" under the list. Name taken: asked in the palette itself – "Giữ cả hai" (comes in as "Xe AGV 2"), "Thay bảng mạch cũ" (same id, all copies now use the file; wires on pins that are gone are removed; one Ctrl+Z undoes), "Thôi". A whole-board file is refused with a plain message. 0 browser dialogs. Reading goes through `parseBoard`, so the same rules and upgrades apply. |
| f | Màu riêng | Swatches (default + the 7 group colours) in the row ("Đổi màu") and in the summary of an entered circuit. Dot on the icon of every copy, in the list and in the inspector. Saved as `color`; default removes the field. |
| e | Chuyển nhóm thành bảng mạch | Button in the group inspector. The group becomes a circuit with one copy where the block stood, with the group's name and colour; crossing wires become pins. One undo brings the group back. |
| d | Mạch mẫu | Palette sub-list "Mạch mẫu" with "Thêm": **Đèn nháy** (Hẹn giờ lặp + Công tắc nhớ; pin Bật, pin Đang sáng, setting Nhịp nháy) and **Xe hai bánh tới mốc** (Thân robot + 2 Động cơ + Đi tới điểm; pins Mốc đích, Chạy, Đã tới, Còn cách, Thân xe; settings Vị trí xuất phát, Màu xe, Công suất; a floor and a marker as bench cards so it can be tried alone at once). Plain data in `io/starter-circuits.ts`, general pieces only. |
| g | Stacked "×N" | Not changed. |
| i | Scene tree / stage / step | Scene tree lists objects inside copies as "Xe AGV 3 › Vật thể #2"; a row opens that copy and selects the card; selecting a copy marks its objects in the tree. A click on the stage on an object inside a copy selects that copy on the main board (135 clicks swept: 3 hit copies, 31 main-board objects, no error). "Từng bước" stops on cards of an entered copy (browser-checked) and still stops on the main board. Written and unit-tested for the id mapping but **not looked at in the browser**: the green frame / glow on the stage for a selected copy, and a step stopping on a Đúng/Sai out pin of a copy on the main board (the seed board has none wired). Robots are not in the scene tree at all (the tree never listed "Thân robot"; unchanged). |

## Differences from the picked preview

1. The bench header (title, Đặt lại, Thoát) is the top line of the strip under the board, not a bar above it.
2. No "Bố cục bàn thử" switch (only "Dải bên dưới" exists, as picked).
3. No "Mô phỏng thử · minh hoạ" panel: the app's own game view (floating window or split) shows the real machine alone.
4. Bool pins have a switch and a hold button; number pins a stepper only (no slider).
5. "Thông số mở" on the bench are the circuit's own values ("giá trị bảng mạch đang giữ"), not values of the copy that was entered; changing one changes the circuit. The bench also ignores that copy's place and heading.
6. The bench starts with "Chạy thử" (or the top "Chạy" button, which runs the bench while it is open); the mock showed it already running.
7. Object pins: no hand control (see a).
8. Colour is per circuit, not per copy (same as slice 1 note 2).
9. Xuất / Nhập and the starter list sit in the palette group, not in a right-hand library tab (slice 1 choice 3c).

## Tests

- `npx tsc --noEmit -p .`: clean at head.
- Whole suite, one run (at `99f2884`; the two commits after it touch only DOM modules, a CSS class and no test): **286 files passed, 1 skipped (287); 4222 tests passed, 1 skipped (4223)**, 608 s, 0 failed, no timeouts. The skipped one is not mine.
- `tests/circuits` + `tests/editor` at head: 42 files, 838 tests, all pass. `solid-off-unchanged`, `real-physics-on-hash` pass; no baseline file changed (`git diff e45c0ed` on them is empty).
- New: `tests/circuits/bench-run` (5), `circuit-file` (6, incl. round trip, both clash answers, too-deep, bad files), `starter-circuits` (7: each starter runs on the bench and as copies on a real board, Vật lý thật on and off); `tests/editor/card-ids` (5), `circuit-bench-cards` (4), `circuit-library` (4), `circuit-scene` (7).
- Browser: `plans/reports/shots-circuit-editor-2/circuit-editor-2-flows.mjs` on port 5182 (stopped). Groups `bench live ids file colour group starters tree shots`; final run at head: **91/91 checks**, 0 page errors, 0 browser dialogs (`flow-results.json`). Slice 1 script run again from a scratch copy at head: 55/55. 44 PNG in the folder.
- Shots (I read them): `flow-a1…i3` per item (Giáo viên, Xám dịu) and `01…06` in Học sinh / Giáo viên × Xám dịu / Tối. Found and fixed from them: hold button stuck after a redraw, bench staying "open" after leaving by Esc, six row tools wrapping to a second line, starter text squeezed into a narrow column.
- Run it: `cd app; npx vite --port 5182 --strictPort`, then `PW_DIR=<folder with playwright-core 1.49.1> node ../../GameBuilder/plans/reports/shots-circuit-editor-2/circuit-editor-2-flows.mjs [groups]`.

## Files

New: `app/src/circuits/bench.ts`; `app/src/io/circuit-file.ts`, `starter-circuits.ts`; `app/src/editor/circuits/circuit-bench.ts` + `.css`, `circuit-scene.ts`, `circuit-library.css`.
Changed, circuits UI: `circuit-canvas`, `circuit-crumb`, `circuit-inspector`, `circuit-model`, `circuit-palette` (rewritten), `circuit-actions`, `circuit-wiring`, `circuit-views`, `circuit-text-vi`.
Hooks elsewhere in the editor (small): `app.ts` (+65), `wiring-canvas.ts` (+11), `scene-tree.ts` (optional source), `entity-drag.ts`, `step/step-run.ts` (optional `shownKey`), `properties-panel.ts` (export stepper, pass notify), `groups/group-inspector.ts`, `editor-state.ts`, `clipboard.ts`, `node-ids.ts`.
Core: `circuits/expand.ts` (`expandCircuitAlone` now also gives the circuit's own pins as `pinPort([], pin)`; an unwired pin gives no port), `circuits/index.ts`, `io/file-io.ts`, `io/index.ts`, `io/text-vi.ts`.
Not touched: `world/**`, `nodes/**`, `render/**`, `engine/**`.

## Limits (not covered)

- Bench values typed by hand live for the session only; they are not saved with the board.
- During a bench run, going into a copy inside the circuit shows its live values, but stage frames and the scene tree still assume the bench level.
- Stage: an object inside a copy cannot be dragged (the copy is selected instead; move it with "Vị trí đặt"). Step run: objects of cards inside an entered copy do not glow on the stage (cards and wires on the board do). One-tick pulses on wires inside a copy show their value but not the flash.
- Scene tree always lists the whole board (or the bench circuit), also while another circuit is open.
- Live edits of a setting inside a circuit while the whole board runs still apply on the next run (slice 1 limit); in a bench run they apply at once.
- Import: "Giữ cả hai" twice brings the inner circuits in twice; "Thay" matches pins by id, so it is meant for a newer file of the same circuit.
- Two starter circuits, not three. "Đèn nháy" has no lamp object (no such piece): its output is the blinking signal.
- Slice 1 limits about zoom floor, groups inside circuits and turned copies stand.

## Concerns

1. **Bug on main, not fixed (outside my files):** on a "Vật lý thật" board the very first "Từng bước" press after the page loads starts the game but does not arm the step run, because the game view loads the physics engine first and is not "playing" yet when `step-run` asks. Same on the main board without circuits. Second press works. Cure is in `render/game-view` or in how `step-run` waits.
2. While the bench is open, the top-bar "Chạy" runs the bench, not the whole board. The strip, the toast and the note say so, but it is a rule the owner should confirm (Q3).
3. `pinPort` for an unwired pin of a copy used to return an empty port and now returns nothing (as its comment always said). No caller relied on the old value; listed because it is a core behaviour change.

## Questions for the owner

1. Thông số mở trên bàn thử: 1a) giá trị gốc của bảng mạch (hiện nay, đề xuất), 1b) giá trị riêng và chỗ đặt của bản sao vừa mở.
2. Giá trị gõ ở bàn thử: 2a) chỉ nhớ trong lúc đang mở (hiện nay), 2b) lưu theo bảng.
3. Khi bàn thử đang mở, nút "Chạy" ở thanh trên: 3a) chạy bàn thử (hiện nay, đề xuất), 3b) luôn chạy cả bảng.
4. Mạch mẫu: 4a) giữ 2 mạch, 4b) thêm mạch thứ ba (cho biết muốn máy gì).
5. Lỗi "Từng bước" ở lần chạy đầu (mục Concerns 1): 5a) giao cho nhóm render sửa (đề xuất), 5b) để sau.

## Follow-up (commit `8db147e`): values covering port names

- Cause: not two pill layers. The second "pill" was the wire value badge. It was always drawn at the middle of its wire, whatever was there; a wire that runs behind a card (back to an earlier card, or out from under its own card) put its badge on that card's port names and pills. Same on any busy board on main; it showed most inside a circuit because of the many backward wires.
- Fix: `editor/graph/badge-placement.ts` – the badge slides along its wire to the place nearest the middle that is clear of every card, pin card and badge already placed (hook in `wiring-canvas.ts` `drawWires`). No free place on the whole wire: the badge is left out (seed board: 40 of 40 wires inside the copy keep theirs, 15 of 16 on the main board). Applies to every board while it runs.
- Second fault found while checking: a pill on the dot of a number pin card ("9.00" half under the dot). Pin cards now show no pill; the wire badge beside them carries the value.
- Check added (group `overlap`, light Giáo viên + dark Học sinh, fit zoom and 100 %, live copy, bench, the circuit with number pins, main board): one pill per port, no pill on a name or a dot, no badge on a name, a pill or another badge. It failed on the old code for both faults and passes now.
- Whole flow script at head: 103/103, 0 page errors, 0 dialogs. `tsc` clean; `tests/circuits` + `tests/editor`: 43 files, 843 tests pass (5 new in `badge-placement.test.ts`). Whole suite not run again.
- Stacked HUD lines in "Xem mô phỏng": a board matter. The seed circuit contains the sample's own "Hiện số" / "Hiện chữ" cards, so 8 copies print the same lines at the same corner; on the bench (one machine) each line shows once.
