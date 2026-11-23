# L7 on board pieces: report (2026-11-03)

Branch `feat/l7-board` in `D:\workspace\GameBuilder-l7board` (2 commits on top of 1c75e43): `b5e3d8a` general pieces, `d4f408e` level 7 conversion. Dev port 5222 stopped. Not merged.

## Pieces added (all in Xưởng Nối too)
| Piece | What | Files |
|---|---|---|
| route-follow, advanced `stopFor` "Dừng ở mỗi điểm (giây)" | 0 = off (default). Walker stands still N s at each point. Applies to walkers in "Lái tới từng điểm" mode only (not vehicles, not rail). | `src/nodes/route-follow.ts` |
| route-follow, advanced `faceAtStop` "Khi dừng, quay mặt về" | `none` (default) / `item` = turns toward nearest loose item within hand reach, by one tiny stick push (0.02 u/s, below speed-sensor "still" limit) | same |
| route-follow output `atPoint` "Đang ở điểm" | true while standing at a point | same |
| NEW `next-free-slot` "Ô trống kế tiếp" / Next Free Slot (logic) | in: Ô 1..Ô 4 (objects); out: `slot` (first free marker, object, go-to target) and `full` (bool). Marker is "taken" when a loose, not-carried item's middle is over it (marker half-size + 0.25) | `src/nodes/next-free-slot.ts`, registered in `nodes/index.ts`, `node-names.ts` |
| Handbook | new page `next-free-slot` (+ try-board), route-follow page gets `atPoint`, `stopFor`, `faceAtStop` text | `src/handbook/*` |
| Lesson | new lesson `tidy-bot` "Bot cất thùng" (pack E, end of Bot chapter): guard bot with `stopFor`, porter bot with next-free-slot + go-to | `src/tutorial/lesson-tidy-bot.ts` |
| Removed | `pad-patrol.ts`, `pad-carry.ts` + registrations (slot-patrol, fetch-store stay) | `src/puzzle/` |

Old boards unchanged: `stopFor` default 0, `faceAtStop` default `none`; new output only adds a key.

## L7 board (what runs)
Robot walks pads -6,-3,0,3,6,9 (z=0), stops 0.5 s at each, turns to the crate beside it (lane z=1.02), red ones too. Player circuit decides grab, only when robot is still. Holding: route halts, go-to walks to next free slot (stops one hand-reach short, 1.05, so crate lands centred), arrive = drop, route resumes at the next point (emptied pads are skipped).

Left part, 4 columns (x 6/178/350/522), ASCII (L = locked card, P = player card, right side):
```
 col0            col1             col2              col3             |  right (player)
 [L Nhân vật]    [L Ô trống kế]   [L Chạy theo      [L Hoặc]         |  [P Đọc màu]   [P Và]
 [L Vật thể Ô1]   [tiếp]           tuyến]           [  still|full]   |  [P Đảo ngược]
 [L Vật thể Ô2]  [L Đi tới]       [L Phép tính +]   [L Và  (cổng)]   |   P Và.out -> L Và (cổng).A
 [L Vật thể Ô3]  [  to store]     [L Đo tốc độ]     [L Khiêng đồ]    |
```
Wires (locked): robot->route/go-to/hands/speed; route.moveX + go-to.moveX -> Phép tính -> robot.moveX; route.moveY -> robot.moveY; speed.still + hands.holding -> Hoặc -> Và.B; Và.out -> hands.grab; hands.holding -> route.stop and go-to.go; slots 1-3 -> next slot Ô1-Ô3; next slot.slot -> go-to.target; go-to.arrived -> hands.drop. Hands in toggle mode (as before: a stray signal while holding puts the crate down, so "Đảo ngược" still matters).

Visible (12 locked cards): robot, 3 slot marks, next-free-slot, go-to, route-follow, math add, speed-sensor, or, and (gate), carry. Each lists exactly its wired ports.
Hidden as scenery (not drawn, parked off-board at y>=640): floor, store mark, 6 pads, 6 crates, blue/red store zones, need, enough, win-lose, camera. Reason: they are the world and the win/lose plumbing, not robot behaviour. Hidden wires: zone->compare->win-lose only.

## Player side
Tray, par 3, freeHints 3, editable, task and hint text, stars, "?" unchanged. Reference solution unchanged except sw5: target moved from `hands.grab` to the locked gate `gate.a` (hands.grab is now fed by the locked gate; the board refuses a second wire there). Solution card positions unchanged (they are only used by tests; real cards go to free spots).

