# Entity scans: making the simulation step scale with the number of machines

Branch `perf/entity-scans` (worktree `D:\workspace\GameBuilder-perf`), head `ab21c74` = 21 commits on `a82062c` + merge of main `ad59d12`. Not pushed, not merged into main.

## Result

All numbers: node, headless, "Vật lý thật" on, 60 simulated seconds, ms per tick (cards + world step). Final = merged head, two runs on a quiet machine (CPU 1-19 % during, 4 node.exe); the two runs agree within 2 %.

| Board | Spike (report) | Before, this session | Final mean | Final p95 | Final max | Hash vs before |
|---|---|---|---|---|---|---|
| AGV x1 (81 cards, 37 entities) | 0.94 | 0.955 / p95 1.33 / max 5.3 | **0.56** | 0.79 | 2.9-4.4 | same `199e25a0` |
| AGV x4 (324 / 148) | 6.30 | 6.47 / 9.86 / 15.5 | **1.75** | 2.81-2.89 | 6.0-7.5 | same `b02208d` |
| AGV x8 (648 / 296) | 21.19, p95 33.5, max 54-59 | 22.1 / 34.2 / 53.5 | **3.83** | 6.84-6.86 | 12.6-14.6 | same `c167a9de` |
| AGV x16 (1296 / 592) | 103.5 | 84.9 / 126.8 / 180.8 | **9.7** | 19.6-20.1 | 36.1-36.5 | same `2ff393aa` |
| Tray chassis x8 (124 / 105) | 4.12 | 5.83 / 7.58 / 22.8 | **1.45** | 1.91 | 11.0-12.5 | same `9efb57dd` |
| Tray chassis x16 (244 / 209) | 34.70 | 22.4 / 30.2 / 60.5 | **3.33** | 4.5 | 16.5-17.6 | same `eb3d88e` |
| Compile x1 / x4 / x8 / x16 | 0.47 / 6.55 / 27.8 / 110.7 | 0.47 / 7.23 / 30.7 / 109.0 | **0.12 / 0.38 / 0.77 / 1.7-1.95** | | | same order and cut wires |

- Target "8 AGV copies well inside 16.7 ms": met. Mean 3.8, p95 6.9, max 12.6-14.6 ms (worst 5-second stretch: 5.3 ms mean).
- "16 copies near-linear from 8": 2.5x for the AGV board (was 3.8-4.9x), 2.3x for the tray fleet (was 3.8-8.5x). Not 2.0x: see "Left slow".
- The hash is over every entity view, sampled every 5 simulated seconds: every big board plays exactly as before.

## Why it is behaviour-identical (evidence)

- `tests/editor/solid-off-unchanged` and `tests/editor/real-physics-on-hash`: green on the merged tree, no baseline touched (the 3 new entries from main included).
- Big-board hashes above, identical after every single change.
- New reference tests (each writes the old rule the long way and compares exactly; each was checked to fail when the shortcut is made deliberately wrong):
  - `tests/engine/compile-order.test.ts` — order and back-edges on every shipped board, the 16x board, 300 random graphs.
  - `tests/world/contact-pairs.test.ts` — grid vs plain double loop, 400 random scenes (turned crates, spinning blocks, offset colliders, floors, NaN/Infinity).
  - `tests/world/weighing-shortcuts.test.ts` — `massOn` vs plain rule with `toBe`, 400 + 200 random yards, shared scene included.
  - `tests/world/moving-block-reference.test.ts` — moving solid block, 3 views, fresh scene and shared scene.
  - `tests/arm/sweep-shortcut.test.ts` — `sweepCubes` vs `sweepWhole`, `planPush` vs `planWhole`, 3000 + 4000 random cases.
  - `tests/world/robot-push-open-floor.test.ts`, `tests/world/line-track.test.ts` (added cases).
- One run with every cached view deep-frozen: 2487 tests passed, so no card writes into a view.

## Changes (file:line at head; numbers = AGV x8 and tray x16, mean / p95 / max)

