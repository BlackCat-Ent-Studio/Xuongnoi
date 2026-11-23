# Robot drive train: Thân robot + Động cơ (branch feat/robot-drive, worktree GameBuilder-rbdrive)

Two new general node kinds (59 kinds on this branch). Real logic is in the engine; every number is an open param. Users build the robot only by wiring pieces; nothing drives without a power wire.

## Ports

### `robot-body` "Thân robot" / Robot Chassis (category object)
| Dir | id | Label | Type | Meaning |
|---|---|---|---|---|
| out | self | Đối tượng | object | the chassis, wire it into each motor's "Thân" |
| out | speed | Tốc độ | number | forward speed m/s, signed (negative = reversing) |
| out | heading | Hướng | number | nose direction in degrees, 0 = +x (right), 90 = +z (down in top view), grows CLOCKWISE seen from above; always 0 in 2d-side |
| out | turnRate | Tốc độ quay | number | deg/s, positive = turning right |
No inputs: it never moves by itself.

### `motor` "Động cơ" / Motor (category action)
| Dir | id | Label | Type | Meaning |
|---|---|---|---|---|
| in | body | Thân | object | chassis it is mounted on (unwired: wheel spins, pushes nothing) |
| in | power | Công suất | number | -1..1 (clamped); unwired = 0 so no motion |
| out | rpm | Vòng quay | number | real current wheel rpm (after ramp and reverse flag) |
| out | turning | Đang quay | bool | \|rpm\| > 0.5 |

## Params (defaults, units)
`robot-body`: position (0,0.5,0) · heading 0 deg (start nose) · length 1 m · width 0.7 m · height 0.3 m · mass 2 kg · friction 0.8 (grip, min 0.02, max 2) · color #3b82f6 · solid yes · advanced: colliderSize / colliderOffset / gravityScale. Mass and friction are live (applied every tick); the rest is read at start (color live).
`motor`: side 0.4 m (negative = left, positive = right) · forward 0 m · wheelRadius 0.15 m · maxRpm 120 · accel 400 rpm/s · reverse normal|reversed.

## Engine (src/world/robot-drive.ts, pure + tested; integrated in physics.ts `stepRobot`)
- wheel speed `v_i = rpm * 2*pi*r / 60` (m/s).
- Rigid chassis: point at side offset `s` moves at `v - w*s` (w positive = turning right). Fit (v, w) to ALL wheels by least squares: `w = -cov(s, v_i)/var(s)`, `v = mean(v_i) + w*mean(s)`. Two wheels give exactly `w = (v_left - v_right)/track`; arc radius `R = track/2 * (vL+vR)/(vL-vR)`. Equal speeds with uneven offsets go straight.
- Wheels all on one line (offset spread < 0.05 m, e.g. a single motor): pivot model `v = mean(v_i)`, `w = -sum(v_i*s_i)/sum(s_i^2)`, so one off-centre motor circles with radius |s| (nose swings away from the motor side). Central single motor drives straight.
- No wheels or no power: target (0,0), body stays still.
- Dynamics (mass/grip feel): chassis speed and turn rate chase the wheel fit under acceleration limits. Speeding up: `a = min(friction*9.81, 6 N * nMotors / mass)`. Slowing/reversing: `a = friction*9.81` (grip only, so it stops faster than it starts, and ice makes it coast). Turn rate limited by `a / (width/2)` rad/s^2. Motor rpm ramps to `power*maxRpm` at `accel` rpm/s.
- Collision: square footprint of max(length,width) vs solid blocks via existing `integrate`; wall takes its share of speed, nose keeps its heading. Solid robots also block walking characters. 2d-top: no gravity; 3d/2d-side: gravity. 2d-side: only rolls along x (mean wheel speed), no turning.
- Stale wheels: motor re-registers its wheel each tick; a wheel not refreshed for one step (wire removed, motor gone) is dropped.
- New world API: `setRobotWheel(body, wheelId, wheel|null)`, `setRobotTuning(body, {mass, friction})`; new entity kind `robot`, view field `robot` {length,width,speed,heading,turnRate,wheels[]}.

