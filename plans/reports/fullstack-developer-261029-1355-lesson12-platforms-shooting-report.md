# Lesson 12 "Bệ và bắn đạn" (`platforms-shooting`) report

Branch `feat/l12` (worktree D:\workspace\GameBuilder-l12), commit 9541de1 on bc4e7c4.

## Files
- NEW `app/src/tutorial/lessons-platforms-shooting.ts` (own helpers, no shared-file coupling)
- NEW `app/tests/tutorial/lesson-platforms-shooting.test.ts` (5 tests)
- `app/src/tutorial/lessons.ts`: +1 import, +`platformsShootingLesson` appended to LESSONS (index 10)
- `app/tests/tutorial/lesson-bot-driver.test.ts` line 48-50: "is the last lesson" asserted `LESSONS[last]`; changed to `LESSONS[9]` (would break whenever any lesson is appended; 11/13/14 agents will hit the same line -> expect trivial merge conflict, keep `LESSONS[9]`).

## Lesson (26 steps, 2d-side)
Starter: player, left bank -14..-3, pit, right bank 3..19, red target (bot, speed 0) with Máu 3 + hp display, flag (pickup) + touch -> win, fall (y<-6) -> Hoặc -> lose, unwired key J. Learner path: Bệ di chuyển + set A(-2,-0.25) / B(2,-0.25) -> ride -> Sửa -> Bắn đạn, wire hero->Người bắn, key J held->Bắn -> play, shoot 3x -> Sửa -> Sinh vật thể (pos 10.5,6,0, life 1) + toucher + touched->Hoặc.B (lose) -> Hẹn giờ 3s -> spawn -> add Hoặc, done->Hoặc.A, Hoặc->reset (self-wire is rejected `same-node`, hence the extra Hoặc) -> Bệ xoay gate (13,2,0 size .5,4,1) + Máu.dead -> turn -> play -> win -> done.
Checks tolerant (ranges, not exact): A.x -3.5..-1, B.x 1..3.5, y -0.8..0.3, spawner x 8.5..12.5 y>=3 life 0..2.5, timer 1.5..6s, gate x 9.5..16.5 base near floor, key wire held or pressed. Hit-3-times step has no sensor available (snapshot has no world), so it completes when learner presses Sửa after playing; early win by walking to flag before building gate is possible and harmless.

## Verification
- `npx vitest run`: 636 passed (631 + 5 new), 42 files.
- `npx tsc --noEmit -p .` clean; `npm run build` ok (only chunk-size warning).
- Unit test proves win via scripted input (ride platform timed to A, 3 J taps, gate turns to 90, dash after rock vanishes); with the turn wire cut the game stays unfinished; starter board w/o bridge loses by falling.
- Browser (Playwright, own Vite on 5192, stopped after): all 26 step transitions PASS via real drag/wire/param edits, lesson reached "Tới cờ rồi!" (win) on attempt, 0 console errors/warnings. First attempt lost to a rock/timing (headless fps), retry won. Screenshots/script: `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\c6588d98-de8b-47ca-8a66-fd5282a3c2b1\scratchpad\l12\` (`run-l12.mjs`, 01..09 png).

## Notes
- Step count 26 vs target 18-22: extra from Hoặc loop workaround (3 steps) and rock-lose wiring (2). Could trim by pre-placing the loop Hoặc.
- Character is a 1x1 box, so gate (4 tall at y=2) leaves bar at y 1.7..2.3 after turn; player passes under.
- Docs/HANDOFF not updated (controller merges).

Status: DONE
Summary: Lesson 12 added in its own file with test; 636 tests, tsc, build green; full browser run reached win with no console errors.
Concerns/Blockers: 26 steps (above 18-22); lesson-bot-driver.test.ts line 50 edited (will conflict trivially with other lesson branches).
