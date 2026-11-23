# Chassis box that turns, side-dump tray, open-frame belt

Date 2026-11-19 · worktree `D:\workspace\GameBuilder-chassis` · branch `feat/chassis-turn` · base e45c0ed · head `2a5b83a` (11 commits, not pushed, not merged, tree clean). No new node kind, no new param, no new world call (`KEEPS_VIEWS` untouched). `npx tsc --noEmit -p .` clean.
Headless numbers: 60 ticks/s, "Vật lý thật" on, crate friction 0.5, chassis friction 0.8.

## Summary

| Item | State | One line |
|---|---|---|
| 1 Chassis box turns with the robot | done, **one shipped test now fails**, one stated limit | Crates, plain items, people, other chassis, shoves, weighing and contacts meet the chassis as length x width turned to its heading. The 35 degree dump works at all 72 headings tried. Open: `tests/io/agv-sample.test.ts` "is anti-forced" (3 of its 25 cut-wire cases), cause measured below. Limit: blocks (walls, floor) still meet the upright square. |
| 2 Side-dump tray | done, no new piece, no new param | Turntable joint + tilt joint + wide link. Carries 1-5 kg, dumps at 30-60 degrees at any heading, lands 0.37-0.58 m beyond the side edge. Recipe below. |
| 3 "Băng chuyền khung xanh" = belt | done | Same rule as "Băng chuyền": runs at 2 along the longer side, side walls, same params. The walls are drawn as plain grey slabs: question 3. |

**Do not merge before question 1 is decided.**

## Open: one shipped test fails, and why

`tests/io/agv-sample.test.ts` > "is anti-forced: removing any essential wire breaks the delivery". The normal run of the sample is fine (2 crates delivered, AGV within 0.1 mm of where it stood before at 60 s, laps shifted by at most 0.17 s). Of the 25 cut-wire cases, 22 behave as recorded and 3 do not (found by running all 25 with a local, uncommitted loop that does not stop at the first):

| Cut wire | Recorded outcome | Now |
|---|---|---|
| `vung-do.count -> dung-do.a` (never stops to unload) | keeps circling with the crate on its deck | crate on the floor after 2 laps (payload 0, lowest crate 0.25) |
| `than.payload -> co-hang.value` (same kind) | same | same |
| `co-tai.out -> dk-b5.b` (hand stays lowered round the crate) | AGV held at the loader, payload 1 | AGV held at the loader, crate on the deck, but payload reads 29.75: the crate is turned a little by the chassis under it, and the weighing rule for a turned crate counts the hand's blocks resting on it |

Cause, measured: the chassis box now turns in the engine, so a crate on the bare deck is taken round by the engine's friction, and that friction drifts. In a bare engine scene (one turning plate, one cube; same for step 1/60-1/2400 s, 1-16 solver passes, friction 0.2-1.5, mass 2-20 kg, cube size, turn speed 0.3-1.3 rad/s) the cube goes round with the plate 98 % and moves outwards by 0.096 x its distance from the plate's own middle per radian turned. On the robot: 0.30 m -> 0.35 m in a quarter turn, off the deck after about 6 rad. The drift is proportional to the distance from the turning body's middle and is zero for a load over that middle, which is why a crate on a tray (the tray is its own body, middle under the load) shows none: 0.300 m held over 9.4 rad in the same probe. Before this change the box never turned, so a crate on the deck kept its place in the world while the robot turned under it.

Ways I tried to get rid of it (each run against the 25 cases, the hash guard and the new tests; none committed):

| Way | Crate on the bare deck of a turning robot | Anti-forced cases that differ | Normal sample run | Other |
|---|---|---|---|---|
| **Committed**: the chassis body turns, friction carries | goes round 98 %, drifts out 10 % of its radius per radian | 3 (table above) | as before (hash differs: the crate turns with the AGV) | corners push crates beside the robot properly |
| Only the shape turns on a body that never spins (two variants) | not taken round at all, as before the change | 1 (`co-tai -> dk-b5`: the AGV drives out from under the caged crate, which drops) | **worse**: the AGV is knocked 8 cm off its line while unloading and crawls at 0.3-0.5 m/s for the next lap; second crate not delivered by 60 s | a corner is up to 86 mm inside a crate before the engine pushes it clear |
| Take what stands on the deck round by rule (as vehicles carry people) | exact, no drift | at least 1 (`co-tai -> dk-b5`: payload 12.25; the crate is forced against the hand that holds it) | not checked further | ignores what holds the crate back |
| Tell the engine the motion about the middle of the load (it removes the drift in the bare scene: 0.096 -> -0.002) | over-turns by 6 % in the real rig | at least 1 (payload 29.75) | not checked further | changing that point at run time disturbs resting contacts (a fallen crate ends 8 mm high) |

