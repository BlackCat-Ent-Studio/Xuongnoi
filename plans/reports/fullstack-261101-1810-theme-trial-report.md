# Theme trial report (A / B / C) - 2026-11-01

Branch feat/theme-trial, worktree D:\workspace\GameBuilder-theme. 1 commit, 15 files, +546/-7 (stat and stat -w match).

## What was built
- `app/src/puzzle/ui/themes/`: theme-a/b/c.ts (animated backdrop builders), theme-a/b/c.css (backdrop + chrome, all scoped under `.pz-theme-a|b|c` on body), backdrop.css (shared base), backdrops.ts, backdrop-kit.ts, theme-trial.ts + .css (state, floating "- A B C" switcher, marked TEMPORARY in comments).
- Switcher: top-right fixed, 40px targets, `?theme=a|b|c` (`?theme=none` clears), localStorage `xuongnoi.puzzle.themeTrial`. Nothing chosen = original look unchanged.
- Transparent stage: `createGameView({ transparentStage: true })` (puzzle-main.ts only), alpha renderer + `SceneView.setBackdrop(null)`. Editor path untouched. With no theme the canvas shows the same mint `--stage` colour as before.
- level-screen.ts: inserts the stage backdrop behind the canvas, swaps live when the theme changes. Page backdrop (fixed, behind list and around phone) is created by theme-trial.ts.
- Backdrops: A wood wall + shelves + swinging lamp + flicker glow + dust motes (stage: lighter wall, glow only, no lamp body). B sky + sun + drifting clouds + 4 swaying hills + petals + windmill/hut (list page). C night gradient + moon + twinkling stars + fireflies + shooting star + hills. Transform/opacity only, no blur; reduced-motion stops all animation.

## Cards, wires, characters untouched
- No theme CSS targets `.wc-*`, node cards, pins, wire or energy classes, or their variables. Checked that no card rule uses the variables themes override (`--ink`, `--sun`, `--board` ...).
- Level 2, first node card, element screenshot vs no-theme: interior pixel diff A 0/9480, B 0/9480, C 0/9480 (same size). Computed styles of card + 12 children + one wire (stroke, width, opacity) identical in all three themes.
- Characters/mascot: no CSS recolour; only the mascot frame border/shadow around the canvas changed per theme.

## Deviations
- B board is a deep leaf green (#2c6a55), not the preview's pale green: yellow/pink wires would be unreadable on pale, and the wires must not change. Board keeps the original width (no margin shift) so card size stays identical.
- Preview's renamed/redrawn cards were NOT ported (per coordinator message).

## Verification
- tsc clean; vitest tests/puzzle tests/editor tests/render: 37 files, 482 tests pass; `npm run build` OK.
- Playwright, no console errors: shots in `plans/reports/shots-theme-trial/{none,a,b,c}/` : list, level-1..8 (1280x720), small-level-2/6 (844x390), level-2-running, sheet-a/b/c.png contact sheets. Read all three sheets plus list/level-2 per theme: text readable, nothing overlapping except the switcher on 844x390 (it sits over the top-right of the board there, where the phone fills the whole viewport; harmless in the shots but could cover a card in some layout).
- 3D levels (5-8) and characters look the same as without theme over the backdrop; in 3D the grey floor plane is opaque as before.
- Dev server on 5209 stopped.

## Unresolved
- User should judge A's stage (shelves at 42% opacity behind the level) and C's moon sitting behind the door pillar in level 2.

Status: DONE
Summary: Three switchable themes with animated backdrops, transparent puzzle stage and floating A/B/C switcher are committed; cards and wires are pixel-identical (diff 0) across themes, all checks pass.
Concerns/Blockers: Switcher overlaps the board's top-right corner at 844x390; B board colour deliberately darker than the preview to keep wire contrast.
