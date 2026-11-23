# Lesson 11 "Xúc xắc và vùng" (chance-zones) report

Branch `feat/l11`, commit 5faaa16 (worktree D:\workspace\GameBuilder-l11).

## Files
- NEW `app/src/tutorial/lessons-chance-zones.ts` (lesson, 28 steps incl. intro/done)
- NEW `app/tests/tutorial/lesson-chance-zones.test.ts` (4 tests)
- `app/src/tutorial/lessons.ts`: one import, one `createChanceZonesLesson(...)` const, appended to LESSONS
- `app/tests/tutorial/lesson-bot-driver.test.ts`: removed "is the LAST lesson" assertion (now `toContain`); it breaks whenever any lesson is appended, so merge of L12-14 would hit it too

## Design
- 2d-side board: stick+jump key, pre-placed KeyE key, hero at x=-6, floor, yellow pad (pickup) at x=0, tall grey gate at x=6, red flag at x=9.
- Steps: watch (gate blocks) -> zone -> random -> and -> wire (E pressed + zone inside -> and -> roll) -> show-number -> compare + const(5) -> latch set -> latch on -> gate hide -> play/roll -> distance (hero, flag) -> second show-number -> win-lose <- distance "within" -> play -> win.
- Default zone (center 0, size 4x3x4) already covers the pad, so no vec3 editing needed. Compare default op is already ge; distance default threshold 3 works (gate stops hero at x<=~5.2, within-3 needs x>=~6.1). Uses distance.within for win instead of touch (teaches distance).
- Winnable without frustration: seed stays 0, learner just presses E again until 5 or 6 (1/3 chance per roll); latch remembers so gate never re-closes. Text says so.
- Checks tolerant by kind/port; gate found by tall solid block, flag by red pickup, key by KeyE. Multi-wire steps hint the first missing wire.
- Both show-number rows read "Điểm": explain text tells how to rename "Tên hiển thị" (no extra step).

## Verification
- vitest 635/635 (631 + 4 new). Tests walk every step via editor-state ops; wrong-kind wire not accepted; learner board played: gate blocks running right, roll with E (fixed seed 7, retries) opens gate, run to flag = win, step -> done; E outside pad never opens gate.
- `npx tsc --noEmit -p .` clean; `npm run build` ok.
- Browser (port 5191, stopped): script with real drags/wires through all steps, rolls via E in zone (4,3,6), gate opened, hero reached flag, "Thắng!" overlay, tutorial reached final step; 0 console errors. Screenshots + script in scratchpad `...\c6588d98-...\scratchpad\l11\` (l11-00..05, tut-lesson11.mjs).
- Browser note: headless fps is low, so the script walks in short bursts + E taps. A script bug (wired latch to every block incl. floor) was found and fixed in the script, not the lesson.

## Concerns
- 28 steps vs "15-20" target; many are one-node add steps (the lesson introduces 5 nodes + and/compare/const/show-number/win-lose). Could merge add+wire pairs if wanted.
- Pre-existing lesson-bot-driver test edited (see above); controller merge may conflict if other lesson branches edit the same line.
- Zone check/hints not asserted to point at the pad; zone marker only visible while editing.

Status: DONE
