# Overview fit trial (feat/overview-fit, commit d883d0e, not merged)

## How the user opens the trial
- Dev server left running on port 5206 (worktree D:\workspace\GameBuilder-fit).
- URL: http://localhost:5206/giai-do.html -> open any level -> press "Toàn cảnh" (overview) -> small floating box "Độ gần toàn cảnh" under that button with a 3-step slider: Hiện tại / Gần vừa / Rất gần.
- Also `?fit=` in the URL: `cu` (Hiện tại), `vua` (Gần vừa), `sat` (Rất gần), or 0/1/2. Default = Gần vừa.
- The slider is TEMPORARY (inline-styled, always shown; remove before release). The choice is remembered across levels until reload.

## What changed (3 files, +108/-9)
- `app/src/render/cameras.ts`: StageFit gets `tight` (margin share) and `include` (extra points). New `contentBounds()` = every visible non-floor thing (characters counted at 1.6x), floor line, + extras, door height capped at 6, margin max(1 unit, share of size). Follow-camera clamp still uses the old box. 3D uses slack 1.12 when tight.
- `app/src/render/../app-contracts.ts`: setStageFit type gets the two fields.
- `app/src/puzzle/ui/level-screen.ts`: presets (0 / 0.12 / 0.04), slider, `levelExtraPoints()` = patrol ends, route points, zone corners from base nodes, tray and solution (so patrol/route extents stay in frame).
- Bottom task box and top HUD are still excluded by the existing top/bottom fractions.

## Evidence
- 96 screenshots (8 levels x 3 presets x desk 1280x720 / phone 844x390) + 6 contact sheets in `D:\workspace\GameBuilder\plans\reports\shots-overview-fit\` (sheet-hien-tai|gan-vua|rat-gan-desk|phone.png). I read the sheets and several full-size shots.
- Scripts: `plans/browser-scripts/overview-fit-shots.mjs`, `overview-fit-sheets.sh` (plans/browser-scripts is gitignored, so they are not in the commit).
- tsc clean, `vitest run tests/puzzle` 261/261, `npm run build` OK.

## Findings (honest)
- 2D side levels (1-4): width is the limit (start bot at left, flag at right), so the scene can only grow a little; Gần vừa gives ~10-15% more than now, Rất gần ~20%. Sky above stays because the frame is tall and the content is a thin strip. Start bots and flags fully visible in all.
- 3D levels (5-8): floor is the stage, content spans most of it, so the picture changes little; Gần vừa shows the whole floor with a margin, Rất gần crops floor corners. In Rất gần level 8 the two near-bottom crates touch the task box edge; Gần vừa clips nothing.
- Not verified: moving characters during play (the overview frame is fixed at start; patrol ends are included analytically, not checked by a recorded run). No real phone/touch test.

## Recommendation
Keep **Gần vừa** as default (nothing clipped on both viewports). Rất gần only if the user accepts crops in 3D corners.

## Unresolved
- If the user wants 2D really bigger, the stage frame itself (aspect/size) must change, not the camera.
