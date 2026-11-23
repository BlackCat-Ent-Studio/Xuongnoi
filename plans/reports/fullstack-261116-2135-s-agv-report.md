# Sample "Xe tự hành chở hàng (AGV)" (feat/s-agv, worktree D:\workspace\GameBuilder-sagv, dev :5275 running)

Branch from main 15cfec5. Menu id `agv-shuttle` (Tệp > Bài mẫu, appended as the LAST line of SAMPLES + one import line). Mode 3D. Built only from existing pieces (kinds used: block, line-track, robot-body, line-sensor, math, map-range, const, pid, motor, zone, compare, and, or, not, sequence, joint, link, gripper, spawner, linear-actuator, counter, show-number, show-text, camera, on-start). No new node, no engine change, no hidden helper. Nothing is driven by a key, stick or button: it runs after "Chơi".

Files: `src/samples/agv-board.ts` (builder, plain data, exports AGV_SETTINGS + AGV_WIRES), `src/io/samples.ts` (+2 lines, CRLF kept), `tests/io/agv-sample.test.ts` (new, 10 tests), `tests/io/groups-save.test.ts` (one additive line: the AGV has 5 groups), `tests/io/samples.test.ts` (additive: id/mode lists, menu list), baselines `tests/editor/solid-off-baseline.json` (+1 entry `sample:agv-shuttle`) and `solid-on-summary.snap.json` (+1 row).

## The machine (3D, floor 20 x 11 m)
- Line: closed loop 7 x 5 m, corner radius 1.4 m, width 0.3 m. AGV (orange chassis 1.2 x 1.0 x 0.3 m) goes clockwise seen from above.
- LOAD station (left edge, x = -3.5): fixed arm on a pillar at x = -5.5 (outside the loop), supply table at x = -7.5 where the spawner drops a 1 kg crate.
- UNLOAD station (right edge, x = +3.5): piston inside the loop (barrel x 0.1..2.3), receiving platform at x 4.25..6.0 with an end wall. Pushed crates queue along the platform (the 2nd crate pushes the 1st one along: 2 x 4.9 N).
- Camera: fixed, tilted view, point (-1.4, 0.8, 0.1), zoom 0.92, whole machine in frame. HUD: payload kg, speed m/s, crates delivered, laps; floating state text above the AGV (green "Đang chạy theo line", blue "Trạm nạp...", red "Trạm dỡ...", red "QUÁ TẢI...").
- 6 board notes in simple Vietnamese (what it is, line following, stops, arm sequence, piston, "Thử đổi thông số" with 4 experiments). 5 groups (Ctrl+G model, `graph.groups`): Bám line (10 cards), Trạm dừng (11), Tay máy nạp hàng (31), Dỡ hàng (2), Đếm và hiện số (14). World pieces (floor, line, AGV body, pillar, table, platforms, camera, start) stay loose on the main board.

