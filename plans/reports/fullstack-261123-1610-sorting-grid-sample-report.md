# Sample "Xưởng phân loại kiện hàng (đang dựng: sàn lưới)" — finishing report

- Worktree `D:\workspace\GameBuilder-sample`, branch `feat/sorting-grid-sample`, head **67ad83a** (main merged in twice: 78c6697 at 951d1cb, 475dee0 at 67ad83a; fast-forwardable). Not merged, not pushed, not deployed.
- Shots: `plans/reports/shots-sorting-grid-sample/` (see "Screenshots").
- Rule kept: **no engine / node / world / editor / render file touched.** Diff vs main under `src/`: only `src/samples/sorting-grid-*.ts` (5 new files) and `src/io/samples.ts` (label + entry). No logic keyed on the sample's name or ids anywhere.

## What I found (state of the paused agent)

- 3 commits: sample + shape test + 300 s run test. Sample ran, but **3 committed tests were red**: `tests/io/samples.test.ts` (mode list one short), `sorting-grid-board` (catch-box stack drawn over the "Vùng thu hồi" card), `sorting-grid-run` (`tips ≥ sorted`: 57 tips for 58 sorted). Plus `sorting-factory-board` still expected the long menu label that the same branch had shortened.
- The debug files were chasing that 57 / 58. Cause found by trace: **cartons creep backwards on the tray at every start** (0 → 1.5 m/s in < 0.25 s, about 6 m/s²). Per start ≈ 4–6 cm; on long routes it added up to 359 mm of the tray's 370 mm (12 of 58 trips over 150 mm). One carton fell off while the turntable turned and landed in the right box by luck, uncounted.

## What I changed in the sample (data only)

| Change | Why | Evidence |
|---|---|---|
| Both motors: "Độ tăng tốc" 400 → 250 rpm/s (a normal motor setting) | cartons stay on the tray | worst slip while carried 359 mm → **84 mm**; 300 s: 58 sorted both ways. Tried 100 (floor locks up, 1 sorted), 120, 150, 200, 300: 250 has the smallest slip and room on both sides |
| Removed 6 wires `Bảng giữ ô."Đang chờ" → xe."Đang chờ ô"` and the robot's pin | decorative: changed nothing | 600 s with all six out: 117 sorted, 0 deadlocks; with them: 115, 0 deadlocks. With one robot parked for good the wire did not help either |
| Removed cards "Đảo ngược" + "Và" (`khong-do`, `khay-phang`) and 3 wires in the robot | decorative: "tray flat" already comes from the tilt joint's "Đã tới góc" | cut showed nothing in 45 s; after removal 300 / 900 s runs clean |
| Main-board columns moved 60 px | card under the catch-box stack | board test green |
| Camera `view: 'free'` kept (the inherited uncommitted edit) | whole deck + both stations in frame in the real app, and the user can still orbit to look under the deck | shot `10-real-app-090s.png` |

Old sample's menu label is the short one ("…(đang dựng: phần trạm)"); its test now expects that.

## What the sample contains

Main board: 44 cards, 66 wires, 3 notes. Played flat: **424 cards, 468 wires, 33 kinds of pieces** (all existing; kind count stays 81, `step-1-nodes` untouched).

| Circuit | copies | cards inside | wires inside | pins | opened settings |
|---|---|---|---|---|---|
| Sàn lưới (deck 3 × 3 holes 0.7 m at 2.6 m, 40 "Mốc sàn" with arrows) | 1 | 41 | 0 | 0 | 0 |
| Trạm nạp (table, spawner with code 1–9, "Đọc mã" + display, pusher) | 2 | 20 | 20 | 5 | 2 |
| Xe phân loại (chassis, 2 motors, marker reader, "Tìm đường trên lưới", turntable + tilt joint + tray, 3 "Bảng giá trị") | 6 | 31 | 46 | 5 | 1 |
| Ô nhận tuyến (short belt on the deck, 4 walls under the hole, zone, counter, "Đọc mã", wrong-route counter) | 9 | 13 | 8 | 2 | 1 |
| Cộng chín số | 2 | 8 | 7 | 10 | 0 |

