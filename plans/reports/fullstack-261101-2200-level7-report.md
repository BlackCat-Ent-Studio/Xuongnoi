# Level 7 "Phân loại thùng màu" - report

Branch feat/level7 (worktree D:\workspace\GameBuilder-level7), commit c426705. Dev server :5205 stopped.

## Engine feasibility (proved headless, then in browser)
Design works with ONE adaptation. color-sensor reads only BLOCKS (kind block), and carry grabs only ITEMS, so a crate cannot be read directly. Fix: each crate (item, tagged xanh/do) sits on a coloured pad (block, same colour). The robot reads the pad under its feet ("Dưới chân"); the grabbed crate is the one on that pad. Sensor tray params: color1 red #ef4444, color2 blue #3b82f6, want starts 1 (red), player must set 2 (editable).

## Level
- id phan-loai-mau, order 7, 3D, cast robot-legs, par 3, freeHints 3, timeLimit 60 (solution wins at ~27 s).
- Locked: floor, store mark, 6 pads + 6 crates (R B R B R B), patrol brain (store x=-10 to x=11), drop zone (bot) -> carry.drop, blue-store zone (goods xanh) count >= 3 -> win, red-store zone (goods do) inside -> lose, camera.
- Player pieces: Cảm biến màu, Không, Và (+ decoy Hoặc). Wires: robot.self->sensor.Vật; sensor.Đúng màu->Và.A; carry.Đang cầm->Không->Và.B; Và->carry.Cầm. Plus set Màu cần tìm = 2.
- Why Và is real: carry is toggle mode; a blue pad seen while holding would DROP the crate. Empty blue pads stay blue, so "blue alone" drops the crate on the way back and never wins (tested).

## Tests (tests/puzzle/level-7.test.ts + shared levels-5-8 generic suites)
solution wins; empty = timeout; each wire removed not win; each piece removed not win; want=1 (red) -> lose "đỏ"; want=3 -> timeout; blue-alone not win; Không unwired not win; tray spare = only Hoặc; over-built with decoy wins at 2 stars, solution 3; exhaustive: every wiring of <=2 pieces with <=3 wires (one into Cầm) never wins; real canConnect per wire; shown ports; no key/stick; no card overlap in 1000x560. Old level kept in levels/archive/level-cau-nhap-nhay.ts (not in PUZZLE_LEVELS) with its tests moved to tests/puzzle/archive-cau-nhap-nhay.test.ts. tests/puzzle: 14 files, 251 tests green; tsc clean; npm run build OK.

## Guide text
guide-script.ts: WIRE_LINES 'phan-loai-mau' sw1..sw5 replaces 'cau-nhap-nhay'; KIND_PURPOSE 'color-sensor' (new-piece intro line works: seen in shot). Level 7 has no auto guide (same as levels 2-8). guide-script.test.ts line for level 7 param changed seconds=3 -> want=2.

## Browser (Playwright, script plans/browser-scripts/puzzle-level7-check.mjs, shots plans/reports/shots-level7/, all READ)
1280x720 and 844x390: intro line, "?" hints (ghost on tray chip), build 3 pieces + 5 wires + set want 2, CHẠY -> win card 3 stars; want 1 -> robot carries red crate, no win. Map shows "Phân loại thùng màu" at node 7.

## Saved progress
Progress is keyed by id. Old stars under 'cau-nhap-nhay' no longer count: a player who only had that level done will see level 7 as open (level 6 stars) but level 8 stays locked until the NEW level 7 gets stars. Map unlock rule untouched; it already works by id (verified: level 7 opened with level 6 stars, level 8 follows level 7).

## Notes
- levels/index.ts unchanged (still imports ./level-07).
- levels-5-8.test.ts keeps CRLF (restored after edit).
- Stage is small/robot tiny in overview; stage restyle is the other agent's area (render/** not touched).

Unresolved: none blocking.
