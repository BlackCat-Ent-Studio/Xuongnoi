# Solid palm and fingers for the gripper ("Vật lý thật") - worktree GameBuilder-solid-fingers, branch feat/solid-fingers

Not merged, not pushed. Commits: `3300759` (engine + gripper + tests), `afb2459` (boards, handbook, baselines). [M] measured, [D] by design, [N] not verified.

## Design
- Switch ON (`world.realPhysicsOn()`): the hand is solid whatever the link/joint "Chắn vật" says (a real hand is solid). Switch OFF: no code path changes ([M] `solid-off-unchanged` 140/140 with the old baselines and the new engine, before any board edit).
- `world/hand-solid.ts` (pure): palm + 2 fingers as the SAME boxes that are drawn (sizes `palmSizeOf`, `FINGER_*`, pose from the hand frame and the finger positions). The world's solid blocks are axis-aligned, so each box is cut in slices (palm 0.25 m, finger 3) and every slice is covered by the bounds of its real outline: a hand square to the axes is covered EXACTLY (test: same volume and bounds), a tilted hand from OUTSIDE (test: every corner inside, never smaller). Count of cubes is fixed per opening (11 for 1 m), cubes are resized each tick (`WorldApi.resizeBlock`).
- Arm motion: the gripper registers `shape` (its cubes) so `solidsBeyond` hands them to every joint beyond it; the joint sweeps them with the same `resolveTurn`/`planPush` path as links and pistons: force = min(tip, slide), limit held every substep, rows/stacks summed, wall/belt/floor stop the hand, stall -> "Quá tải" and the load read-out. One change in the shared sweep: a rigid crate touched by several cubes of one sweep is charged ONCE (a 5-slice palm paid 5 x friction before); non-rigid bodies are charged per cube as ever (`PushPlan.needs`).
- Finger motion: each finger travels toward its place at 1 m/s (constant `FINGER_SPEED`, no new UI) through `resolveTurn` with lever 1 m and `availableNm` = grip force (N): pushes an un-gripped crate with at most "Lực kẹp", stops when that is not enough, stops at walls and at the other finger (a crate cannot be squeezed into it). The palm is NOT an obstacle for a finger (it sits behind). Clamp unchanged: pads end on the faces of a crate that fits.
- Held crate = part of the hand: `WorldApi.setItemGrip` -> `Entity.grippedBy`; the engine keeps it parked (no contacts, no kick), `findFreeSpot` and "rests on" ignore the hand's own cubes, joints/fingers leave it out of their push list (`heldBeyond`). On release the flag is cleared: it re-enters the engine at the same place with zero speed.
- Gripping is refused (no `holding`, no `inReach`) when the crate does not fit between the fingers AS THEY STAND NOW (closed fingers leave no room) or a pad on the crate's faces would be inside a solid (a finger cannot go under a crate lying flat on a table).
- Fragile crates: crush needs the clamp (squeeze of the held pair, `applySqueeze`, unchanged, > crush limit still crushes). A finger that only pushes does not count; one finger pressing a crate on a wall does not crush it [D, documented as a gap].
- Unmounted hand (base wire removed): lets go, its cubes are hidden until mounted again.
- Rendering: the drawn palm/fingers are placed from the same `handBoxes` numbers (same sizes, same pose, finger positions = the simulated ones); tested by construction + `crateInHand` measuring the drawn boxes in every sample test.

## Files
Src: `world/hand-solid.ts` (new), `nodes/gripper.ts`, `nodes/arm-parts.ts` (`holds`, `heldBeyond`, resizing placer), `nodes/joint.ts`, `nodes/linear-actuator.ts` (`pushBodiesOf` extra exclusion), `world/arm-solid.ts`, `world/linear-actuator.ts` (`needs`), `world/crate-engine.ts`, `world/teleport.ts`, `world/entity.ts`, `world/world.ts`, `engine/types.ts` (3 WorldApi methods). Boards: `samples/auto-arm-board.ts`, `samples/robot-arm-board.ts`, `handbook/boards-robot-arm.ts`. Docs: `handbook/topic-real-physics.ts` (item + Ví dụ 9 + "Chưa mô phỏng"), `handbook/content-robot-arm.ts` (gripper page purpose + worked tip), gripper description. Tests: new `tests/arm/gripper-solid-hand.test.ts` (8), `tests/world/hand-solid.test.ts` (3), `tests/io/solid-hand-samples.test.ts` (2); helper `tests/helpers/grip-metrics.ts` (`crateInHand`, `crateInArm`, `handBoxesOf`; drawn boxes are the first three entities of the gripper).

## Hand vs measured
Tolerances: overlap 1 mm; stop angle 0.3 deg; loads +-10 %. The planner counts a rigid crate as touched 5 mm before the faces meet, so stops are about 5 mm short.