Rows 1-2 are clean per-commit runs; rows 3-10 were measured as each change landed (same hashes, load not recorded); final row is the clean run above.

| # | Change | Where | AGV x8 | Tray x16 |
|---|---|---|---|---|
| 0 | before | | 22.1 / 34.2 / 53.5 | 22.4 / 30.2 / 60.5 |
| 1 | `listEntities` keeps its views until a world call that may change one | `world/world.ts:80` (`KEEPS_VIEWS`), `:1010` (`listEntities`), `:1040` (wrapper) | 20.8 / 32.3 / 50.3 | 22.2 / 29.5 / 63.8 |
| 2 | moving-block lists made once (`MoveScene`); per-tick machine calls renew only their own view | `world/platforms.ts:80` (`MoveScene`), `world/world.ts` `moveBlock`, `resizeBlock`, `setBlockAngle`, `setBlockTilt`, `setRobotTuning`, `applySqueeze`, `setItemRotation`, `teleport` | 16.4 / 25.5 / 41.9 | 18.7 / 25.2 / 53.8 |
| 3 | weighing: a crate far to the side of a support is not put through the outline maths | `world/material.ts:225` `tooFarToHold` | 14.4 / 22.3 / 35.1 | 14.1 / 17.7 / 49.8 |
| 4 | contacts through a grid, same touch test, same argument order | new `world/contact-pairs.ts`, `world/world.ts:207` | 9.3 / 18.5 / 39.2 | 10.3 / 13.9 / 43.8 |
| 5 | chassis shove: boxes worked out once per body (was item x chassis x chassis) | `world/robot-push.ts:46` (`restsOnTop`), `:108` (`pushBodies`) | 8.5 / 18.2 / 27.4 | 8.4 / 10.8 / 44.6 |
| 6 | a moving body asks only the solids near it | `world/physics.ts:89` `nearSolids`, `moveAxis` | 8.0 / 17.6 / 26.5 | 7.9 / 10.1 / 44.3 |
| 7 | weighing height test; line sensor measures only the track pieces a sample can be on | `world/material.ts` `holds`, `world/line-track.ts:171` (`pieceBoxesOf`), `onTrack` | 5.7 / 15.0 / 28.7 | 8.1 / 10.1 / 44.6 |
| 8 | weighing scene shared by all chassis of a tick; arm sweep that can touch nothing skips bodies and far solids; crate bounds hoisted | `world/material.ts:190` `WeighScene`, `world/physics.ts:541`, `world/arm-solid.ts:179` `quietSweep`, `world/platforms.ts:118` `crushesCrate`, `world/physics.ts:598` `overlapsSolid` | 4.3 / 8.0 / 18.7 | 5.2 / 7.3 / 34.6 |
| 9 | same shortcut for single pushes; block looks only at bodies on its way; sensor sample table | `world/linear-actuator.ts:354` (`HeadReach`), `:412` (`quietPush`), `world/platforms.ts:187` (`bodiesOnTheWay`), `world/line-track.ts:213` | 4.06 / 7.3 / 18.3 | 4.76 / 5.65 / 47.2 |
| 10 | exact head passes over crates out of reach; chassis with nothing on its way plans no push; weighing looks only round the pile | `world/linear-actuator.ts:210` (`beyondHead`), `world/robot-push.ts:149` (`somethingOnTheWay`), `world/material.ts:120` (`Fact` boxes) | 3.83 / 6.85 / 12.6-14.6 | 3.33 / 4.5 / 16.5-17.6 |
| C | compile: ready heap instead of re-sorting | `engine/compile.ts:74-128` | compile 30.7 -> 0.8 ms (x8), 109 -> 1.8 ms (x16) | |

Full rows where measured: after #1: x1 0.92, x4 6.13, tray8 5.83. After #2: 0.89, 5.12, 4.96. After #7: x1 0.59, x4 2.2, x16 17.5 / 52.3 / 94.6, tray8 2.65. After #8: x16 11.2 / 22.5 / 60.1, tray8 1.92. After #9: x1 0.57, x4 1.85, x16 11.0 / 21.3 / 64.9, tray8 1.79.

