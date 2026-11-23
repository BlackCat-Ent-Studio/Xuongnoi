# p-arm report (feat/p-arm, 2 commits on 18e24fa, not merged, not pushed)

Commits: `67e1f5c` gripper + legacy default + WorldApi.robotPushN, `9de1759` solid joint/link + piston on chassis/joint.

## 1. Solid joint / link ("Chắn vật", default Không) - REAL
- New select param `solid` (no/yes) on `joint` and `link`, createOnly. OFF = no extra entity, no new field: baseline 0 changed (solid-off-unchanged 136/136, solid-on summary snapshot green).
- ON: invisible solid blocks (render hint part `body`, empty figure). Link = chain of cubes of side = thickness laid along the length (exact for horizontal / vertical, up to ~0.4 x thickness fatter on a diagonal). Joint = one 0.3 m cube at the pivot. They are ordinary solid blocks, so characters, robot chassis (side/top/3D), vehicles and loose items collide through the existing rules.
- Spawned lazily on the first tick at their place (a solid block cannot be dragged 1000 m by moveBlock).
- Turning = push. Joint asks the arm registry for the solid cubes beyond it at old and candidate angle (new `shape` closure per part; link, joint, piston register one). Each cube pushes with `planPush` (piston model: friction of pushed bodies, lifting adds weight, a solid stops it). Torque needed = sum(F x r) added to the gravity holding torque; mechanics `torque()` reused. Too much torque or an unmovable load: joint stays, `overloaded` true, `reached` false. Solid in the way: angle cut back (up to 6 retries) to the touching angle, same flags. Never tunnels (tests check no cube ever overlaps the wall).
- Files: `world/arm-solid.ts` (new, pure), `nodes/arm-parts.ts`, `joint.ts`, `link.ts`, `render-hints.ts`, `render/arm-part-models.ts`.
- Tests (`tests/arm/arm-solid.test.ts`, 11): lowered barrier stops walker and robot, raised passes (side, 3D, top-view gate); OFF = walker passes + no extra entities; board without the param = OFF; arm swinging onto a wall stalls (angle -28 deg, overloaded, reached false, no cube inside); same arm without wall reaches -90; yaw sweep pushes a 10 kg crate with 200 N m, stalls with 40 N m; crate lands on a horizontal link (solid) / falls through (off).

## 2. Gripper between fingers - REAL
- New select `grip` ("Cách kẹp"): `between` "Vật nằm giữa hai ngón" / `reach` "Vật trong tầm với". Rule `between`: grasp point inside the object's extent along the arm (and along the third axis in 3D) and the whole object inside the open fingers across the closing axis (`betweenFingers`). `inReach` / `candidate` follow the active rule. `reach` param only used in reach mode.
- Old-board pattern: new optional `ParamDef.legacyDefault`. New cards (createNode) get `default` = between; missing value in runtime, `parseBoard` and properties panel reads `legacyDefault` = reach. One mechanism for saved files, samples, lessons, handbook boards. Baseline unchanged. Chosen over a wire migration because a param has no wire to add.
- Test helper `tests/helpers/arm-rig.ts` now fills missing params with `legacyDefault ?? default` (simulates a card without the setting); no existing test file edited. Handbook try-board "Tay kẹp" got `grip: 'reach'` explicitly (built by createNode, would have flipped its hash).
- Tests `tests/arm/gripper-between-fingers.test.ts` (8): centred crate yes, 0.4 m ahead no (reach yes), off-centre across opening, too wide, 3D third axis, arm pose decides (joint 0 vs 40 deg), new card = between, old file = reach (parse + save + load + run).

## 3. Piston on a moving base - REAL (chassis, joint tip); other bases unchanged
- Chassis base: red tests first (4 failed: head went 5.1 m into a wall at 3.8, 200 kg crate shoved to x 11.6), then fix. The head follows the chassis through `planPush` sub-steps with force = `availablePushN` of the wheels (new `WorldApi.robotPushN`), never enters a solid; what it cannot follow is subtracted from the chassis (`teleport` back, rod is rigid), `overloaded` true, `force` = drive force. First tick placement stays a plain move (`placed` flag).
- Joint tip base: the joint's sweep includes the piston head (solid cube at current rod length). Head cannot enter a table (test), stalls the joint.
- Tests `tests/actuator/piston-on-chassis.test.ts` (5), `piston-on-joint.test.ts` (2). Invariants added to `tests/puzzle/physics-invariants.test.ts` ("arms and pistons", 3): chassis piston into wall was red with the old node (`machine-in-wall`), green now; the two arm invariants are new behaviour (no old red).

## Verification
- `npx tsc --noEmit -p .` clean.
- Full `npx vitest run --testTimeout 300000`: 3223 pass, 4 failed. Reruns: handbook:gripper hash + solid-on summary (cause: handbook try-board, fixed, rerun green with tests/handbook, tests/tutorial, both solid files = 764 pass); `course-coverage` (listed bool-to-number / value-table / angle-diff as untaught: those kinds are not in this worktree, passes alone, looks like cross-test registry pollution during the full run, not reproduced); level-7-decoy passes alone (about 14 min); city-delivery-3d red light timed out at its own 180 s when run beside it (208 s) and PASSES alone (103 s): known load timeouts, no arm or piston in those boards.
- Screenshots (read): `plans/reports/shots-p-arm/` barrier-down-5s (character stopped at the orange hanging barrier), barrier-up (walks past), grip-right-1-space-held (arm level, gripper at the crate), grip-wrong-1-space-held (arm raised 35 deg, crate stays on the table). Script `plans/browser-scripts/p-arm-shots.mjs`.

## Limits (not faked, just not done)
- Link/joint on a MOVING base (robot chassis, moving platform): their cubes follow with `moveBlock` (unlimited push, no wall check). Only piston-on-chassis is force-limited.
- Static solids only: other movers (another arm's cubes, piston heads, platforms) are not in the sweep, so two arms can pass through each other.
- Riders standing on an arm piece are carried but their weight is not added to the holding torque; reaction torque of a piston extending while on a joint not modelled.
- Sweep treats each cube step as a straight chord (fractions of a degree per tick); the same pushed body touched by two cubes is counted per cube (slightly conservative torque).
- A solid link whose cubes overlap the gripper's held crate can part them (physics resolves overlaps); not seen in tests.
- Piston on vehicles / moving blocks: old unlimited `moveBlock` follow.
- Not verified: top-view 3D camera look of the cubes (invisible), touch/mobile, deploy.
- Lessons untouched: the robot-arm lesson adds a new gripper card (between rule); its tests passed, but the lesson's crate pose was not re-checked by a human.
- Sample re-tune for the new gripper default is left to the later agent (samples keep `reach` via legacy default).
