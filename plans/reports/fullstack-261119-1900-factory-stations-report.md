# Xưởng phân loại kiện hàng, part 1 (stations) — report

Worktree `D:\workspace\GameBuilder-factory`, branch `feat/factory-stations`, head `79a7d0e` (main 3acb3da merged in at 463dcc7). Not merged. Nothing in `D:\workspace\GameBuilder` touched except this report and `plans/reports/shots-factory-stations/`. Dev server 5186 stopped.
No file under `src/world`, `src/nodes`, `src/engine`, `src/editor`, `src/render`, `src/circuits` was edited. Source changes: `src/samples/sorting-factory-stations.ts`, `src/io/samples.ts` (+2 lines).

## 1. The three failing chute tests: one cause, the circuit was wrong

Measured with a tick-by-tick trace (which carton is in the zone, where it goes, how often it is moved):

- "Dịch chuyển" put every counted carton on ONE fixed spot behind the chute. It only looks for solid blocks at the destination, not for other cartons, so the cartons landed exactly on each other and stood as a column: 11 cartons, top at 2.9 m (measured at t = 27 s). The column leaned, fell, and three cartons dropped back into the chute zone at once.
- Failure 1 (85 vs 84 wrong): cartons e24, e27, e28 were moved out a SECOND time, so counted twice; a new carton (e32) was pushed out of the zone by them before its beat and never counted.
- Failure 2 (3 inside, max 2) and failure 3 (cut `dua-di.done -> dem.up`: 3 inside, max 1): the same returning cartons.
- The test expectations were right. A cage round the pile did not help (the column grew above any wall), a moving cage floor did not help (first layer slides away, the next cartons land on it and stack again), a belt into a pen jammed after 5 cartons.
- Fix (pieces only): the counted carton is put on the START of a belt behind the chute ("băng ra", `belt-frame`, 4.8 m, 1 m/s) that carries it away; the cartons line up against a stop at the far end. Measured: 17 cartons stand in one line; the 18th climbs on top. After the fix, 1 carton/s for 106 s: 105 counted (the last one still falling), 84 wrong = exactly the cartons of another colour, never 2 in the chute, nothing moved twice.
- One test condition changed, no assertion loosened: the "two a second" case now gives its stand-in cartons 6 s of life instead of 12 s (12 s x 2/s = 24 cartons stored, more than the line of 17 holds). Added: "the way out holds 16 in one line", and line / height / floor checks in the other cases.

## 2. Circuits (all palette pieces + wires)

| Circuit | Cards | Pins | Exposed settings |
|---|---|---|---|
| Trạm nạp | 43 + 1 bench floor | in `Cho nạp tiếp` (bool); out `Có kiện chờ` (bool), `Loại kiện` (colour number 1-5), `Khối lượng` (kg) | Số loại kiện (2-6), Nghỉ giữa hai kiện, Hạt giống |
| Cửa thả | 15 + 3 bench (floor, timer, spawner) | out `Số kiện`, `Kiện sai loại` | Số cửa (biển), Màu được nhận (0 = mọi màu), Chỗ gom kiện đã thả |
| Luật chia cửa | 6 | in `Loại kiện`, `Khối lượng`; out `Cửa phải tới` | Từ bao nhiêu kg trở lên là kiện nặng (4), Cửa cho kiện nặng (6) |
| Cộng sáu số | 5 | in `Số 1..6`; out `Tổng` | none |
| Chuyển tạm (thay xe) | 15 | in `Có kiện chờ`, `Cửa phải tới`; out `Vừa chuyển` | Chờ bao lâu rồi chuyển (2 s) |

Main board: 19 cards, 13 blocks visible (Khi bắt đầu, Máy quay, sàn, Trạm nạp, Luật chia cửa, Chuyển tạm, Cửa thả x6 stacked, Cộng sáu số x2 stacked, 5 Hiện số) + 3 notes. Flat graph the engine runs: 172 cards. Read-outs exist only on the main board (tested: no circuit holds Hiện số / camera / key).