I did not edit the failing test. What it needs is a decision (question 1), not a number tweak.

## Item 1: what changed

One definition, `chassisOutline` in `world/collider.ts`: a chassis on wheel traction (= switch on) with no collision box of its own is `length x height x width`, turned to where it points. Switch off: it returns nothing and every old code path runs as before (`solid-off-unchanged` green, untouched).

| Who meets the chassis | By what now | Where |
|---|---|---|
| Rigid crates (crate engine) | outline, turned; the turn is fed to the engine in the 4 sub-steps like its move | `crate-engine.ts` (`shownBox`, `turnOf`) |
| Another chassis: stop, slide along, shove, hold | outline against outline; shoved distance worked out exactly, not searched | `physics.ts` (`overlapsAll`, `pushOut`), `robot-push.ts`, `linear-actuator.ts` (`outline` on head / body / solid), `oriented-box.ts` (`backOffAlong`, `obbGap`) |
| People on foot | outline | `physics.ts` (same two functions) |
| Plain items resting on it, riders carried along | outline footprint | `robot-push.ts` (`restsOnTop`), `platforms.ts` (`standsOn`) |
| Weighing ("Khối lượng đang chở", "Cân") | outline as the top that bears | `material.ts` (`rests`, shape, `tooFarToHold`) |
| Contacts (`isTouching`) with anything but a block | outline | `physics.ts` (`touching`), `contact-pairs.ts` |

New rule needed by the turn (`settleTurn`, `physics.ts`): the old square was the same at every heading, a rectangle is not. A chassis whose turn swings a corner into another chassis backs off the shortest way out (millimetres per tick), like a real robot pivoting against another; when a block or a third chassis leaves no room, the turn is undone for that tick (turn rate 0). The other chassis is never moved by it.

### Limit (not done, on purpose): blocks still meet the square

Floor, walls, moving blocks, belt walls and machine cover cubes stop the chassis by the upright square (side = longer chassis side), exactly as before. Reason: against a wall an honest turned box needs the same turn rule against blocks, and that changes existing boards: a robot flush to a wall can only turn by being pushed off it, and a robot in a corridor narrower than its diagonal (1.56 m for 1.2 x 1 m; the square needs 1.2 m) can no longer turn round. Size if wanted: `outlinePair` stops excluding blocks, and `settleTurn` is applied to them too. Expect many robot boards with the switch on to change.

Also still on the square (they read entity views, which I did not change because every recorded hash covers every view field): "Dò phía trước", "Chạm", zone sensors, pistons and arm pieces pushing a chassis. A chassis with a hand-set collision box keeps that box, upright. Vehicles and robots still pass through each other.

### Proof

