# Auto-sense: sensors, encoder / odometry and payload on a robot chassis (feat/auto-sense, worktree D:\workspace\GameBuilder-ausense, dev :5261 running)

Branch from main deb9fe2. Node kinds stay 67. Entity views of boards without payload are byte-identical (new view fields only appear when nonzero).

## New ports / params (all default off or neutral)
| Piece | Name (VI / EN) | Kind | Default | Shown when |
|---|---|---|---|---|
| Dò phía trước | `mountSide` Gắn lệch ngang (m) | param, advanced | 0 | always in Nâng cao |
| | `mountForward` Gắn lệch trước (m) | param, advanced | 0 | |
| | `lookAngle` Xoay hướng nhìn (độ, + = phải) | param, advanced | 0 | |
| | `beam` Độ rộng tia (m, 0 = bằng thân) | param, advanced | 0 | (4th param, added so a thin ultrasonic beam does not need a hidden rule) |
| Động cơ | `showTurns` Hiện bộ đếm vòng | param, advanced | no | |
| | out `turns` Số vòng đã quay / Turns (signed) | optional out | | showTurns = yes |
| | in `resetTurns` Đặt lại vòng / Reset turns (pulse) | optional in | | showTurns = yes |
| Thân robot | `showDistance` | param, advanced | no | |
| | out `distance` Quãng đường / Distance (m) | optional out | | showDistance = yes |
| | in `resetDistance` Đặt lại quãng đường / Reset distance (pulse) | optional in | | showDistance = yes |
| | `showPayload` | param, advanced | no | |
| | out `payload` Khối lượng đang chở / Payload (kg) | optional out | | showPayload = yes |
| | out `overloaded` Quá tải / Overloaded | optional out | | showPayload = yes |
| | `maxPayload` Tải tối đa (kg, 0 = không giới hạn) | param, advanced, live | 0 | limit works with or without the ports |
| Tầm nhìn, Vùng kích hoạt | filter option `robot` Robot | select option | n/a | |

Default cards keep their ports and size (tests assert `activeInputs/activeOutputs` equal the old lists). Names added to node-names.ts (VI + EN); handbook pages of robot-body, motor, ahead-sensor, vision-sensor, color-sensor, zone updated in simple Vietnamese.

## Already working vs fixed
| Item | Before | Now |
|---|---|---|
| line-sensor on chassis | worked (`headingOf` read `view.robot.heading`) | now shares one helper `world/heading.ts` `groundHeading` |
| Dò phía trước on a chassis | partly: used the entity facing (set each step), stale before the 1st step, box lane = 1 m square, generous on diagonals | exact beam test (`probeBeam`) for robots and any mounted/turned sensor; chassis facing set at spawn; other robots count as obstacles |
| Tầm nhìn on a chassis | BROKEN: robot view has no `facing`, no `vehicle` -> always looked along +x | fixed via `groundHeading` (robot heading) |
| Vùng kích hoạt "Bám theo + Xoay theo vật" on a chassis | BROKEN: yaw 0 | fixed (reads robot heading); filter "Robot" added |
| Đọc màu (feet / ahead), Va chạm, Đo khoảng cách on a chassis | already worked (generic) | tests added only |
| Payload rides | NOT working: items fell THROUGH the chassis (not a support), and rides only existed for `vehicle` | items rest on the top of a solid chassis; characters and items resting on it travel and turn with it (3D and side view) |
| Payload mass loads the chassis | not at all | `massOn(chassis)` added to the drive mass every step |
| Overload | n/a | above `maxPayload` motors ask for no motion (robot brakes, then stays), `overloaded` on |

Heading helper: one `groundHeading` (robot, vehicle, character facing, default +x; 0 = +x, clockwise from above), `turnDirection`. Used by line-sensor `headingOf`, vision `lookDirection`, probe beam. The old `probeAlongFacing` code is untouched and still used for characters/vehicles with a neutral mount (identical results; baselines unchanged).

