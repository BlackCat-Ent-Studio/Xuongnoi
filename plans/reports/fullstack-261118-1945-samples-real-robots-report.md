# Samples with "Vật lý thật" on (branch feat/samples-real-robots, commit 3f522d2, from b91ab5b)

Nothing merged or pushed. No change under src/world, src/nodes, src/engine.
3 of 4 samples done. **agv-shuttle is NOT switched on: a piston/chassis gap (below).**

## Per sample

| Sample | Cards before -> after | Wires | Board change |
|---|---|---|---|
| robot-line-follow | 18 -> 19 | 25 -> 26 | `settings.realPhysics: true`; Thân robot mass 2 kg, friction 0.8 written on the card; both motors maxForce 30 N, accel 400 -> 2000 rpm/s (so the wheel can ask for more than the floor grips: slip is visible at the start and in sharp bends); left motor "Hiện ô Đang trượt" on; new card "Bánh trái trượt (m/s)" (show-number) wired from dc-trai.slipSpeed; new note n5 (a = mu*g, 15.7 N, 7.85 m/s2, try 20 kg) |
| robot-avoid | 50 -> 50 | 57 | `realPhysics: true`; mass 2 / friction 0.8 / maxForce 30 written on the cards; new note n5 (braking a = 7.85 m/s2, 1.7 m/s stops in 0.18 m, try 20 kg). No new card: the sample never slips, a read-out stuck at 0 would teach nothing |
| robot-square | 31 -> 32 | 39 -> 40 | `realPhysics: true`; mass 2 / friction 0.8 / maxForce 30 on the cards; left motor slip read-out + card "Bánh trái trượt (m/s)"; note n3 rewritten (it still talked about extra "So sánh" cards for the wrap, stale since the Chênh lệch góc rebuild); new note n5 (try friction 0.2) |
| agv-shuttle | 80 -> 80 | 115 | untouched (gap) |

Gravity stays 9.81 (not written on the board) in all three.

## Physics shown, with the hand formula, and what is measured
- Line follow: 2 motors x 30 N = 60 N asked, floor holds mu*m*g = 0.8*2*9.81 = 15.7 N, so a <= 7.85 m/s2. Test: peak acceleration over 10 s < 7.85 x 1.1; wheel slip flag true for some ticks; the HUD slip card read > 0. 20 kg robot: 1.19 m/s average instead of 1.67, still follows (max drift 0.127 m).
- Avoid: braking a = 7.85 m/s2 (formula in note, from the tested robot-traction model). 20 kg robot turns slowly (yaw inertia m(l2+w2)/12) and comes within 4.5 cm of a wall/box (test: gap in (0, 0.15)).
- Square: grip 0.8 closes; grip 0.2 -> slip read-out > 0 and the 4th corner is 0.62 m from the start.

## Measured results (ship board, real physics on)
| Sample | Run | Result |
|---|---|---|
| line-follow | 120 s | 5.96 laps of the figure 8, max drift 0.115 m, **mean drift 0.042 m** (old model 60 s: 2.98 laps, mean 0.042: same) |
| avoid | 180 s / 300 s | min gap 0.458 m (test > 0.3), 249 m / 416 m driven, keeps moving; 4 other start spots still pass; wall reverse test passes |
| square | 180 s | 8+ laps: every 4th corner within **0.30 m** of the start (worst 0.175 m) and within 10 deg of the start heading (worst 4.2 deg); side 2.04 m |

Old numbers kept: the test thresholds for line-follow (< 0.2 m) and square (0.3 m, 10 deg) are unchanged; I only made the runs longer (60 -> 120 s, 45 -> 180 s, 60 -> 180 s for avoid, gap 0.15 -> 0.3 m because 0.458 was measured).

## Tests changed (all in tests/io/robot-*-sample.test.ts)
- Every `createWorld` call now uses `worldOptionsForGraph(board.graph)`, so the test plays the board with its own switches.
- New per sample: "ships with Vật lý thật on, 2 kg, 30 N"; physics tests above.
- robot-square anti-forced: cutting `than.self -> dc-phai.body` (right motor not mounted) used to stop the square; with real physics a one-wheel robot drives a small loop that returns to the start within 0.3 m, so "closed near the start" alone is no longer a proof of a square. The helper `realSquares` now also needs every side > 1.7 m. All 18 essential wires are still tested and still break it; this wire is the one the stricter check fixed.
- Anti-forced tests of line-follow (13 wires) and avoid stay unchanged and green.
- tests/editor/solid-off-unchanged.test.ts: the guard "none of the shipped boards turns the switch on" is now "only the listed ids turn Vật lý thật on" (a 3-id set, one per line, so the sibling branch merges by adding its ids). **Merge note: the sibling edits the same test; union the set.**