| Test | Result |
|---|---|
| Rear tray, robot standing at every heading 0-355 in steps of 5, tilt 35 | all 72 dump; crate rests 1.08-1.18 m behind the middle, at most 0.22 m to a side. On the old code the same test fails: at 45, 60 and 135 the crate stays 0.6 m up, hung on the corner of the square |
| Rear tray, driven by "Đi tới điểm", turned to exactly 10, 20, 30, 45, 60, 80, 135, -15, -30, -45, -60, -75, -120, -150, 165, tilt 35, 1 and 5 kg | rides (slide < 8 cm), dumps within 3 s, rests clear behind, chassis moves < 3 cm |
| (note on the row above) | These driven arrivals also dumped on the old code in my runs; the hang needs the crate exactly where it was placed. The standing sweep is the test that fails without the change. |
| Tilt 45 and 60 at 7 askew headings | dump |
| Driving straight into a parked chassis that stands at 45 degrees (normal / top speed) | stops with its nose on the corner that is drawn, x = -0.378 (the squares met at -0.2); overlap 0.00 mm; parked one moves < 1 mm; 3 s pressing: drift < 1 mm |
| Nose to nose along a diagonal (45 and 225) | stop flush, middles 1.20 m apart, no drift |
| At 45 degrees into the side of a parked one | corner meets face, never inside |
| Two 1 m wide robots in lanes 1.1 m apart | pass with 10 cm room, tick-identical to driving alone (the 1.2 m squares collided here) |
| Turn on the spot 2 cm beside another chassis | never inside (< 1 mm), turns more than 180 degrees, ends 0.2-0.3 m away; the other does not move |
| Same with a wall 1 cm behind it | turn stops after < 8 degrees, turn rate 0, position and heading identical over the next 2 s |
| Crate beside a 1.2 x 0.4 m chassis, inside its square | falls to the floor, payload 0 (before: sat on the invisible square) |
| Same spots at heading 90; corner spots at 45 | swap as the drawing says |
| Crate 0.3 m from the middle of a narrow chassis, quarter turn on the spot | goes round with it (within 4 %), stays on, radius 0.30 -> at most 0.36 m (the drift above) |
| Person on foot | walks past the narrow chassis; stopped by the corner at 45 degrees |
| Plain item without the crate engine | carried over the outline, dropped beside it |

All existing `robot-vs-robot` (20) and `robot-right-of-way` (14) cases pass unchanged in what they assert. `tests/helpers/chassis-metrics.ts` now measures the real rectangle from the views (it measured the square, which reports 10-16 cm "overlap" for two outlines that only touch).

### Shortcuts from the perf work: kept correct, each held against the long way

| Shortcut | Change | Reference test (each checked to fail with the shortcut made wrong) |
|---|---|---|
| Contact grid | box of a chassis holds its outline at any heading | `contact-pairs.test.ts`: traction chassis in the 400 random scenes |
| Weighing (`Fact` boxes, `tooFarToHold`, shared scene) | chassis takes √2 reaches round its position; crate ruled out along the chassis's own length and width | `weighing-shortcuts.test.ts`: +2 tests, 400 + 200 random yards with chassis at any heading (one on top of another, with own collision box, non-finite numbers), plain rule written with the outline |
| Shove plan (`planPush` vs `planWhole`) | outline head, shoved and holding chassis | `sweep-shortcut.test.ts`: +1 test, 4000 cases, 3 views |
| "Nothing on the way" (`somethingOnTheWay`) | head followed along its own axes (`beyondOutline`) | `robot-push-open-floor.test.ts`: +3 tests, 4000 cases per view |
| Cached views, `KEEPS_VIEWS`, `MoveScene` | not touched, no view field added | hash guards |

## Baseline entries re-recorded

Measured first: the whole `tests/editor` folder. **One** entry differs, nothing else (`solid-on-summary.snap.json`, `solid-off-baseline.json` untouched).

| File | Entry | Old | New | What touches the turned chassis there |
|---|---|---|---|---|
| `real-physics-on-baseline.json` | `sample:agv-shuttle` | `1ccf7be5:900` | `dbd59c97:900` | The arm sets a crate on the AGV's deck (tick 527, 8.8 s); the AGV then drives the loop. |

Visible behaviour, traced tick by tick for 60 s: identical until the crate is on the deck. Before: the crate kept pointing the same way in the world while the AGV turned under it. After: the crate turns with the AGV through the bends (at 15 s it is turned a quarter with it) and sits 5 cm from where it sat. Same outcome: both crates delivered (x = 4.98 and 4.44 against 5.08 and 4.52), AGV back at the loading spot at 60 s. Edited by hand, one line. If question 1 goes another way this entry changes again.

## Item 2: side-dump tray recipe (copy as is)

Pieces on a "Thân robot" (all existing):

