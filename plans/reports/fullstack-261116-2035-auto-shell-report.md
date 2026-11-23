# Auto-shell report (feat/auto-shell, from main deb9fe2, port :5263)

## What changed
A. One 2D button (src/editor/top-bar.ts, view-switch.ts, shell-text-vi.ts, menu.css)
- Top bar now `[2D] [3D]` (same `.seg` / `.seg-opt` look). Next to it a small `select.sel-ui.sub2d` (the layout-select look) "Nhìn ngang / Nhìn từ trên"; on width <= 1180 it shows only the glyph (↔ / ↓) so the bar does not grow. It is hidden while the board is 3D.
- 2D button returns to the last 2D view; remembered in the top bar (derived from the board's mode, reset to "ngang" when another board is loaded). No new saved field. ViewMode type, engine, saved files untouched.
- Pure logic in `src/editor/view-switch.ts` (viewKindOf / remember2d / modeForKind).
- Arrow keys on the control still work (2 items). `data-tut` hooks: old buttons had none; new ones `view-2d`, `view-3d`, `view-2d-kind`. No lesson text mentioned "bấm 2D ngang", so no lesson selectors needed change. Removed now-dead `.seg-full/.seg-short` CSS and the `modeFull/modeShort` texts.
- New boards default to 3D: first-run/fallback board in app.ts is `createEmptyBoard('3d')`; new-game dialog order 3D, 2D nhìn ngang, 2D nhìn từ trên, 3D focused first. "Tạo game mới" from the Chơi-lại path still keeps the current mode (unchanged).

B. Samples (src/io/samples.ts, index.ts)
- `listSamples()` = menu list = `robot-line-follow`, `robot-arm` (one line per sample, append to `SAMPLES`).
- `listArchivedSamples()` = the 16 game samples (files and tests kept); `listAllSamples()` = archived + menu in the ORIGINAL order.
- Tests that iterate / look up samples by id switched to `listAllSamples` (19 test files, mechanical rename). New assertion in samples.test.ts for the two lists.
- Wording: Tệp → "Bài mẫu" (was "Mở game mẫu"), launchpad "Mở bài mẫu" / "Chọn một bài mẫu" / "Chưa có bài mẫu", hint "Mở một máy đã nối sẵn", error text "Bài mẫu ... bị hỏng".

C. Lessons (src/tutorial/course.ts, controller.ts)
- Order: Làm quen, Robot, Đồ vật, Bot tự động, Thế giới, Xe cộ, Giao hàng, Số và giao diện, Dự án tổng hợp, then archived "Đánh nhau" (combat, platforms-shooting) at the end.
- `Chapter.archived?: boolean`, `isArchivedLesson(id)`. Controller menu + lessons dock list + counts skip archived lessons (menu shows 0/39 instead of 41); `startLesson(id)` and LESSONS still include them, so tests and coverage are unchanged. Numbers run 1..N with archived ones last.
- Lesson ids unchanged, so saved ✓ marks survive (tests added).
- Lesson texts edited (only where they pointed at samples that left the menu): `lessons-vehicles.ts` final step, `text-vi.ts` bot lesson final step ("Hãy thử hai game mẫu Lính gác..."), `lesson-robot-arm.ts` ("game mẫu" -> "bài mẫu"). Archived lessons' texts (combat, platforms-shooting) left as is.
- Lessons menu header "Học làm game" left as is (as instructed).

## Files
src/editor/{top-bar,view-switch(new),shell-text-vi,text-vi,new-game-dialog,app}.ts, src/editor/menu/menu.css, src/io/{samples,index}.ts, src/tutorial/{course,controller,dock-text-vi,text-vi,lessons-vehicles,lesson-robot-arm}.ts; tests: new tests/editor/view-switch.test.ts, tests/tutorial/course-order.test.ts; edited tests/io/samples.test.ts + 18 other tests (listSamples -> listAllSamples).

## Tests
- tsc --noEmit clean. Line endings preserved (numstat == numstat -w).
- Focused: view-switch, course-order, course-coverage, samples: 56 passed.
- Full vitest (once, --testTimeout 300000): 3027 passed, 1 failed = solid-on-invariants 'summary table' snapshot. Cause: that table lists lessons in LESSONS order, which the chapter reorder changed. Updated `tests/editor/solid-on-summary.snap.json`; checked against `git show deb9fe2:`: 126 entries before and after, 0 removed, 0 changed, 0 added (order only). The file re-run alone: 127/127 pass.

## Playwright (:5263; BEFORE from :5256 = main)
Shots in plans/reports/shots-auto-shell/: 00-before-*, 10/11 fresh 3D, 12 2D ngang, 13 2D trên, 20 Bài mẫu menu, 30 new-game dialog, 40 lessons menu (desktop 1440x900 and phone 844x390). Script: plans/browser-scripts/auto-shell-check.mjs. Verified by script: fresh board is 3D; 2D click -> 2D; sub-switch top -> 2d-top; 3D then 2D returns to top; ArrowRight moves to 3D; Tệp → Bài mẫu lists only the 2 robot samples; new-game order 3D first and focused; chapter order as above.

## NOT verified
- The native dropdown popup of the sub-switch (the OS select list is not captured by screenshots); only its closed state with each value.
- Phone-landscape top bar: the Chơi / Hướng dẫn buttons already overlapped on main at 844 px (see 00-before-phone); the new control does not make it worse but does not fix it either.
- Touch behaviour of the select on a real phone.
- Console shows 2 "404" resource errors on load (logged across main and this port; not investigated).
- Lessons were not played through in the browser after the reorder (unit tests only).