| Case | Hand number | Measured |
|---|---|---|
| Closing finger, 2 kg mu 0.5 crate (0.4 x 0.3 x 0.4), tip 13.08 N > slide 9.81 N | 8 N stalls, 12 N slides it between the pads | 8 N: z 0.25000 (moved 0.006 mm), `holding` false; 12 N: z -0.008 (met the other pad half way), tilt 0.48 deg |
| Open hand lowered on a 1.75 m crate (palm face) | stops at sin a = 0.1333, 7.66 deg, load 9.81 N x 3.0..3.3 m | stops 7.757 deg (0.095 deg = 5 mm short), gap +4.8 mm (>= 0), crate moved 0.07 mm, `overloaded`, load 29.2 N m |
| Crate wider (1.2) than the opening (0.5), fingertips on top | stops at 6.70 deg | stops 6.794 deg, worst overlap of every tick -4.96 mm (a gap), `overloaded` |
| Closed hand swept at a tall crate (palm leads, h 0.925 m, push dir 9.5 deg off) | F_tip 24.4 N, 24.4 N m at 1.0 m; slide 49.05 N | 15 N m stalls, load read 24.27, crate untouched; 40 N m tips it (tilt 90 deg), not overloaded |
| Same, low squat crate (0.4 x 0.4 x 0.6), tip 73.6 N, slide 49.05 N | 49.05 N m at 1.003 m | 40 N m stalls (load 49.21), 80 N m slides it to z -1.092, tilt 0.04 deg |
| Crate against a wall (face z -0.65), 1000 N m | stalls | crate face -0.6501, joint stops at 4.1 deg of 40, `overloaded` |
| Crate leaning 5.5 deg on the wall | stalls | moved < 1 cm, tilt change < 1 deg, `overloaded` |
| Held crate, hand still, 2 s | pose constant | drift 0.000 mm |
| Released in the air | falls straight | 3.7 mm lateral over fall + landing (< 5 mm) |
| Cover cubes, hand pointing down | volume = box | equal to 1e-9 (palm 5 cubes, finger 3) |
| auto-arm 300 s, every tick, drawn palm/fingers/`upper`/`fore` vs every crate | overlap < 1 mm | worst < 1 mm (test), 0 joints overloaded, 0 slips, 0 crushes, >= 33 placed |
| AGV 180 s, same measure on `canh-tren`/`canh-duoi` | overlap < 1 mm | worst < 1 mm (test), no joint overloaded, >= 4 delivered |

## Board retunes (pieces only, each listed)
- **auto-arm**: cycle 6 -> 7 steps. Step 6 "nhả" now holds 0.5 s (new `timer` card `open-wait`, wires `step6 -> open-wait.run`, `open-wait.done -> done6`) and step 7 swings home (`swing.reached -> done7`). Reason: the swing used to start the tick the fingers were told to open; the still-closed pads carried the released crate sideways and blocked the swing once per cycle. Tables got a 7th row (swing `[0,0,0,0,180,180,0]`, shoulder/elbow hover), sequence card `rows 17`, notes/step text updated. Taught poses unchanged (28.7/-99 etc. already stood round the crate).
- **robot-arm** (2D side): the 0.5 m opening cannot be steered by the old poses: a hand tilted 30 to 55 degrees puts a finger through the table or the crate next to it. Added a `wrist` joint (hand pointing down = -90 - shoulder - elbow) with `down` const and two `math` subtractions, gripper width 1 -> 0.5, `heavy` 0.5 x 0.5 x 0.5 at x 0.78 -> 0.44 x 0.5 x 0.44 at 0.46, `fragile` 0.4 at x 1.52, y 0.8 -> 0.35 cube at 1.12, 0.775 (palm clears the top). Masses, light crate and key counts unchanged. Wires: first 27 are essential in the test (was 20).
- **handbook "Tay kẹp"**: pillar 1 m -> 1.3 m, cap y 1.25 -> 1.6, fixed `wrist` joint (start -78, powered) hangs the hand down, crate x -0.5 -> -1.02; arrow down still lowers the hand onto it.
- **agv-shuttle**: no change needed (arm poses already put the hand round the crate; see the 180 s test).
- Test route changes (physical reason in each comment): robot-arm/resting-crate tests now bend the elbow first (hand stays high), then lower the shoulder; `gripper-turned-crate` holds the crate in the air from the start and swings the hand about a joint (a crate swung off a shelf would dip its corner into it); `gripper-hold-pose` waits 45 ticks for the fingers to close and measures face gaps after 0.35 s; its "0.3 m off the middle" case now asserts the finger pushes the crate out instead of ghosting through (overlap < 2 mm); AGV anti-forced wire `co-tai -> dk-b5.b` now fails as "stuck loaded at the loading station" (the open hand left lowered keeps the chassis in) instead of "one crate delivered".

