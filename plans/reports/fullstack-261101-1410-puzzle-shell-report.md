# Puzzle shell report ("Xưởng Bot giải đố")

Branch `feat/puzzle-shell`, worktree `D:\workspace\GameBuilder-shell`, commit `ef5279b`.

## Files
- `app/giai-do.html`, `app/src/puzzle-main.ts` (hash router `#/` list, `#/level/<id>`; one shared GameView moved between screens)
- `app/vite.config.ts` multi-page input (index + giai-do), test config kept
- `app/src/puzzle/ui/`: `board-state.ts` (pure rules), `progress.ts` (localStorage `xuongnoi.puzzle.progress`), `board-view.ts` (DOM board), `level-screen.ts`, `list-screen.ts`, `puzzle-text.ts`, `puzzle.css`
- `app/src/editor/app.ts`: Help menu item "Chơi giải đố" (opens giai-do.html in a new tab). Only editor file touched.
- Tests: `app/tests/puzzle/ui-board-state.test.ts`, `ui-progress.test.ts`, `fixtures/door-fixture(.test).ts`

## How to open
`cd app; npm run dev -- --port 5202 --strictPort` then `http://localhost:5202/giai-do.html`.
Fixture (dev only): `giai-do.html?fixture#/level/fixture-cua-kho` ("Cửa kho (mẫu)", real nodes, passes headless runLevel). Loaded only when `import.meta.env.DEV` and `?fixture`; verified not in the production bundle. Fixture lives in `app/tests/puzzle/fixtures/`.

## Reuse
Cards = `buildNodeView` + `node-cards.css` + `graph.css`; wires = `wirePath` + `createWireEnergy` (edit dots, lit/dim, glow, sparks, live ports, hot cards, driven by `getWireValue`/`takeRisen`); wiring rules = `checkPortPair`/`canConnect`. No second copy of logic.

## Behaviour notes / interpretations
- Locked node listed in `shownPorts` with no ports (`{}`) = scenery: card not drawn (win-lose, floor, flag...). Unlisted nodes show all ports. Listed node with only `out` shows no inputs. Wires touching hidden ports are not drawn. Please tell level authors.
- Locked-node editable params are applied by overriding `level.base` before `buildPlayGraph` (no contract change); tray-copy params live on the placed node.
- Board fits the 1000x560 logical space (wider if cards stick out) into the board area above the bottom bar, scale <= 1. On 844x390 scale is about 0.47, so card text is small (about 6px); legible but denser levels will be tighter. Pin taps use nearest-pin within 26px so small cards stay tappable.
- Win: stage `stop()` is called inside the end callback to hide the view's own end card; last frame stays on canvas (checked). Lose/timeout: toast, scene resets after 1.7s. Timeout counted in game ticks vs `level.timeLimit`.
- Hint stays "used" for the whole visit (also after ↺).

## Verified
- `tsc --noEmit` clean; `npm run build` OK, both pages emitted; `vitest run tests/puzzle tests/editor`: 149 pass (puzzle tests: 20).
- Playwright (swiftshader) screenshots read: `D:\workspace\GameBuilder\plans\reports\shots-puzzle-shell\` — list (empty, fixture), level 844x390 and 1280x800, placed, wiring (picked + dimmed/pulsing), wired, running (lit wires, hot cards), win overlay (3 stars, progress saved), param stepper + select popovers, hint, timeout toast, portrait ("Xoay ngang điện thoại để chơi"). Drag by header, tap wire to remove, × to tray, ↺ reset, DỪNG all exercised. No console errors.

## Not verified
- Real touch devices / real GPU; 3D level with locked camera (no 3D level available, only 2D fixture); lose path via win-lose "Thua" (only timeout path run); list screen with several levels and the locked state visually (logic unit-tested); other-browser behaviour.

## Contract change requests
None.

Unresolved: should scenery nodes be hidden by `shownPorts: {}` (current) or via an explicit `hidden` flag?

## Round 2: real levels (stage + card readability)
- Stage: new `GameView.setStageFit({top,bottom,pitch?})` (additive: `app-contracts.ts`, `render/game-view.ts`, `render/cameras.ts`, `render/scene-view.ts#setBackdrop`). Puzzle page uses it: no editor grid, mint backdrop, fixed camera framing the scene box inside the part of the stage not covered by HUD/task box, same framing before and during play. Wide flat blocks (floor) only add a 3-unit margin around the other objects, so a 30-unit floor does not shrink the action. 3D keeps the locked camera node's tilt (`viewPitch`), distance solved from the box corners.
- Task box is collapsible (button, 40px), closes on CHẠY and reopens on stop.
- Cards: no more whole-board scaling. Level positions are stretched to the board; cards stay at scale 1 (desktop) / about 0.78 (phone), shrinking up to 20% more only if needed; overlaps are pushed apart (`separateBoxes`, unit-tested); tray pieces land in free space. Text about 12px desktop, about 9.4px phone.
- Scenery convention documented in a comment in `puzzle/ui/board-state.ts`.
- Verified: shots of all 8 levels at 1280x800 and 844x390 in `plans/reports/shots-puzzle-shell/levels/`; full solve from `level.solution` via tray + taps + CHAZ on level 2 (cua-kho) and level 5 (du-ba-thung) ends in the win overlay (3 stars); tsc clean; vitest tests/puzzle tests/editor tests/render 369 pass; build OK.
- Not verified: one level-5 running frame lacked the HUD badge in a screenshot (not reproduced on level 2; likely screenshot timing); characters still default human (waiting for look agent); real touch devices.

## Round 3: follow camera + view toggle
- `StageFit.follow` (owner node id) in `render/cameras.ts`: overview stays the default before CHAY; with follow the camera eases (rate 5/s, no jitter, still redraws jump) to the main character so it fills about 30% of the visible stage height (2D: ortho size = size/0.3; 3D: distance, min 3.5, tilt from the locked camera node kept), target clamped inside the scene box. Stop/lose/timeout reset returns to overview.
- Main character = first `character` node whose `look` equals `level.cast[0]`, else the first character (`mainCharacterId` in level-screen.ts).
- Toggle pill "Toàn cảnh" / "Theo nhân vật" (40px, top right under the stars, hidden when a level has no character). Auto behaviour until the player taps it (overview while editing, follow while running); after a tap the choice is kept for the visit (all levels) and applies before and during the run.
- Verified: levels 2, 5, 6, 8 at 1280x800 and 844x390: overview, follow after 2.2 s of running (nothing placed), after stop, toggled before run: `plans/reports/shots-puzzle-shell/follow/`. tsc clean; vitest tests/puzzle tests/editor tests/render pass; build OK.
- Not verified: reference-solution runs in follow mode (only empty-board runs), real touch devices; in 3D the character is about 25-30px on the phone because the floor plane fills the view.