| # | Piece | Settings | Wires |
|---|---|---|---|
| 1 | Khớp xoay "turn" | Trục quay = Đứng; Góc bắt đầu = 90 (right side) or -90 (left); Góc nhỏ nhất / lớn nhất = -180 / 180; Chắn vật = Không; Lệch so với vật gắn = dọc 0, lên `H/2 + gap + 0.025`, ngang `+W/2` (right) or `-W/2` (left) | Thân.Đối tượng -> Gắn vào; Khi bắt đầu -> Bật; "Góc đặt" left unwired (it holds 90) |
| 2 | Khớp xoay "tilt" | Trục quay = Ngang; Góc bắt đầu 0; Mô-men tối đa 150; Tốc độ tối đa 60; Chắn vật = Không; Lệch 0, 0, 0 | turn.Đầu khớp -> Gắn vào; Khi bắt đầu -> Bật; tilt angle -> Góc đặt |
| 3 | Thanh nối "tray" | Chiều dài = size ACROSS the robot (0.6); Bề dày 0.05; Bề rộng = size ALONG the robot (0.6); Chắn vật = Có; Khối lượng 1 | tilt.Đầu khớp -> Gắn vào |
| 4 | Tilt signal | "Đi tới điểm".Đã tới -> bool-to-number (bật = 35, tắt = 0) -> tilt.Góc đặt | as the rear tray |

