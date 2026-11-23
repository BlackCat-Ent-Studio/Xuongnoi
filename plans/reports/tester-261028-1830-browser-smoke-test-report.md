# Browser smoke test: Xưởng Nối (2026-10-28)

Scope: real Chromium (headless, SwiftShader WebGL), Vite dev server `http://localhost:5173`. 7 checks from the brief plus extra regression runs.

Tool note: `ck:agent-browser` CLI not installed and no Skill tool in this session. Used Playwright 1.x in scratch folder `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\091c5a2d-ceff-4dfe-a2af-61a656b30d1c\scratchpad\smoke\` (scripts `run-*.mjs`, outside app). Screenshots in `...\scratchpad\shots\`.

## Results per check

| # | Check | Result | Evidence |
|---|---|---|---|
| 1 | Editor loads: top bar, palette (16 items), wiring canvas, game view, props. No console errors | PASS | `shots\01-editor-initial.png` |
| 2a | side-stars: preview renders, Chơi, ArrowRight drives stick.x (badge 1.00), Space drives key.held (Đúng), fall → "Thua!", Chơi lại, Sửa | PASS | `shots\03-…idle.png`, `04-side-stars-moving-right.png` (character moved, `Sao: 1`), `06-side-stars-lose.png` |
| 2b | top-collect (2d-top): D drives stick.x, S drives stick.y, 30 s timer → "Thua!", Chơi lại, Sửa | PASS | `shots\13-top-collect-timeout-lose.png` |
| 2c | 3d-hop (3d): D drives stick.x, Space drives key.held, walk off edge → "Thua!", Chơi lại, W input works, Sửa | PASS | `shots\22-3d-hop-moving.png`, `23-3d-hop-lose.png` |
| 3 | side-stars scripted win ("Thắng!" + 5 stars) | PASS (1 of 8 attempts) | `shots\31-side-win-pulse-offset-0.png` |
| 4 | Palette drag-add; stick.x → character.moveX accepted; key.held (bool) → moveX (number) rejected with red reason; live badges in play; click wire selects; Delete removes wire | PASS | `shots\41-wire-hover-ok.png`, `42-wire-hover-bad-type.png`, `44-play-wire-badges.png` |
| 4+ | Other reject reasons: input already wired ("Cổng này đã có dây nối"), out→out ("Hãy nối từ cổng ra…") | PASS | tooltip text checked in DOM |
| 5 | Tạo mới dialog (3 modes → 3D board). Góc nhìn switch side→top on side-stars, still plays. top-collect → 3D, still plays | PASS | `shots\50-new-game-dialog.png`, `51…`, `52…`, `53…` |
| 6 | Reload restores nodes, wires, name, and dragged position (autosave) | PASS | 26 nodes / 31 wires before and after |
| 7 | Entity drag in edit mode moves block: side-stars platform-1 x 4.5 → 10.5, y kept 1.25 (after fix), snapped 0.5 | PASS (side view only) | `shots\60-…before-drag.png`, `61-…after-drag.png` |

Console errors and page errors: none in any run. Dialogs: none triggered (dismiss handler logged none).

Counts: about 50 browser PASS lines across all runs, 0 FAIL in the final runs (1 INFO line, see below). Earlier FAILs were my own harness timing or a wrong colour selector, plus the drag-snap bug, now fixed. Final regression run of checks 1, 2, 5, 6, 7 all PASS.

## Bugs found and fixed

1. **Stale HUD in edit preview.** After a play session, switching the sample or returning to Sửa kept the old HUD (e.g. top-collect's `Điểm: 0 / Giây còn lại` shown on side-stars preview). Cause: `render/game-view.ts` `resetSession()` cleared overlays but not HUD items. Fix: `hud?.clearItems()` in `resetSession()`. Verified in browser (`run-check-hud-stale.mjs`).

2. **Unformatted HUD numbers.** Timer showed `Giây còn lại: 28.36666666666676`. Fix: `render/hud.ts` new `formatHudValue()`: integers as-is, otherwise one decimal; non-finite → `0`. Unit test: `tests/render/hud-format.test.ts` (new, 3 tests). Browser now shows `28.7`.

3. **Drag silently moved the un-dragged axis.** In side view, dragging a block horizontally also snapped its Y to the 0.5 grid. Sample values are off-grid (platform-1 y=1.25, star-3 y=2.1), so a plain horizontal drag changed Y 1.25 → 1.5. Cause: `editor/entity-drag.ts` `positionOnPlane()` snapped both axes every move. Fix: an axis the pointer has not moved along keeps its current value. Regression test added in `tests/editor/editor-state.test.ts` ("an unmoved axis keeps an off-grid value"). Verified in browser.

Files changed (app tree, not committed): `app/src/render/game-view.ts`, `app/src/render/hud.ts`, `app/src/editor/entity-drag.ts`, `app/tests/editor/editor-state.test.ts`, new `app/tests/render/hud-format.test.ts`. No changes to `src/engine/types.ts` or `src/app-contracts.ts`.

Pre-existing: `HANDOFF.md` was already modified before this run. Not touched.

## Gates after fixes

- `npx vitest run`: 121 passed (10 files). Baseline was 117 (9 files).
- `npx tsc --noEmit -p .`: clean (exit 0).
- `npm run build`: OK. Warning: JS chunk 601 kB > 500 kB (known, three.js).

## Observations (not fixed)

- Sample `top-collect` and `3d-hop` use stick scheme **WASD**, not arrows as the brief assumed. Arrows do nothing there (verified). This is sample design, not a code bug, but a first-time player pressing arrows gets no response. Consider a hint or an arrows scheme.
- Side-stars win is physically possible but needs timing. Engine probe (deterministic, `runtime` + `world`, temporary test file, removed): 185 of 603 Space-timing configs win, e.g. 30 ticks left, then Space 2 ticks every 40 ticks. Browser win reproduced on first try with the same cadence. Hold-Space hop attempts failed. No bug found.
- Dropping a wire on the port it started from shows "Hãy nối từ cổng ra…" (wrong-direction text). Misleading wording. Code reading only, not browser-verified.
- Wire badges are always visible in play (plan said "on hover/click"). Behaviour is more visible than the plan, not a defect.
- Check 7 verified in side view only. Top and 3D drags not browser-verified (code path shares `positionOnPlane`, unit-tested).

## Not verified

- Real feel, FPS, input latency. SwiftShader software WebGL only. Browser timing made hop timing noisy (see Check 3).
- Properties panel edits (number, select, key capture, color, vec3) in the browser. Covered only by existing unit tests.
- Palette click-to-add (drag-add tested). Node-restricted mode notification ("N khối không dùng được").
- Autosave across a real browser restart (page reload tested, same profile).
- JSON export/import round trip in browser (`Lưu`, `Mở file…`).
- Chromium headless only. No Firefox/Safari.

## Unresolved questions

1. Should samples `top-collect` and `3d-hop` accept arrow keys too, or stay WASD-only as designed? The brief assumed arrows.
2. HUD decimals: one decimal chosen as a judgment call. Two decimals (matching wire badges `toFixed(2)`) is a one-line change if preferred.
3. Should dropping a wire on its own start port say "same port" instead of "wrong direction"?

Status: DONE_WITH_CONCERNS
Summary: Smoke test passes all 7 checks in real Chromium (side-stars win reached with scripted input). Three real bugs fixed (stale HUD in preview, unformatted HUD numbers, drag snapping unrelated axis), each with tests where testable. Gates green: 121 tests, tsc clean, build OK.
Concerns/Blockers: Top and 3D entity drag not browser-verified. Samples use WASD, not arrows. Real feel and FPS not measured. agent-browser CLI unavailable, so Playwright fallback used. Nothing committed.
