# Lessons dock + launchpad (agent H, branch feat/ui-lessons-dock, commit 5bfacdf)

## Done
- Tutorial UI now lives in the bottom dock `#dock-lessons`: lesson list with progress ticks (left), step card (right) with segmented bar, step text, "Chỉ cho tôi", Quay lại, Bước tiếp, Thoát bài. Idle state when no lesson runs. Floating `.tut-panel` removed (old CSS rules left in style.css, now unused; A owns that file).
- Controller logic untouched (runner, checks, stash, storage). New deps `onStart` (app opens bottom dock on Bài học tab via `bottomDock.select('lessons')` + `layout.ensureBottomOpen()`) and `revealPaletteItem`.
- `Tutorial` API: `panel` replaced by `dock` (mounted into `#dock-lessons`), added `startFirst()`.
- Bước tiếp on an auto-advancing step is labelled "Bỏ qua bước" (old separate skip link merged).
- `palette.reveal(kind)` (clears search, expands the category). `createPalette` now returns `PaletteElement`. Controller reveals once per step change and on "Chỉ cho tôi"; app callback also selects the Khối tab and expands a collapsed left dock.
- Highlighter now scrolls palette/props targets with `block: 'center'` (the old `nearest` left the item under the sticky category header, which made dragging fail).
- Fix found by the e2e run: on "Quay lại sửa" steps the target was the disabled Chơi button. While playing, `[data-tut="play"]` targets now resolve to `.pbtn.stop`. Stale text "nút Sửa" changed to "nút Dừng" in tutorial strings.
- `editor/launchpad.ts`: centred card on the wiring canvas when 0 nodes, no tutorial, not playing. Học từ đầu (lesson 1), Mở game mẫu (samples inline, loads via app `loadBoard`), Tự làm (dismiss + show palette). Reappears after any board load that is empty.
- app.ts diff: one import, one callback block, one mount block (about 30 lines).
- Files: `tutorial/{controller,panel,highlight,palette-targets,dock-text-vi,lessons-dock.css}`, `editor/{launchpad,palette,app}`, text fixes in `tutorial/*`, test `tests/tutorial/palette-targets.test.ts`.

## Verified
- vitest 695 pass, `tsc --noEmit` clean, `npm run build` ok.
- Playwright (`plans/browser-scripts/tut-dock-e2e.mjs`, port 5179, 1440x900): launchpad on empty board, Học từ đầu starts lesson 1, lessons tab opens, lesson 1 (12 steps) and lesson 3 (14 steps) run fully through the UI incl. Quay lại / Bước tiếp, search hidden then "Chỉ cho tôi" reveals and highlights, stop button highlighted while playing, board restored, ticks, Tự làm, autosave not overwritten, 0 console errors. All PASS.
- `tut-dock-1280.mjs` at 1280x720: launchpad centred, samples inline load a sample, left dock expands on lesson start (was collapsed), highlighted palette item inside viewport, step card does not overlap the game or canvas (card sits in the bottom dock), also while playing, 0 console errors.
- Scripts written back to `plans/browser-scripts/` (`tut-common.mjs` updated for `.ld-*` selectors, lesson start via `#tab-lessons` + `.ld-item[data-lesson]`).

## Not done / notes
- Other old scripts (tut-lesson10/11, tut-l2-only etc.) still use `.tut-panel`/`.tut-progress`; not updated.
- The 3 canvas-targeted highlights (ports) do not switch the centre to the Bảng nối tab if the learner is on Màn chơi.
- Bottom dock default height is about 190px; the step card fits but tight with a 3-line explain; it scrolls. Bigger default dock is a shell decision.
- Left top-bar button "Hướng dẫn" and invite popup kept as is (menu items `[data-lesson]` also exist, so scripts must scope `.ld-item`).
- Playwright scripts place nodes by canvas offsets; at the smaller canvas some drops land off-screen, so L3 uses "Vừa màn hình" before wiring.

Status: DONE_WITH_CONCERNS
Summary: Lessons dock, launchpad, palette reveal and highlight reliability done; gates green, lessons 1 and 3 pass end to end at 1440 and overlap check passes at 1280x720.
Concerns: stale `.tut-*` CSS in style.css (agent A file); old browser scripts other than tut-common/tut-dock-e2e not migrated; dock height tight.