One "Bảng giữ ô" on the main board, 4 wires per robot. Stations and robots share no wire: they meet only in the world. "Thu hồi" takes counted cartons out of the boxes (4 wires per station pair).

## Reference run (headless, as shipped, "Vật lý thật" on, 6 robots)

| | 300 s (asserted) | 900 s (reported) |
|---|---|---|
| Cartons made / reached own box / other box | 62 / **58** / 0 | 184 / **179** / 0 |
| Sorted per minute | **11.6** | **11.9** |
| Per hole 1…9 | 8 / 12 / 5 / 6 / 3 / 7 / 4 / 4 / 9 | 18 / 24 / 16 / 22 / 11 / 18 / 20 / 22 / 28 |
| On the deck floor > 1 s / on the ground outside a box | 0 / 0 | 0 / 0 |
| Deadlocks (nobody moves 20 s) / longest single standstill | 0 / 8.8 s | 0 / 8.8 s |
| Smallest gap between two chassis | 371 mm | 366 mm |
| Chassis over a hole opening / lowest chassis middle / deepest inside a solid | 0 ticks / 2.720 m (deck 2.6 + half body) / 0 mm | same |
| Tips per robot | 9 / 9 / 9 / 11 / 10 / 10 | 30 / 29 / 29 / 31 / 30 / 31 |
| Loads station 1 / 2 | 38 / 22 | 95 / 87 |
| Counters and all 14 numbers on the screen = measured truth | yes | yes |
| Same board twice, same hash | yes (d5f6c49d) | — |

Against the spike's 12.5 / min: the spike was traffic only (a "delivery" = reaching a cell). Here a delivery is a real carton pushed onto a tray, carried, tipped (2.0 s per tip, 1.2 s settle) and counted in the right box: 11.6–11.9 / min, about 5 % under. Station 1 loads more than station 2 in the first minutes (5 of 9 routes go home to station 1); it evens out by 900 s.