Beam rules (documented in handbook): gap measured from where the beam leaves the chassis collision box (square footprint), so it reads 0 when the chassis is stopped by the obstacle. Default beam = 90% of body width (robot: `width`, not the square), like the old lane. Look angle/side ignored in the side view (only forward applies).

Odometry details: `turns` = integral of wheel rpm / 60 (wheel's own revolutions, also while the robot is blocked by a wall: spinning wheel). `distance` = ground path of the chassis centre between ticks (turning on the spot adds ~0; reads one tick behind the position because nodes tick before the world step).

## Baselines
No baseline file changed. `solid-off-unchanged` (hash of all samples / lessons / handbook boards incl. robot-line-follow and the 3 robot lessons) passes untouched; entity view JSON only gains `robot.payload` / `robot.overloaded` when nonzero. The robot handbook try-boards and `content-robot-drive.test.ts` expectation changed in one line: ports must equal `knownInputs + knownOutputs` (same rule as the PID page).

## Tests added
- tests/world/robot-payload.test.ts (8): crate rides straight, swings with a spin, side view, starts on a turned chassis, heavier -> slower, payload reported (absent when empty), overload, maxPayload 0 = no limit.
- tests/nodes/robot-sense.test.ts (20): heading helper (robot/vehicle/character/default, turn direction, line eye = vision cone at 0/45/90/200, side view); Dò phía trước on chassis at 0/45/90/200 deg exact distance vs independent slab calc, wall beside the lane misses at all headings, default beam width in/out, mount side, mount forward, look angle (right/left/back, turns with chassis), character unchanged, side/top views, other robot; Tầm nhìn at 0/90/200 and filter robot; Đọc màu feet + ahead, Va chạm, Đo khoảng cách, Vùng kích hoạt follow + rotate + robot filter.
- tests/nodes/robot-odometry-payload.test.ts (18): optional ports hidden by default; turns = 2 x (t - 0.15) with ramp, turns x circumference vs path, custom rpm, signed/reversed, reset pulse; distance straight / curve length / spin-in-place / reset / side view; payload rides + output, heavier slower, overload + `overloaded`, empty chassis identical with maxPayload set, top-down view no payload.

## Verification
- `npx tsc --noEmit -p .` clean.
- Full vitest (--testTimeout 300000): 191 files, 3064 tests, all passed.
- Playwright :5261 (plans/browser-scripts/auto-sense-check.mjs, shots in plans/reports/shots-auto-sense/, read): `wall-2-driving.png` / `wall-3-stopped.png` (3D robot with chassis + 2 motors; front sensor distance 5.6 -> 0.3 m on Hiện số and it stops 0.3 m from the wall through Khoảng cách -> Quy đổi khoảng -> both Công suất; left-looking sensor (mount -0.35, angle -90, beam 5 cm) reads 1.8 m from the side wall then 6 when past its end); `crate-1-board.png` (new ports on cards, default cards unchanged in size), `crate-2-turning.png` (crate rides on the turning chassis; HUD Đang chở 4 kg, Quãng đường 10.4 m, Vòng bánh trái 14.9). Only console error: one 404 (favicon, as before).
- Demo boards were loaded through the autosave slot (not shipped samples; no samples.ts change).

## NOT verified
- Real touch / phone; the new advanced params only seen in the Properties panel by test, not by screenshot.
- Items resting on a chassis in the top-down view (no stacking there by design).
- A chassis running into a loose crate on the floor still passes through it (as before); crates only ride when on top.
- Encoder counts spinning wheels even when blocked (documented); no slip model.
- Character standing on a moving chassis rides in position only if its feet are within the ride gap; not browser-tested.
- Vision fan overlay (3D yellow cone) is only drawn for characters, not for robots (render/vision-fan.ts untouched).
- The `payload` view fields are new optional fields on `EntityView.robot` (only present when nonzero).

## Unresolved questions
- Should the 3D vision cone be painted for robot viewers too? (render change, not asked.)
- Should a chassis shove loose crates on the floor instead of passing through? (new physics, not asked.)
