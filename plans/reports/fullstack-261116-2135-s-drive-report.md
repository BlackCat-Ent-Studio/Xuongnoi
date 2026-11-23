# s-drive: three automated driving samples (feat/s-drive, worktree D:\workspace\GameBuilder-sdrive, dev :5273 running)

Branch from main 15cfec5. All three: mode 3D, floor block, Máy quay follow (tilted) on the robot, readouts, notes in simple Vietnamese. Only existing pieces; no change in src/nodes, src/world, src/render. No key / stick / button piece anywhere (tests assert it).

## Files
| File | Change |
|---|---|
| src/samples/robot-line-follow.json | converted to 3D (mode 3d, + floor block `san`, robot y 0.8, camera view tilted zoom 0.7), note n4 rewritten with 3 experiments |
| src/samples/robot-avoid.json | NEW (50 cards, 57 wires, 4 notes) |
| src/samples/robot-square.json | NEW (39 cards, 49 wires, 4 notes) |
| src/io/samples.ts | 2 import lines + 2 appended sample lines + line-follow label "nhìn từ trên" -> "3D" |
| tests/io/robot-line-follow-sample.test.ts | simulate in the board's own mode, assert 3d + floor + tilted camera, allow `block` |
| tests/io/robot-avoid-sample.test.ts, robot-square-sample.test.ts | NEW |
| tests/io/samples.test.ts | ids + modes lists, additive (+ robot-avoid, robot-square, line-follow now 3d) |
| tests/editor/solid-off-baseline.json, solid-on-summary.snap.json | additions only (script check vs `git show 15cfec5:`): added sample:robot-avoid, sample:robot-square; CHANGED entry: sample:robot-line-follow (it is 3D now). Nothing missing. |

CRLF: `git diff --numstat` equals `--numstat -w` for every changed file. The sample JSON files were written CRLF with no trailing newline like the existing ones.

## 1. Robot dò đường (3D)
Same wiring as before (see fullstack-261116-1710-robot-integrate-report.md), only: mode 3d, floor 24 x 1 x 16 under the figure-8 (line-track centre y 0.5 = floor top), Máy quay `view: tilted, zoom 0.7`. Tests (kept): > 2 laps in 60 s, max drift < 0.2 m, camera target = robot, speed + plot on HUD, 13 anti-forced wire cuts, Kp = 0 fails. All pass in 3D with the SAME params (Kp 3, speed gain 1.3), so no retune was needed.

## 2. Robot tránh vật cản
Room 16.5 x 11.5 m inside 4 walls (0.5 thick, 1.2 high) + 3 orange boxes. Robot 0.9 x 0.7, start (-6, 3.5) heading -20.
```
Thân --self--> Mắt trái / Mắt giữa / Mắt phải (.who), Động cơ trái/phải (.body), Máy quay.target
Mắt trái  : Dò phía trước reach 1.5, mountSide -0.35, mountForward 0.3, lookAngle -60, beam 0.15
Mắt giữa  : Dò phía trước reach 3,   mountForward 0.3, beam 0.6
Mắt phải  : Dò phía trước reach 1.5, mountSide +0.35, mountForward 0.3, lookAngle +60, beam 0.15

phải.distance - trái.distance --[trừ]--> Quy đổi (-0.7..0.7 -> -1..1)  = lái theo bên thoáng  --a--> [cộng] lái
giữa.distance --> Quy đổi (0.5..1.5 -> 0.3..0) (đẩy sang phải khi phía trước hẹp) --b--> [cộng] lái
giữa.distance --> Quy đổi "tiến" (0.25..1.6 -> -0.4..0.9)  = tốc độ: xa chạy 0.9, gần chậm, rất gần âm (lùi)

chế độ lùi (Bộ đếm 0/1):
  Thân.speed < 0.2 --> Hẹn giờ 1 s (lặp)  --done-->  [Hoặc] --> Bộ đếm.set (giá trị mới 1)
  giữa.distance < 0.6 ----------------------------^
  Bộ đếm.reached --> Hẹn giờ 1.2 s --done--> Bộ đếm.reset
  Bộ đếm.value -> Quy đổi (1..0) x tốc độ  + Quy đổi (0 -> -0.5)  = tốc độ cuối
  Bộ đếm.value -> Quy đổi (0 -> 0.6) cộng vào lái (quay thêm khi lùi)
Động cơ trái.power = tốc độ cuối + lái ; Động cơ phải.power = tốc độ cuối - lái
HUD: Hiện số (cách phía trước, tốc độ), Đồ thị 3 mắt, Hiện chữ x3 (đi thẳng / né / lùi và quay)
```
Why a counter: bool -> number is not wirable, so the 0/1 "reverse mode" is a Bộ đếm (set / reset) turned into numbers by Quy đổi khoảng.

Tuning notes (honest): wide side beams at 2.5 m reach made the front eye useless (cutting it changed nothing), so side reach is 1.5 m and angle 60. Without the stuck-watchdog the robot sat in a stable "stop" pose between a box and a wall (found in a 6-start sweep) -> added the timer + reverse mode. The speed rule alone rarely gets below 0.6 m, so the reverse-turn mostly shows when it starts very near a wall or gets stuck.

Tests (tests/io/robot-avoid-sample.test.ts, 5): general pieces only + no hand-control pieces + 3 eyes at -60/0/+60; cards apart; 60 s with min gap to any wall/box > 0.15 m (measured about 0.47 on the shipped start), distance > 60 m (about 85), covers x span > 5, z span > 4; reverses and turns away from a wall when started 0.8 m in front of it (gap stays > 0.03); 4 other starts (positions/headings) keep gap > 0.1 and > 50 m; anti-forced: front eye without Thân wire -> touches a wall (gap < 0.02); front distance not reaching the speed rule -> < 40 m; either motor power wire cut -> stays within 4 m (circles); either motor body wire cut -> within 4 m.