## Tests
- Gates: `npx tsc --noEmit -p .` clean; focused vitest green; FULL `npx vitest run --testTimeout 120000`: 138 files, 2335 tests, all pass. physics-invariants green (all 17 L7 answers).
- Reference solution wins at 17.7 s (limit 60). Each solution wire removed fails; `want=1` loses; solution wires pass canConnect (existing tests, retargeted to gate.a).
- Ported stop-grab tests: stops at every pad incl. red (also with nothing wired), faces crate, ~0.5 s stop, grab only after standing still within hand reach, never farther from store after grab before drop, crate centred in slot (store-slots test, <0.1), crate never jumps >0.3 per tick after grab.
- NEW anti-forced test `tests/puzzle/level-7-board-pieces.test.ts`: all level kinds exist in `registerAllNodes()` alone (registry cleared), the level builds and runs without `registerPuzzleNodes`, no old brain kinds, hidden set = scenery list only, every visible card shows its wired ports, cards in left part and non-overlapping.
- New unit tests: `route-follow-stops.test.ts` (6), `next-free-slot.test.ts` (7), `lesson-tidy-bot.test.ts` (4).
- Editor stability: all 16 samples, 31 lessons and the 54 handbook try-boards keep the same trajectory hash (0 of the 100 existing baseline entries changed). Added baseline entries only for the 2 new boards (`lesson:tidy-bot`, `handbook:next-free-slot`); summary snapshot got additions only. Node count test 54 -> 55; handbook input-logic test 20 -> 21.
- CRLF: only `store-slots.test.ts` was CRLF and stays CRLF; `git diff --stat` vs `-w` differ by 1 line total.

## Visual (Playwright, `plans/browser-scripts/l7-board-shots.mjs`)
Shots in `plans/reports/shots-l7-board/`: `board-desktop.png`, `board-phone.png` (+ `-with-solution`), `run-*.jpg`, `contact-run.jpg`. Read: desktop 1280x720 is clean: 4 columns left, player cards land on the right. Run in browser wins, 3 stars, no page errors or physics-watch warnings; frames show stop at pad, carry toward store, crates in slots.

## Not verified / concerns
- Phone 844x390: 12 locked cards do not all fit at readable scale (~0.7). In the plain level 2-3 cards (slot 3, speed sensor, hands) spill into the right area; with the solution placed the last card is partly clipped by the bottom edge. Text is small. Only fixable by fewer cards (e.g. hide the 3 slot marks as scenery: -3 cards, but the "Ô 1-3" wires would be invisible) or a layout change; I did not choose for you.
- Locked cards extend to ~70% of the board width (4 columns), not 60%; 3 columns do not fit 12 cards.
- Hint text still says wire "Và" into "Nhấc lên"; that port is now fed by a locked "Và" and the player's "Và" goes into that gate's A. Left untouched on purpose (you said text unchanged); wording may deserve a tweak.
- Route loops: after the last pad the robot walks back and stops at the pads again (old brain stood still after the last pad). Reference solution wins on the first sweep so it does not matter; a wrong circuit just keeps looping until timeout.
- A wire-less robot with the route `stop` input fed by "holding": if the robot grabs at the last pad it passes pad 1 on the way to the store and skips that stop on the next lap (cosmetic, second lap only).
- `stopFor` pause works in "Lái tới từng điểm" mode only (not rail, not vehicles); label says so.
- With route `lookAhead` left at default 2.5 the robot facing a crate would block itself; L7 sets lookAhead 0. Not documented in the handbook beyond the existing param text.
- Phone/tablet other than 844x390 and desktop widths < 1000 were not checked. Tutorial lesson `tidy-bot` was tested headless only, not clicked through in the browser.

Status: DONE_WITH_CONCERNS
Summary: Level 7 now runs only on editor pieces (new `next-free-slot`, route-follow stop/face/atPoint, existing go-to/carry/speed-sensor/and/or/math) as 12 visible locked cards; pad-patrol and pad-carry are deleted. All gates green (full suite 2335 tests), reference wins at 17.7 s, editor boards hash-identical.
Concerns/Blockers: phone layout is crowded (some cards spill/clip); hint text wording and solution wire sw5 target (now `gate.a`) need your call; locked cards take ~70% width.
