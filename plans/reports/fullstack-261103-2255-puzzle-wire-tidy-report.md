# Puzzle board "tidy wires" report

Worktree `D:\workspace\GameBuilder-tidy` (branch `feat/puzzle-wire-tidy`), commit `feat(puzzle): tidy wires on the puzzle board ...`, then `git merge main` (cb470f3) clean, no conflicts. Editor untouched (all new CSS scoped `.pz-board`; no engine/nodes/io/levels/guide-script edits).

## What was built (Xưởng Bot board only)
| # | Item | Where |
|---|---|---|
| 1 | Pins on the card edge (half outside, ring in card colour), text padding 14px | puzzle.css |
| 2 | Wires: curve kept when clear; backward or card-crossing wires routed on a grid (A*) through gaps, rounded corners; curves only while dragging/animating; grid scales with card size; stays on visible board in the default layout | wire-geometry.ts |
| 3 | Focus: tap card = its wires bright, others 20%, other cards 62%; tap wire lights it; tap empty/Esc clears. Classes `pz-lit` / `pz-faded` (not `is-dim`) | board-view.ts, puzzle.css |
| 4 | Knots: double-tap wire adds; drag knot moves; double-tap knot removes; Ctrl+R on hovered/just-tapped wire adds at middle; dragging a wire pulls a knot out; dropping a knot on another knot of the same source pin merges (branching, shared knot drawn bigger, shared trunk drawn once); other source = toast, refused. "Gom dây" button: per source pin with 3+ wires one shared knot, spot chosen by trying free spots with the real router (fewest crossings) | wire-knots.ts, board-view.ts |
| 5 | "Sắp xếp gọn": role columns, barycentre + permutation search, no overlap, 620 ms animation incl. zoom-to-fit; board becomes a free view (drag empty board to pan, wheel / two fingers zoom 0.25-1.6, "Vừa khung" fits all). Cards draggable afterwards (drop resolves overlap), new tray pieces land in free view space | board-arrange.ts, board-pan-zoom.ts |
| tools | Right column under the top bar (icon-only on narrow screens, text on wide): Sắp xếp gọn / Gom dây / Vừa khung. Cards keep clear of it when the default layout still fits | board-view.ts, puzzle.css |
No ⑥ label stubs.

## Where knots / layout are stored
**In memory for the current visit of the level only.** The puzzle saves no answer (progress = stars only), so there was nothing to attach to. Knots and tidy layout survive Chạy/Dừng, are lost on leaving the level or reload. Knots of removed/rewired wires are pruned on every change; "Sắp xếp gọn" and "↺" clear knots. Engine `Wire`/`Graph` untouched.

## Behaviour change to know
Single tap on a wire still removes a player wire, but now after 320 ms so a second tap can add a knot instead (locked-wire toast is delayed the same way).

## Tests
- `tests/puzzle/wire-tidy.test.ts` (25 tests): for ALL 7 levels (new reference solutions after merge) after Sắp xếp gọn: no card overlap, 0 wires through a card, routes start/end on pins; role order; fewer crossings than stacked layout; routing (curve kept, detour, backward, knot pass-through, leg index, shared trunk drawn once, fast mode); knots add/order/move/remove/merge/refuse other pin/prune/Gom/free spot/best spot; fit.
- `npx tsc --noEmit -p .` clean. Full `npx vitest run --testTimeout 120000` run alone after merge: **156 files, 2635 tests passed**, no timeouts.
- Model check (card model, scales 1 to 0.4): L5 5-7 crossings, L7 10-15, 0 wire x card, routing 10-40 ms.

## Playwright (levels 5 and 7, solution wired through the real UI, after merge with new solutions)
Script `plans/browser-scripts/puzzle-wire-tidy-shots.mjs`, shots + `counts.json` in `plans/reports/shots-puzzle-wire-tidy/` (all PNGs read). Crossings measured on drawn DOM wires (wire x wire, wires sharing a pin skipped; wire x card):
| Board | Before (game layout) | After Sắp xếp gọn | after Gom dây |
|---|---|---|---|
| L5 desktop 1280x720 | 86 (52+34) | **8 (8+0)** | 8 |
| L5 phone 844x390 | 62 (29+33) | **16 (16+0)** | 16 |
| L7 desktop | 118 (95+23) | **27 (27+0)** | 27 |
| L7 phone | 134 (119+15) | **46 (46+0)** | 43 |
Checked in browser: knot add by double-click, Ctrl+R, double-click remove (all 4 boards except L7-phone remove: stayed 2, script click probably missed the knot, unverified), branch merge shared knot (L5 both, L7 desktop; L7 phone had no clickable point), focus (lit/faded counts), pin pick highlights 13/10 inputs, wheel zoom + fit, run frames (wire energy lit/dim on new routes, board and stage), "?" hint ghost wire + ring on new pin positions, guide intro. Earlier Playwright pass before merge: L5 67->7, L7 69->17.

## Honest notes
- Numbers are my DOM counter, not a game metric; L7 is higher than the preview (5) because no ⑥ and L7 now has 11 cards / 23 wires.
- Default stretched layout on crowded boards (phone L7) still has cramped/overlapping cards and wires that cannot find a gap fall back to curves; Sắp xếp gọn fixes it.
- Phone tidy view of L7 is ~0.38 zoom: structure visible, text needs zoom (pinch untested on a real phone).
- Gom dây does not always lower crossings (L7 desktop equal); it makes one trunk + branches.
- board-view.ts grew to ~1290 lines; knot/tidy code could move to its own module later.
- Dev server on 5231 stopped.

## Unresolved questions
- Keep single-tap-removes-wire (now delayed) or switch to select-then-delete button?
- Should knots/tidy layout be saved with progress later?

Status: DONE_WITH_CONCERNS
Summary: Tidy-wire design ported to the puzzle board (pins, routing, focus, knots with branching + Gom dây, Sắp xếp gọn with pan/zoom); merged main, tsc clean, 2635 tests pass, shots re-taken on new solutions.
Concerns/Blockers: knots/layout memory-only; wire removal tap delayed 320 ms; phone L7 dense; L7-phone knot-remove/branch checks not verified.