`H` = chassis height, `W` = chassis width, `gap` = room under the plate (0.01 in the tests, 0.05 for the factory look's stand). The plate lies across the robot from the side edge inwards; tipping raises the inner end. Looks: Thân robot `agv`, both joints `hinge`, link `factory`. Keep the parcel on the tray, not on the bare deck (see "Open").

Measured (`tests/arm/side-tray-robot-goto.test.ts`, 34 tests):

| | 1.2 x 1 m robot, 0.4 m crate | 0.9 x 0.7 m robot, 0.4 m crate | factory look 0.9 x 0.7 x 0.24, plate 0.62 x 0.74, carton 0.3 x 0.22 x 0.26, hinge 0.31 from the centre line |
|---|---|---|---|
| ride (turn on the spot, 5.8 m, stop, turn to the final heading), 1 / 3 / 5 kg, left and right | on the tray every tick; slide <= 2 mm along, <= 7 mm across; payload reads the crate | same | same |
| leaves after "Đã tới" at 35 degrees, 60 degrees/s | 0.95-0.97 s | 0.97 s | < 3 s |
| rests, beyond the side edge of the chassis | 0.38-0.58 m | 0.48-0.57 m | 0.37 m |
| rests, ahead / behind the chassis middle | within 0.23 m | within 0.23 m | within 0.13 m |
| chassis moves while dumping | 0.0 mm | 0.0 mm | < 3 cm |

Zone asserted at every heading 0-355 in steps of 5, both sides, and for arrivals turned to 30, 45, 60, 135, -15, -60, -120, 165: on the floor, clear of the chassis side by at least half the crate, at most 0.75 m beyond the side edge, within 0.35 m ahead or behind. Tilt: 20 stays on, 25 hangs on the edge (do not use), 30 / 35 / 45 / 60 dump; a 20 degrees/s joint dumps at 35 too. Same ride twice = same state every tick.

## Item 3: belt

`nodes/block.ts` `beltOf`: styles `conveyor` and `belt-frame` are belts by their look. Card description and three handbook sentences name both styles. Test (`tests/world/conveyor.test.ts`): a crate and a walker on a `conveyor` and on a `belt-frame` of the same size give the same positions on all 150 ticks and the same belt + wall entities, for 4 settings (default, walls off, speed -3 along z, long side along z). No shipped board uses `belt-frame`; hash guards unchanged by it.

## Cost

The machine was shared the whole time (CPU 30-77 % from other work); wall-clock numbers of the same code moved by a factor of 2-3 between two runs, so they prove little.

Measuring tool (`VITE_TICK_COST="agv:1,8 tray:8,16"`, ms per tick, wall clock):

| Board | Before (17:07, lightest load of the day): mean / p50 / p95 / max | After, head `2a5b83a`: mean / p50 / p95 / max | Hash before -> after |
|---|---|---|---|
| agv x1 | 0.62 / 0.58 / 0.93 / 4.6 | 0.65 / 0.57 / 1.00 / 6.0 | 199e25a0 -> 7e641953 |
| agv x8 | 4.93 / 3.93 / 10.2 / 33.2 | 6.60 / 5.01 / 16.1 / 31.1 | c167a9de -> 88698352 |
| tray x8 | 2.12 / 1.67 / 4.9 / 25.7 | 2.37 / 1.72 / 6.6 / 23.1 | 9efb57dd -> 9efb57dd (same) |
| tray x16 | 6.10 / 4.21 / 15.7 / 42.8 | 4.78 / 3.85 / 12.6 / 51.9 | eb3d88e -> eb3d88e (same) |

Processor time per tick (a temporary harness of mine on the same boards, least of 3 runs of 60 s; old code and head measured 40 minutes apart):

| Board | Before | After |
|---|---|---|
| agv x1 | 1.38 | 1.09 |
| agv x8 | 7.17 | 7.95 |
| tray x8 | 2.51 | 2.27 |
| tray x16 | 6.16 | 5.24 |

Reading: no difference I can separate from the noise (single runs of the same code spread 7.2-9.7 and 7.9-10.9 for agv x8). The first version of the change did cost about 30 % on the tray fleet (every chassis planned a shove every tick, and weighing looked 3.6 m round each chassis); commits `8c96c3f` and `77de820` brought that back. **Not shown: "8 AGVs well under 16.7 ms max".** The max was 33 ms before my change on this loaded machine (12.6-14.6 ms in the perf report's quiet run). It needs one run of the tool on a quiet machine.

## Tests

| File | Tests | |
|---|---|---|
| `tests/arm/tray-robot-goto.test.ts` | 33 (was 16) | exact-heading dumps, 72-heading sweep |
| `tests/arm/side-tray-robot-goto.test.ts` | 34 new | recipe |
| `tests/world/robot-vs-robot.test.ts` | 27 (was 20) | 45 degree cases, narrow lanes |
| `tests/world/robot-chassis-outline.test.ts` | 9 new | crates, items, people, turning beside a chassis |
| `tests/world/weighing-shortcuts.test.ts` | 5 (was 3) | |
| `tests/world/contact-pairs.test.ts` | 4 | scenes extended |
| `tests/arm/sweep-shortcut.test.ts`, `tests/world/robot-push-open-floor.test.ts` | +1, +3 | |
| `tests/world/conveyor.test.ts` | 20 (was 19) | |

Whole suite, one run on head `2a5b83a` (688 s, machine loaded): 282 files: 279 passed, 2 failed, 1 skipped (the measuring tool); 4259 tests: 4256 passed, 2 failed, 1 skipped.
- `tests/io/agv-sample.test.ts` "is anti-forced": real, see "Open".
- `tests/io/city-delivery-3d-sample.test.ts` "cars stop at a red light": timed out at 180 s under load; run alone afterwards: 27 / 27 passed (230 s).

## Shots (all 5 opened below were read) — `plans/reports/shots-chassis-turn/`

Script `scripts/side-dump-shots.mjs`, scene harness on port 5185 (stopped), headless SwiftShader. Taken on head's behaviour for the tray and the belt (nothing in them depends on question 1).

| Shot | Shows |
|---|---|
| `side-dump-2-sliding.png` | factory-look AGV, tray tipped to its side, carton sliding over the hinge edge |
| `side-dump-4-landed.png`, `side-dump-4-landed-from-above.png` | carton on the floor beside the wheels, 0.73 m from the robot's middle, not ahead or behind |
| `belt-frame-with-walls.png`, `belt-frame-with-walls-end-on.png` | the open-frame belt now has the two side walls: plain grey slabs 0.3 m high that hide the cartons from the side (question 3) |
| `side-dump-0-level.png`, `-1-tipping.png`, `-3-falling.png` | in the folder, not opened |

## Files (app/)

- World: `collider.ts`, `oriented-box.ts`, `crate-engine.ts`, `physics.ts`, `robot-push.ts`, `linear-actuator.ts`, `material.ts`, `platforms.ts`, `contact-pairs.ts`.
- Nodes: `nodes/block.ts` (belt rule, description), `nodes/robot-body.ts` (comment only). Handbook: `content-math-object-output.ts` (3 sentences).
- Tests: the files above, `tests/helpers/chassis-metrics.ts`, `tests/editor/real-physics-on-baseline.json` (1 line).
- Nothing under `editor/`, `circuits/`, `render/`.

## Unresolved questions

1. **The crate on a bare deck when the robot turns** (decides the failing test). a) Keep what is committed: it goes round with the robot but drifts outwards and is lost after about two laps; the 3 cut-wire cases then need their recorded outcomes changed by you. b) Do not take it round (as before the change): needs the cause of the 8 cm knock while unloading found first, and 1 cut-wire case still changes. c) Carry it round by rule: needs a rule for what holds a crate back. I recommend a) only if parcels always ride on trays; otherwise b) with more time.
2. Walls: keep the square against blocks (now), or make walls meet the turned box too? The second changes how robots turn next to walls and in narrow corridors on existing boards.
3. Belt "khung xanh" walls are drawn as tall grey slabs (shot). Keep, draw them as slim rails in that look (render work, needs your preview), or leave walls off by default for this look?
4. Sensors ("Dò phía trước", "Chạm", zones) and pistons / arm pieces still read the square of a chassis (up to 18 cm off at 45 degrees for a 1.2 x 1 m robot). Switch them to the outline? It needs either a new view field (every recorded hash changes) or deriving the outline from fields a view already has.
5. The 16.7 ms check for 8 AGVs needs a quiet machine: who runs it?

