# Course pack A report

Branch feat/course-a, worktree D:\workspace\GameBuilder-course-a, commit 4bc773b.

## Lessons (registered only in course-pack-a.ts)

| id | chapter | steps | game | teaches |
|---|---|---|---|---|
| secret-door "Cửa bí mật" | Làm quen | 9 | Door opens at start, slams shut once hero leaves the room zone; touch flag = win | Khi bắt đầu -> Ẩn đi; Cảm biến vùng "Có ai trong vùng" -> Không -> Hiện lại |
| chase-game "Trò đuổi bắt" | Bot | 10 | Red bot chases (touch = lose), green bot flees (touch = win) | Đuổi theo / Tránh xa both modes, "Khoảng bắt được" = 0.8 (Nâng cao), 3-wire steps |
| collider-gravity "Va chạm và trọng lực" | Thế giới | 12 | Carry a big crate up to a floating pad | touch "Tính khi nào" = A nằm trọn trong B, "Chạm bao lâu mới tính", Nâng cao: hero Hệ số trọng lực 0.3, crate gravity 0, Cỡ vùng va chạm 1x1x1 |
| conveyor "Băng chuyền" | Thế giới | 12 | 3 green + 1 red crate on a platform | Kiểu dáng Băng chuyền, Nâng cao "Hướng băng chuyền" = Ngược trục X, key -> Đảo chiều, zone filter Đồ vật, "Chỉ tính loại hàng" = xanh, "Ít nhất bao nhiêu vật" = 3 |

Advanced-param steps point at the property row, the node and the ".pn-adv-h" heading (so the folded "Nâng cao" pulses); text tells the user to open it.

## Files
New (app/src/tutorial): lesson-secret-door.ts, lesson-chase-game.ts, lesson-collider-gravity.ts, lesson-conveyor.ts, lesson-param-step.ts (shared paramStep/allOf helpers), text-vi-course-a.ts. Edited: course-pack-a.ts. Tests: tests/tutorial/course-pack-a.test.ts (30 tests).
Also edited tests/tutorial/lesson-camera-portals.test.ts: it hard-coded the title "14. Máy quay và cổng", broke as soon as any new lesson shifts numbering; now compares lessonName(). Packs B/C/D will hit the same failure; same one-line fix, merge may conflict on that test only.

## Tests
- Per lesson: registered in chapter, plain title, starter board valid, no check true on the starter board, solver applies each intended edit and steps advance in order to "done", targets non-empty.
- Headless play: secret-door (blocked without wiring; opens, slams, wins), chase-game (red catches idle player = lose; green flees, red trails, player wins), collider-gravity (full carry-jump-drop wins; each of collider/crate gravity/hero gravity reverted = no win), conveyor (plain platform = nothing; belt wins; minCount 4 = no win; key reverse sends crate right).
- Gates in app/: full vitest 1164/1165 before the camera-portals fix (the 1 failure was that title), then tests/tutorial 102/102; tsc --noEmit clean; npm run build green (existing chunk-size warning only).

## Browser (Playwright, port 5211, server stopped)
Shots in D:\workspace\GameBuilder\plans\reports\shots-course-a\: 00-menu-chapters, <id>-1-intro and <id>-2-mid for all 4, secret-door-3-playing/4-done, conveyor-3-advanced-open (Nâng cao heading + row highlighted), conveyor-4-done.
secret-door and conveyor walked through the real UI (drag nodes, wires, selects, advanced section, inputs) to the win and last step. chase-game and collider-gravity: menu + first steps in UI only; their full flow is covered headless. 0 console errors.
Note: the lesson menu is not wide enough to show all chapters in one screenshot (scrolls); chapters Làm quen/Đồ vật/Bot visible.

## Findings
- Setting params while playing is ignored by the editor (live note), tests must stop play first.
- grab reach is 3D distance (1.2) so the crate lesson text says "đứng cạnh thùng".
- node_modules junction left in D:\workspace\GameBuilder-course-a\app (gitignored).

Status: DONE_WITH_CONCERNS
Summary: 4 lessons + tests + helpers committed, all gates green, 2 lessons fully walked in browser, other 2 verified to the first steps.
Concerns: (1) camera-portals test edit may conflict with other packs (same fix). (2) chase-game/collider-gravity not walked to the end in the real browser. (3) collider-gravity is the hardest to play by hand (jump + drop timing, ~1s window); tuned headless only.
