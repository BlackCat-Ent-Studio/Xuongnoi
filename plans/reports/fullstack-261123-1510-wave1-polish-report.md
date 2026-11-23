# Wave 1 polish: 7 small changes

- Worktree `D:\workspace\GameBuilder-polish`, branch `feat/wave1-polish`, base main 65fae6d, **main 5a2d819 merged in** (merge commit 568b442, no conflicts). 7 commits of mine, one per item. Tree clean, not pushed, NOT merged into main.
- Dev server LEFT RUNNING on http://localhost:5341 .
- Kinds: still 81. **Baseline entries moved: none** (see "Baselines").
- Shots: `plans/reports/shots-wave1-polish/` (31 files; I read 10, 11, 21, 22, 30, 31, 34-tick-700, 40, 50, 71).

## Per item

| # | Commit | What changed | Labels as built |
|---|---|---|---|
| 1 | f86a804 | "Sàn nâng có lỗ": two settings for the size + two outputs that say the size really built | settings "Chiều dài sàn theo trục X (m; 0 = tự tính theo lề)", "Chiều rộng sàn theo trục Z (m; 0 = tự tính theo lề)"; outputs "Chiều dài thật (m)", "Chiều rộng thật (m)" |
| 2 | a4c5858 | legs can be solid posts; new cards solid, old cards draw-only | setting "Chân trụ" (was "Vẽ chân trụ"): "Có, cột cứng (robot và đồ vật ở dưới bị chặn lại)" / "Chỉ vẽ (đi xuyên qua được)" / "Không" |
| 3 | a389662 | a held tile gets a 30 % wash of the held colour over the whole tile, under ring + arrows | no new setting ("Màu ô đang bị giữ" also colours the wash) |
| 4 | 967277c | 3 new items in "Việc cần sửa" | see item 4 below |
| 5 | 1ee09ab | handbook search: exact name first | - |
| 6 | 0180976 | "Chưa có mảnh ghép Nhân vật…" only when the board has "Phím bấm" or "Cần điều khiển" and nothing to control | text unchanged |
| 7 | 65766e4 | "Thử: Đọc mã" has a "Máy quay" card wired to "Khi bắt đầu" | card "Máy quay": Kiểu "Đứng yên nhìn một điểm", point (0, 0.8, 0), Phóng to 2.6, Độ mượt 0, Góc nhìn "Tự do" |

