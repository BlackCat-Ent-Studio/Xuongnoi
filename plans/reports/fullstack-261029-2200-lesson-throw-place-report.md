# Lesson throw / place: implementation report

Branch feat/lesson-throw-place (worktree D:\workspace\GameBuilder-lesson-throw), not merged.

- Lesson 7 (id chores): title "7. Bot quăng thùng"; "Vừa tới" (pad) now wires to "Ném"; texts rewritten.
- New lesson 8 (id chores-place, "8. Bot đặt thùng"): lesson 7 solved + touch(crate, pad) AND sequence-finished -> win. Steps: intro, play, stop, delete Ném wire, wire Thả, play, win, done. Registered after lesson 7.
- Old lessons 8-14 renumbered 9-15 (titles, boardNames, test assertions). job1-lesson7.mjs (git-ignored folder, so not committed) was edited in the worktree copy only.
- Tests (lessons.test.ts): lesson 7 sim: crate thrown beyond x>5.5, still wins, bot home. Lesson 8: step walk-through, registration/numbering 1..15, Ném = no win in 40s, Thả = crate |x-4.5|<1 not held, win, bot home.
- Gates: vitest 727/727 pass, tsc clean, build OK. Playwright on port 5186: menu lists 15 lessons in order; server stopped.
- Commits: c65b223 feat(tutorial) lesson 7/8; b6abd60 chore(tutorial) renumber.
- Note: app/node_modules in the worktree is a junction to the main checkout's (git-ignored).

Status: DONE
