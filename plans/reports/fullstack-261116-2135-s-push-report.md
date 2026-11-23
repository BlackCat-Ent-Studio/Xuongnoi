# S-push report (2026-11-16): robot shoves loose items (3a) + robot vision fan (4a)

Worktree `D:\workspace\GameBuilder-spush`, branch `feat/s-push` (from main 15cfec5). Dev server :5272 left running.
Shots: `D:\workspace\GameBuilder\plans\reports\shots-s-push\` (script `plans/browser-scripts/s-push-check.mjs`).

## 3a. Shoving
Code: `src/world/robot-push.ts` (new) reuses `planPush` / `exceeds` from `src/world/linear-actuator.ts` unchanged (same chain, riders, wall stop, friction sum). Hooked in `physics.ts stepRobot`: `beginShove` before the move, `finishShove` after it. `supportsOf` now uses `restsOnChassis` (same rule, moved so the shove can skip items riding on the chassis).

Params:
| Piece | Param / port | Default | Notes |
|---|---|---|---|
| motor | `maxForce` Lực kéo tối đa (N) | 30 | per motor, x |power| (= rpm / maxRpm, so it follows the motor ramp). Only matters when something is pushed. 2 motors = 60 N |
| robot-body | `pushObjects` Đẩy được vật (advanced select) | **yes** | see gating |
| robot-body | `showPush` (advanced select) | no | adds outputs `pushing` Đang đẩy vật (bool), `pushForce` Lực đang đẩy (N). Default card unchanged (tested) |

Formulas: required F = sum over directly pushed items of mu * (m + riders' m) * g (g 9.81); available = sum of wheel `maxForce * |power|` over wheels turning the way the chassis travels. F > available -> robot stalls (velocity zeroed, `pushForce` = available, wheels/turn counter keep counting). Else pushes at full speed, `pushForce` = F. Pushed item stopped by a wall: the chassis stops just short (nothing tunnels). If a wall bends the chassis path so the pushed chain would need more force, the move is cancelled.
Bodies shoved: kind `item` only, visible, not carried / in hand / bullet, not resting on the chassis top (those ride, as before). Blocks (walls, fixed, moving platforms), characters, vehicles, other robots are NOT pushed.
Modes: 3D, 2d-side (z ignored), 2d-top (height of items ignored; solids filtered by height overlap with the chassis so the floor slab does not block).
Slow-down while pushing: NOT modelled (documented in handbook: full speed or stall). View exposes `pushing` / `pushForce` on the robot view only while pushing (hash of old runs unchanged).

Gating decision: **pushObjects default = yes** (ON). Evidence: `tests/editor/solid-off-unchanged.test.ts` (every sample, lesson, handbook board, 15 s trajectory hash vs recorded baseline) 130/130 identical, `solid-on-summary` identical; baseline json/snap NOT edited, no additions needed (I added no board). Spec level (`world.spawn` robot without `pushObjects`) stays OFF, so raw-world callers are unchanged. Boards saved before this change that drive a robot through a floor item would now shove it (no shipped board does).

## 4a. Vision fan for robots
`src/render/vision-fan.ts`: `fanSpecs` accepts `kind === 'robot'` viewers; facing = `groundHeading(view)` (world/heading.ts, the nose). Same colours / shape / outline code; eye height = chassis centre. 3D only, as for characters. Handbook tip updated.

## Docs / names
Handbook: robot-body (ports pushing, pushForce; params pushObjects, showPush), motor (maxForce, 1 tip merged), vision-sensor tip (robot fan). `node-names.ts` VI+EN for the two new ports. No new node kinds (68).

## Tests
- `tests/world/robot-push.test.ts` (10): 10 kg crate 49.05 N: 40 N stalls (nose at crate, force 40, wheel turns keep counting), 60 N pushes (force 49.05); half power halves the force; two crates 98.1 N (90 stalls / 100 pushes both, 0.6 gap kept); wall stall (crate flush at 5.5, robot behind); crate on top rides identically with push on/off; push off = old pass-through; mu 0.1; top view stall+push; 3D heading 90 stall+push; card ports unchanged unless `showPush`.
- `tests/render/vision-fan.test.ts` +3: fan spec for robot at heading 0 / 45 / 90 (facing, range, angle, outline shape), none in 2d-top.
- Baselines: `solid-off-unchanged` + `solid-on-*` identical, no additions. FULL VITEST: see below.

## Browser (Playwright :5272, 3D, read PNGs)
`push-3-later`: red 30 kg lane stalled against its crate, label "Lực đẩy 30 kg (N): 60"; the 10 kg lane label showed 49.1 while pushing and its crate/robot left the 24 m floor by the end (`push-4-end`, 0 while falling). `vision-2-a`, `vision-4-c`: yellow fan on the floor from the blue chassis, rotating as it drives a circle. Only console message: one 404 (as in earlier runs, unrelated).

## NOT verified
- 2D top / side shoving in a browser (headless tests only).
- Red (alert) fan colour on a robot viewer in a browser (code path is shared with characters).
- Pushed item tunnelling for items thinner than one tick of chassis travel (~0.03 m at 2 m/s); no sub-stepping.
- Items pushed onto other robots / characters / vehicles (they are not obstacles for pushed items).
- Sibling sample / puzzle boards created after this branch point were not run here beyond the full suite.
- Property rows and wording read by me only; not shown to the user.
