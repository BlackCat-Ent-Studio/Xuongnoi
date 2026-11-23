# Edit camera pan/zoom + closer default

Status: DONE

## Changes
- `app/src/render/cameras.ts`: VIEW_CLOSENESS=1.5 (default ortho 16/1.5, 3d distance 14/1.5, fit homes /1.5). Pure helpers: clampZoom (0.3-4x), zoomAfterWheel, zoomCenter (zoom-to-cursor), panOrthoDelta, panGroundDelta. CameraRig: persistent edit view (target, mag, home computed once from content, re-armed by resetView), pan(), zoom(deltaY, ndc). Entering play swaps in a follow view with default framing; leaving restores the edit view exactly.
- `app/src/render/game-view.ts`: pointer arbitration (edit 2D: left/right drag pans; edit 3D: left orbits, right pans; play 3D: left orbits, 2D none), contextmenu suppressed, wheel zoom to cursor, grab/grabbing cursor, "Về giữa" button (hidden in play), `resetCamera()` flag applied at next preview.
- `app/src/render/text-vi.ts`: `resetCamera` string. `app/src/style.css`: `.cam-reset`.
- `app/src/app-contracts.ts`: `GameView.resetCamera()`.
- `app/src/editor/app.ts`: on 'board' change call `gameView.resetCamera()` (new/open/tutorial lesson). Mode switch resets via new rig.
- `app/src/editor/entity-drag.ts`: ignore pointerdown not targeting the canvas (so the reset button is not seen as an entity grab). Capture logic unchanged.
- `app/tests/render/render-logic.test.ts`: +5 tests (zoom clamp, zoom-to-cursor invariant, ortho pan, ground pan, default closer + persistence + reset).

## Verification
- vitest 195/195, tsc clean, build ok.
- Playwright (`scratchpad/smoke/camera-check.mjs`, `camera-drag.mjs`; shots in `scratchpad/camera/`): side-stars, top-collect, 3d-hop: wheel in/out, pan (2D left-drag, 3D right-drag), 3D left orbit, reset, play (button hidden, follows), Sửa back (button back): all PASS, no console errors. Entity drag moves a star while camera stays put after the preview refresh (drag-A/B pngs). Tutorial run (tut-run.mjs): 67 PASS, 0 FAIL, no logs.

## Notes
- Edit default for wide boards frames fit/1.5, so very wide boards are partly off-screen by design (pan/zoom/reset available).
- Not tested in-browser: automated "param edit in properties panel" (covered instead by entity-drag, which goes through setParam and the same preview refresh).

Status: DONE
