# Robot traction, "Vật lý thật" switch (worktree GameBuilder-w2trac, branch feat/w2-traction, base fc93d95)

Commits: 7d20f13 (switch), cc478eb (traction model, motor, handbook, tests). Nothing pushed or merged.

## What changed

| File | Change |
|---|---|
| src/engine/types.ts | `GraphSettings.realPhysics`; `RobotWheelSpec.driveN/brakeN`; `EntityView.robot.slip` (only with switch on); `WorldApi.robotWheelState` |
| src/io/save-format.ts | parse `settings.realPhysics` (only explicit `true`) |
| src/world/world-options.ts, graph-world-options.ts | `WorldOptions.realPhysics`; options built from either switch (solid-bodies output unchanged) |
| src/editor/editor-state.ts, properties-panel.ts, app.ts, panels-text-vi.ts | get/setRealPhysics, 2nd toggle under "Va chạm thật" (panel, nothing selected) + File menu entry |
| src/world/robot-traction.ts (new) | the model (pure maths) |
| src/world/robot-drive.ts | traction branch `driveOnTraction`, wheel fields, `settleRobot` for averaged travel |
| src/world/robot-push.ts | push force per wheel capped by wheel grip (only when traction state exists) |
| src/world/world.ts, entity.ts | robot created with traction flag; `robotWheelState`; view `slip` only when on |
| src/nodes/motor.ts | params `driveForce`, `brakeForce`, `showSlip`; optional outputs `slipping`, `slipSpeed`; rpm/turns outputs follow real wheel only when switch on |
| src/handbook/topic-real-physics.ts (new), handbook-dialog.ts, content-robot-drive.ts | page "Vật lý thật" (switch + 3 formulas, 1 worked example each); motor page ports/params |
| tests | tests/world/robot-traction.test.ts (20), tests/io/real-physics-setting.test.ts (5), helper `rig(..., realPhysics)`, fake-world |

Off mode: `createRobotBody(..., traction=false)` keeps the old code path byte for byte; no new view field, no new save field. Gravity: traction uses 9.81 (same constant the old drive used); entity fall gravity (-30) untouched.

## Formulas as implemented (per tick, dt = 1/60)
- Wheel i at side s_i: ground speed g_i = v - w·s_i. Command c_i = rim speed from motor rpm (0 if overloaded).
- Force wanted: the smallest force set F_i = a + b·s_i closing every gap c_i - g_i in one tick (total force m·gap/dt, torque I·gap/dt; wheels on one line share the push).
- Limit: |F_i| <= min(motor, grip). Motor = `driveN` (default 6 N, the old FORCE_PER_MOTOR) when speeding up, `brakeN` when slowing down (0 = no motor limit). Grip = max(0.02, mu)·m·9.81/n (m = chassis + payload; weight shared equally).
- m·dv/dt = sum F_i; I·dw/dt = -sum F_i·s_i; I = m(length² + width²)/12.
- Slipping = wanted force (after motor limit) above grip. Slip speed = command - ground; wheel rim then equals the command, otherwise it rolls with the ground (rpm output, encoder, drawn spin follow this).
- Chassis moves/turns at the average of old and new rate per tick (exact v²/2a distances).
- Braking design: "Lực phanh" = N per motor, 0 = friction only. Chosen because a force per motor gives a = sum brake / m (mass-dependent), exactly the physics asked for, and 0 leaves the friction case mass-independent (mu·g). Brake larger than grip is clipped by grip.
- Push: robot pushing crates uses sum over wheels of min(maxForce·|power|, wheel grip).
- Load transfer: left out. Sum of grips stays mu·m·g so none of the numbers change; stated in handbook.

## Acceptance numbers (asserted in tests/world/robot-traction.test.ts)
| Case | Expected | Measured (tolerance) |
|---|---|---|
| 2 kg, 2 x 6 N, mu 0.8 | 6 m/s² | speed after 0.5 s = 3.000 (1e-6); x = 0.75 m (1e-3) |
| +1 kg crate on chassis | 4 m/s² | 2.000 after 0.5 s (1e-6) |
| mu 0.2 | 1.962 m/s², slip | 0.981 after 0.5 s (1e-6); slipping true, rim = command |
| Yaw, 2 kg, 1 x 0.7 m, wheels at 0.35 m, 6 N opposite | I = 0.2483, alpha = 16.91 rad/s² | turn rate after 10 ticks = alpha·10/60 (1e-6). The report's 16.9 is correct; I re-derived it (4.2 / 0.24833). Note motor default side is 0.4 (alpha 19.3). 4 kg turns at exactly half |
| Friction braking from 1 m/s, mu 0.8 | 0.0637 m | 2 kg and 5 kg both within 1e-3 m |
| Brake 2 N per motor | 0.25 m (2 kg), 0.625 m (5 kg) | within 1e-3 m |
| Brake 500 N (above grip) | 0.0637 m | within 1e-3 m |
| Push cap, 2 kg, mu 0.2 | 3.924 N (not 60) | exact 1e-6 |

## New visible UI (exact labels)
- Panel (nothing selected) and File > Cài đặt game: checkbox "Vật lý thật", tip "Robot chạy bằng lực bám thật: bánh quá khỏe so với độ bám thì trượt, robot nặng thì tăng tốc, quay và dừng chậm hơn. Áp dụng ở lần Chạy sau." plus "?" opening handbook page "Vật lý thật".
- Motor card (Nâng cao params): "Lực kéo bánh (N, ...)" default 6, "Lực phanh (N mỗi động cơ, ...; 0 = chỉ phanh bằng ma sát)" default 0, "Hiện ô "Đang trượt" và "Tốc độ trượt"" default Không. Optional outputs "Đang trượt", "Tốc độ trượt" (card size unchanged unless enabled).
- Screenshots (looked at): plans/reports/shots-w2-traction/1-toggle-panel.png (toggle under Va chạm thật, unchecked), 2-toggle-on-closeup.png, 3/4-slip-low-mu*.png (mu 0.2 board: Trượt 1.7 m/s, Robot 3.1 m/s; slipSpeed 3.83 -> 1.83 wires). Script: plans/browser-scripts/w2-traction-shots.mjs.

## Baselines
Changed keys: none. tests/editor/solid-off-unchanged and solid-on-* pass unmodified (no baseline file touched).

## Tests
- tsc --noEmit clean. Focused run (io, editor, handbook, world, nodes, tutorial): 147 files, 2277 tests passed (before the last test additions). New files: 25 tests pass.
- Full run `npx vitest run --testTimeout 300000`: 217 files, 3332 tests passed, 0 failed.
- `git diff --numstat` == `--numstat -w` (CRLF kept).

## Not verified / limits
- Chassis with all wheels on one line: forces shared equally, yaw drifts as physics says; no sideways scrub model; payload assumed centred; equal weight per wheel; robot falling gravity unchanged.
- No handbook try-board added (existing try boards run with the switch off; a board needs settings which the try-board builder cannot set cheaply).
- Not exercised in 3D rendering; slip is data only (no skid marks).
- Braking with power 0 reports "Đang trượt" while the wheels are locked (friction braking above grip); intended, documented.
- Real-physics board hashes not recorded in a new baseline file.

## Unresolved questions
1. Should power 0 mean "wheels locked" (current) or "free-wheeling with coasting"? Old mode also brakes by grip; kept.
2. Should the 30 N push `maxForce` and 6 N `driveForce` be unified in this mode?
3. Add an ON-mode hash baseline for robot samples later?
