# Lesson 14 (editor-tools) + L3 wiring flake root cause

Worktree `D:\workspace\GameBuilder-l14`, branch `feat/l14` (from bc4e7c4). 3 commits:
- `966c4d1` fix(editor): float the status note so it cannot shift the layout mid-drag
- `7431250` feat(editor): put new sticky notes in free space instead of behind blocks
- `e7e7b6f` feat(tutorial): lesson 14 on undo/redo, multi-select copy/paste and sticky notes

## B. Lesson 3 flake: root cause (REAL APP BUG, fixed)

Not specific to the const wire. Reproduced on the full `tut-run.mjs` chain: 3 fails in 10 (before), failing step varied (wire win, wire height, wire limit). Isolated lesson never fails.

Cause: the top-bar status note (`notify`, auto-clears after 4 s) was a flex item in a `flex-wrap: wrap` bar already full at 1440 px. Showing it wrapped the bar to a 2nd row (+33 px), the whole canvas moved down; when it expired the canvas jumped back up 33 px. Lesson 2 ends with a "Bạn đã xong bài ..." notify, so its 4 s expiry lands in the middle of lesson 3 wiring at a random moment.
Probe (elementFromPoint + `.wc` rect logged per wire): at measure time `.wc` rect y=89 h=811; at mouse-down y=56 h=844. Dot measured at y=631 hit-tested OK, then pointerdown at the same coordinates hit empty `.wc` -> branch "pan" (not wire), mouse move panned world by (-130,-194), no wire. Later wires then missed too (ports panned off screen), so one miss cascaded.
Ruled out: pointer capture, stale port element (portEls rebuilt only on render), rAF, tut-hl overlay (outline/box-shadow only), tutorial panel (fixed, no overlap). This also hit real users: any notify (copied, pasted, saved...) shifts the editor layout under a drag.

Fix: `.status` is `position:absolute` under the bar, `pointer-events:none`, hidden when empty; `.topbar` `position:relative`. Test `tests/editor/status-layout.test.ts` (reads style.css; fails on the old CSS, verified). Needs `tests/editor/node-fs.d.ts` (no Node types in project).

Pass rate lesson 3 via full tut-run chain (L1+L2+L3, 10 sequential runs, port 5194): before 7/10 (P P F P P F P P P F); after 10/10. No console errors.

## Extra app fix found while scripting L14
New sticky note appeared at view centre, behind blocks (notes layer is under nodes), so on a crowded board it could not be clicked. `findFreeNoteSpot` (`src/editor/note-placement.ts`) picks nearest clear grid spot (falls back to old spot on a crowded board); used by `addNoteAtCenter` in `app.ts`. Test `tests/editor/note-placement.test.ts`.

## A. Lesson 14 "14. Công cụ bảng nối" (id `editor-tools`), 13 steps
Files: `src/tutorial/lessons-editor-tools.ts` (own file, `createEditorToolsLesson(kit)` same kit pattern), `src/tutorial/snapshot.ts` (new `takeSnapshot(state, ended)`), `tests/tutorial/lesson-editor-tools.test.ts` (4 tests).
Shared files touched minimally: `lessons.ts` = 1 import + 1 const line + appended to LESSONS; `types.ts` Snapshot + 3 optional fields (`selectedIds`, `notes`, `canRedo`); `controller.ts` uses `takeSnapshot` and also re-evaluates on `selection|notes|history` events.
Also edited `tests/tutorial/lesson-bot-driver.test.ts`: "is the last lesson" assertion -> `toContain` (breaks as soon as any lesson is appended; other worktrees will likely hit the same line, trivial conflict).

Steps / checks (all from editor state): intro (Tiếp) -> Shift+drag box: selection is exactly key+character -> Ctrl+C then Ctrl+V: nodes>=5 -> Ctrl+V: >=7 -> Ctrl+D: >=9 -> Delete: <9 -> Ctrl+Z / Hoàn tác button: canRedo && >=9 -> Ctrl+Y / Làm lại button: !canRedo && <9 -> undo again -> 📝 Ghi chú (top bar or palette): notes>=1 -> type text -> change colour -> done. Starter: Phím bấm -> Nhân vật(jump) + Sàn.
Limitation: Ctrl+C itself is not checkable (clipboard not in snapshot), so it is merged with the first paste. Over-pasting (more than 2 pastes) makes count-based steps wait; "Bỏ qua bước này" always available.

Browser (5194, `l14-run.mjs`): all 13 steps advance via real keyboard/buttons, 0 console errors, panel closes on finish.

## Verify
- vitest: 642 pass (631 + 11 new), 0 fail
- `tsc --noEmit -p .` clean; `npm run build` ok (chunk-size advisory only)
- dev server 5194 stopped. Scripts/shots: `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\c6588d98-de8b-47ca-8a66-fd5282a3c2b1\scratchpad\l14\` (tut-run-probe.mjs = per-wire geometry probe, before-*/after-* = 10x runs, l14-run.mjs).

## Merge notes
Conflict-prone lines: `lessons.ts` import + LESSONS array + const block; `lesson-bot-driver.test.ts` line 47-48; `types.ts`/`controller.ts` only if other lessons extend Snapshot too. `style.css` fix is 2 lines near `.topbar` / `.status`.

## Unresolved questions
- Toast now floats over the top-right of the game preview for 4 s. OK visually (screenshot l14-04.png); confirm product-wise.
- Doc updates (docs/) not done; no docs listed lesson count in scope.

Status: DONE
Summary: Lesson 14 added (13 steps, all browser-verified) and the lesson-3 flake root-caused as a real layout-jump bug (status note wrapping the top bar, shifting the canvas 33 px mid-drag) and fixed; L3 full-chain pass rate 7/10 -> 10/10.
Concerns/Blockers: none blocking; one-line conflict likely in `lesson-bot-driver.test.ts` and LESSONS array when merging lessons 11-13.
