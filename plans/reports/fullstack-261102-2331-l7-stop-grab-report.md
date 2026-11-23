# L7 stop-at-pad + grab-only-when-still (branch fix/l7-stop-grab, worktree D:\workspace\GameBuilder-l7stop)

## Changes (all in app/)
- NEW src/puzzle/pad-patrol.ts: puzzle-only brain `pad-patrol`. Walks outward from the store, stops `wait` (0.5s) at every pad whose crate is still loose (red too), one-tick tiny push turns it to face the crate. Hands full -> straight to next empty slot (reuses `parkingSpot`, `nextEmptySlot`), `atStore` pulse -> existing drop wire. Then walks out to the next crate farther out than the last pad stopped at (`passed`), so empty pads and already-read red pads are skipped. Nothing left -> stands still.
- NEW src/puzzle/pad-carry.ts: puzzle-only `pad-carry` = copy of `carry` node (same ports/labels), but with EMPTY hands the grab input counts only if robot moved < 0.01 u/tick since previous tick. Full hands: signal untouched (toggle drop still works, so removing "not holding" wire still fails the level).
- src/puzzle/puzzle-nodes.ts: registers both.
- src/puzzle/levels/level-07.ts: brain kind slot-patrol -> pad-patrol; hands kind carry -> pad-carry. Solution wiring, tray, par, editable, timeLimit (60), texts unchanged (texts do not describe old movement).
- tests/puzzle/store-slots.test.ts: brain lookup also accepts `pad-patrol` (CRLF kept).
- NEW tests/puzzle/level-7-stop-grab.test.ts (9 tests, red first: 6 failed before fix).
- Untouched: L5, L8, fetch-store, slot-patrol, editor, nodes/carry.ts.

## Results
- tsc clean. Full vitest (--testTimeout 120000): 2304 passed + the 1 store-slots test I then fixed (re-run green); physics-invariants L7 green (17).
- Reference solution wins at 19.9 s (limit 60, unchanged). Grabs at ~1.9 s, 7.9 s, 15.9 s.
- Tests cover: win, each wire removed fails, want=1 loses, no grab while moving (step before/after < eps), grab at pad within GRAB_REACH of crate start, blue-only grab never lifts mid-walk, never farther from store than grab point before drop, stops at all 6 pads incl. red (also with empty answer), faces crate (facing.z>0.5), stop >= 0.4 s.
- Existing level-7.test.ts (incl. 600 s decoy sweep) passes.

## Visual
Playwright run (port 5221, server stopped) with solution wired: 40 frames in D:\workspace\GameBuilder\plans\reports\shots-l7-stop-grab\ (script plans\browser-scripts\l7-stop-grab-frames.mjs). Read 3 frames: robot standing on blue pad, crate carried in front, walking back toward store; no page errors / physics-watch warnings.

## Not verified
- Software-rendered browser is slow, so I did not capture a frame of the exact lift moment or the turn toward the crate; facing proven only headless.
- Card look of `pad-carry` on the board not inspected closely (labels copied from `carry`; hidden/shown ports same as before).
- Win-time/behaviour of L8 unchanged by construction (slot-patrol untouched), covered by full suite.

Status: DONE
Summary: L7 now uses puzzle-only pad-patrol brain + pad-carry hands; stops at every pad, grabs only while still, returns straight to store; solution wins in 19.9 s, all gates green, committed on fix/l7-stop-grab.
Concerns/Blockers: none blocking; visual of lift moment not captured.
