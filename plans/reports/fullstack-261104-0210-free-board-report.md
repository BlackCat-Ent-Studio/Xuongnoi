# Free board (Xưởng Bot) - report 2026-11-04

Branch `feat/free-board` in `D:\workspace\GameBuilder-freeboard`. Not merged.

## What changed (behaviour only, no CSS touched)
- Board is always the old "tidy" free world: cards at real size x view zoom. Removed: 1000x560 stretch, card-scale ladder (0.46), separateBoxes squeeze, routed-wire screen bounds.
- Locked card positions = level pos x 1.5 (rounded). Placed cards keep their own world position.
- One-time de-overlap of the level's own cards, only if two truly overlap (none do on L1-L7 at open: checked).
- Drag empty board = pan (no bounds), wheel / pinch = zoom 0.25-1.6 around pointer (existing `attachPanZoom`, now always on while not running). Card header drag has no edge and still slides a dropped card off another card.
- Open + resize (unless the player moved the view): `fitFree` = fit all cards, zoom clamped [0.70, 1], centred per axis; on an axis that does not fit at 0.70 the view shows left/top of the cards. Keeps clear of the corner stage window (left of / above it).
- Double-tap / double-click on empty board (not on tray, card, wire, pin, button) = animated fit again (same rule). No button.
- Tray piece: new card at the free spot nearest the centre of the current view (prefers fully on screen, 32px room), measured again after render so real card height (number rows) is respected.
- Guide / "?" : `aim()` calls new `board.ensureVisible(el)`, which pans (no zoom) so a pin/row inside a card is on screen before the spotlight, hand and ghost wire are placed.
- Running (Layout B): no pan/zoom, mini board shows the view as it was; stopping returns the same view. "Làm lại" resets world positions and refits.
- A popup (number editor) closes when the view moves.
- Tidy / gom code kept, compiles, buttons still not attached; tidy reuses the same view/world (its fit uses `fitFree`).

## Files
- `app/src/puzzle/ui/board-arrange.ts` (+ `fitFree`, `freeSpotNear`, `panToShow`, `worldToScreen`, `screenToWorld`, `FIT_MIN_K/FIT_MAX_K`)
- `app/src/puzzle/ui/board-view.ts` (layout rewritten, `ensureVisible`, empty double-tap, tray spot)
- `app/src/puzzle/ui/guide.ts` (2 lines in `aim`)
- `app/tests/puzzle/free-board-view.test.ts` (new, 15 tests: fit rule incl. 0.70 floor + top-left + corner window, zoomAbout, world<->screen, tray spot, panToShow)
- `board-pan-zoom.ts`: unchanged (already had zoomAbout, tap slop 6, clamps).
- Browser scripts (plans, uncommitted on branch): `plans/browser-scripts/freeboard-lib.mjs`, `puzzle-levels-freeboard.mjs`, `puzzle-freeboard-pixel-compare.mjs`.

## Tests
- `npx tsc --noEmit -p .`: clean.
- `npx vitest run tests/puzzle`: 30 files / 608 tests pass .
- Full `npx vitest run` (final code): 158 files / 2654 tests pass.
- CRLF: `git diff --stat` == `git diff --stat -w` (224+/158-, 3 files), no CRLF flips.

## Playwright (dev :5233, SwiftShader)
Real level list has 7 levels (no level 8 in `PUZZLE_LEVELS`). Per level, desktop 1280x720 and phone 844x390: opened with cards, open zoom in [0.70,1], no overlap, pan 1:1, pan unbounded, double-tap fit, wheel zoom hits 1.6 and 0.25, fit after zoom, tray drops (pieces placed), all solution wires joined by real clicks (script pans to pins that are off screen), placed cards do not overlap, run -> stage, stop -> board with the same view. L1 guide on both sizes: guide leads; after panning the whole board away, "?" brings the spotlight back on screen.
Result: desk 1-6 98/98, desk 7 16/16, phone 1-7 114/114. No console errors.
Shots in `D:\workspace\GameBuilder\plans\reports\shots-free-board\`: `{desk,phone}-L5-{1-opened,2-solved-fit,3-solved-zoomin,4-running}.png`, same for L7, `{desk,phone}-L1-guide-{1-first-step,2-wire-step,3-panned-hint}.png`. I read the L5/L7/L1 PNGs.

## Pixel compare (main :5234 vs free :5233, same viewport, overlays hidden)
Only possible where free board opens at zoom 1: desktop L1.
- Locked "flag" card: 7 of 10519 interior pixels differ, max channel diff 1 (anti-alias). Whole card (with shadow edge) 414/13351 differ (shadow over the dot grid at a different position).
- Locked "bot" card: 26 of 14787 interior pixels differ, max diff 38 (not investigated; likely the avatar icon / pulse).
- Tray chips (all 3): 0 differing pixels.
- At zoom < 1 (L2/L5 desktop 0.71/0.73, phone 0.89/0.70) sizes differ by design (zoom); tray chips are unchanged in size, with 0-139 differing pixels per chip at chip corners (translucent rounded corner over a different card/dot background behind). No CSS file was edited, so card/pin/wire/tray look is the same code.

## Not verified / notes
- Pinch on a real touch device: not tested (mouse wheel and the existing synthetic-pointer pinch code only). Phone run used mouse input in a 844x390 viewport, not touch emulation.
- At open the "Đề bài" task popup (open on first visit) covers the top-left card on some levels (L5/L7); same overlay as before, not changed. Top-left alignment puts the first cards right under it on phone L7.
- When the visible area is already full (L7 solved), a new tray card goes to the nearest free spot outside the view (may be under the top bar / tray until the player pans). Double-tap fit shows only the start of the cards at the 0.70 floor, as chosen.
- Wire drag from pins: the real game joins pins by tap-tap (no wire drag exists); that still works.
- Pixel-compare "bot" card residue (26 px) not explained.
- Levels with scenery/placed state restore: new unknown cards stack below existing bounds (fallback), not hit in tests.

Status: DONE_WITH_CONCERNS
Summary: Free board built on feat/free-board (always-on pan/zoom, fit rule 0.70 + top-left, double-tap fit, tray spot near view centre, guide pans to off-screen targets); tsc, puzzle tests and 7-level desktop+phone browser checks pass.
Concerns/Blockers: real-touch pinch not verified; task popup can cover top-left card at open; see "Not verified".
Commit: 7e12ccd feat(puzzle): free board with pan, zoom, fit and tray drop near view centre