Why each keeps behaviour:
1. A view is rebuilt whenever a call outside a checked list ran (unknown or new calls drop everything by default) and on every step; a handed-out list is never written again.
2. The lists depend only on who exists / is visible / is held, which block moves do not change; crate boxes are refreshed when a crate is teleported or turned.
3, 7, 10 (weighing). Pairs are ruled out only by the test the full rule starts with, or by distance with slack; order of the entity list kept (shares depend on it).
4. Each entity gets a box that provably holds all the touch test can measure (derivation in the file header); only pairs with disjoint boxes are skipped; non-finite numbers are never skipped.
5, 8 (hoists). Same arithmetic on the same numbers, computed once.
6. Picks are kept in list order and re-made whenever the body leaves the watched region.
8-10 (push/sweep). Taken only when no head can touch any body, in which case nothing is pushed and bodies cannot matter; otherwise the whole plan runs as before.
C. Same rule (smallest ready id; else force smallest remaining id), different data structure.

16-chassis jump (profiled): it was two scans, weighing (42 %) and the shove list, which grew with the cube of the fleet (12 %). Both fixed (#3, #5, #8, #10).

## Left slow, and why

- Scaling x8 -> x16 is 2.5x, not 2.0x. What still grows with machines x entities (profile of x16, shares of tick time):
  - Card code in `src/nodes/**` (not edited, as instructed): gripper card about 20 % (`nearestGrippable` over every entity, `pushBodiesOf` and `solidBoxes().map` per card), joint card 11 %, zone sensor 6 % (every zone loops every entity). These contain scans; none was touched.
  - `beginShove` about 10 % when a chassis does have something on its way: the full plan still lists every loose item.
  - `moveBlock` about 11 %: each solid cube still checks each solid when a held crate sits in a finger cube.
- Linear, just costly: rigid-body engine 9 %, line sensors 7 %, building the views once per tick 7 %.
- Not attempted: a persistent spatial index of entities shared by cards (would need a world API addition and card edits).

## Concerns

1. One shortcut is not provable to the last bit: `tooFarToHold` (crate far from a support). The outline clipper it skips has tolerances of its own; a crate edge lying within one nanometre of a support edge line, tilted by less than about 1e-10 rad, could make the old code return a stray contact far away. No test, baseline or big-board hash hits it. If this must be excluded on principle, remove that test for turned supports (costs part of #3).
2. Per-change numbers for rows 3-10 were taken while another agent's tests ran at times; treat them as +-15 %. An attempt to re-measure every commit was disturbed (CPU up to 100 %, and two of my own measuring jobs overlapped for a while) and its numbers are not used. The tree was restored and re-verified afterwards (clean status, tsc, both hash guards).
3. `world/world.ts` wraps every world call not on a checked list so that it drops the cached views. A new call that is added later is safe by default but slow if cards call it every tick; add it to `KEEPS_VIEWS` only after checking it against `viewOf`.
4. New exports used only by tests: `sweepWhole`, `planWhole`, `somethingOnTheWay`, `weighSceneOf`, `moveSceneOf` / `moveBlockIn`. Additive; no card-visible API changed.

## Tests on the last commit (`ab21c74`, merged with main `ad59d12`)

- `npx tsc --noEmit -p .`: clean.
- Full suite, one run: 270 files passed, 1 skipped (the measuring tool, runs only when asked); 4024 tests passed, 1 skipped; 368.8 s. No timeouts, nothing rerun.
- Hash guards after the merge: 187 tests passed.
- Merge: no conflicts; main changed nothing under `src/world` or `src/engine`.

Measuring tool: `VITE_TICK_COST="agv:1,4,8,16 tray:8,16" npx vitest run tests/perf/tick-cost --testTimeout 3000000 --silent=false` (also `profile-agv:16`, see file header). It asserts nothing.

## Unresolved questions

1. Accept concern 1, or drop that shortcut for turned supports?
2. Should the card-side scans (gripper, joint, zone sensor) be done next? They are now the largest share at 16 machines.