## Baselines
Re-recorded only (script-compared with the pre-change files, 42 ON / 138 OFF keys): ON `sample:robot-arm` cee76ba8 -> 2e9434c5, `sample:auto-arm` 7ec55ddb -> 5b6a8bef, `sample:agv-shuttle` 5bd70320 -> 782fde07 (engine: solid hand, finger travel), `lesson:arm-steps` 4466f24b -> 4b31d25 (engine only: its horizontal hand now stops at the table, the lesson is not retuned), `handbook:gripper` 868ae8a1 -> 9615d789. OFF `sample:robot-arm` a1e1715c -> d5249227 and `handbook:gripper` 9aae8020 -> 2f6ed7de (board edits only). `solid-on-summary.snap.json`: same two OFF/ON hashes for those boards; `handbook:gripper` checker note "sensor-without-contact" x1 -> x2 (the new wrist hub). Two fresh process runs of real-physics-on-hash + solid-off-unchanged + solid-on-invariants: 323/323 both times, identical hashes.

## Totals
`npx tsc --noEmit` clean. ONE full `npx vitest run --testTimeout 300000` in `app/`, waited to the end: **239 files, 3564 tests, 3564 passed** (776 s, no timeouts), run on the committed tree (HEAD afb2459). Earlier focused runs: `tests/arm` 99/99, editor guards 323/323 twice, handbook/nodes/tutorial/engine/render subset 2142/2142.

## Cost
Auto-arm board, 60 s of play, 3 runs each, mean per tick (tick + world step): hand not solid (the previous ON behaviour, forced by a temporary switch, since removed) 0.52-0.54 ms; hand solid 0.92-1.14 ms (about 2x, 6 % of the 16.7 ms budget). Cost sits in the 11 cube sweeps per joint move and the collider rebuilds of resized cubes.

## Browser [M, looked at], server on 5300 stopped
`plans/browser-scripts/solid-fingers-shots.mjs`, shots in `plans/reports/shots-solid-fingers/` (headless SwiftShader; the sim runs faster than the wall clock, bursts are matched by the step banner).
1. `push-b-00..11`: closed hand (black fingers at the foot of the orange arm, seen from above) swings into a brown crate: frame 0.5 s the fingers touch its side, 2.6 s the crate has been pushed ahead of them (about 0.5 m) and sits beside the hand; later frames identical (stalled at the target angle). Angle `a` is too far away to read.
2. Auto-arm, angle `a` (`arm-a-*`): 18.4 s "3. Kẹp" the dark fingers stand either side of the brown crate on the feed belt; 20.3 s "5. Quay sang chỗ đặt" the arm has swung with the crate under the hand; 24.3 s "1. Chờ thùng tới" placed counter 1, one crate rides the out belt, one waits on the feed belt. Angle `b` (`arm-b-*`, from the other side, close): 18.2 s fingers round the crate on the belt, 19.2 s "4. Nâng thùng" crate raised with the hand, 23.2 s "7. Quay về" placed crate on the out belt, hand back with the fingers open.
3. AGV (`agv-a-*`): 5.4 s vehicle waits at "Trạm nạp", the arm is down at the table round the cyan crate; 7.5 s the arm has swung the crate over the vehicle (fingers beside it); 11.4 s the vehicle leaves with "Khối lượng đang chở: 1".

## Not verified [N]
- 2D top view of the solid hand (only side and 3D are exercised); other browsers/phones; real GPU.
- Tilted hand: cover cubes are a little fat (bulge up to a few cm at 45 degrees); a crate can be pushed by the bulge slightly before the drawn finger touches it. The grips and every measured overlap (against the drawn boxes) were inside 1 mm.
- Slices count (11 cubes) tuned by hand, not by measurement; long runs on a weak machine.

## Gaps / decisions for the owner
1. Finger speed 1 m/s is a constant (no param, no new UI). A grip is decided the tick closing starts and the pads travel up to 0.2-0.35 s onto the faces: the crate is "held" while the pads are still on the way.
2. Links with "Chắn vật" = Không still pass through crates; only the hand is always solid (decision: a real hand is solid). Boards saved with the switch ON before this change get a solid hand: their poses may need re-teaching (4 shipped boards were; `lesson:arm-steps` was not and plays OFF by default).
3. A stalled finger has no output (no "Quá tải" for the hand's own fingers); only joints report overload.
4. A crate pressed against a wall by ONE finger is not crushed (crush needs the clamped pair).
5. Gripper cannot grip a crate lying flat on a table with a horizontal side-view hand (the lower pad cannot get under it): boards must come down from above (documented in the handbook page).
6. Exact oriented colliders (instead of upright covers) would remove the tilted-hand bulge: a bigger engine change, not done.
