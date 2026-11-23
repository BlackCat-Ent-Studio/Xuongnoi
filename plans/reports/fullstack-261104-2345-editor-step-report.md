# Editor step run port (branch feat/editor-step, worktree D:\workspace\GameBuilder-edstep, port 5241)

## What changed
| Id | Result |
|---|---|
| A | "🐢 Từng bước" replaces the old 1-tick step button. Press while playing (or from edit mode: it starts the run) -> game auto-pauses on a tick where an output pin drawn on the board AND having a wire rises (same `stepBreakKeys` / `GameView.setStepBreak` as puzzle). Button reads "▶ Tiếp" while stepping, live only when frozen. "Tạm dừng" untouched; resuming by it drops the light. Light: fired pin pulses, "who" and "what" from puzzle `stepLight` (imported, not copied), lit wires are redrawn on an overlay, rest fades (cards .2, wires/badges .1) only in step mode, stage glow via `GameView.setHighlight`, board panned/zoomed to lit cards (fired cards first when everything cannot fit). No text bubble. Stop / restart / game end leave step mode. |
| F | "Chơi" (and 🐢 from edit mode) call `enterFullscreenOnTouch()` (puzzle helper, coarse pointer only). |
| G | New optional `extraTries` on a handbook page = one more button next to "Thử ngay". route-follow: "Thử: tuyến theo vật" (`pointsFrom: objects`, car drives to you + 2 boxes, move with WASD). block: "Thử: báo đang ẩn" (`showHiddenOut`, hide box with Space -> "Đang ẩn" -> Thắng). Existing `tryBoard`s untouched. |
| L | Lesson "Xem dây chạy từng bước" (id `step-run`) at the end of chapter "Làm quen" (becomes lesson 5; later lessons renumber by title only). Steps: intro, Chơi, Từng bước, wait for the freeze, Tiếp (needs 2 freezes), done. Learner wires nothing. Checks read new optional snapshot fields `stepping`, `stepWaiting`, `stepBreaks` (fed by `tutorial.noteStep`). |

## Files
- New: `src/editor/step/step-run.ts` (controller), `step-light-layer.ts` (board light), `step.css`; `src/tutorial/lesson-step-run.ts`, `text-vi-step-run.ts`.
- Edited: `src/editor/app.ts`, `top-bar.ts`, `shell-text-vi.ts`, `console/console-text-vi.ts`, `wiring-canvas.ts` (only: 1 import, 1 `let stepLayer`, 2 interface lines + `hasOutPin` / `setStepLight` appended at the end of the returned object), `src/handbook/{types,handbook-dialog,boards-action-brain,boards-math-object-output,content-action-brain,content-math-object-output}.ts`, `src/tutorial/{course,course-pack-a,controller,snapshot,types}.ts`.
- Tests: new `tests/editor/step-run.test.ts`, `tests/editor/step-break-samples.test.ts`, `tests/handbook/extra-tries.test.ts`, `tests/tutorial/lesson-step-run.test.ts`; baselines `solid-off-baseline.json` and `solid-on-summary.snap.json` got ONLY the new `lesson:step-run` entry appended (diff is pure additions).
- Not touched: `src/puzzle/**`, `src/editor/graph/**`, `src/render/game-view.ts`. Merge note for the board agent: keep both in `wiring-canvas.ts`.

## Verified
- `npx tsc --noEmit -p .` clean.
- Vitest: new tests all green; full-suite result in the final message.
- Playwright on :5241 (scripts in `plans/browser-scripts/editor-step-*.mjs`, shots in `plans/reports/shots-editor-step/`): sample "Nhặt sao" in step mode paused on a break shows 4 lit cards, 1 glowing pin, 4 lit wires, rest faded, button "▶ Tiếp"; second break works; Stop clears light and restores the label. Lesson runs end to end (steps 1 to 6 advance by themselves). Handbook route-follow page shows the extra button and it opens the board "Thử: Tuyến theo vật".

## NOT verified
- Fullscreen on a real touch device (desktop mouse only checked that nothing breaks).
- Handbook block extra button in the real dialog (same code path as route-follow, covered by headless test of the board only).
- Stage outline glow on the PiP while paused (not inspected in a shot).
- On big boards (city-3d) the lit cards can be far apart: the board zooms out to min 0.4 or frames only the fired cards.

## Unresolved
- Wires/cards of nodes inside a collapsed group are not "shown", so they never break the run (by design, matches "shown" rule).