Merges of main:
- 78c6697 (side push, scale weight): **no change at all**, same run hash before and after.
- 475dee0 (blocks move as one body, slide rule, two lessons): the 300 s reference run is **identical** (58 sorted, same per-hole counts, same position hash d5f6c49d over robots every tick and cartons every 6th tick). But the sample's 15 s whole-state entry in `real-physics-on-baseline.json` moved **4fcec266 → ee671a3a** (that hash also covers every other entity and the cartons' rotation). Cause NOT isolated: something other than robot and carton positions (my guess: the pusher head or a carton's turn under the new slide rule); no visible outcome changed in 300 s / 900 s. The new value is in the merge commit 67ad83a, next to main's two re-recorded rows, which I kept as main has them. The off-switch entry (4b9fae3b) did not move.

Performance, ms per tick of the headless 300 s run (the tick only, not my measuring). The machine was never free of other agents' test runs, so three readings:

| run | mean | p50 | p95 | p99 | max |
|---|---|---|---|---|---|
| best (one other process running) | 6.1 | 5.8 | 8.4 | 10.1 | 103 |
| 900 s run | 7.3 | 6.8 | 11.1 | 14.3 | 54 |
| CPU "9 %" by the meter | 8.5 | 8.0 | 12.5 | 15.6 | 129 |

So p50 6–8 ms, p99 10–16 ms against a 16.7 ms frame: **close to the limit on this PC before any drawing**, and wave 2 adds cages and more cartons. A 600-tick split (taken under load, ratio only): about 60 % in the cards (424 of them), 40 % in the world step. Spike reference was 0.56 ms (traffic only, no cartons, trays, stations, boxes). Nothing I may change (engine); flagged as a concern.

## Anti-forced: every wire cut, one at a time

147 wires in the sample (46 robot + 20 station + 8 catch box + 7 adder + 66 main board). Each cut = one run (45 s; 20 s where the symptom shows at once), symptom named in the test table and asserted absent before the cut.

| Group | wires | result |
|---|---|---|
| Xe phân loại | 46 | 46 / 46 show: 20 "no robot leaves its cell", 14 "cartons end on the deck floor or on the ground", 11 "no carton reaches a box" (the turntable-power wire on a board fed with route 4 only: the one cut that needs a left-hand hole), 1 "tip counters stay at 0" |
| Trạm nạp | 20 | 20 / 20: 4 "no carton is made", 9 "no carton gets onto a tray", 2 "no carton reaches a box" (code never drawn / never put on the carton), 1 "makes cartons without end", 1 spill, 1 "at most half", 1 "load counters stay at 0", 1 "no waiting code on the screen" |
| Ô nhận tuyến | 8 | 8 / 8: belt → nothing reaches a box; counter wire → counters 0; 3 wires → every carton counted as wrong; 3 wires of the wrong-route alarm → alarm stays 0 **on a board where every box is mislabelled** |
| Cộng chín số | 7 | 7 / 7: total on the screen too small (on a board fed with route 1 only, so every link carries a number) |
| Main board, robot 1 / box 1 / everything that exists once | 22 | 22 / 22 (camera not held; two robots touch; robot 1 never leaves; robot 1 tips nothing; cartons not taken back ×5; screen numbers ×9; deck-floor alarm ×5) |
| Main board, same wires for robots 2–6 and boxes 2–9 (`GRID_CUT_ALL=1`, not in the default suite) | 44 | 44 / 44 (run once on 05c9f83: 81 / 81 tests green with the flag, 59 minutes on a loaded machine; not re-run after the last merge) |

Wires that only speak on a fault were cut on a board where the fault happens (named in each test): every box mislabelled (settings), stations pushing blind (one other wire out), one route only (two settings of the dice). Two deck-alarm wires need 150 s (without the reset the moments cartons spend falling past the deck face add up to a false "1").

**Wires that did not show and were REMOVED**: the 6 "Đang chờ ô" wires and the 3 wires around `khong-do` / `khay-phang` (table above). After removal no decorative wire is left that I know of.

## Tests

- New / changed: `tests/samples/sorting-grid-board` (7), `sorting-grid-run` (4 + 1 opt-in 900 s), `sorting-grid-cut-robot-drive` (24), `-robot-tray` (22), `-station` (20), `-main` (37; 81 with the flag), helpers `grid-sample-run.ts`, `grid-sample-cuts.ts`. Debug `zz-*` files deleted (what they found is in the run test: slip, tips ≥ sorted, per-tick geometry, p50 / p99).
- Shared files: `solid-off-unchanged.test.ts` + 1 line (the allowed one); `solid-off-baseline.json` + `"sample:sorting-factory-grid": "4b9fae3b:900"`; `real-physics-on-baseline.json` + `"…": "4fcec266:900"`; `solid-on-summary.snap.json` + 1 row. All by hand, no `-u`, **no existing entry moved** (3 guard files: 355 / 355 green).
- `tests/io/samples.test.ts`: id + mode lists gain the new sample. `sorting-factory-board`: label assertion → short label. `step-1-nodes`: unchanged (81, no new kind).
- Typecheck (`tsc --noEmit`): clean on the final tree.
- **Full vitest on the final head 67ad83a** (contains main 475dee0; `npx vitest run --testTimeout 300000`, once): **333 files = 331 passed, 2 skipped, 0 failed; 4852 tests passed, 3 skipped, 0 failed**, 2296 s (other agents' runs on the machine part of the time). The "random crate mass" flake did not show.
- Before that merge, on 05c9f83: 4813 passed, 1 red = `tests/puzzle/level-7-decoy` running into its own 900 s limit with the CPU at 100 % from three other test runs; alone 3 / 3 green in 336 s; green in the final run. One run earlier still (3e058b4) had a red of this branch's own making: `sorting-factory-board` wanted the long menu label; fixed.
- After the last merge, re-run by themselves: 3 hash guards, `tests/io/samples`, `sorting-factory-board`, `sorting-grid-board`, `-run` (with 900 s), the 4 cut files: all green.

## Screenshots (looked at all of mine)

Mine, final data: `01-start-whole-deck`, `02-60s-whole-deck`, `03-300s-whole-deck`, `04-60s-station-1-close`, `05-60s-hole-5-close`, `06-60s-under-the-deck`, `07-300s-from-above` (scene harness, exact ticks, software GL) and `10-real-app-editing / -003s / -090s` (real app: Tệp › Bài mẫu › the entry › tab Mô phỏng › Chạy).

- Whole deck, both stations and all 6 robots in frame; red wash on held cells; numbered cartons on trays; "Không có gì cần sửa"; HUD: 9 route counters left, 3 totals right, 2 waiting codes bottom left. 0 wrong, 0 on the floor in every shot.
- Ugly / plain: (1) under the deck the nine catch boxes are plain dark cubes and the two station bases plain grey blocks (stand-ins, below); (2) marker numbers of the far rows are small and partly hidden behind the hole trims in the default view; (3) in the harness framing the top half of the picture is empty (the real app frames better); (4) cartons with a mass show the yellow "N kg" tag next to the number (known M1a choice).
- NOT mine, stale: `00-start`, `01-menu*`, `02-main-board`, `02-opened`, `03…07-inside-*`, `10…15-play-*` were left by the paused agent and show the board BEFORE my changes (robot circuit had 2 more cards, 5 wires per robot). I did not delete them.

## Gaps and stand-ins (for the user to decide)

| Item | What stands in / what is missing |
|---|---|
| Catch box under each hole | 4 plain blocks + zone + counter; "Thu hồi" removes counted cartons. Wave 2 replaces it with the roll cage (`container`). No lower level, no tugs, no docks (not this task) |
| Tray cannot reach the hole from the lane cell (cell 1.4 m, hole 0.7 m) | a 0.55 m belt block on the deck between stop cell and hole carries the tipped carton in. General piece, but it is a small conveyor at every hole; a real tilt-tray robot would stop at the hole's edge |
| Cartons slide on the tray under hard acceleration | real behaviour of "Vật lý thật"; handled with the motor's acceleration setting. No piece exists to make a tray with a rim (a "Thanh nối" is a flat plate), so the margin is tuning, not shape |
| A robot never falls in the shipped run | by routes only (0 ticks over a hole). The "really falls" rule is tested in main's own deck tests, not exercised here |
| Catch-box counter | counts "a carton came in while the zone was empty or not" by the zone's "Khi đối tượng vào"; with "Thu hồi" cut, a second carton arriving while one still lies there is missed (seen in the cut runs: total 4 for 7). With recall on, counters = truth over 900 s |
| "Đang chờ" output of "Bảng giữ ô" + "Tránh ô bị giữ" of "Tìm đường trên lưới" | not used by this sample: on this 7 × 7 layout it bought nothing in 600 s. Pieces unchanged |

## Not verified

- Real GPU and real-time speed: pictures are software GL (swiftshader), where the app ran at about half speed (7 sorted after 90 s of wall clock, 49 after 420 s on a loaded machine). No timing claim for a real machine beyond the ms / tick numbers.
- No pixel compare; no phone / small window; dark theme not looked at.
- Editing the sample by hand in the editor (opening a copy, changing a route table) was not driven in a browser; only "opens with nothing in Việc cần sửa" and save / load round trip are tested.
- Runs longer than 900 s.
- Playwright: not installed in the project; `playwright-core` was installed into the session scratchpad and pointed at the already present chromium-1248. A context hook blocked two of my shell commands that named a dependency folder (listing / reading a package file); I did not retry them and did not need them.

## Unresolved questions

1. Keep the short belt at every hole, or should a later wave move the stop point so the tray tips straight into the hole (needs a tray that reaches ≥ 0.7 m, or a smaller cell)?
2. Full suite time. My three full runs took 1934 s, 2802 s and 2296 s, all while other agents' suites ran on the same machine (main's last quiet run: 562 s), so I have no clean number. The four cut files are 103 short runs (about 20 CPU-minutes when the machine is free, 11 minutes per file when it is not). Keep them in the default suite, or move them behind a flag like the 900 s run?
3. Stale shots of the paused agent in the shots folder: delete?
