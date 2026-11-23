# UI nodes report (branch feat/ui-nodes, worktree D:\workspace\GameBuilder-ui-nodes)

## Done
- 5 nodes (`app/src/nodes/ui-*.ts`, registered in `nodes/index.ts`, palette group in brackets):
  - `ui-button` "Nút trên màn hình" (Đầu vào): in `Hiện`; out `Vừa bấm` pulse, `Đang giữ`. Params text, colour, corner.
  - `ui-pick` "Bấm vào vật" (Đầu vào): in `Vật` (object); out `Vừa bấm`. Hidden entity cannot be picked.
  - `ui-meter` "Thanh đo" (Kết quả): in number, `Gắn vào vật`, `Hiện`; params label/min/max/colour/corner. Corner bar or bar floating over an object.
  - `ui-dialog` "Hộp hỏi" (Đầu vào): in `Hỏi` (rising edge opens); out `Chọn 1/2/3` pulses + `Đang hỏi`. Answer 3 optional (empty = 2 buttons). Game keeps running while open.
  - `ui-start` "Màn hình bắt đầu" (Đầu vào): out `Đã bắt đầu` (false until the button is clicked, then latched). Param pauseMenu (default yes).
- Pause menu: Esc (only after start, only when the start node has pauseMenu=yes) -> menu "Tiếp tục" / "Chơi lại". Uses the existing pacer pause (same state as the toolbar Pause) and the existing restart request, so restart was easy.
- Plumbing (all optional/back-compatible):
  - `engine/types.ts`: `InputSnapshot.ui?: UiInput {clicked, held, picked}`; `HudItem.widget?: HudWidget`.
  - `render/ui-input.ts`: `UiInputBuffer` (clicks consumed once per frame on the first tick; held persists; a press+release between ticks still reads held once), `pickEntities` (ray vs entity boxes; 2D = all boxes on the ray, 3D = nearest only, skips hidden/zone/in-hand), click-vs-drag tracker (6px slop, so 3D orbit drags are not clicks).
  - `render/hud-widgets.ts` (corner buttons/bars, elements persist so hold works), `render/hud-modals.ts` (start card, dialog, pause menu), small edits in `hud.ts`, `floating-labels.ts` (anchored bar), `game-view.ts` (input into `runtime.tick`, pointer click tracking, Esc), `text-vi.ts`.
  - Clicks on widgets/cards `stopPropagation`; the cards are siblings of the canvas so editor entity-drag (edit mode only) and orbit never see them. PiP re-parents the same game box/renderer, so it gets the HUD for free (not separately tested).
  - Picking uses entity boxes, so it did not touch `humanoid-model.ts` / character visuals (other agent's area).
- Lesson 17 `ui-chest` "Rương bí mật": `tutorial/lesson-ui-chest.ts` + `tutorial/text-vi-ui.ts`. Starter board: stick, hero, floor, brown chest (pickup block). Steps: add Bấm vào vật, wire chest -> target, add Thắng/Thua, wire pressed -> win, add Hẹn giờ (seconds 10), add Thanh đo (max 10), wire left -> value, wire done -> lose, play, win, done. "Chơi lại" is the existing end-card button (no extra button node; the lesson's done step suggests Nút / Hộp hỏi / Màn hình bắt đầu).
- Registry: one const line + appended `lessonUiChest` as last entry of `LESSONS` in `tutorial/lessons.ts`.

## Tests (new)
- `tests/nodes/ui-nodes.test.ts` (each node with simulated UI input, fallbacks, hidden/edge cases)
- `tests/render/ui-input.test.ts` (buffer, click tracker, pickEntities 2D/3D, runtime plumbing with real world; ticks without `ui` still work)
- `tests/tutorial/lesson-ui-chest.test.ts` (full step walk-through + headless sim: click chest = win, click floor = nothing, timeout = lose)
- Edited existing assertions: `step-1-nodes.test.ts` node count 41 -> 46; `lessons.test.ts` LESSONS length 16 and titles `[1..15, 17]`.

## Browser check (port 5188, Playwright, swiftshader)
Script: `...\scratchpad\smoke\ui-nodes.mjs` (autosave-seeded board). 2D side and 3D, 26/26 checks each, 0 console errors/warnings:
start card shown, chest clicks behind it ignored, start click -> Đã bắt đầu; button click counted, held on while pressing / off on release; corner bar + bar floating over hero; chest click (found by colour in a screenshot) -> counter + dialog opens, game keeps running, answer buttons counted, dialog closes; click on empty space and a drag are not picks; Esc -> pause menu, time frozen, Tiếp tục resumes, Esc twice toggles; Esc -> Chơi lại restarts to the start card.
Screenshots: `D:\workspace\GameBuilder\plans\reports\shots-ui-nodes\` (1-start-screen, 2-started, 3-button-held, 4-dialog, 5-pause-menu, 6-after-restart; `3d-` prefix for 3D). Dev server stopped (port 5188 free).

## Gates (app/)
`npx vitest run` 57 files / 756 tests green; `npx tsc --noEmit -p .` clean; `npm run build` ok.
Commits: `feat(ui): add clickable on-screen nodes ... and lesson 17`, `fix(render): draw floating labels behind ... cards`. Not merged.

## Merge notes for controller
- `lessons.test.ts` "registered right after lesson 7 ..." test: I set length 16 and titles `[1..15, 17]`. With lesson 16 merged it must be length 17 and titles 1..17 (drop the `, 17` special case).
- `tutorial/lessons.ts`: my 3 edits are one import line, one const line after `lessonEditorTools`, and `, lessonUiChest` appended at the end of `LESSONS` -> expect a trivial conflict with the other agent's line; put lesson 16 before `lessonUiChest`.
- `step-1-nodes.test.ts` counts: if the other agent adds a node, add to 46.
- `app/node_modules` in the worktree is a junction to the main app's folder (untracked/ignored); remove with `rmdir`, not recursive delete, when cleaning the worktree.
- Line endings: `types.ts`, `text-vi.ts`, `game-view.ts` are CRLF in the repo and kept so; other files LF.

## Limits / unresolved
- Game keeps simulating behind the start screen and while a question is open (by design: gate logic with `Đã bắt đầu`); Esc pause is the only freezing path.
- Picking uses axis-aligned entity boxes (rotated blocks are approximate); in 2D every box on the ray gets the click, so an object overlapping the chest also counts.
- Only one start card and one open dialog are drawn at a time (first visible).
- Bar/button corners are the four existing corners (no free pixel position).
- Lesson text not user-tested by a real learner; walk-through verified by tests only (lesson panel UI not exercised in the browser).

Status: DONE_WITH_CONCERNS
Summary: 5 interactive UI nodes, pointer/HUD plumbing, Esc pause menu and lesson 17 done; all 3 gates green, 26/26 browser checks in 2D and 3D with 0 console errors; committed on feat/ui-nodes, not merged.
Concerns/Blockers: merge fixes needed in lessons.test.ts (count/titles) and the LESSONS line with lesson 16; lesson panel not exercised in browser.
