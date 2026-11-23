# s-words: "game/chơi" -> "mô phỏng/chạy" in editor chrome

Branch feat/s-words (worktree D:\workspace\GameBuilder-swords), from main 15cfec5. Wording only: ids, data-tut, localStorage keys, file formats, layout, colours untouched.

## Old -> new (user-visible)

| Old | New |
|---|---|
| Game mới (default new board name, io) | Mô phỏng mới |
| Game của tôi (default board name, launchpad) | Mô phỏng của tôi |
| Học làm game (lessons menu header) | Bài học |
| menu hint "Mỗi bài có một bảng riêng. Game của bạn được giữ nguyên." | "Mỗi bài có bảng riêng. Mô phỏng của bạn không bị đổi." (shortened: longer text clipped at 844 px) |
| Cài đặt game (File menu heading + properties panel) | Cài đặt mô phỏng |
| Xem game (PiP title/aria/drop zone) | Xem mô phỏng |
| Chơi / Chơi lại (top bar, restart, result overlay) | Chạy / Chạy lại |
| Đang chơi (top bar, PiP, live chip, panel notes) | Đang chạy |
| Bắt đầu chơi / Đã dừng chơi / Chơi lại từ đầu / khi chơi lại (log) | Bắt đầu chạy / Đã dừng chạy / Chạy lại từ đầu / khi chạy lại |
| Đã mở game | Đã mở mô phỏng |
| Bấm Chơi để thử game ngay tại đây | Bấm Chạy để thử mô phỏng ngay tại đây |
| Kho game của tôi (menu, dialog, launchpad, lesson) | Kho mô phỏng của tôi |
| Tạo game mới / Tên game / Game đang mở sẽ được thay thế | Tạo mô phỏng mới / Tên mô phỏng / Mô phỏng đang mở sẽ được thay thế |
| Chưa có ... nên chưa có ai để chơi | ... nên chưa có gì để chạy |
| Màn chơi (tab, View menu, scene root, PiP dock-back, F/Esc help rows) | Mô phỏng (tab/menu), Màn mô phỏng (scene root) |
| Góc nhìn của game, Kiểu game chạy nhảy như Mario, như game đi đường | Góc nhìn của mô phỏng, Mô phỏng nhìn ngang như màn chạy nhảy, như bản đồ đi đường |
| Chơi thử game / Điều khiển chơi thử | Chạy thử mô phỏng / Điều khiển chạy thử |
| io errors (Kho game, Tên game không hợp lệ, "một game của Xưởng Nối", ...) | same with "mô phỏng" |
| Library dialog strings, group lock text, dock texts (exit/restore/"về game của bạn") | "mô phỏng" |
| Lesson/handbook/sample quoted labels: Bấm "Chơi", Chơi lại, Chơi thử, Chơi tiếp, lần Chơi sau, lúc/lần chơi (run sense) | Chạy / Chạy lại / Chạy thử / Chạy tiếp / lần chạy |

## Files (68 files, 297 lines changed, numstat == numstat -w)

- Editor chrome: editor/text-vi.ts, shell-text-vi.ts, library-text-vi.ts, console/console-text-vi.ts, panels/panels-text-vi.ts, pip/pip-text-vi.ts, scene/scene-text-vi.ts, groups/group-text-vi.ts (+ comments in top-bar.ts, properties-panel.ts, game-pip.ts, css comments), io/text-vi.ts, render/text-vi.ts (result overlay), tutorial/text-vi.ts (menu chrome), tutorial/dock-text-vi.ts.
- Quoted labels only: tutorial lesson-*.ts, lessons-*.ts, text-vi-*.ts, start-wire-steps.ts, handbook boards-*/content-*/topic-*, nodes (random, sight-forecast, ui-start, zone-sensor, camera descriptions), samples/robot-line-follow.json and robot-arm-board.ts notes, app-contracts.ts comments.
- Tests: tests/io/game-library.test.ts, tests/io/save-roundtrip.test.ts (expected strings), NEW tests/editor/chrome-wording.test.ts (all chrome tables contain no "game" and no run-sense "chơi"; allow-list = IO_TEXT.fallbackFileName).

## Left on purpose

- puzzle app (src/puzzle/**, "Chơi giải đố" menu link): it is a game.
- Node names/ports/param labels (e.g. "Tên game" on the Màn hình mở đầu node, "Bấm để chơi" start button default text) and "Người chơi" (character role, scene role, palette synonyms).
- Lesson/handbook BODY prose saying "game" / "trò chơi" (e.g. "game báo thắng", "Game được làm từ các mảnh ghép"), node descriptions saying "game"/"trò chơi" (win-lose "Kết thúc trò chơi"): body text, not quoted labels. Candidate for a later pass.
- Archived sample samples/city-delivery.json notes ("khi chơi", "luật chơi").
- io fallbackFileName 'game' (download file name when board name is empty), palette search synonym "hết game", code identifiers/comments (GameView, game-box, tab-game, icon 'game').
- Win/lose piece texts (Thắng/Thua).
- Phone 844 px: default name "Mô phỏng mới" shows as "Mô phỏn…" (name box is a fixed 90 px at <=1100 px; a long user name truncates the same way). The "Hướng dẫn" button overlapping the play group at 844 px is pre-existing (same with "Game mới").

## Verification

- `npx tsc --noEmit -p .`: clean.
- Full vitest (--testTimeout 300000): 3119 pass, 3 fail. (1) save-roundtrip "rejects bad mode" expected old "Kiểu game": fixed, rerun green. (2) tests/puzzle/level-7-decoy and (3) tests/io/city-delivery-3d-sample "red light" hit the timeout under machine load; both are untouched by this change (puzzle/archived sample). level-7 rerun alone with 600 s timeout was still running at hand-back (not confirmed green). All baseline tests (sample/lesson/handbook hashes) passed.
- Commit f2310b1 on feat/s-words.
- Playwright on :5271 at 1440x900 and 844x390: shots in D:\workspace\GameBuilder\plans\reports\shots-s-words\ (01 edit, 02 topbar edit, 03/04 running, 05 Tệp menu, 06 new dialog, 07 lessons menu, 08 lesson step "Bấm nút "Chạy" để bot bắt đầu đi"; props panel "Cài đặt mô phỏng" and PiP "Xem mô phỏng" visible in 01/03). Read and checked. Only console error: one 404 (static asset, not from this change).
- Dev server left running: http://localhost:5271/

## NOT verified

- Baselines/script-check are the vitest baseline tests (solid-off-baseline etc.); result in the final status. Sample notes were edited (robot-line-follow.json, robot-arm-board.ts): if a hash test covers notes it would show in the vitest run.
- Did not click through every lesson to confirm each quoted label; done by grep (no "Chơi" quote left outside puzzle/archive).
- Handbook UI pages not screenshotted.