Cửa thả inside: zone over the chute -> "Đọc màu" reads the first carton; a 0.3 s timer runs while something is inside; each beat "Dịch chuyển" puts that carton on the out belt and its `Khi dịch chuyển` pulse adds 1 to "Bộ đếm"; colour != "Màu được nhận" (and that setting != 0) at that pulse adds 1 to the second counter.

Sorting rule (user's layout): colour number k -> chute k (đỏ 1, vàng 2, xanh lá 3, xanh dương 4, tím 5); a carton of 4 kg OR MORE -> chute 6 whatever its colour. Pieces: So sánh (>=), 2 x Đổi thành số, Phép tính (x), Phép tính (+): `chute = colour x (heavy ? 0 : 1) + (heavy ? 6 : 0)`. Spawner classes: 5 colours at 1/2/3/2/3 kg + class 6 = red tape, 8 kg. (Class 5 was 4 kg; changed to 3 kg, otherwise every purple carton would be "heavy" under the 4 kg rule and chute 5 would stay empty.)

## 3. Tests (vitest, real runtime, "Vật lý thật" on)

`tests/samples/`: station 5, chute 6, board 10 = 21 tests, all pass.

- Station alone, 180 s: 25 made, 23 handed over, every scan = class colour, mass right, 0 dropped / slipped / overloaded.
- Chute alone: see section 1.
- Shipped board exactly as the menu gives it, nothing added, 180 s: 22 cartons made, per chute 3/4/4/4/2/3, each chute counted exactly the cartons of its class, wrong 0, screen totals = sums, 0 cartons on the floor, longest line 4.
- Determinism: two 60 s runs, same hash, same cartons, same counts.
- Rule truth table: colours 1-5 at 1 / 3.9 / 4 / 8 kg.
- Layout: the app's own spread (biggest card size) moves no card on the main board or inside any circuit. Save -> load -> save gives the same text.

Anti-forced tables (cut one wire, the named failure must show):

| Level | Wires | Groups |
|---|---|---|
| Trạm nạp (inherited) | 61 of 61 | 10 |
| Cửa thả | 14 of 14 | 5 (new: belt stands still -> column > 1.5 m, cartons on the floor) |
| Luật chia cửa | 6 of 6 | 4, by truth table |
| Chuyển tạm | 24 of 24 | chute k gets nothing, chute k+1 still does |
| Main board | 5 wires stop the factory in a named way; 3 read-out wires leave the factory running and the line at 0; the other 15 wires are checked to be of those same read-out kinds (not cut one by one) | |

Registry (first shipped sample with circuits):
- Added only: `sample:sorting-factory` in `real-physics-on-baseline.json` (30f4ae1a:900), `solid-off-baseline.json` (5018498e:900), one 23-line block in `solid-on-summary.snap.json` (typed in by hand from the test's diff; `-u` not used), one id in `SHIPS_WITH_REAL_PHYSICS`, the id in two lists of `tests/io/samples.test.ts`. `git diff --numstat` on the three baseline files: 25 added, 0 removed.
- Three tests that walk every sample assumed "no sample has circuits": `tests/io/samples.test.ts` and `tests/editor/step-break-samples.test.ts` now run `runnableGraph(board)`; `tests/circuits/circuits-save.test.ts` ("a board without circuits is written as before") skips boards that have circuits.
- Whole suite: see the last section.

Cost per tick (headless, recorded only): Trạm nạp alone 3.0 ms; Cửa thả alone with 12 cartons in line 5.6 ms; whole board 3.5 / 4.3 / 9.2 / 10.0 ms on four identical runs (the machine was shared with other test runs; budget is 16.7 ms).

## 4. GAPS (nothing was worked around in code)

1. **No piece takes an object away.** Only "Sống bao lâu" of its spawner ends a carton. So sorted cartons must be stored until then: a 4.8 m belt behind every chute, 17 cartons each. Beyond 17 the line stacks and the chute can miscount again. Smallest general addition: on "Tạo đối tượng", inputs `Vật cần thu hồi` (object) + `Thu hồi` (bool) = take back one of its own objects now. Then the chute needs no belt.
2. **"Dịch chuyển" puts an object onto another object** (it only avoids solid blocks). Cause of the three failures. Possible general addition: setting "Chỗ đến đang có đồ vật: vẫn đặt / tìm chỗ trống cạnh đó". Not needed with the belt.
3. **Trạm nạp has no pin "Đã lấy kiện"** (the task text names one). The station watches its own table with a zone and goes on when it is empty; `Cho nạp tiếp` is the outside's hold. If part 2 wants the pulse: one more out pin on `cho-giao` "Khi đối tượng ra", no new card.
4. **The stand-in does more than "clear the spot"**: it sends the carton above the chute the rule names, so the chutes count from the first carton instead of sitting idle. All pieces (zone, timer, Chọn theo số, 6 x Và, 6 x Dịch chuyển), named "Chuyển tạm (thay xe)", said in the menu label and the top note. User may prefer the plain version (question 1).
5. **The chute block is draw-only** (pass-through): no physical funnel. Dropped from above nothing escaped (106/106, 22/22). A carton thrown in sideways by a tray is NOT tested.
6. Editor (not mine to change), seen in the shots:
   - factory level: cards tidy, wires busy. The wires of the 5 hidden copies of a stacked block are still routed round the cards.
   - "Vừa màn hình" stops at 92 %: the 44 cards of Trạm nạp need "Thu nhỏ" by hand (30 % shows all).
   - the app estimates a copy card as 168 x 70; real copies are about 240-275 wide and taller, so its automatic spread cannot be trusted for copies. Laid out by hand at the "Học sinh" size.
   - a card has no own name: the 5 blocks inside Trạm nạp all read "Vật thể".
7. Lines of "Hiện số" in one corner come in engine order (Khối lượng, Màu, Cửa), not settable. Used two corners: waiting carton left, totals right.
8. 13 blocks visible on the factory level (asked: about 10). Five of them are the read-outs.
9. `solid-on-summary` row of the new sample says "sensor-without-contact x1 from 6.4s" (switch off and "Va chạm thật" on); two older rows carry the same kind of line. Not looked into.
10. One 404 for a resource in the page log (older reports have it too).

## 5. How the user opens it, and the first 60 seconds

Menu **Tệp > Bài mẫu > "Xưởng phân loại kiện hàng (đang dựng: phần trạm): trạm nạp + 6 cửa thả là bảng mạch; chưa có đội xe AGV, khối "Chuyển tạm" đưa thùng tới cửa thay xe"** (last entry). Bấm **Chạy**, then tab **Mô phỏng** for the big 3D view. Only local, branch not merged: `cd D:\workspace\GameBuilder-factory\app; npx vite --port 5186 --strictPort`.

- Board: yellow note on top says the factory is unfinished and what replaces the vehicles; two more notes on the right (station, rule).
- ~1 s: a carton with coloured tape appears at the right end of the blue belt; passes the yellow scan gate; stops at the arm.
- ~6-13 s: arm lowers, grips, lifts, swings half a turn, sets the carton on the dark table. Left of the screen: Khối lượng (kg), Màu (số), Cửa phải tới.
- 2 s later the carton leaves the table, drops into the numbered chute, appears on the long belt behind it and rides to the far end. Right of the screen: "Kiện đã vào cửa" +1, "Kiện vào sai cửa" stays 0.
- About one carton every 8 s (22 in 3 minutes). Browser shot at 90 s: 9 in the chutes, 0 wrong.

Shots (all read): `plans/reports/shots-factory-stations/` — `0-menu`, `1-factory-level` (light, dark, Học sinh), `2-inside-tram-nap` (+ `-whole` at 30 %), `3-inside-cua-tha` (+ `-whole`), `5-inside-luat-chia-cua`, `6-inside-chuyen-tam`, `4-running-board-08s`, `4-running-3d-11s..90s` (light), `-13s/-17s/-30s` (dark). Scripts: `factory-stations-shots.mjs`, `quick-level.mjs`. Card overlap check on screen: 0 on every level. Found and fixed from the shots: cards pushed apart by the app's spread, top note clipped at the Học sinh size, totals mixed with the waiting-carton lines.
Not checked: real GPU (headless SwiftShader only), the bench button "Chạy thử máy này" for these circuits in the browser, the inside views in Học sinh mode.

## 6. What the AGV fleet (part 2) needs from these stations

- Job signal: `Có kiện chờ` rising = one job; job code = `Luật chia cửa.Cửa phải tới` (valid while the carton waits; `Loại kiện` / `Khối lượng` are held from the grip to the next grip).
- Hand-over spot: a table 0.6 x 0.6 m, top 0.34 m, centre x = -1.056, z = 0 in the station frame. For the arm to set a carton straight onto a tray: the taught angles of rows 6-7 (value tables `goc-vai`, `goc-khuyu`) and the zone `cho-giao` would have to be exposed; today they are inside. Simpler: an AGV-side piece takes the carton off the table.
- `Cho nạp tiếp` can hold the arm (e.g. "an AGV is on its way").
- Chute mouth 0.94 x 0.94 m at floor level at `chutePlace(k)`: x = -3.75 + 1.5(k-1), z = -3.2. Behind each chute 5.7 m of out belt: no driving lane there. One carton at a time is safest; 2 inside at once is handled (beat 0.3 s).
- Remove the block "Chuyển tạm" and its 2 wires; nothing else depends on it.
- Each chute holds 17 sorted cartons; station cartons live 150 s.

## 7. Questions for the user

1. Khối "Chuyển tạm (thay xe)": 1a) giữ như hiện nay, thùng được đưa tới đúng cửa nên cửa đếm được ngay (đề xuất); 1b) chỉ dọn thùng khỏi bàn giao, 6 cửa đứng yên số 0 cho tới khi có xe.
2. Băng ra dài 4,8 m sau mỗi cửa (để chứa thùng đã đếm): 2a) giữ (đề xuất, không cần thêm mảnh ghép); 2b) thêm ô "Thu hồi" cho mảnh "Tạo đối tượng" để thùng biến mất sau khi đếm, cửa gọn lại (cần duyệt vì sửa mảnh ghép).
3. Loại 5 (tím) đổi từ 4 kg xuống 3 kg để không bị tính là kiện nặng: 3a) đồng ý; 3b) muốn khối lượng khác.
4. Chân "Đã lấy kiện" trên Trạm nạp: 4a) không cần, trạm tự biết bàn trống (hiện nay); 4b) thêm chân ra báo một nhịp khi thùng rời bàn.
5. Tên trong menu khá dài: 5a) giữ (nói rõ là đang dựng); 5b) rút gọn còn "Xưởng phân loại kiện hàng (đang dựng: phần trạm)".

## 8. Whole suite

- `npx tsc --noEmit -p .`: clean at head.
- Whole suite, one run at `d192ede`: 292 files, 288 passed / 3 failed / 1 skipped; 4254 tests passed, 3 failed, 1 skipped; 1062 s (the machine was shared).
  - 2 of the 3 are the known load-only timeouts: `tests/puzzle/level-7-decoy` (1052 s) and `tests/io/city-delivery-3d-sample` red light (its own 180 s limit). Run again: level-7-decoy passed; city-delivery-3d failed once more while 9 other files ran beside it, then passed alone (27/27).
  - The third was mine: the card-overlap check in `sorting-factory-board.test.ts` still counted the hidden copies of a stacked block after I moved them close under the first copy. Fixed in `79a7d0e` (the check now looks at the 13 cards that are drawn); only that test file changed after the whole run.
- After that commit, run together: `tests/samples/sorting-factory-board`, `tests/editor/solid-off-unchanged`, `real-physics-on-hash`, `solid-on-invariants`, `shipped-layout`, `step-break-samples`, `tests/io/samples`, `tests/circuits/circuits-save`, `level-7-decoy`: all pass. The whole suite was NOT run a second time.