## Bare-deck drift: final attempt

Date 2026-11-22 · same worktree and branch · from `83a06d4` to `1860061` (6 commits, not pushed, not merged, tree clean). One line of attack: find what the engine is told and what it does with it. **It worked: the drift is gone and `tests/io/agv-sample.test.ts` (file identical to main's) passes with all 25 cut-wire cases as recorded.** This answers question 1 above; questions 2 to 5 are unchanged.

### Cause, proved

The engine was told the right thing all along (a position-based kinematic box, next place and next turn set before each of the 4 engine steps of a tick). The error is inside the engine, and it is geometric, not friction:

| Probe (bare scene: one turning plate, one 0.4 m cube 0.3 m from its middle, 1 rad/s, engine step 1/240 s) | Result |
|---|---|
| Cube started with exactly the plate's speed and turn rate, first 12 steps | its velocity stays (0, -0.300) and does not swing round with the plate: the plate's speed "under the cube" is worked out for where the cube *was* |
| 9 rad, nothing changed | 0.300 -> 0.792 m (0.108 x radius per radian; the earlier report's 0.096) |
| Cube not allowed to turn about the vertical (so it moves against the plate every step) | 0.300 -> 0.357 m: the drift is gone but for the step error |
| Plate's box set again on its body, to the same place, before every step (this marks the contact as changed) | 0.300 -> 0.3056 m; identical when the cube's box is the one set again |
| Setting the cube's place, turn, speed, friction or contact skin again | no effect |

So: for two bodies that do not move against each other the engine keeps the contact it worked out earlier, including where the touching points lay in the world then. A crate that rides on a turning chassis is exactly such a pair, and it swings those points round the chassis's middle. That is why the drift was proportional to the distance from the turning body's middle, zero over it, and blind to step size, solver passes, friction, mass and speed. (That the engine keeps the contact is my reading of these five rows; I could not read the engine's source, it ships compiled.)

Two smaller errors were left once that was fixed, both measured and both removed:

| Left over | Size | Cause | Fix |
|---|---|---|---|
| Turning on the spot, 0.94 rad/s | 0.59 mm per radian outwards (5.5 mm over 9.4 rad) | the engine moves the crate straight on for a whole step while the deck goes round: (1 - cos of the step's angle) x distance from the middle | that bit is taken back after each engine step, only for a crate that stands on the deck and does not slide on it (speed against the deck under it <= mu x g x step) |
| Driving round a bend, 1.06 m/s at 0.79 rad/s | 1.2 mm per radian sideways (9.8 mm over 7.8 rad); 1.15 in the bare scene | the chassis was shown along a straight piece per tick, so the deck's speed jumped once a tick and the crate needed the bend's whole friction in one engine step | a turning chassis is shown along the arc of one steady turn from where it stood to where the game put it (same end place and heading); bare scene: 0.02 mm per radian |

### What changed (app/)

| File | Change |
|---|---|
| `src/world/crate-engine.ts` | In a tick in which a chassis turns: its contact is worked out afresh before each engine step (`refreshContacts`), it travels along an arc (`arcOf`, `arcPoint`), and a crate its deck holds follows that arc (`followArc`). A chassis that does not turn in a tick takes the old code path. |
| `src/world/material.ts`, `physics.ts`, `world.ts` | Weighing: a piece bolted to a machine can rest on the body its machine stands on and on the other pieces of that machine, never on a body it only hangs over (`machineOf`, built from the mounts the pieces already declare; no new world call, `KEEPS_VIEWS` untouched; real physics only, with the switch off there are no mounts). |
| `src/world/linear-actuator.ts` | A chassis outline pushes clear only a body that lies ahead of it, the rule plain boxes already had (`clearance`). |

The last two were needed by the third cut-wire case (`co-tai.out -> dk-b5.b`, hand left lowered round the crate) and were taken from the earlier agent's uncommitted tree after checking each alone:
- Engine fix only: 24 of 25. In the 25th the crate is now turned 0.6 degrees with the AGV as it drives off, the open fingers round it then count as "resting on" it, the AGV reads 29.75 kg, is overloaded and stops. (Main reads the same kind of false weight, 31 kg, for 2 ticks at 8.8 s while the hand lets go.)
- Plus the weighing rule: payload 1, but the AGV drives out from under the caged crate, which drops to the floor.
- Plus the pusher rule: as on main. The crate, held back by the fingers, tips over the rear edge into the chassis outline and the AGV is held 0.84 m on (main: 0.86 m), payload 1, crate up.

Discarded from the earlier agent's tree: `holdOnDecks` / `carryRiders` in `crate-engine.ts` (crates put by hand on their place on the deck every step, when they touch nothing else). Not needed once the engine is right. Its debug loop in `agv-sample.test.ts` is gone too: `git diff a54bbe1 -- app/tests/io/agv-sample.test.ts` is empty.

### Test numbers

New `tests/world/robot-bare-deck.test.ts` (7 tests; chassis, motors and speeds of the shuttle sample; crate 0.3 m cube, 2 kg, friction 0.5 unless said):

| Case | Result |
|---|---|
| Turn on the spot, 0.94 rad/s, crate 0.3 m ahead, 9.5 rad | worst distance from its place on the deck 0.19 mm |
| Same the other way, crate to the side and behind (0.30 m out) | 0.18 mm |
| Bend of 1.3 m at 1.06 m/s, 0.79 rad/s (the sample), crate 0.3 m ahead, 9.5 rad | 0.31 mm |
| Wide bend at 1.2 m/s, 0.47 rad/s, crate 0.3 m to the side, 9.5 rad | 0.34 mm |
| Flat out on the spot, 3.14 rad/s (needs friction 0.302 by hand): friction 0.35 / 0.25 | stays on through 30 rad (creeps 0.30 -> 0.35 m, it is near its limit) / on the floor, payload 0. Probed, not in the test: 0.30 also slides |
| Friction 0.02, chassis drives off round a bend | left behind on the floor, payload 0 |
| Between two walls hanging 6 cm over the deck, 1 cm of room each side, 9.5 rad at 0.94 rad/s | taken 7 mm to one wall and turned a few degrees until it sits askew between them; stays there (7 mm from where it stood), never through a wall, not taken round, payload 2 |
| Held by a gripper | no new test: the cut-wire case above, in the shipped sample test |

Old quarter-turn test (`robot-chassis-outline.test.ts`) tightened: same angle as the chassis to 0.0001 degrees, radius 0.2999 m (it allowed 0.30 -> 0.36).
New in `robot-own-parts-payload.test.ts`: a finger bolted to a stand beside the robot, hanging 1 cm over a 2 kg crate on the chassis: chassis reads 2, crate bears 0; the same block bolted to nothing: 12 and 10.
The pusher rule has no test of its own; the cut-wire case is what fails without it.

| Run | Result |
|---|---|
| `tests/io/agv-sample.test.ts` (as on main) | 12 / 12, all 25 cut-wire cases |
| `tests/editor/solid-off-unchanged` (untouched) | pass |
| `tests/editor/real-physics-on-hash` | 44 / 44 after one entry re-recorded (below); same value on two runs |
| `tray-robot-goto` 33, `side-tray-robot-goto` 34, `robot-vs-robot` 27, `robot-right-of-way` 14, `weighing-shortcuts` 5 | 113 / 113 with `--testTimeout 120000`. With the default 5 s, long tests in these files timed out on this machine today, and the same ones did on the old sources (`83a06d4`, checked twice): load, not the change |
| `contact-pairs`, `moving-block-reference`, `robot-push-open-floor`, `sweep-shortcut`, `robot-chassis-outline`, `crate-weighing`, `robot-own-parts-payload` | pass |
| `npx tsc --noEmit -p .` | clean |
| Whole suite, plain run (default 5 s per test) | not usable: the machine was loaded and at least 80 tests in unrelated files (puzzles, arm pick-and-place, door samples, robot lanes) ran past 5 s; my output filter cut the list at 80 lines and with it the summary |
| Whole suite again with `--testTimeout 300000` (1130 s) | 291 files: 289 passed, 1 failed, 1 skipped (the measuring tool); 4310 tests: 4308 passed, 1 failed, 1 skipped. The one failure: `tests/puzzle/level-7-decoy` ran into its own 900 s limit (known to do so under load). Run alone afterwards: 3 / 3 passed (808 s; it does not use the crate engine). |

### Baseline entries

| File | Entry | Main | Branch before | Now | Why |
|---|---|---|---|---|---|
| `real-physics-on-baseline.json` | `sample:agv-shuttle` | `1ccf7be5:900` | `dbd59c97:900` | `fe268163:900` | Does not come back to main's value: the crate still turns with the AGV through the bends (the point of the branch), now without drifting on its deck. The weighing rule may add to it (in the cut-wire run the hand weighs on the crate for 2 ticks at 8.8 s on main; I did not check the normal run for the same 2 ticks). |

Nothing else differs (43 other boards, `solid-off-baseline.json`, `solid-on-summary.snap.json`). Edited by hand, one line.

### Cost

Machine busy the whole evening (other test runs; the same code gave agv x1 means of 1.05 and 1.93 ms in two runs minutes apart), so wall-clock proves little again. Tool, ms per tick, mean / p50 / p95 / max:

| Board | Before (`83a06d4`) | After, run 1 | After, run 2 | Hash before -> after |
|---|---|---|---|---|
| agv x1 | 2.70 / 1.62 / 7.6 / 52.7 | 1.93 / 1.57 / 3.9 / 115.9 | 1.05 / 0.98 / 1.9 / 3.8 | 7e641953 -> 4ce9ff39 |
| agv x8 | 9.77 / 8.37 / 19.9 / 81.3 | 9.90 / 9.26 / 18.6 / 55.9 | 10.58 / 10.11 / 17.6 / 32.0 | 88698352 -> a5cd5174 |
| tray x8 | 2.33 / 2.05 / 4.3 / 21.2 | 2.21 / 1.82 / 4.9 / 15.1 | 3.49 / 3.15 / 5.7 / 26.1 | 9efb57dd -> 9efb57dd (same) |

Profile of agv x8 (`profile-agv:8`, first 20 s, 8.2 ms of processor time per tick): the crate engine's whole step is 12 % inclusive, and none of the new functions (`followArc`, `arcPoint`, `refreshContacts`, `machineOf`) appears in the self-time list (it ends at 1.0 %) or in the top 20 of the inclusive list (which ends at 6.5 %; I did not read further down). **Not shown: "8 AGVs under 16.7 ms max"**: the max was 82 ms before the change on this loaded machine. It still needs one run on a quiet machine (question 5).

### Limits, said plainly

- Only chassis are refreshed. A crate standing off-centre on a crate that rides a turning chassis, or on a tray that turns, would meet the same kept contact (error proportional to its distance from the middle of what it stands on, so small there). Not measured, not changed: the tray fleet's hash is identical before and after, and the tray tests pass as they were.
- Near its friction limit a crate creeps (0.30 -> 0.35 m over 30 rad at 3.14 rad/s with friction 0.35): the arc correction only acts while it does not slide.
- The weighing rule now ignores an arm piece that truly presses down on a foreign body (an arm leaning on a scale reads 0 for the arm; before it read the piece's whole mass). Closer to a motor-held arm, but it is a change of rule for boards with the switch on. No shipped board's hash changed by it except the shuttle sample.

### Question 1: closed

Options a), b), c) of question 1 are no longer needed. As far as this point goes the branch can be merged; questions 2 to 5 stand.
