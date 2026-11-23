# Course pack C report

Worktree D:\workspace\GameBuilder-course-c, branch feat/course-c, commit 2a3dbb3.

## Lessons (chapter "Số và giao diện", registered only via course-pack-c.ts)

| id | steps | board and goal |
|---|---|---|
| health-color | 18 | turret bot shoots player every 2s (timer+Hoặc loop, Bắn đạn prebuilt). Learner: Máu (maxHp 3) -> Đổi thang số (0-3 to 0-100) -> Thanh đo; Máu -> Chọn theo số "Là 1" -> Hiện chữ warning; Hết máu -> Thua. Ends on lose. |
| start-screen | 12 | hero, tall brown door, star (goal prebuilt). Learner: Màn hình bắt đầu (title), Nút trên màn hình (text) -> door Ẩn đi, Hẹn giờ 20s run <- Đã bắt đầu, Hết giờ -> Thua. Ends on win. |
| ask-dialog | 12 | hero, bot NPC, gate, star. Learner: Cảm biến chạm (hero, bot) Vừa chạm -> Hộp hỏi; Chọn 1 -> gate Ẩn đi, Chọn 2 -> Thua. Ends on win. |

Files (all in app/): src/tutorial/lesson-health-color.ts, lesson-start-screen.ts, lesson-ask-dialog.ts, course-c-shared.ts, text-vi-course-c.ts, course-pack-c.ts (edited); tests/tutorial/course-pack-c.test.ts (17 tests).

## Verification
- `npx vitest run --testTimeout 120000`: 85 files, 1152 tests pass. `tsc --noEmit` clean. `npm run build` ok (only chunk size warning).
- Headless tests: starter valid, no check true before its edit, every step advances in order after intended edit, wrong value/wire does not advance, final boards simulated: health bar 100/67/33 + warning appears at 1 hp + lose; start clock frozen until start click, door blocks until button, then win; countdown loses; ask: touch bot -> dialog, answer 1 opens gate and star wins, answer 2 loses.
- Browser (Playwright, port 5213, server stopped): all three lessons walked through real UI by drag/wire/param edits, each step number matched, health-color played to the final step; 0 console errors in all runs. Shots: D:\workspace\GameBuilder\plans\reports\shots-course-c\ (health-color-1..5, start-screen-1..2, ask-dialog-1..2).

## Notes
- Brief said "Đổi khoảng số"; the real node label is "Đổi thang số", texts use that.
- Gate for start-screen is the clock (run port); game keeps running behind the start overlay and number ports (stick) cannot be gated by a bool, so the hero can still move before the start click. Engine limitation, not a bug.
- Starter touch nodes use mode "Tâm A vào trong B" so the lesson can tell the board's own goal sensor from the one the learner adds.
- ask-dialog screenshot 2 was taken in the small preview; the dialog overlay itself is covered by the headless test, not seen in a shot.
- node_modules junction left in D:\workspace\GameBuilder-course-c\app (untracked, ignored).

Status: DONE_WITH_CONCERNS
Summary: 3 lessons implemented, tested, browser-walked, committed.
Concerns: dialog overlay not captured in a screenshot; hero can move before pressing start (engine design).
