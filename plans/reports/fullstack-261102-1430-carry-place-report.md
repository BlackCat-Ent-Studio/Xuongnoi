# Carry / place fix (levels 5, 7, 8) - report
Branch fix/carry-place (worktree GameBuilder-carry), 1 commit. tsc clean, vitest 122 files / 1989 tests pass, npm run build OK, dev port 5210 stopped.

## Engine (solid-body 3D worlds only; editor, 2D, samples unchanged)
- Drop: crate is released exactly at the hold point (no computed free spot) and falls with gravity. If it would sit inside a wall/crate/character, drop() returns null and the robot keeps hold.
- Hold point: front-carry reach is now at least box half + crate half + margin, so the crate stands just clear of the robot box (a released crate never overlaps its carrier). Wheel robot now also carries in front (was overhead; dropping overhead would land on its own head).
- Stacking: hands rise over crates lying ahead (carryFloor, 1 unit look-ahead), so crate 2/3 are set down on crate 1/2 at the same spot. This is what lets a fixed patrol end drop three crates.
- Pick-up: crate rises to the hands at 9 u/s (was a teleport); robot turns to face a crate that is not in front; covered (stacked-under) crates cannot be picked. Humanoid turns to the sim facing when standing still while carrying (so the side-pick turn is visible).
- Not done: set-down arm pose (visual only, skipped).

## Levels (ideas, pieces, par, wires unchanged)
- L5: store pad/zone centre x 8.5, crate-1 x -8.8. Reference wins 26.6 s, crates 1-3 stacked at x 8.81 on the pad.
- L7: patrol A and robot start x -9.7, drop-zone is a thin slice (x -9.6, width 0.2) so the drop fires exactly when the robot turns at the store; store pad/zones centre -10.5; dropDistance removed. Wins 27.45 s.
- L8: bay zone centre x -6.6. Wins 12.3 s.

## Tests
- physics-invariants: new per-level check - released crate horizontal shift < 0.02, no crate moves > 0.3 per tick, incl. grab step.
- solid-bodies.test: drop in place, lift-over-and-stack, drop refused when blocked; overhead test now uses cat-chibi.

## Shots
plans/reports/shots-carry-place/ : l5-a/l5-b (L5), l7, l8 contact sheets (844x390) + frames/. Read: crates ride in front, set on the pad, stack visibly, no flying. Script plans/browser-scripts/carry-place-frames.mjs + carry-place-sheet.py. Swiftshader frames are ~0.55 s apart, too coarse to see the 0.1 s lift; lift smoothness is proven by the per-tick invariant, not by frames.

Status: DONE_WITH_CONCERNS
Summary: crates are released in place and stack; picked up by a smooth rise; levels re-tuned, all tests/build green.
Concerns: (1) L7 crates sit beside the line, so the robot turns sideways to pick them while walking (cannot be in front without blocking the patrol). (2) Third crate is lifted above head height to clear the stack. (3) No set-down pose. (4) Branch not merged. (5) Real-GPU feel untested.