## Baselines (script comparison against HEAD of the branch base, other keys byte-identical)
| File | Changed key | Reason |
|---|---|---|
| solid-off-baseline.json | sample:robot-line-follow 2857517b -> 9e629b9a | plays with realPhysics now + accel/slip card |
| | sample:robot-avoid 58d8376 -> d6a7f032 | plays with realPhysics now |
| | sample:robot-square 5a7a0 (was d6963b32) | plays with realPhysics now |
| solid-on-summary.snap.json | sample:robot-line-follow, off and on hash 2857517b -> 93a37405 | its motor accel param (2000) changes the plain-rules run too; off == on still. avoid and square rows unchanged (their cards give the same plain-rules run) |
| real-physics-on-baseline.json | none | that test only covers boards with loose items (item / spawner); my three robot boards have none, so they are NOT covered by an on-mode hash. Not widened. (agv-shuttle, which has a spawner, is covered and unchanged because it is not switched on there) |
Two fresh runs of solid-off-unchanged + real-physics-on-hash: identical, all green (180 tests, then 140 again).

## GAP: agv-shuttle (stopped on purpose)
With `realPhysics: true` on the shipped board, the cycle breaks at the unloading station: the arm loads the crate fine (payload 1 kg, rides the chassis, step 6, laps counted), the AGV stops in the red zone, the piston extends 0.35 m and then presses with 100 N forever (force 100, overloaded false); delivered = 0, the AGV waits loaded at x 3.48 for the rest of the run. Off: the same board delivers.
Cause (found with the engine's own functions on that tick): `pushBodiesOf` lists the robot chassis as a push body. The rigid crate (Rapier) rests 0.3 mm inside the chassis top (centre y 0.5497, chassis top 0.30). `contactSet` (src/world/linear-actuator.ts) counts any overlap above 1e-6 as touching for a non-rigid body, so once the crate is pushed the chassis is "pushed" too (planned delta 0.29 m), the chassis would be shoved into the delivery platform block, plan.blocked = true, advance 0. With the platform moved out of the way the chassis is teleported 0.78 m in one tick and the crate stays behind: still wrong. Nothing on the board changes this (no param on piston, robot, crate or platform controls the contact tolerance or a chassis being pushable). I did not fake it.
What is missing (pick one, engine side): (a) a body that a rigid crate rests on is a support, never a pushed body (overlap below the engine skin must not count as contact for non-rigid bodies under a rigid crate), or (b) the world's open question 2 (crate on a robot sticks to the chassis / is carried) decided. Until then keep agv-shuttle off. Everything else in its description (arm loading at the station, overload, slower when loaded) was not retuned.

## Browser
Own server :5297, script plans/browser-scripts/samples-real-robots-shots.mjs, shots in plans/reports/shots-samples-real-robots/ (3 samples x board + 3 run shots, 3D). I looked at line 10 s, avoid 30 s, square 30 s: robot runs on the line / room / square, the panel shows "Vật lý thật" ticked with gravity 9.81, the new "Bánh trái trượt (m/s)" read-out is on screen, plot and speed work. One console message "404 Not Found" (a resource; same page without my change was not compared). First Chạy took longer, not measured. Server stopped. The note texts were not looked at in the board view shots (notes sit far from the cards); I read line-0-board.png only (partial view of the board, new cards off screen); the other two board shots were not read.

## Verification
- `npx tsc --noEmit` clean.
- Focused (tests/io + solid-off-unchanged): 22 files, 392 tests green.
- ONE full `npx vitest run --testTimeout 300000` on commit 3f522d2 (waited for it): 233 files, 3515 tests, all green, 799 s, no timeouts.

## Not verified
- Notes' wording only by me; the owner has not seen the new cards/notes on the live game ("no unpreviewed UI": the 2 new read-out cards are plain show-number cards, same look as the existing ones).
- Phone, real GPU. Rapier not used by these three (no crates), so the Chromium-vs-node determinism of the crate engine is not touched.
- "Slippery patch" demo: there is no piece for ground friction under part of the floor (friction is a property of the robot body only). The slip demo is therefore "change the robot's Độ bám", not a patch. Gap to report: surface friction zone (block `mu` is not read as the ground under a wheel).
- Avoid: no readout of the braking distance itself (needs a piece that stores the speed at an event).

## Unresolved questions
1. Engine owner: fix (a) or (b) for the AGV gap, then switch agv-shuttle on and re-record sample:agv-shuttle in real-physics-on-baseline.json.
2. Do you want a "ground friction" piece (a floor patch with its own mu) so a slippery stretch can be built?

## AGV follow-up (commits 8eed10a + merge 7ce4d1c of main d0a1995)

### General rule (src/world/linear-actuator.ts contactSet, src/nodes/linear-actuator.ts pushBodiesOf)
- Pushed sideways (|dir.y| <= 0.5, not top view), a rigid crate that is being pushed does not push a body that lies below it with its top where the crate rests (within RIDE_GAP 0.06 m): `holdsUp`. This is what a chassis top, a platform, a belt or a lower crate is. The head itself is not affected; stacks still count (a crate on top rides on the pushed one, so the row/stack sum is unchanged). Non-rigid bodies (switch off) take the old path unchanged.
- `pushBodiesOf(world, except)`: a piston mounted on a body never lists that body (used in the three calls of nodes/linear-actuator.ts). crate-tipping.ts and arm-solid.ts needed no edit.
- Tests tests/world/crate-support-push.test.ts (4, hand numbers crate 1 kg mu 0.5): floor piston pushes a crate off a 5 kg robot: card reads 4.905 N (= mu*m*g; tip would be 9.81 N), crate leaves the chassis, robot drift < 0.02 m; piston bolted on a 3 m chassis does the same with the same force; crate carrying another is pushed with 9.81 N (mu*(1+1)*g); a 3 N piston stalls (overloaded) with crate and robot staying. Tolerance 0.02 m: the chassis is not a physics body, it stands on locked wheels (0.8*5*9.81 = 39 N against the 4.9 N drag); the push and its reaction are internal for the bolted piston, so only the 5 mm contact skin may show. Without the rule test 1 fails (verified by stashing the two source files); test 2 passes before and after (it guards the mounted case, which the head geometry already avoided).
- Existing push/tip/robot-push/actuator/arm tests (150) green.

### agv-shuttle board
- `settings.realPhysics: true`. Only param change: both drive motors maxForce 6 N (AGV_SETTINGS.motorForce); no wire or card changed (80 cards, 115 wires). New note n7 with the formulas.
- Hand numbers: driveN = 6 N x 0.7 power = 4.2 N per motor, 8.4 N together. Empty 5 kg: a = 1.68 m/s2, 0.9 m/s after 0.54 s; loaded 6 kg: a = 1.4 m/s2, 0.64 s. Grip 0.8*5*9.81 = 39 N > 8.4 N, no slip. Measured over 180 s: empty departures 0.53 s, loaded 0.63 s (every one of 7 cycles); 7 crates delivered, 6 laps.
- Note n6 item 3 now says a = F/m with 8.4 N (it said 12 N).
- tests/io/agv-sample.test.ts: world built from the board's settings with the crate engine loaded; new tests: ships on with 6 N motors; heavier chassis (20 kg: < 0.45 m/s after 0.8 s, 5 kg 0.99); 3-minute repeated cycles (>= 6 delivered, >= 5 laps, max drift < 0.25 m, no crate dropped, loaded departure slower than empty with the hand numbers). Overload (0.5 kg limit stays at the station, 1.5 kg delivers) and piston force tests (3 N stalls, 6 N one crate, 12 N two) pass unchanged. One expectation changed: with the elbow wire cut ("goc-khuyu-a -> khuyu.angle") the straight arm now sweeps the crate off the table (real body), so that wire is allowed to end with the crate on the floor; it still delivers 0.
- No new gap found.

### Baselines (script-compared against the pre-change files, main's convention after the merge)
| File | Changed key | Reason |
|---|---|---|
| real-physics-on-baseline.json | sample:agv-shuttle a2c4833d -> a04b627d | motor force 6 N and the general pusher rule (the only on-mode entry the rule moves; no other board's hash moved) |
| solid-off-baseline.json | none | agv-shuttle is hashed with the switch removed: plain rules are unchanged by the retune (6b630e11) |
| solid-on-summary.snap.json | none | |
'sample:agv-shuttle' added to SHIPS_WITH_REAL_PHYSICS. Two fresh runs of solid-off-unchanged + real-physics-on-hash: identical, 180 / 184 green.

### Browser
:5297, shots agv-0..4 in plans/reports/shots-samples-real-robots/. Read 14 s and 40 s: arm loads, AGV carries the crate, at 40 s one crate lies on the green platform ("Thùng đã giao: 1", second crate already on the AGV), state text and readouts show. Server stopped.
- Verification: tsc clean; ONE full run on 7ce4d1c: 234 files, 3532 tests, all green, 953 s.
