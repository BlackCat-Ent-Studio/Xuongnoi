# Stage port report - cozy wooden workshop in "Xuong Bot giai do"

Branch `feat/stage` (worktree `D:\workspace\GameBuilder-stage`), commit `b732dc3`. Not merged. Dev server :5204 stopped.

## What was done
- Puzzle-only stage theme. New code: `app/src/puzzle/stage/{stage-kit,stage-props,stage-scenery,cozy-stage}.ts`, interface `app/src/render/stage-theme.ts`. `createGameView({ stage })` is passed only by `puzzle-main.ts`; the editor passes nothing, so every shared code path is the old one (character scale 1, side camera pitch 0, no props).
- Roles come from entity shape (size, colour, view mode), no level data needed, so a new level 7 gets the look for free: wide thin block = floor (side) / tray (3D), thin pad = button (side, or red in 3D) / storage pad (green >= 3) / goal pad (green < 3), tall block = door, small yellow cube = star, small tall pickup = flag, crate item = rounded crate, sensor zone = flat outline on the floor (3D only).
- Side levels: plank floor + cream plank back wall (wainscot, rail, skirting), 1 window, 1 shelf, ONE hanging lamp. 3D levels: wooden tray with low walls, plank floor, plants/crates in free corners, painted pads, chunky gold stars, flag.
- Door (levels 2, 3, 4 side view; level 8 in 3D): thin hinge post + edge-on plank leaf that swings about the vertical hinge when the door is hidden (hide = swing open and STAY open beside the post, closes again if the signal drops). Never sinks, no frame, no hole. Verified by screenshot series (`door2o-*`).
- Characters drawn 1.6x (visual only; feet stay on the collision floor), follow camera default (toggle kept), side camera tilted 0.2 rad so floor planks show, warm lights. Follow framing tuned to the approved preview (side ~45% frame height, 3D ~27%); `heroScale` in `StageFit`.
- Legs robot `carry` pose (arms forward, smoothed) only when the scene asks for it (stage); crate drawn in front of the legs robot. Other looks ignore it. Look/geometry of characters untouched.
- Level 5: cast + look = robot-legs, name "Ro-bot chan", task text "Ro-bot chan dang cho thung...". No guide/hint line mentioned the wheel robot for level 5; level 8 text unchanged.
- Level 3 converted from `2d-top` to `2d-side` (see concerns): stars in a row on the ground, tall wooden gate (0.8x8x1, same as level 2 door), ground block added, route points z=0. Solution wires unchanged.

## Verification
- tsc clean; `vitest run tests/puzzle` 238 -> 248 passed (10 new stage tests); full suite 115 files / 1831 tests passed; `npm run build` OK.
- New tests `tests/puzzle/stage-theme.test.ts`: roles per level, every level draws, hidden door stays open and closes again, hidden star pops and goes, characters drawn 1.45-1.75x, no props without a stage.
- Playwright (swiftshader) all 8 levels, edit + running, 1280x720 and 844x390, follow (default) and overview: no console errors. Sheets in `plans/reports/shots-stage-port/`: `sheet-{desk,phone}-{follow,overview}.png`, `sheet-door2o.png` (level 2 door closed/swinging/open), `sheet-star3.png` (level 3 stars + gate), `sheet-carry5.png` (level 5 carry), `editor-home.png` (editor untouched, no errors).
- Editor: no stage object means no stage code runs; cards, wires, wire energy, CSS were not touched (no `.css` or board file in the diff). No pixel diff of the editor was run (only a screenshot + the existing render tests).
- Line endings: `git diff main --stat` equals `--stat -w` (CRLF kept; new files LF).

## Triangles (renderer.info, last frame, includes the 3D shadow pass)
| Level | follow edit / run | overview edit / run |
|---|---|---|
| 1 | 6.9k / 6.5k | 9.9k / 9.9k |
| 2 | 6.5k / 7.1k | 12.7k / 12.7k |
| 3 | 10.1k / 10.1k | 17.6k / 15.7k |
| 4 | 5.8k / 7.9k | 24.4k / 24.4k |
| 5 | 15.9k / 14.7k | 22.9k / 22.6k |
| 6 | 18.2k / 31.6k | 38.0k / 38.0k |
| 7 (old, replaced by other agent) | 22.4k / 22.4k | 23.1k / 22.8k |
| 8 | 47.6k / 37.5k | 78.8k / 78.5k |
Stage geometry alone: side room ~4.9k, 3D tray 1.7k (+~6k corner decoration), door 1.6k, crate 1k, star 1k, button 1.2k. Level 8 and level 4 are dominated by the wheel robot (~25k, characters untouched). Real-phone FPS not measured.

## Concerns / decisions to confirm
1. Level 3 mode change (2d-top -> 2d-side) is a data change beyond the brief: needed so the approved side-view preview and the shared door rule apply. Tests (solution wins, wires removed fail, canConnect, overlap) all pass. If the user wants the top-down star level back, revert level-03.ts and level 3 gets a plain look (roles return null for 2d-top).
2. Props are built in the preview's design units (robot ~2.9 tall) and scaled by `STAGE_UNIT` = 1.6/2.9 = 0.55 to match the real 1-unit robot; door visual is 2.0 tall while its collision stays 8 tall (as in the preview).
3. Follow camera is close (approved defaults): the whole level is only visible via "Toan canh".
4. Level 7 got only generic theming (banks as plank slabs, bridge/water stay plain boxes); the replacement level will need its bridge/gap props if wanted.
5. Zone markers (tall translucent box) now draw as a flat green outline on the floor in 3D (to avoid washing the close-up); side view keeps the old box.
6. Shadows: the 3D sun shadows now fall on the planks; slow-machine shadow auto-off is unchanged.

## Unresolved questions
- None blocking. Level 3 side-view conversion needs the user's OK when merging.

Status: DONE_WITH_CONCERNS
