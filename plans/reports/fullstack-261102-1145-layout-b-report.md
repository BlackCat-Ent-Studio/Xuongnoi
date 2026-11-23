# Layout B (swap) + stage camera pan/zoom: implementation report (2026-11-02)

Worktree `D:\workspace\GameBuilder-layout` (branch `feat/layout-b`), commit `92cbabb`. Logic checker NOT implemented (dropped). Dev server :5207 stopped.

## What the player gets (all sizes, phone and desktop)
- Board (cards, wires, tray) is full screen. The stage is a live corner window (bottom-right, ~21% of the screen width, 150-340 px).
- Tap the corner window or press CHẠY: stage grows to full screen, the board shrinks into the same corner as a live mini board (wire energy and lit cards keep running). Back with: tap the mini board, DỪNG, or the shrink button in the camera column. Lose/timeout returns to the board after 1.7 s (toast stays readable on top).
- Both layers keep their full layout size and are only scaled by `transform` (0.42 s ease); a `::after` ring fades with `opacity`. Computed `transition-property` of both layers = `transform`. No CSS filters added. Reduced-motion: no transition.
- Top bar (shared by both views): back, level badge, "Đề bài" button (task text drops under it; closes on run, on board touch, on swap, or after 12 s), stars, settings gear, `?`, `↺`, CHẠY/DỪNG. Run/stop therefore never moves with the board.
- Stage camera (only when the stage is the big view): drag = pan, wheel / ctrl+wheel / two-finger pinch = zoom (zoom about the pointer), double tap or the recenter button = reset, `+` / `−` buttons, small zoom chip (shown only when the camera is not at default). Pan/zoom clamp to the level box (`stageBounds`): at the whole-scene fit you cannot pan at all; zoom max 4x over the default.
- Camera moves are view-only (`CameraRig` user layer; no world/runtime calls).

## Old "Toàn cảnh / Theo nhân vật" toggle: replaced (my call)
- Removed button + remembered choice. Default framing is now automatic: editing = whole-scene fit; running = follow the main character. Any pan/zoom is the player's own; reset (button / double tap / swapping to the corner / start or end of a run) returns to the default.
- While following, zoom stays on the character; once dragged the camera stays free until reset. A following camera can still be zoomed out down to the whole-scene view.
- Because the stage is now 2x wider, the old follow framing (hero = 85 % of height) hid the door/button/flag. The follow framing now never closes in past 1/3.2 (2D) or 1/2.6 (3D) of the whole-scene size. This changes how close the default run camera looks; constants `FOLLOW_CONTEXT_ZOOM`, `FOLLOW_CONTEXT_ZOOM_3D` in `cameras.ts`.

## Files
- New: `src/puzzle/ui/stage-camera-input.ts` (gestures), `tests/render/stage-camera.test.ts` (12 tests).
- `src/puzzle/ui/level-screen.ts` rewritten around focus state, pip sizing, top bar, camera tools; `puzzle.css`, `themes/theme-a.css`, `guide.css`, `puzzle-text.ts`, `shell-kit.ts` (4 icons).
- `src/render/cameras.ts` (`userZoomBy/userPanBy/resetUserCamera/userCamera`, clamp), `src/render/game-view.ts` (CRLF kept; `panCamera/zoomCamera/resetStageCamera/cameraState`; canvas size now from layout size, not the on-screen box, because the stage is scaled by a transform), `src/app-contracts.ts` (4 methods).
- `board-view.ts`: pin centres divide out the shrink, world starts under the top bar, optional `toastHost` and `keepClear` (corner window), smaller card scales allowed when a level does not fit; `board-state.ts` `separateBoxes(..., blocked)` (+1 test). `guide.ts`: `showBoard` hook, cat placement.
- Node cards, wires, wire-energy code, characters, level data, stage props: untouched (card DOM/CSS identical). Card scale on phones is now ~1.0 (board is full width) where it used to be ~0.78; levels 8 needs ~0.58-0.65.

## Guides / hint / intros
- Guide steps, "?" and new-piece tips call `showBoard()` first, so they always point at the full board. While the mandatory guide (levels 1, 5) leads in the edit phase the corner tap is ignored.
- Cat is now top-left under the top bar (drops to the bottom when the target is in the top half) because the tray is bottom-left now. The bubble text no longer takes taps (cards sit under it); the cat's face does (dismiss / next tip).

## Verification
- `tsc --noEmit`: clean. `npm run build`: OK.
- Full `vitest run --testTimeout 120000` after the last code change (commit 92cbabb): 118 files, 1857 tests, all passed (puzzle + render subset: 431 before the final tweaks, also green).
- Playwright (swiftshader, real clicks via a solver in `plans/browser-scripts/layout-b-lib.mjs`): every level 1-8 at 844x390 and 1280x720: board-full, `?` step, solved board, swapped running (focus = stage asserted), win overlay, retry back to board (focus = board asserted). All 16 won. No console errors/warnings in any script.
- `puzzle-layout-b-camera.mjs` (phone + desk, 18 asserts each, all PASS): tap swap, wheel, ctrl+wheel, drag, hard-drag clamp, +/-/reset buttons, CDP touch pinch, CDP double tap, shrink button, tap mini board, `?` from stage view brings the board, run -> stage, zoom while running, lose toast on the stage view, return to board.
- `puzzle-layout-b-guide.mjs` (phone + desk): level 1 and 5 forced guide (intro, first step, wire step, run step, win with cat), corner tap ignored while guide leads, level 3 tips, hint from stage view.
- Shots: `D:\workspace\GameBuilder\plans\reports\shots-layout-b\` (`phone-L*-*`, `desk-L*-*`, `*-cam-*`, `*-guide-*`, `*-hint-*`, `*-lose-*`). I read the ones named in this report; level 4/6/8 phone, level 2/5 desktop and every camera/guide set were looked at.

## Bugs found and fixed while testing
- Level 8 spilled over the tray (too many cards): card scale can now go down to 0.58 of base, and the corner window is a blocked area instead of a full-width reserved band.
- First cat placement (bottom-left) covered the tray chip the hint pointed at; moved as above. Cat bubble also intercepted clicks on cards (mis-wired my solver): bubble made click-through.
- Test-only: closing the param editor by clicking the screen corner hit the rounded phone frame on desktop.

## Not verified / limits
- No real phone: pinch/drag tested with CDP touch events only; swiftshader frame rate is low, so swap smoothness and 60 fps are unmeasured. Swap frames mid-animation were not captured reliably (screenshots arrive after the 0.42 s).
- Stage canvas renders at full size even while it is the small window (cost = same as before at 44 % width x ~2).
- Zoomed far in at the wall, the clamp still allows a view with only wall in it (it keeps the level box, not the floor, in range). Reset fixes it.
- 3D levels 5-8 follow camera now shows more floor; they are due for the 3D redo anyway.
- Dev-only themes B/C (`?theme=`) have no style for the new task button.
- HANDOFF.md not touched (not in this task).

## Unresolved questions
- Keep the zoom chip relative to the default (follow view default is not "1x of the whole level") or show absolute zoom of the whole level?
- Should the task text start closed on levels the player has already won?

Status: DONE_WITH_CONCERNS
