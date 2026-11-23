# Grid floor pieces: arrows on "Mốc sàn", "Tìm đường trên lưới", "Bảng giữ ô"

Date 2026-11-23 · worktree `D:\workspace\GameBuilder-grid` · branch `feat/grid-route` (base main 0d273e9, 5 commits, head 56a724f, working tree clean) · NOT merged, main NOT merged in (no sibling had landed / I was not told to).
Dev server LEFT RUNNING on http://localhost:5333 .

## Short answer

- Built: arrows on "Mốc sàn" (opt-in, drawn on the tile), marker numbers to 999, marker readers pick the tile nearest in height, 2 NEW kinds (`grid-route`, `cell-hold`). Kinds on this branch: **79** (main 77 + 2).
- Right of way is ONE kind, one card on the main board ("Bảng giữ ô"), no per-robot asker card, no hidden table: the table is the card's own state, every robot reaches it through 4 wires (5 with the arrival signal).
- With the robot as ONE CIRCUIT copied x N and real pieces: 2 / 4 / 6 / 8 robots x 900 s = 5.07 / 9.73 / 12.53 / 13.80 deliveries/min (spike A2 tuned: 5.00 / 9.53 / 12.53 / 13.53), 0 deadlocks, smallest chassis gap 367-381 mm, never in a hole cell, stop error max 23 mm, same seed twice = same hash.
- Old boards: both hash guards green with only my 2 new named entries; 3 existing marker boards compared main :5173 against branch :5333 = 0 differing pixels.

## Pieces as built

### "Mốc sàn" `floor-marker` (changed)
| What | Detail |
|---|---|
| New setting `exits` "Mũi tên chiều đi (vẽ trên ô)" | select, default "Không có mũi tên". Choices: → +x, ← -x, ↓ +z, ↑ -z, 4 turn pairs (→↓ →↑ ←↓ ←↑), "đi hướng nào cũng được". Stored as letters E W S N (any mix is read, the list offers 10). Create-only. |
| How it travels | on the tile entity as block style `marker-exits:<letters>`; a marker without arrows has NO block style, so its entity view has exactly the old fields (tested) |
| Drawing | one extra flat mesh in the marker colour: arrow from near the ring toward each exit edge. Not drawn in the side view. No arrows = the same 2 (+ number) meshes as before |
| Number | 1-999 (was 1-99); 3 digits drawn smaller |
| Readers | "Đọc mốc sàn" compares tiles with the FEET of the object: nearest tile in height first, then nearest middle (not a tolerance). `markerUnder` without a height answers as before |

### "Tìm đường trên lưới" `grid-route` (new, group Tính toán)
| Port | Type | Label |
|---|---|---|
| in `at` | number, required | Ô đang đứng |
| in `goal` | number | Ô đích |
| in `avoid` | bool | Tránh ô bị giữ |
| out `next` | number | Ô kế tiếp |
| out `hasNext` | bool | Còn phải đi |
| out `steps` | number | Số ô còn lại |

Setting: `detourAfter` "Chờ quá bao lâu thì đổi lối ra (giây; 0 = không bao giờ đổi)", default 3.
Lanes = arrows of the markers in the world: an arrow leads to the nearest marker ahead within the tile's width, on the same floor (height within 0.3 m). No rows / cols anywhere. Breadth first. At the goal, no goal, or no way: `next` = the cell it stands on. `hasNext` = there is a goal and the robot is not on it.

### "Bảng giữ ô" `cell-hold` (new, group Bộ não), one card for the fleet
| Port (k = 1..Số robot, max 12) | Type | Label |
|---|---|---|
| in `robotK` | object | Robot k |
| in `wantK` | number, read one tick late (loop cut here) | Ô robot k muốn tới |
| out `cellK` | number | Ô robot k được đi |
| out `waitK` | bool | Robot k đang chờ ô |
| out `stoodK` | bool | Robot k đứng giữa ô |
| out `held` | number | Số ô đang bị giữ |

