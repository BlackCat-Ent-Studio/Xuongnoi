# In-app tutorial — implementation report

Status: DONE. Not committed.

## Files
New (app/src/tutorial/): types.ts, graph-checks.ts, lessons.ts, runner.ts, storage.ts, highlight.ts, panel.ts, controller.ts, text-vi.ts.
New tests: app/tests/tutorial/lessons.test.ts, app/tests/tutorial/runner-storage.test.ts (19 tests).
Edited (minimal): editor/app.ts (create tutorial, onGameEnd/restart hooks, autosave pause, save guard, exit-before-loadBoard, stash recovery at startup), editor/top-bar.ts (`addControl`, `data-tut="play"`), editor/wiring-canvas.ts (`data-kind` on node), editor/properties-panel.ts (`data-param` on row), style.css (tutorial block appended).

## Design decisions
- Autosave: paused while a lesson is active (app.ts guard) + user's board stashed in memory and `xuong-noi:tutorial-stash`. Pausing is simplest/safest: lesson board never reaches `xuong-noi:autosave`. Stash is a reload safety net: on startup `takeStash() ?? loadAutosave()`.
- Lessons 2 and 3 start from a prebuilt board (result of the previous lesson) so each lesson is short; built via real `createNode`/`addWire`, so invalid ports throw in tests.
- Checks tolerant and pure (floor = non-pickup block size.x >= 5; wires by kind+port, star = pickup block; counter goal 1..#stars; compare op lt/le; const < 0).
- Going back holds the earlier step until "Tiếp" (else auto-advance would bounce forward).
- Extras beyond brief: "Bỏ qua bước này" link on check steps (no one gets stuck), Save blocked during a lesson, New/Open/sample during a lesson exits the lesson first, panel draggable and placed bottom-left of canvas (bottom-right covered the Properties panel's `type` row).
- Last step of each lesson is info; button reads "Hoàn thành". Progress saved on finish (✓ in menu).

## Verification
- `npx vitest run`: 12 files, 140 tests green (121 existing + 19).
- `npx tsc --noEmit -p .` clean; `npm run build` ok.
- Playwright (scripts `...\scratchpad\smoke\tut-run.mjs`, `tut-common.mjs`; shots in `...\scratchpad\tutorial\`): first-launch invite, then lessons 1 (12 steps), 2 (14, incl. Thoát mid-lesson then restart) and 3 (14, incl. real win via ArrowRight) completed purely with UI actions (drag palette, wire ports, set params, Chơi, keys). Auto-advance, highlight counts, finish status message, board restore (name + node count) after each, ✓ marks, autosave contains only the user's board, stash key cleared, zero console errors. All checks PASS.

## Notes
- Lesson 3 win step requires holding ArrowRight until the star is touched (headless game loop is slow; used polling).
- Highlight is a CSS class (.tut-hl) re-applied on state change + 300 ms poll since canvas DOM is rebuilt.

Status: DONE
Summary: Tutorial with 3 original lessons, step runner, panel, highlight, invite, stash/restore implemented; tests 140 green, tsc/build clean, lessons 1-3 completed end-to-end in a real browser.
Concerns/Blockers: none. Unresolved: none.