## Render
`src/render/robot-models.ts` + 3 small hooks in scene-view.ts: boxes only, chassis in the entity colour + darker plate + light "eye" strip on the nose (heading readable from above), one dark tyre with light hub bar per motor at its mount point, spinning with the wheel. Existing palette only.

## Handbook / lesson / names
- node-names.ts: `robot-body` Thân robot / Robot Chassis; `motor` Động cơ / Motor; all ports named VI + EN.
- Handbook pages in new `src/handbook/content-robot-drive.ts` (purpose, every port, every param, example, tips, "Thử ngay" boards): robot-body board = two Số cố định (1 and 0.5) driving a circle with speed/turn readouts; motor board = Cần điều khiển mixed by two Phép tính (left = up + right, right = up - right), 2d-top. Only change to existing handbook files: `build` and `v` exported from boards-math-object-output.ts, one line in handbook/index.ts.
- Lesson "Robot hai động cơ" (`two-motor-robot`, new `lesson-two-motor-robot.ts` + `course-pack-f.ts`, new chapter "Robot" in course.ts, one line in lessons.ts): player adds Thân + 2 Động cơ, mounts them, moves one to the left, wires the two powers, plays, then raises the mass.

## Tests added
- tests/world/robot-drive.test.ts (20): rim speed formula, no motors, straight, spin in place, arc radius vs formula, 4 wheels = 2, 3 uneven wheels, stopped-wheel pivot, one off-centre motor circles, motor ramp, mass/grip limits, coast distance vs friction, stale wheels, side view.
- tests/nodes/robot-nodes.test.ts (14): no power wire = no motion (also gravity only in 3D), straight, spin in 2d-top and 3d, arc radius, anti-forced (removing either power wire or the Thân wire changes the path, opposite sides), side view, reverse flag, mass slows start, wall stops it, output ports, heading param, wheels in view.
- tests/handbook/content-robot-drive.test.ts (ports/params exactly equal to node def, text, lesson exists, try-board valid, saved-board round trip, robot moves).
- tests/tutorial/lesson-two-motor-robot.test.ts (5): registration, starter board lacks the kinds, step-by-step solve, finished board drives/spins/turns on keys, unfinished board never moves and a missing power wire changes the path.
- Updated: step-1-nodes (57 -> 59), no-action-without-wire (59, `setRobotWheel` counts as an action when rpm != 0), fake-world (+2 stubs). Baselines: solid-off-baseline.json gains 3 entries (lesson:two-motor-robot, handbook:robot-body, handbook:motor), solid-on-summary.snap.json gains the same 3 rows (pure additions, no existing hash changed).

## Verification
- `npx tsc --noEmit -p .` clean.
- See "Test run" at the bottom of the final message for the full-suite outcome.
- Playwright on :5251 (script `plans/browser-scripts/robot-drive-check.mjs`, shots in `plans/reports/shots-robot-drive/`): handbook motor page, try board, 2d-top forward and turning, properties panel of Thân robot (all open params visible) and Động cơ, 3D turning on a floor. 0 page errors; one console "404 Not Found" resource message, source not investigated (not checked against main).

## NOT verified
- Real phone / touch; sound; performance with many robots.
- Handbook "Thử ngay" in 3D: the try boards are 2d-top (no floor); in 3d a robot without a floor falls (normal gravity rule).
- Editor shows the usual "Chưa có mảnh ghép Nhân vật nên chưa có ai để chơi" info line on the try boards (same as the vehicle try board); play works anyway.
- Pivot model for a single off-centre motor is a deliberate simplification (wheel slip is not modelled); it is not a physical simulation of a caster.
- Merge: expect small conflicts in nodes/index.ts, node-names.ts, the count tests, handbook/index.ts, course.ts, lessons.ts, fake-world.ts, types.ts (WorldApi), solid-off-baseline.json and solid-on-summary.snap.json; all my edits there are additive.