## 3. Robot đi hình vuông (encoder)
2 m square drawn on the floor by a Đường line (tự vẽ, 4 points, only a guide). Robot start (-1, -1) heading 0. Chassis `showDistance`, left motor `showTurns`.
```
Chuỗi bước (2 bước, lặp)  step1 = đi thẳng, step2 = quay tại chỗ, index 1/2
Thân.distance >= Số cố định 2 ----[So sánh]--> [Và step1] --> [Hoặc] --next--> Chuỗi bước
step1 --set--> Bộ đếm "giữ hướng" (giá trị mới = Thân.heading)  : nhớ hướng đầu cạnh
Thân.heading - nhớ = lệch góc
 lệch >= 89                                   (không vòng)
 hoặc (lệch >= 89-360 và lệch < -180)         (hướng chạy vòng qua 180)      --> [Hoặc] --> [Và step2] --> [Hoặc]
step2 --resetDistance--> Thân (quãng đường về 0 khi bắt đầu quay)
index --> Quy đổi (1..2 -> 0.6..0) "tiến", Quy đổi (1..2 -> 0..0.1) "xoay"
Động cơ trái.power = tiến + xoay ; Động cơ phải.power = tiến - xoay
[Và step1.so sánh] --up--> Bộ đếm cạnh --> Hiện số cạnh, / 4 = Hiện số hình vuông
HUD: cạnh đã đi, hình vuông, quãng đường cạnh này, hướng, vòng bánh trái (encoder), Đồ thị hướng, Hiện chữ x2 (đi thẳng / quay tại chỗ)
```
Tuned: leg 2 m, spin power 0.1, turn threshold 89 deg (turn is relative to the heading at the start of the side, so the small coast after the stop adds about 1 deg; with 89 the error does not build up: heading after sides 4/8/12 = 0.0/-1.3/-0.5 deg off, position within 0.15 m). With threshold 90 the error grew by about 1.4 deg per turn.
A 90-degree turn needs a wrap fix because `heading` runs -180..180: the "lệch" is accepted when >= 89 or when it already wrapped (< -180) and >= -271. These are 3 extra So sánh + Và + Hoặc and 3 constants. This is the only awkward bit (no modulo / angle-difference piece).

Timing: one square is about 20 s (turn power kept low on purpose): 3 squares in 60 s, 8 sides by 40 s.

Tests (tests/io/robot-square-sample.test.ts, 5): general pieces only; cards apart; after side 4 position within 0.3 m of the start and heading within 10 deg, same after side 8 (2 squares inside 45 s); every side 1.7..2.4 m; readouts (sides, distance, heading, wheel turns, plot) and camera on the robot; anti-forced: distance wire cut -> 0 sides, never turns (heading change < 5 deg); heading wire cut -> stuck in the turn (sides 1, spun > 360 deg); 16 other essential wires cut one by one -> no closed square.

## Verification
- `npx tsc --noEmit -p .` clean.
- Focused: robot-line-follow, robot-avoid, robot-square, samples, solid-off-unchanged (132) and solid-on-invariants (131, summary snapshot updated) green.
- Full vitest: see the last section.
- Playwright :5273 (plans/browser-scripts/s-drive-check.mjs, shots in plans/reports/shots-s-drive/, all read): `line-2/3-run.png` figure-8 in 3D, robot on the line, speed + plot; `avoid-2/3-run.png` room with boxes, robot, 3 distances + plot + state text; `square-2/3-run.png` guide square, robot, 5 readouts, heading plot; `*-1-board.png`, `*-1b-board-fit.png` the board (zoomed out). Opened from Tệp -> Bài mẫu. Only console error: one 404 (favicon, as before).

## NOT verified
- Real touch / phone, sound, weak GPUs.
- The boards are large (avoid 7 columns x 9 rows of cards, square similar); the board screenshots only show part of the wiring at a readable zoom. Layout is by dataflow columns, not hand-polished.
- Orange state text on the grey floor (colour changed to #9a3412 after the first screenshot, not re-shot for the avoid board).
- Obstacle robot reversing into a wall behind it (no rear eye): not covered; only the start-0.8 m-from-wall case is tested.
- Coverage of the room: the robot follows a repeating loop (limit cycle) in about 40 percent of the room cells; it never touches but does not wander everywhere. A "wander" timer was tried and dropped (YAGNI, and it made the reverse/escape logic less predictable).
- The 3D robot picture: wheels are small black boxes, nothing else checked.

## Missing pieces (found, worked around, no engine change)
1. No bool -> number piece, so the 0/1 mode and the straight/turn speed switch go through a Bộ đếm / Chuỗi bước `index` + Quy đổi khoảng.
2. No angle-difference / modulo piece: the 90-degree turn test needs the wrap handling above.
3. Hiện chữ cannot show a changing text, so three Hiện chữ cards are shown/hidden by state.

## Unresolved questions
- Should a Dò phía trước on the BACK of the chassis be a standard part of the avoider (safer reversing)?
- Is a 20 s square (slow, accurate turn) fine for the demo, or should the turn be faster with a looser angle?

## Full vitest (--testTimeout 300000), commit f56f70c
199 files, 3134 pass, 2 fail on the first run under load: `city-delivery-3d red light` (passes alone) and `puzzle/level-7-decoy` (its own 900 s cap; known slow brute-force test, timed out again alone at 900 s, puzzle code untouched by this branch). Everything else green, incl. solid-off-unchanged 132 and solid-on-invariants 131.
