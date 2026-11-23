# Lesson 13 "Máy quay và cổng" (camera-portals) — report

Branch `feat/l13` (worktree `D:\workspace\GameBuilder-l13`), commit f8a0d46, from bc4e7c4.

## Files
- NEW `app/src/tutorial/lessons-camera-portals.ts` — `createCameraPortalsLesson(kit)`, id `camera-portals`, 24 steps, own text table.
- NEW `app/tests/tutorial/lesson-camera-portals.test.ts` — 3 tests.
- `app/src/tutorial/lessons.ts` — one import, one const, appended to LESSONS (+3/-1).
- `app/tests/tutorial/lesson-bot-driver.test.ts` — one assertion: "bot-driver is last lesson" -> `LESSONS` contains it (otherwise fails once any later lesson exists; other lesson branches will likely need the same, trivial merge).

## Design
Board (2d-side): hero + arrows/Space prewired, cliff (x -12..4), pit floor, island (x 17..31), green pickup flag at x 27.
Steps: intro, try jump, edit, add 2 portals, move one to X=22, pair (partner wire either direction OR same pair code), play through, edit, Khoảng cách (hero/flag, threshold >= 6 -> 8), Máy quay (on <- within, zoom >= 1.4 -> 1.8), shake <- portal.used, Phím R, Dịch chuyển (who, go<-R pressed, position x <= -4 -> -8), Cảm biến chạm + Thắng/Thua, wires, play, win, done.
Camera is off when far from the flag (default follow) and zooms near it; teleport home via R.

## Verification
- `npx vitest run`: 634 pass (631 + 3). `npx tsc --noEmit -p .` clean. `npm run build` ok.
- Test plays the learner-built board in a real world: crosses via portal (x>=20), camera command shows shake>0 and zoom>=1.8, R returns hero to x<-6, then walks to flag -> win; lesson reaches 'done'. Pair-by-code path tested.
- Browser (port 5193, stopped): full lesson scripted through real UI drag/wire/params, all 24 steps advance correctly, ends at "Bạn qua vực rồi!", console clean (no errors/warnings). Screenshots: `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\c6588d98-de8b-47ca-8a66-fd5282a3c2b1\scratchpad\l13\` (01-start, 04-play-mid, 05-play-zoom shows zoomed win, 06-end; script run-l13.mjs).

## Notes
- Shake frames not eyeballed in browser (win lands ~4s, shake ~0.5s after portal); covered by test (shake>0 observed).
- Step count 24 (above the 15-20 target) because each wire/param is its own guided step; several merged already.
- Merge: lessons.ts LESSONS array line and lesson-bot-driver test line will conflict with other lesson branches; resolve by union.

Status: DONE
Summary: Lesson 13 added in its own file with a test that plays the learner-built board to a win; browser run of all 24 steps clean.
Concerns/Blockers: trivial merge conflicts expected in lessons.ts LESSONS array and the bot-driver test assertion.