## Wiring per group (ASCII)
```
BÁM LINE
 Thân.self -> 3 Mắt.who (side -0.22/0/+0.22, forward 0.65, spot 0.2) ; Đường line -> 3 Mắt.track
 Mắt trái.level -a-> [trừ] lech <-b- Mắt phải.level ; lech -> PID.measured (Kp 3, Ki 0, Kd 0, target 0, out -1..1)
 Mắt giữa.level -a-> [nhân] toc-do <-b- he-so.value (from TRẠM DỪNG)
 toc-do -a-> [cộng] cong-trai <-b- PID.out -> Động cơ trái.power (side -0.45, max 90 rpm)
 toc-do -a-> [trừ]  tru-phai  <-b- PID.out -> Động cơ phải.power (side +0.45)
 Thân.self -> both Động cơ.body

TRẠM DỪNG  (stop = 1 when stopping, 0 when free; analog 0/1 numbers, no bool->number piece exists)
 Thân.payload -> co-hang  [map 0..0.5 -> 0..1]  (loaded)      Thân.payload -> trong [map 0..0.5 -> 1..0] (empty)
 Vùng nạp(robot, centre rule).count -a-> [nhân] dung-nap <-b- trong
 Vùng dỡ (robot, centre rule).count -a-> [nhân] dung-do  <-b- co-hang
 dung-nap + dung-do = dung -> he-so [map 0..1 -> 0.7..0]  (speed gain 0.7 free, 0 stopped) -> toc-do.b
 rong = Thân.payload < 0.5 ; co-tai = Thân.payload >= 0.5 (bool, via const 0.5)

TAY MÁY NẠP HÀNG
 Chain: Trụ.self -> Vai(joint) -> Cánh trên(1.5 m) -> Khuỷu(joint) -> Cánh dưới(1.2 m) -> Tay kẹp ; Khi bắt đầu -> both joints' Bật
 Chuỗi bước (6 steps, loop). Step done conditions (and/or cards):
  1 wait      : Vùng nạp.inside AND rong                       (AGV at LOAD and empty)
  2 go down   : Vai.reached AND Khuỷu.reached AND Tay kẹp.inReach
  3 grab+lift : Vai.reached AND Khuỷu.reached AND Tay kẹp.holding   (close = step 3 OR step 4)
  4 swing over: both reached
  5 release   : co-tai (payload >= 0.5 : crate is on the AGV)
  6 go back   : both reached
 Step 1 also -> Tạo đối tượng.spawn (crate 0.5 m, 1 kg, lifetime 90 s, max 6 alive).
 Taught angles (shoulder/elbow): over table 120/95, at crate 146/95, over AGV 27/-92. Chuỗi bước.index -> 6 Quy đổi khoảng ramps
 (shoulder 4 ramps: 120->146, 0->-26, 0->-93, 0->+93; elbow 2 ramps: 95->-92, 0->+187) -> add chains -> Vai.angle / Khuỷu.angle.
 Only feedback wire that loops back: dk-hop-4 -> buoc.next (test pins it; card ids sort after "buoc" so the sequence is where the loop breaks).

DỠ HÀNG
 Vùng dỡ.inside AND co-tai -> Xi lanh đẩy.extend (stroke 1.9 m, 1.2 m/s, max 100 N, head 0.6 m at y 0.68, 8 cm over the chassis top)

ĐẾM VÀ HIỆN SỐ
 Xi lanh.positionNow >= 0.5 AND rong -> Bộ đếm "Thùng đã giao" (rod out and chassis empty = a crate left it)
 Vùng nạp.entered -> Bộ đếm "Số vòng" (starts at -1: first arrival is not a lap)
 Thân.payload / speed / counters -> 4 Hiện số ; 4 Hiện chữ anchored on Thân (run = gain >= 0.5 AND NOT overloaded ; nap = ready ; do = piston trigger ; overload = Thân.overloaded)
 Khi bắt đầu -> Máy quay.on
```

## Tuned numbers and physics
| Item | Value |
|---|---|
| Chassis | mass 5 kg, friction 0.8, maxPayload 3 kg, 2 motors push 12 N total |
| Cruise | gain 0.7 x 90 rpm x 2 pi 0.15 m = 0.99 m/s (readout 1.0), braking = grip 0.8 x 9.81 = 7.8 m/s2 so it stops in about 0.1 m |
| Acceleration | empty 12/5 = 2.4 m/s2, with the 1 kg crate 12/6 = 2.0 m/s2 (-17 %) |
| Line | max distance from the line centre over 80 s: 0.17 m (limit 0.25); first tuning with eyes at +0.8 m and gain 0.8 cut the corners by 0.27 m |
| Timing | arrives LOAD about 5.5 s, crate on AGV 8.1 s, AGV leaves 8.2 s, UNLOAD about 19 s, lap about 26 s, 2 crates delivered by about 46 s, 10 crates in 240 s, no stall |
| Gripper | 20 N per finger, mu min(0.8, 0.5) x 2 fingers = 20 N >= 9.81 N weight |
| Piston | needs mu x m x g = 0.5 x 1 x 9.81 = 4.9 N per crate pushed (2 crates 9.8 N); 3 N stalls, 6 N delivers one then stalls on the second, 12 N delivers two |
| Overload | maxPayload below 1 kg: chassis stays at LOAD with the crate on it, `overloaded` on, red text, delivered 0 |

