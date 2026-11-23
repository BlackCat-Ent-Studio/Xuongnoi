# Physics 3D fix (option A) — report

Branch `feat/physics3d` (worktree `D:\workspace\GameBuilder-physics`), 2 commits on top of main 77ba058:
- `65bfea1` test: hidden invariant suite (red on the old engine: 37 of 85 cases failed)
- `cb038d7` feat: engine fix + levels 5-8 re-laid + dev-only watcher

## Result
tsc clean · full vitest 119 files / 1941 tests pass · `npm run build` OK · build output has no watcher/checker code (grep below) · shots of levels 5-8 read, no visual pass-through.

## 1. Hidden physics check
- `app/src/world/physics-check.ts`: pure rules over body snapshots. Codes: character-in-block / -item / -character, item-in-item, item-in-block, carried-in-block, carried-in-body, below-floor, sensor-without-contact, collider-mismatch.
- `World.debugBodies?()` (optional method, only exists when `import.meta.env.DEV`) gives the real collision boxes.
- `app/tests/puzzle/physics-invariants.test.ts` (85 cases): every level (2D 1-4 and 3D 5-8) played tick by tick with the reference solution, an empty answer, the solution minus each wire, and editable numbers at 0/1/8. Also: sensors' "touching" must agree with the boxes; character box = 1.6x drawn size and same feet; no crate still carried inside a store when a win comes; unit tests of the checker itself. 2D levels run with the body rules off (only block/fall rules apply).
- Dev watcher `app/src/dev/physics-watch.ts`: runs the same rules after every step in a solid-body world, `console.warn("[physics-watch] ...")` once per distinct violation (max 30). Called from `world.ts` behind `import.meta.env.DEV && MODE !== 'test'`.
- Proof it is stripped from production: after `npm run build`, grep of `dist` (8 files) for `[physics-watch]`, `createPhysicsWatch`, `sensor-without-contact`, `character-in-block`, `debugBodies`: all NOT FOUND. Same strings are served by the dev server (`/src/dev/physics-watch.ts` has the marker), so the grep is not vacuous.
- Playwright runs on the dev server with the solution wired: zero `[physics-watch]` warnings.

## 2. Engine (all behind `WorldOptions.solidBodies`; editor, samples, lessons, 2D levels unchanged)
Files: `world/world-options.ts` (type), `world/solid-bodies.ts` (rules, carry spot, drop spot), `physics.ts`, `world.ts`, `puzzle/world-options.ts` (the puzzle's options, 3D only).
- Characters block each other and free crates; crates block crates (stack, never merge). Bodies that already overlap at spawn may walk apart instead of being snapped.
- Character collision box = 1.3 x 1.6 x 1.3, feet on the same floor (box grows upward from the 1x1x1 base). Chosen over lowering the 1.6x drawing, so the approved look is untouched. Width is slightly under the drawn 1.6 (arms/ears), so a tiny sliver of arm can still overlap a neighbour.
- Carried item is part of its carrier: it is stopped by walls, doors and other bodies, and stops the carrier. Physics hold point = drawn point: legs robot holds the crate low in front (constants moved to `puzzle/world-options.ts`, `cozy-stage.ts` now reads them); other characters hold it just above their 1.6-high box, which equals where the stage already drew it.
- Drop: lands beside the carrier first (so the way ahead stays open), then front/back/diagonals/further out, never inside a wall, crate or character. `dropDistance` on the carry card (existing param) sets how far to the side.
- Zones skip carried items (`EntityView.carried`, set only in solid-body worlds).
- Anything below y=-6 goes back to its spawn point (carried crates follow their carrier).
- `game-view.ts`: one-line hunk (`createWorld(m, options.stage?.worldOptions?.(m))`). `stage-theme.ts`: optional `worldOptions` hook. Did NOT touch `level-screen.ts` / `cameras.ts`.

## 3. Levels (ideas, pieces, par, hints, WIRE_LINES unchanged; tests pass)
- L5: pile = one crate ahead of the robot's pick-up end, one each side, none touching; store pad 0.02 thick.
- L6: goal pad lowered to the floor (y 0.1). Cats now collide at their drawn size, so "caught" fires when they visibly meet.
- L7: floor 28x8; crates (0.7) wait in a lane beside the walking line (z 1.02), a 1x1 colour tile on the line in front of each crate (the colour sensor still reads under the feet, so the tile has to be on the line; the crates are not). Store 6x5, drop zone 3 wide, `dropDistance 2` so a dropped crate lands out of reach of the lane; without it "grab on blue alone" won by luck at 55 s (found while testing). Reference still wins at 27.3 s.
- L8: crates ahead/left/right of the wheel robot's pick-up end; goal pad on the floor; door is now part of a full wall line (two grey 1.8-high wall pieces + the 2-high door).

## Not changed / limits
- 2D levels keep the old rules (user scope: 3D). A 2D crate can still sit inside another; the invariant suite only checks block/fall rules there.
- Characters do not push each other: two walkers block, then "touch" fires. Nobody tumbles.
- Level 7's red tile still draws as the round red button prop (stage role by colour); blue tile is a plain flat box. Look-only, not touched.
- No shot-level check on real phone GPU/touch; swiftshader timings lag (real seconds are in the file names).
- Line endings kept (`git diff main --stat` 921 vs `-w` 920 lines; the 2 extra files in that diff, HANDOFF.md and shell.css, come from main moving ahead).

## Verification
- Shots: `plans/reports/shots-physics3d/` (desk 1280x720 and phone 844x390, follow and overview, levels 5-8, solution wired in via a Playwright route). Script `plans/browser-scripts/physics3d-shots.mjs`. Read: robot beside crates and carrying in front (L7), wall line + open door (L8), cats apart (L6), pile pick-up (L5): no pass-through.
- Dev server :5208 stopped.

Status: DONE
Summary: Solid bodies for puzzle 3D (character/crate/character collisions, carried crate blocked, drops beside, zones ignore carried, fall respawn) + hidden invariant suite + dev-only watcher, levels 5-8 re-laid; all 1941 tests, tsc, build pass.
Concerns: see "Not changed / limits"; branch not merged into main (user decides). L7 tiles are on the line by necessity of the feet colour sensor.