### 1. Deck size
- Rule (on the card's description and the handbook page): a typed side above 0 is the deck's size on that axis; holes stay centred at their pitch; a side smaller than the holes need grows to `first hole edge … last hole edge + 2 × 10 cm` (3 holes of 0.7 at 2 m: 4.9 m); max 100 m; 0 or missing = the old rule (holes + pitch + "Lề quanh lỗ ngoài cùng"). Each axis on its own.
- "The card shows the size really used" = two number outputs on the card (wire them to "Hiện số"; shot 22 shows "Chiều dài thật: 4.9" after typing 3). There is no read-out mechanism in the properties panel, and I did not invent one (new visible UI).
- Old cards: no setting = 0 = same plates, same ids, and the trim text on the first plate is the same 7 numbers (test compares plates and text for 4 old shapes). A typed deck writes 9 numbers. `handbook:raised-deck` unchanged in both guards; pixel compare of that try-board vs main = 0.
- "Lề quanh lỗ ngoài cùng": **kept as the alternative**, used on any axis whose size is 0. Reason: deriving it would change what an old card means; hiding it would need the new card to start with a typed size (question 1).
- Files: `nodes/raised-deck.ts`, `nodes/node-names.ts`, `handbook/content-raised-deck.ts`. Tests: `tests/nodes/raised-deck.test.ts` (+7), `tests/handbook/content-raised-deck.test.ts`.
- See on :5341: Mảnh ghép › Vật thể › "Sàn nâng có lỗ" › click the card › right panel, below "Lề quanh lỗ ngoài cùng".

### 2. Solid legs
- A solid leg = one plain solid block 0.1 × (floor height − thickness) × 0.1 m spawned by the card AFTER the plates (plate ids unchanged), drawn as the same steel post + foot. 3D view only. No world edit.
- Spacing rule, now written in code, card description and handbook: ring 12 cm inside the outer edge; a leg at every corner; along each edge evenly spread, neighbours ≤ 3 m; none under the inside of the deck; **never under a hole** (new: where the rim outside the holes is narrower than the ring, the ring moves out so the post stays under the rim; before, a deck with a 10 cm rim drew legs partly under the outer holes). Decks with a rim ≥ 17 cm: leg places unchanged.
- Setting to keep lanes clear = the 3-way choice only (no spacing number). Under the deck there is never a leg; a lane enters between two edge legs (3 × 3 default deck: gap 2.35 m between leg middles).
- New cards: solid (`default`). Cards without the setting and cards saved with "Có": draw-only (`legacyDefault: 'yes'`; old "Có" was stored as `yes`, which now means "Chỉ vẽ"). The try-board "Thử: Sàn nâng có lỗ" now says `legs: 'yes'` explicitly: same entities, hash unchanged.
- Tests (`tests/nodes/raised-deck.test.ts` +6, `tests/nodes/raised-deck-physics.test.ts` +4): ground robot sent at a leg stops with its nose at the post face and never arrives, with drawn legs it arrives ("Vật lý thật" on, and plain rules); robot crossing under the whole 3 × 3 deck between two legs: tick-identical (gap 0) to "Chỉ vẽ" and to "Không", same arrival time; every post wholly under floor for 7 shapes incl. 10 cm rims; ≤ 3 m; colour change leaves legs steel.
- Shots 10 (above), 11 (below: red robot stopped at a post, green one passed between posts), 12 (drawn legs: red one drove through).

### 3. Held tile
- "Bảng giữ ô" can only change a tile's colour in the world, so it also leaves a render note (same channel the arm pieces use, `engine/render-hints.ts`); the tile figure adds one flat mesh, made the first time the tile is held and hidden when it is let go. World state and hashes untouched (`handbook:cell-hold` unchanged).
- Never-held markers and boards without a hold card: no extra mesh. Pixel compare vs main: floor-marker, floor-marker-find, grid-route try-boards = 0 differing pixels.
- Files: `engine/render-hints.ts`, `nodes/cell-hold.ts`, `nodes/floor-marker.ts`, `render/floor-marker-figure.ts`, `handbook/content-grid-floor.ts` (one sentence). Tests: `tests/render/floor-marker-figure.test.ts` (+1), `tests/nodes/cell-hold.test.ts` (+1, 2 extended).
- Shots 30 (try-board, both robots on washed tiles), 31, 34-tick-700 (washed tiles with and without a robot), 33 (same floor without the card: no red).
- On dark tiles the 30 % wash reads as dark red, not pink. Needs the user's eyes (question 3).

### 4. "Việc cần sửa" for the hold card
Rule (per canvas: main board, and inside each circuit):
- a robot row k (k ≤ "Số robot") that has ANY wire but lacks "Robot k", "Ô robot k muốn tới" or a wire out of "Ô robot k được đi": one item per missing port. "đang chờ ô" / "đứng giữa ô" may stay unused. A row with no wire at all is not listed.
- a robot (a "Thân robot" card, or a copy of a circuit with a "Thân robot" inside) on a canvas that has a hold card, with no wire into an active "Robot k": one item.

Sentences:
- `Bảng giữ ô: hàng robot 2 mới nối một phần, chưa nối dây vào "Ô robot 2 muốn tới"`
- `Bảng giữ ô: hàng robot 4 mới nối một phần, chưa có dây nối ra từ "Ô robot 4 được đi" (robot không biết ô nào được đi)`
- `Xe 3: chưa nối vào ô "Robot ..." nào của Bảng giữ ô, nên các robot khác không biết nó ở đâu để tránh`

"Xem" jumps to the hold card / the robot. No shipped board, lesson, try-board or extra try gets one (test). Files: new `editor/circuits/hold-issues.ts`, `circuit-issues.ts`, `console-text-vi.ts`. Tests: `tests/editor/issues-cell-hold-wiring.test.ts` (6). Shot 40.

### 5. Search
`handbook/handbook-model.ts`: score 4 when the name equals the query after removing accents / capitals / extra spaces. Rest of the order as before. Test: `tests/handbook/handbook-dialog.test.ts` (+2). Shot 50: "Đọc mã", then "Đọc màu".

### 6. "Chưa có mảnh ghép Nhân vật…"
- Intent found in code: "the board has nothing to play" (list: Nhân vật, Thân robot, Xe, Khớp xoay, Xi lanh đẩy). It fired on every board without one of those, also machines that run alone.
- New condition: only when the board ALSO has a piece a player steers with ("Phím bấm" or "Cần điều khiển"). Text unchanged.
- **13 boards lose the item**: lessons `weight-force`, `piston-push`, `share-jobs` (start boards); try-boards `on-start`, `ui-button`, `ui-pick`, `ui-dialog`, `ui-start`, `select-number`, `dispatcher`, `code-reader`; the two extra tries of "Tạo đối tượng".
- **11 keep it**: lessons `two-motor-robot`, `robot-arm`; try-boards `key`, `stick`, `and`, `or`, `not`, `compare`, `latch`, `force-sensor`, `sample-hold` (all have a key / stick and nothing they drive; several of them also run fine: question 2).
- Every other issue on every shipped board: identical before / after (dumped and diffed).
- Files: `editor/console/issues.ts`. Tests: `tests/editor/issues-nothing-to-control.test.ts` (4). "Thử: Đọc mã" now shows "Không có gì cần sửa." (shot 71).

### 7. "Thử: Đọc mã" camera
- The card is LAST in the board's list, so every other card keeps its id: **`handbook:code-reader` did not move in any baseline file; nothing was re-recorded.**
- Shot 71 (1440 × 900 window, game view 914 × 555): carton numbers and the display's digit are readable as it opens. Angle left free (the learner can still turn the view). Cutting the wire "Đã bắt đầu → Bật" gives the far view back (tested).
- Files: `handbook/boards-parcel-code.ts`. Tests: `tests/handbook/content-parcel-code.test.ts` (+2 per world, cut table has the 13th wire).

## Checks
- Hash guards (solid-off, real-physics-on, solid-on snapshot): green, 0 lines differ from main in the three baseline files.
- Pixel compare main :5173 vs :5341 (scene harness, second loads): **0 differing pixels in all 13**: sorting-factory 600, weight-sorter 600, agv-shuttle 600, auto-arm 300, robot-avoid 300, robot-line-follow 300, city-delivery-3d 60, cleaner-bot 120, try-boards floor-marker 120, floor-marker-find 120, grid-route 300, raised-deck 0 and 200. (Run before the merge of main; main's commit touches no drawing code.)
- Browser: playwright from an older session scratchpad + chromium-1248 with swiftshader (nothing installed). One console line on both servers: a 404 for a resource (also on main's harness page); no page error.
- `npx tsc --noEmit -p .`: clean (after the merge).
- ONE full `npx vitest run --testTimeout 300000` on the merged state (568b442): **317 files passed, 1 skipped; 4676 tests passed, 1 skipped; 0 failed**, 562 s. The two known load-only timeouts did not happen; no rerun needed.

## Not verified
- Real GPU / human eye: all shots are headless swiftshader.
- Deck: the two size fields were not typed into by hand in the browser (board loaded with the values; panel labels read from the page). Typed size with a deck inside a turned circuit copy. Side view with a typed size (unit test of the plate cut only for the old rule).
- Solid legs: only a two-motor robot was driven at one; cartons falling next to a post, characters, vehicles not run. Frame rate with many posts not measured.
- Held wash: 2D top view and 3D seen; side view has none by design. Dark theme not looked at.
- Issue items: "Xem" button not clicked in the browser. A hold card INSIDE a circuit with robots outside is not reported (rule is per canvas).
- Item 6: the 13 boards were checked by the issue list only, not opened one by one in the browser.
- Item 7: only 1440 × 900 looked at; smaller windows not.
- Failing-test-first: done for 1, 2, 3, 5, 6, 7 (red run seen). Item 4: tests were written first but first run was after the code.
- Found on the way: the card description of "Sàn nâng có lỗ" is now a long paragraph in the right panel (shot 21).

## Questions (answer like `1a 2a 3a 4a`)
1. Deck size on a NEW card: a) starts at 0 = follows the holes and "Lề", type a number to fix it (built) ⭐ / b) starts with 3.3 × 3.3 typed and "Lề quanh lỗ ngoài cùng" is hidden for new cards (then adding holes makes a cramped deck until the size is retyped).
2. "Chưa có mảnh ghép Nhân vật": a) as built: only with a key / stick and nothing to control ⭐ / b) remove the item completely (11 more boards lose it) / c) narrower: keep the old rule and only exempt boards with "Tạo đối tượng" (3 boards change instead of 13).
3. Wash strength of a held tile: a) 30 % (built) ⭐ after you look at shot 34 / b) stronger, about 45 % / c) lighter, pink instead of dark red (needs a lighter colour than the held colour).
4. Try-board "Thử: Sàn nâng có lỗ": a) keep drawn legs (built, hash unchanged) ⭐ / b) switch it to solid legs (moves `handbook:raised-deck` in both baselines: one named re-record).