## Tests (tests/io/agv-sample.test.ts, all green)
0. (10 tests in all.)
1. Only general pieces, 5 named groups, no overlap inside the main board and inside each group (estimateNodeSize), group blocks/notes apart, no word "game".
2. The only back edge of the compiled graph is `dk-hop-4 -> buoc.next` (the sequence).
3. 80 s: delivered >= 2, laps >= 2, max drift < 0.25 m, lowest crate centre > 0.4 m (floor would be 0.25), waits > 3 s at LOAD, carries > 10 s, all three state texts shown and no overload text.
4. HUD labels + fixed tilted camera.
5. maxPayload 0.5: delivered 0, overloaded, payload 1, stays at LOAD, speed 0, red text shown; maxPayload 1.5 delivers again.
6. Piston 3 N / 6 N / 12 N as in the table.
7. Heavier chassis accelerates slower (5 kg vs 20 kg after 0.8 s).
8. Kp = 0: no steering, loses the line at the first corner, never reaches a station (the middle eye drives the speed, so it stops instead of wandering off: drift stays small).
9. Anti-forced, 23 wires, each run 80 s. What each removal does:
   - Vùng nạp.count -> dung-nap: passes LOAD without stopping, the arm still moves and drops its crate on the floor (lowest crate 0.25), delivered 0.
   - Vùng dỡ.count -> dung-do, Thân.payload -> co-hang: circles forever with the crate, delivered 0.
   - Thân.payload -> trong: `trong` reads 1 forever (payload input unwired = 0), so the stop at LOAD never lifts: it sits loaded at LOAD forever.
   - Arm feedback (Vai.reached, Khuỷu.reached, Tay kẹp.inReach / holding, close wire, sequence next, angle wires): arm stops on one step, AGV waits empty at LOAD, delivered 0.
   - co-tai -> step 5 condition: first crate delivered, arm waits forever after (delivered 1).
   - buoc.step1 -> spawner: no crate ever appears.
   - dk-do-hang -> piston.extend, co-tai -> dk-do-hang: AGV waits loaded at UNLOAD, delivered 0.
   - Right eye, middle eye, lech -> PID, PID inputs, either motor power or body wire: never gets round the first corner, laps -1.
   PID -> motors (separate test): removing ONE of the two PID -> motor wires alone does NOT break it (left path: 3 crates, drift 0.17; right path: 3 crates, drift 0.08; the other motor still steers). Removing BOTH: no steering, loses the line at the first corner, 0 crates. So the single wires are not in the anti-forced list; the pair is tested.

## Verification
- `npx tsc --noEmit -p .` clean.
- Focused: tests/io/agv-sample.test.ts + tests/io/samples.test.ts 55/55 green. Full vitest: see end of file.
- Baselines: script-checked additions only (solid-off-baseline +1 key, solid-on-summary +1 row).
- Playwright :5275 (script scratchpad `agv-check.mjs`, `agv-play.mjs`; Tệp > Bài mẫu > open, Chơi). Shots in plans/reports/shots-s-agv/: `01-board-top.png` (main board: 5 group blocks, notes, world cards), `02-group-grp-*.png` (inside each group), `11-arm-loading.png` (arm placing the crate), `12-agv-carrying.png`, `13-unloading.png` (piston at the chassis), `14-unloaded.png` (crate on the platform, counter 1). All read: machine visible, camera framing OK, readouts legible, state text above the AGV. Console: one 404 (favicon) only.

## What was missing / honest limits
- Spawner ("Tạo đối tượng") has NO mass parameter: a spawned crate is always 1 kg. So the overload experiment lowers the chassis "Tải tối đa" instead of raising the crate mass (physics identical: payload > maxPayload). A pre-placed `Đồ vật` crate has `Khối lượng` but a supply of many crates needed the spawner. Not changed (not asked).
- There is no bool -> number piece: the stop gating is an analog 0/1 signal built from zone `count` (number) and `map-range` of payload, instead of And/Or on bools. It works and is readable but is more cards than a bool design.
- The joint angle per step is a sum of "Quy đổi khoảng" ramps of the step number (no lookup-table piece): 6 ramps + 4 adds for the "taught angles".
- Crates vanish 90 s after spawn (spawner `lifetime`, an open param, mentioned in the "Dỡ hàng" note) so the receiving platform never fills; with lifetime 0 it fills after 4 crates and the piston then stalls.
- Fixed arm geometry assumes the stop point (+-0.1 m); the loading zone is 0.6 m wide with centre rule.
- Delivered counter = "rod out >= 0.5 m AND chassis empty" (an honest proxy, tested with the failures above).

## NOT verified
- Touch / phone, sound, slower machines (browser ran about real time on the dev machine with SwiftShader).
- The 3D look of the crate model colours (red/teal crate model ignores the brown colour param).
- Note cards text length in the board (read in screenshot, partly cut by the PiP window at 1440 px width).
- Heavy chassis mass (20 kg) full cycle (only the acceleration test).