Settings: `robots` Số robot (1-12, default 2) · `flow` "Đi thẳng thì xin ô kế tiếp sớm" (Có / Không, default Có = A2) · `arriveWithin` "Coi như đứng giữa ô khi còn cách (m)" 0.06 · `heldColor` "Màu ô đang bị giữ" (red).
Rule as built (the spike's): a robot holds every cell its body lies on (its own floor only) plus the one it was last cleared for; cleared when nobody else holds the cell; may ask from the middle of its cell, or, going straight, from inside it; two asks for one cell on one tick: lower row wins. Held tiles are repainted in the held colour and get their colour back when let go.

**Why one kind, not board + asker:** an asker card per robot would have to reach the board by something other than number / bool wires (a shared table keyed by an id), which is exactly the hidden sharing the user ruled out. With one card all of it is plain wires, the tie-break is visible (row number), and it is one page to teach.

**Learner trap G7 ("Đã tới" one tick old): solved without touching `robot-goto`.** Nothing in the design reads "Đã tới". The card measures the robot itself; `stoodK` is on only while the robot stands still (< 0.05 m/s) within `arriveWithin` of the middle of its cleared cell, and goes off in the same tick the cleared cell changes (tested per tick). "Arrived at the goal" = `stoodK` AND NOT "Còn phải đi". The test stand-in and the demo circuit use only these two signals: stop error max 23 mm over 1 245 stops, 0 early goal changes in the demo.

## What the learner wires

Robot circuit "Xe trên lưới" (8 cards, 9 inner wires, 7 pins; shipped as `gridBotCircuit()` in `src/handbook/boards-grid-floor.ts`, the traffic tests run THIS circuit):

```
 pins in                                                             pins out
 Ô đích ─────────────────────────▶ Ô đích ┐
 [Thân robot]─Đối tượng─┬▶ [Đọc mốc sàn]─Số mốc─▶ Ô đang đứng [Tìm đường trên lưới]─Ô kế tiếp──▶ Ô muốn tới
                        │                              ▲ Tránh ô bị giữ          └─Còn phải đi─▶ Còn phải đi
 Đang chờ ô ────────────┼──────────────────────────────┘        (Đọc mốc sàn Số mốc ───────────▶ Ô đang đứng)
                        ├▶ Robot [Đi tới điểm] ─Trái─▶ [Động cơ trái]     Thân robot Đối tượng ─▶ Robot
 Ô được đi ─▶ [Tìm mốc sàn]─Mốc─▶ Đích   │      ─Phải─▶ [Động cơ phải]
 [Khi bắt đầu]─Đã bắt đầu────────▶ Chạy  ┘   (Thân robot → Thân của hai Động cơ)
```

Main board (N copies, drawn for 2):

```
 [Sàn: các Mốc sàn có mũi tên]
                                 ┌──────── Bảng giữ ô ────────┐
 [Xe 1] Robot ──────────────────▶│ Robot 1      Ô robot 1 được đi │──▶ [Xe 1] Ô được đi
 [Xe 1] Ô muốn tới ─────────────▶│ Ô robot 1    Robot 1 đang chờ ô│──▶ [Xe 1] Đang chờ ô
                                 │  muốn tới    Robot 1 đứng giữa ô│──▶ (đổ hàng / chọn đích mới)
 [Xe 2] Robot ──────────────────▶│ Robot 2      Ô robot 2 được đi │──▶ [Xe 2] Ô được đi
 [Xe 2] Ô muốn tới ─────────────▶│ Ô robot 2    ...               │
                                 │              Số ô đang bị giữ  │──▶ [Hiện số]
 (ô đích của từng xe: trạm / bảng / số) ──▶ [Xe k] Ô đích          └─────────────
```

Per robot across the circuit border: 2 wires in, 2 out (+1 for "đứng giữa ô"). Deviation from the spike sketch: "Ô đang đứng" of the route comes from the robot's OWN "Đọc mốc sàn", not from the hold card, because a pin feeds one inner port only; behaviour is the same (measured below).

## Runs (vitest, "Vật lý thật" on, 7 x 7 cells, cell 1.4 m, tuned drive power 0.8 / slow-down 0.6, seed 20261122, robot = circuit copied x N, stand-in `x-grid-jobs` plays stations 1.85 s and tipping 1.5 s)

| Robots | Deliveries/min (spike A2 tuned) | Deadlocks (floor still 20 s) | Longest standstill | Smallest gap | Off lane max | In hole cell / corner over hole | Stop error max | Stop angle max |
|---|---|---|---|---|---|---|---|---|
| 2 | 5.07 (5.00) | 0 | 2.2 s | 381 mm | 51 mm | 0 / 0 ticks | 23 mm | 6.8° |
| 4 | 9.73 (9.53) | 0 | 6.0 s | 373 mm | 66 mm | 0 / 0 | 23 mm | 7.7° |
| 6 | 12.53 (12.53) | 0 | 10.5 s | 367 mm | 65 mm | 0 / 0 | 23 mm | 7.7° |
| 8 | 13.80 (13.53) | 0 | 10.4 s | 369 mm | 66 mm | 0 / 0 | 23 mm | 7.7° |

Two robots cleared for one cell: 0 ticks in every run. Per robot at 6: 32/29/32/33/31/31 (nobody passed over).
Determinism, 6 robots 900 s: f42282a3 / f42282a3; other seed f429bd61 (12.80/min, 0 deadlocks, gap 370 mm).
The full run at the end (robot circuit taken from the shipped `gridBotCircuit()`) gave the same rows and the same hash f42282a3.

## Full run

`npx tsc --noEmit -p .` clean. ONE `npx vitest run --testTimeout 300000` at head 56a724f: **301 files passed, 1 skipped; 4437 tests passed, 1 skipped; 0 failed**, 553 s. The two known load-only timeouts (level-7-decoy, city-delivery-3d) passed this time. Machine during it: 100 % CPU, 27 node processes.

Stress, 6 robots 600 s, trouble from 200 s (rates before / during to +40 s / after):
| Case | Rates /min | Deadlocks | Longest standstill | Gap |
|---|---|---|---|---|
| no trouble | 12.3 / 12.0 / 12.8 | 0 | 10.5 s | 367 mm |
| robot 2 stays 30 s beside a hole | 12.3 / 10.8 / 12.6 | 0 | 30.4 s (itself) | 369 mm |
| station A silent 60 s | 12.3 / 8.4 / 12.6 | 0 | 53.4 s | 368 mm |
| station B silent 60 s | 12.3 / 4.8 / 12.8 | 0 | 62.0 s | 369 mm |
| station A silent + robot 2 stays | 12.3 / 7.2 / 12.8 | 0 | 53.4 s | 369 mm |

Ring of 8 cells: 7 robots all 7 arrive (180 s); 8 robots, detour 0: 0 move; 8 robots, detour 3 s: all 8 leave their cell (3 at their goal after 300 s); 8 robots, detour 3 s but the 8 "đang chờ ô" wires cut: 0 move.
Graph of layout A read from the arrows: 40 cells, 8 crossings with two exits, no two cells point at each other, every cell reaches every other, shortest closed loop 8 cells, 5 such loops.
Two levels: deck 2.6 m above ground tiles at the same x, z: each robot reads its own floor; the deck robot is cleared for the cell above a parked ground robot.

Difference from the spike's detour: the spike's route piece peeked into the hold table and took "the free exit". Mine has no such access: after `detourAfter` seconds of "Tránh ô bị giữ" it asks for the other exit, and after the same time again for the usual one. Measured effect: none visible (table above).

Cost: 1.8-4.9 ms per tick for 6-8 robots in these runs is NOT a usable number: the machine sat at 100 % CPU with 27 node processes (3 other agents). The spike measured 0.56 ms for 6 on a quieter machine; I did not re-measure on a quiet one.

## Anti-forced (4 robots, 150 s; whole board delivers 5/5/5/7)

| Wire cut | What happens |
|---|---|
| circuit: Thân robot → Động cơ trái / phải (2 wires) | no robot delivers, none leaves its cell |
| circuit: Thân robot → Robot of Đi tới điểm | same |
| circuit: Thân robot → Đọc mốc sàn | same (no cell known, nothing asked) |
| circuit: Khi bắt đầu → Chạy | same |
| circuit: Trái → Động cơ trái, Phải → Động cơ phải (2) | same |
| circuit: Số mốc → Ô đang đứng | same |
| circuit: Mốc → Đích | same |
| main: Xe 1 Robot → Robot 1 | robot 1 delivers 0 and is INVISIBLE to the others: gap 0 mm (they run into it) |
| main: Xe 1 Ô muốn tới → Ô robot 1 muốn tới | robot 1 delivers 0; it keeps holding its start cell, which is the only way out of station A, so robots 2 and 3 stop behind it (0/0/0/2) |
| main: Ô robot 1 được đi → Xe 1 | same |
| main: Xe 1 Ô đang đứng → stand-in | robot 1 delivers 0 |
| main: Robot 1 đứng giữa ô → stand-in | robot 1 delivers 0 (drives, never "arrives") |
| main: Ô đích → Xe 1 | robot 1 delivers 0 |
| main: Robot k đang chờ ô → Xe k (all 8, full ring) | the full ring stays locked: 0 move |
Same done on the two try boards and the 4-robot demo (5 main wires of robot 1 + all 15 inner wires): `tests/handbook/content-grid-floor.test.ts`.

## Handbook, lesson coverage, boards (the user has NOT seen any of this)

- Pages: `grid-route`, `cell-hold` (new file `content-grid-floor.ts`); "Mốc sàn" page: new setting, 999, two tips; "Đọc mốc sàn": two-floor sentence.
- Try boards: "Thử: Tìm đường trên lưới" (ring of 8 cells, robot sent to the cell behind it goes all the way round), "Thử: Bảng giữ ô" (robot 2 blocks robot 1 until the learner gives it a goal). Both plain rules, 2D top.
- Extra try on the "Bảng giữ ô" page: "Thử: 4 robot trên sàn 9 lỗ": 3D, "Vật lý thật" on, circuits "Sàn lưới 7 x 7" (40 markers) x1 and "Xe đi tuần" x4 (the robot circuit + Đảo ngược, Và, Hẹn giờ, Số ngẫu nhiên, Bảng giá trị to pick goals for ever).
- Lesson coverage: the SMALLEST thing the course test accepts: `tutorial/course-pack-n.ts` names the two kinds and returns no lesson (same as the deck sibling). No lesson written, no "why sensing fails" lesson (one tip on the page says it).
- `tests/handbook/extra-tries.test.ts`: list + runs boards through the circuit expander (needed for a try board with circuits).

## Baseline entries added (by name, nothing re-recorded)

- `tests/editor/solid-off-baseline.json`: `handbook:grid-route` f53dff5b:900, `handbook:cell-hold` 767b4546:900
- `tests/editor/solid-on-summary.snap.json`: the same two rows
- `real-physics-on-baseline.json`: none (no shipped board of mine turns the switch on; the demo is an extra try)
- `tests/nodes/step-1-nodes.test.ts`: 77 → 79

## For the user: http://localhost:5333

1. Trợ giúp › Sổ tay mảnh ghép › gõ "Bảng giữ ô" › bấm dòng đầu › nút **"Thử: 4 robot trên sàn 9 lỗ"**.
2. Bấm tab **Mô phỏng**, rồi **Chạy**.
3. In the first 30 seconds: a dark 7 x 7 floor with 9 grey holes, orange arrows on every tile; 4 robots stand 1.5 s, then each drives off along the arrows to a random cell, stops 1.5 s, picks another. Tiles a robot holds or is about to enter show ring and arrow in RED; top right "Số ô đang bị giữ" moves between 4 and about 11. Robots wait before a red tile, never touch.
4. Wiring: tab Bảng nối; click "Xe 1" › "Mở bảng mạch" to see the 13 cards inside.
Shots (read by me): `plans/reports/shots-grid-route/` 01-11 (handbook pages, both try boards, main board, robot circuit, floor at 5 / 15 / 30 s) and `pixel-*.png`.

## Not verified / known limits

- Main not merged in; `raised-deck`, `code-reader` and the physics branch not combined with this.
- Held-tile tint = ring + arrows only; a robot standing on a tile hides most of it (see shot 06b). Not the whole tile.
- Arrows are world directions: a marker inside a TURNED circuit copy keeps its arrow letters (not turned with the copy).
- "Bảng giữ ô" grants any cell asked for; it does not check the cell is a neighbour (that is the route piece's job).
- A robot not wired to the card is invisible to the others (crash, see table). By design of "nothing without a wire".
- Properties panel of the new select and of the 12-robot card (36 output rows) not looked at; side view not looked at; "Giáo viên" card size not looked at.
- Plain rules ("Vật lý thật" off): only the two small try boards run there; the fleet was measured with the switch on only.
- Cost per tick not measured on a quiet machine. Robots of mixed sizes, cells under 1.4 m, fast drive: not run here (spike numbers only).
- Starvation: none seen (per-robot counts even), none ruled out; tie-break is row order.
- Hook: one `ls` of the dependency folder was blocked by `scout-block`; not worked around. Playwright was found with the Glob tool in an older session scratchpad and imported by absolute path from a script file (the recipe in HANDOFF); nothing installed.

## If the table were hidden instead (the reading NOT built)

A per-robot card "Giữ ô" inside the circuit, all such cards sharing one table per run: 0 wires across the circuit border instead of 4-5 per robot, no card on the main board, card count per robot +1, kinds still +2. Lost: the tie-break rule becomes "card id order" (not visible), "Số ô đang bị giữ" and the one place to look, and the rule "nothing shared without a wire". The rule code is the same ~100 lines; switching is about half a day including tests and pages.

## Questions

1. Held tile look. a) keep ring + arrows red (built) · b) also wash the whole tile in a light red · c) a red frame round the tile. Recommend b: under a robot only the tile rim is visible. Needs your eyes first.
2. Lesson. a) leave the two pages + try boards (built) · b) add a lesson "Hai robot một sàn" that also shows sensing-only locking up. Recommend b after the sample exists, so the lesson can borrow its floor.
3. Arrow choices in the list. a) 10 choices (built) · b) four yes/no switches (any combination). Recommend a.
4. Unwired robot. a) invisible to the others (built; it gets hit) · b) the editor flags a robot circuit whose "Robot" pin is unwired. Recommend b later, as an editor warning, not a rule.
