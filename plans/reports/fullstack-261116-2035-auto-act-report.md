# Auto-act report (2026-11-16): G3 feedback outputs + G4 linear actuator

Worktree `D:\workspace\GameBuilder-auact`, branch `feat/auto-act` (from main deb9fe2). Dev server :5262 running (left on).
Shots: `D:\workspace\GameBuilder\plans\reports\shots-auto-act\` (script: scratchpad auto-act-check.mjs).

## G3. Feedback outputs
Choice: ALWAYS-ON ports (no optionalOutputs, no advanced switch). Reason: trajectory hashes do not depend on unused outputs, and the script check shows 0 changed baseline entries (the sample robot-arm, lesson robot-arm, handbook joint/link/gripper all identical). Card gets 2 (gripper) / 1 (joint) more rows only.
- gripper: `inReach` Có vật trong tầm (bool, held state) and `candidate` Vật trong tầm (object). Same search as the grab: nearest free item within `reach`, width along the finger axis <= `width`. While holding = the held object. Search moved into `nearestGrippable()`; grab behaviour unchanged.
- joint: `reached` Đã tới góc = `!overloaded && |angleNow - clampedTarget| <= tolerance`; new advanced param `tolerance` (deg, default 1, 0..90).
- Names VI+EN in node-names.ts; handbook joint/gripper pages updated.

## G4. Linear actuator `linear-actuator` "Xi lanh đẩy" / "Linear Actuator / Piston" (category action, kinds 67 -> 68)
Inputs: `base` Gắn vào (object, optional; unwired = fixed at param `position`), `extend` Đẩy ra (bool; unwired = stays retracted), `position` Vị trí đặt (number 0..1 of stroke, wired wins over extend).
Outputs: `tip` Đầu đẩy (object; frame at the FRONT face of the head, registered in the arm-parts registry so a gripper / sensor / link can mount on it), `positionNow` Vị trí (m), `extended` Đã ra hết, `retracted` Đã thu về, `force` Lực đang đẩy (N), `overloaded` Quá tải.
Params (default, unit): `position` vec3 (0, 0.3, 0) m world origin of the barrel; `direction` 0 deg (ground plane, 0 = +x, clockwise from above like robot heading); `orient` ground | up | down; `stroke` 2 m (create-only); `maxForce` 100 N; `speed` 1 m/s; `headSize` 0.6 m cube (create-only); advanced `mount` vec3 (local offset when `base` wired), `color` #0ea5e9.
Pieces: solid cube head (the pusher), non-solid barrel (stroke + 0.2 m long) and rod. Head front at origin + (stroke + 0.2) + len + headSize.

Physics (src/world/linear-actuator.ts, pure, built on mechanics.ts `frictionForce` / `weight`):
- Each tick the rod moves toward its goal at `speed`, in sub-steps of <= 0.1 m (no tunnelling).
- Per sub-step `planPush`: bodies overlapped by the head's new box are pushed; bodies those meet are pushed too (chain); bodies standing on a pushed body ride along. Displacement of a pushed body = the distance along the push direction needed to clear the pusher.
- Required force `F = sum over directly-pushed bodies of mu * (m + riders' m) * 9.81`, plus `sum (m + riders) * 9.81` when pushing straight up. Example 10 kg, mu 0.5 -> 49.05 N.
- `F > maxForce` -> rod stays where it is, `overloaded` true, `force` = maxForce, nothing moves (no teleport).
- Solids (world.solidBoxes): bisection finds the largest advance (12 iterations) where head and every pushed/riding body stay out of solids (strict along travel axes, 1 cm slack across them so a crate on the floor is not "in" it). Blocked -> rod stops just short, `force` = maxForce, `overloaded` false.
- Objects are moved with `world.teleport` (front first) then the head with `moveBlock`; retract never pulls objects. Deterministic (60 Hz, no randomness).
- 2d-side ignores z, 2d-top ignores y (and riders). Side view direction = forward / backward along x, up / down; 3D and top use the yaw.

## Where things are
- New: `src/world/linear-actuator.ts`, `src/nodes/linear-actuator.ts`, `src/handbook/content-linear-actuator.ts` + `boards-linear-actuator.ts`, `src/tutorial/lesson-piston-push.ts` + `course-pack-k.ts`, tests `tests/actuator/*` (4 files, 38 tests).
- Edited (small): nodes/index.ts, node-names.ts, gripper.ts, joint.ts, handbook/index.ts, content-robot-arm.ts, boards-robot-arm.ts (`build` + types exported, optional `mode` arg), topic-engineering-physics.ts (+1 block "Đẩy bằng xi lanh"), editor/console/issues.ts (PLAYABLE_KINDS += linear-actuator, so a piston board no longer warns "Chưa có Nhân vật"), tutorial/lessons.ts (import + 1 spread), tutorial/course.ts.
- Handbook page: purpose, every port and param with units, formula F >= mu * m * 9.81 with 10 kg / 49.05 N example (40 N stalls, 60 N pushes), two crates 98.1 N, link to "Vật lý kỹ thuật" in tips and the topic page got a matching block. Try-board (3D): zone sensor "Khi đối tượng vào" -> Chốt nhớ -> piston `Đẩy ra`; piston `Đã ra hết` -> latch reset; 10 kg crate falls off a 4.7 m platform; note tells how to try 30 kg (stalls with Quá tải) and raise maxForce to 150.
- Lesson id: **`piston-push`** "Xi lanh đẩy thùng" in the "Robot" chapter (new pack file course-pack-k.ts). course.ts edit is ONE line: `'robot-arm'] }` -> `'robot-arm', 'piston-push'] }` on the `robots` chapter; lessons.ts: 1 import + `...createCoursePackK(KIT)` appended to the existing spread line. If the sibling reorganises chapters, just make sure `'piston-push'` stays in the Robot chapter list (test `tests/actuator/piston-try-and-lesson.test.ts` pins chapter id `robots`; update there if it is renamed).

## Tests
- tests/actuator/push-plan.test.ts: 49.05 N, 40 vs 60 N, two crates add up (98.1), rider load, lifting adds weight, wall stop, head stop, rest-on-floor not blocked, approach / targetLength, frames.
- piston-world.test.ts: 10 kg 40 N stalls (overloaded, force 40, rod 0.9 m) / 60 N pushes; peak force 49.05; two crates 60 N stalls / 100 N pushes both; 30 kg stalls until maxForce raised live; mu 0.1; wall stall (crate stops 4.6..4.72, head never past 5.02, force = max); retract leaves crate; extend unwired -> no motion; `position` wins; tip frame 2.8 + len; gripper mounted on tip gets inReach; top view and 3D push + stall; direction 90 pushes +z.
- feedback-outputs.test.ts: gripper inReach true/false by distance and width, held state; joint reached with tolerance, wide / zero tolerance, false when overloaded.
- piston-try-and-lesson.test.ts: handbook try-board (3D) pushes 10 kg off (force 49.05), 30 kg stalls then 150 N pushes, ANTI-FORCED: cut latch->piston wire or zone->latch wire -> crate stays at x 4, force 0; lesson solved step by step (ends with 150 N).
- Updated: step-1-nodes (68 kinds), play-edit-console (+1 test), solid-off-baseline + solid-on-summary: additions only (`lesson:piston-push`, `handbook:linear-actuator`), script-checked vs deb9fe2: 0 changed entries in both. no-action-without-wire and handbook coverage pass with no allowance needed (piston does not call spawn at evaluate; head spawned in create like joint/gripper). fake-world stub needed no change (no new WorldApi methods).
- Full vitest once with `--testTimeout 300000`: 192 files, 3062 / 3062 green. `npx tsc --noEmit -p .` clean. `git diff --numstat` == `-w` for all edited files.

## Browser (Playwright, :5262, 3D try-board)
Read: 01 handbook page, 02 board, 03 light crate (crate off the edge, resting on the ground, rod out), 04 properties panel (9 rows, advanced collapsed), 05/06 30 kg crate: rod stops at crate, "Lực đang đẩy (N): 100" and red "Quá tải!", 07/08 maxForce 150: crate pushed off. Only console message: one 404 (not investigated, appears unrelated).

## NOT verified
- 2D top / side play-through of the piston in a browser (headless tests only); real phone.
- Piston mounted on a moving base (robot, joint tip): follow-up uses `moveBlock` without force limit for the base's own motion; only rod motion is force-limited. Headless test covers only the tip frame, not a moving base.
- Pushing characters / vehicles / robots: they are treated as pushable bodies with their materialOf mass (60 / 1000 / 2 kg default); not tested.
- Up / down orientation only by the pure maths test, not played.
- Inertia (starting acceleration) not modelled, friction only; no kinetic vs static friction split.
- First-tick placement when `base` is wired: the head is spawned at the `position` param and slides to the base on tick 1 (can shove items near it once).
- Handbook / lesson text and the 3D look of the barrel/rod read by me only; not shown to the user. Piston card: 3 inputs, 6 outputs.
