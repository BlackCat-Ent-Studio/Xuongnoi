# L5 scattered crates - report
Branch feat/l5-scatter (worktree GameBuilder-l5), commit 8fbbfbd. tsc clean, vitest 133 files / 2260 tests pass, npm run build OK, dev port 5217 stopped.

## What changed
- New puzzle-only brain `fetch-store` (src/puzzle/fetch-store.ts, registered in puzzle-nodes.ts, never in editor): each step reads the world. Hands empty -> walk to nearest loose crate outside the slots, stop 0.85 in front of it (approach side = side it comes from, so it already faces it), pulse atEnd -> hands grab. Hands full -> walk to next empty slot, park so crate is over slot middle (<0.03), pulse atEnd -> hands drop. Repeat; idle when no crates left or store full. Failed grab/drop is retried (state is derived from hands, not remembered).
- Crates come from the world, not a hard-coded list, so no data duplication; goals are fixed per leg (no wobble).
- Level 5: crates at (-9,-4.5), (-7.5,0), (-9,4.5) (4.5 apart); brain kind slot-patrol -> fetch-store (same slotBrainParams, wires b1-b5 unchanged). Idea, tray, par 2, hints, guide, solution, store pad/slots untouched.
- Levels 7/8 and slot-patrol.ts untouched (no shared code path edited).
- Tests: tests/puzzle/level-5-scatter.test.ts (crates >=3 apart, reference wins, 3 crates in 3 distinct slots within 0.1 of middle). store-slots.test.ts brain lookup accepts fetch-store. Reference wins at 27.0 s (limit 90).

## Shots
plans/reports/shots-l5-scatter/ l5-a.jpg, l5-b.jpg (844x390, frames/ has all 60). Read: robot walks to top-left crate, carries to slot 1, fetches middle crate to slot 2, bottom crate to slot 3, win card. Script plans/browser-scripts/l5-scatter-frames.mjs (+ l5-scatter-sheet.py). First vite run needed --force (stale optimized deps through junction).

Status: DONE_WITH_CONCERNS
Summary: L5 crates start in 3 separate spots; robot fetches each in turn into successive slots; all tests/build green, frames read.
Concerns: (1) Fetch order is nearest-first from the robot, not fixed top/mid/bottom (reference run: top, middle, bottom by luck of geometry; not asserted). (2) Camera framing: far crates start near the screen edge; not tuned. (3) Straight-line walking, no obstacle routing; safe because crates are 4.5 apart and slots are not on any path. (4) Real-GPU feel untested; branch not merged. (5) Written new test file is LF while neighbours are CRLF.
