# Piston, arm links and joints push crates through the engine (worktree GameBuilder-w2-arm-push, branch feat/w2-arm-push)

Not merged, not pushed. Labels: [M] measured, [D] by design, [N] not verified.

## What was built
- The piston head and the arm cubes were already kinematic engine bodies (moving blocks). Only the old displacement of crates was in the way. With the switch on a rigid crate is no longer teleported by the push plan: piston (nodes/linear-actuator.ts, rod push and chassis-follow push) and joint (nodes/joint.ts). The plan still runs first and still decides the force limit, the torque limit and "a solid or wall is in the way" (head stops short, crate never crushed into a wall).
- `WorldApi.isRigidCrate(id)` (types.ts, world.ts, tests/nodes/fake-world.ts). A `rigid` field on EntityView was tried first and dropped: it changed every on-mode hash.
- `PushBody.crossTol` / `RIGID_CROSS_TOL = 0.05` (world/linear-actuator.ts): a crate the engine tilts at a belt edge sinks about 2.4 cm into the belt, which its unrotated box showed as "stuck in a solid"; the piston froze and read maxForce (found in weight-sorter, 80 N). Rigid crates only; off mode unchanged.
- Handbook "Vật lý thật": the sentence saying piston/arm/slider push the old way is replaced; one "Chưa mô phỏng" line added.
- crate-engine.ts untouched.

## Files
src: engine/types.ts, world/world.ts, world/linear-actuator.ts, nodes/linear-actuator.ts, nodes/joint.ts, handbook/topic-real-physics.ts.
tests: tests/world/crate-pushers.test.ts (8), tests/world/crate-pusher-samples.test.ts (2), tests/nodes/fake-world.ts, tests/editor/real-physics-on-baseline.json (1 entry).
plans/browser-scripts/w2-arm-push-check.mjs, plans/reports/shots-w2-arm-push/.
Not touched: motor.ts, robot-traction.ts, off-mode baselines and test, sensor/zone/scale code.

## Measured vs hand [M]
Crate 10 kg, 0.4 x 1.2 x 0.4, mu 0.5, piston 0.3 m/s.

| Case | Hand | Measured |
|---|---|---|
| Piston at 1.1 m, 100 N (tip needs 17.8 N) | tips | peak tilt over 60 deg (test bound), no overload |
| Piston at 0.15 m (tip would need 130.8 N) | slides | peak tilt under 3 deg, moved over 0.6 m |
| Rod force while sliding | mu m g = 49.05 N | 49.05 N |
| Piston 40 N < 49.05 N | stalls | crate x = 3.00, tilt under 1 deg, overloaded, force 40 N |
| Crate between head and wall (1000 N) | not crushed | crate face within 2 cm of wall, head stops short |
| Arm link 1.0 m high, 500 N m, 15 deg/s | tips | peak tilt over 45 deg |
| Arm link 0.15 m high | slides | peak tilt under 5 deg |
| Joint 40 N m (needs about 74 N m) | stays | crate untouched, overloaded |

Without the source change 5 of the 8 tests fail (crate never tilts).
Samples with the switch on: weight-sorter sorts every heavy crate to the side bin and light to the end bin over 80 s, never overloaded, peak force 34.3 N (limit 39.24 N for 8 kg); auto-arm places all crates, 0 slipped, 0 crushed, no overload.
A joint at 40 deg/s tipped even a link at 0.15 m (13 deg peak): a kinematic hit at about 1 m/s is a real jerk, same as noted for blocks; tests use 15 deg/s.

## Re-recorded hashes
Only `handbook:linear-actuator` (b0cf41d9:900 to ffc16e32:900): its piston now pushes a loose crate by contact instead of displacement. Two fresh processes gave the identical ffc16e32. The other 37 entries are unchanged. Off-mode baselines untouched, solid-off-unchanged green.

## Tests
`npx tsc --noEmit` clean. Full run `npx vitest run --testTimeout 300000`: 226 files, 3437 tests, all passed (610 s).

## Browser [M, looked at]
Dev server 5293, stopped. Shots scene-*.png: the high-piston crate lies on its side by 2.5 s, the low-piston crate stays standing and is slid, the arm link sweeps and tips the third crate (headless SwiftShader). The mid-tip frame was not captured. Older push-*.png shots are from a first run without a camera card.

## NOT verified
Phone/other browsers; pushers faster than about 6 m/s (several 0.1 m sub-steps in one tick, the crate is not moved between them, the head may end inside it and the engine pushes it out hard); an arm pushing a stack in a real board; cost per tick.

## Gaps
1. The force check is sliding friction only: a piston or joint too weak for mu*m*g stalls even where a high push could tip the crate with less force (same as today; stated in the handbook).
2. The pusher is kinematic: once cleared it gives the crate any impulse, no slowdown on impact (same as the robot chassis).
3. The plan box of a crate is unrotated; crossTol 5 cm hides the tilt sink, but a crate tipped over a wall edge may be judged by its upright box.

Status: DONE
