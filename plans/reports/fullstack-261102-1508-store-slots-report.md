# Store slots (levels 5, 7, 8) - report
Branch feat/store-slots (worktree GameBuilder-slots), 1 commit. tsc clean, vitest 123 files / 2015 tests pass, npm run build OK, dev port 5212 stopped.

## What it does
- Store pad shows N marked slots (L5 = 3, L7 blue store = 3, L8 bay = 2). Four decorative corners + centre ring are gone on these pads (plain sage mat + cream border; levels without slots keep the old pad).
- Robot walks to the next EMPTY slot (filled far end first), faces it (walks in along the row), parks so the crate in its hands is over the slot middle (<0.02 off in tests), drop releases at hands (existing rule) and the crate falls straight into the slot. No stacking in stores.
- Slot fills with a soft amber tint when a crate rests in it.
- Store full -> robot stands still (L8: 3rd crate stays at pick-up, robot idles holding it at the pick-up end; L5/L7 never hit this).
- Puzzle idea, tray, par, hints, solutions unchanged. Editor untouched.

## New files (all puzzle-side)
- src/puzzle/store-slots.ts: slot definition (`PuzzleLevel.storeSlots`), slot centres, floor-mark blocks, brain params, occupancy helpers.
- src/puzzle/slot-patrol.ts: brain node `slot-patrol` ("Đi tuần về kho"): like patrol (moveX/moveY/atEnd) + `atStore` pulse. Params: pickup, slotFirst, slotStep, slotCount, wait.
- src/puzzle/puzzle-nodes.ts: `registerPuzzleNodes()`, called from levels/index.ts and run-level.ts. NOT in nodes/index.ts, so the editor palette, handbook and registry tests never see it.
- tests/puzzle/store-slots.test.ts (26 tests).

## Edited files
- levels 5/7/8, types.ts (+optional `storeSlots`), world-options.ts (+`handReach`), cozy-stage.ts (+'slot' role by colour #f59e0b, slot figure, plain mat when slots are on the pad), stage-props.ts (+`makeSlotMat`), run-level.ts (+register call), levels/index.ts.
- L5: pad/zone now 5.6x2 at x 8.5 (was 3.4 square; tray + solution zone resized the same). L7: store 5.6x2 at x -10.7, drop-zone node removed, drop now wired brain.atStore -> hands.drop, robot start -7.6. L8: new `store-pad`, bay zone 3.6x2 at x -6.4, wheel robot start -9.5, brain wait 2 s (was 0.5): faster delivery had shifted the door/guard timing and broke two existing L8 tests; wait 2 restores them (swept 0.5..3).
- Slot spacing 1.8 (L7 1.9): wider than the hands' look-ahead, so no crate is lifted over its neighbour.

## Shared engine files: NONE edited
No hunk in world/physics.ts, world.ts, nodes/carry*.ts, solid-bodies.ts, engine/types.ts. Only `nodes/steering` and `nodes/util` helpers are imported. Merge with feat/editor-solid should be conflict-free (touching: puzzle/* and tests/puzzle/* only).

## Tests added
Level data (slot count, marks on pad, inside counting zone, brain params match marks, stage role 'slot' only for slot blocks); next-empty logic (ignores carried/hidden/elsewhere); parking spot; per level 5/7/8 after 45 s: each delivered crate fully inside exactly one slot, no slot shared, filled in order, resting on floor (no stack), within 0.1 of middle, robot still once full. Existing physics-invariants, level tests, reference solutions all pass.

## Shots
plans/reports/shots-store-slots/: l5-a/l5-c, l7-a, l8-a contact sheets (+ overviews, frames/). Scripts plans/browser-scripts/store-slots-frames.mjs, store-slots-sheet.py, store-slots-latest.py. Read: slots drawn as honey outlines, crates set in the middle of successive slots, filled tint visible, no stacking. frames/ also holds leftover frames of two earlier runs (could not delete, rm was blocked); use the sheets.

Status: DONE_WITH_CONCERNS
Summary: slots implemented as level-side brain + marks for L5/L7/L8 with no shared-engine edits; tsc, 2015 tests, build green; frames read.
Concerns: (1) L8 brain wait changed 0.5->2 to keep guard/door timing tests valid. (2) Pads are wider than before (5.6 long); camera framing at the far end not tuned. (3) The "filled" tint only tested by eye, no unit test. (4) Branch not merged; real-GPU feel untested. (5) L8 robot idles holding crate 3 once the bay is full.
