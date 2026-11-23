# Course pack D report: groups + capstone-factory

Worktree D:\workspace\GameBuilder-course-d, branch feat/course-d, commit 09a27bc.

## Delivered
- `groups` "Gom nhóm mảnh ghép" (10 steps): board of two bot+Đi tới setups; select pair, Ctrl+G, rename, double-click enter, Esc exit, select group, Ctrl+D, library info step (no check, library not in snapshot), done.
- `capstone-factory` "Dự án cuối: Xưởng đóng gói" (21 steps): half-built board (belt, bot + 4 Đi tới + Chuỗi việc + Cầm/Thả toggle, 2 tagged crates, 3 zones, spawner, timer loop, Hoặc/Và gates). Learner adds Màn hình bắt đầu, wires start->timer->spawner->belt, bot next/grab, sets "Chỉ tính loại hàng" (đỏ / xanh), adds Bộ đếm (target 2), Thanh đo (max 2, rename), wires and win-lose, plays.
- Snapshot: added optional `scope` (entered group id) in types.ts + snapshot.ts (additive; controller already re-evaluates on 'selection', which setScope emits).
- Files: lesson-groups.ts, lesson-capstone-factory.ts, text-vi-course-d.ts, course-pack-d.ts, tests/tutorial/course-pack-d.test.ts (13 tests).

## Gates (in app/)
- vitest full: 85 files, 1148 tests pass. tsc clean. build OK (only chunk-size warning).
- Headless: finished capstone wins in ~7s sim time with no input; unfinished never wins; swapped goods filters never win (filter works).
- Browser (port 5214, stopped): groups lesson walked through the real UI to the end, each step advanced on its action; capstone first steps via UI drag; finished board loaded from autosave and played: start click, counter 2, bar full, "Thắng!". 0 console errors.
- Shots: D:\workspace\GameBuilder\plans\reports\shots-course-d\ (groups-1..7, capstone-1..6, capstone-5-playing-*, capstone-6-result).

## Engine gaps (not fixed, out of scope)
1. Spawner "Sinh vật thể" cannot set "Loại hàng" (tag); only Item node can. So sorted crates are two pre-placed tagged items; spawner boxes are the belt feed counted by the end-of-belt zone (3 boxes, `Và` with counter).
2. A node cannot wire to itself (timer.done -> timer.reset), so the periodic spawn uses a prebuilt Hoặc in the loop.
3. Start screen does not pause the sim: bot keeps working behind the overlay; only the spawner timer is gated by `started`.
4. Zone goods filter compares exact string (no trim); lesson check is strict too and tells learner "không thêm dấu cách".

## Notes
- Lesson numbering in menu is by registered order (now 18/19 with other packs absent).
- node_modules junction left in worktree app/ as instructed.

Status: DONE_WITH_CONCERNS
Summary: Both lessons implemented, registered in pack D, tested headless and walked in the browser; all gates green.
Concerns: engine gaps above (spawner has no goods tag; start screen does not pause); capstone is partly prebuilt (21 steps) so some earlier-learned wiring (bot walk/sequence) is given, not rebuilt.
