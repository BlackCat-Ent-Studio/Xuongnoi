# City delivery sample: implementation report

Branch `feat/city-delivery` in `D:\workspace\GameBuilder-city`, commit `91c662f`. Not merged.

## What was built
- Sample `city-delivery`, label "Thành phố giao hàng (lái xe tải giao hàng, nhìn từ trên)", mode 2d-top.
- Board: **127 nodes, 152 wires, 8 sticky notes** (Thành phố, Bot nông dân, Bot thợ mỏ, Bot bốc vác, Xe của bạn, Đơn hàng, Thắng / Thua, Màn hình). Only the 48 existing node kinds were used. No engine or node changes.
- Files: `app/src/samples/city-delivery.json` (CRLF), `app/src/io/samples.ts` (registered), `app/tests/io/city-delivery-sample.test.ts` (16 tests), and `app/tests/io/samples.test.ts` (id and mode lists extended).
- The JSON was produced by a throwaway generator, not committed. It used the node registry for layout sizes, and the board is validated on load by `parseBoard` (canConnect on every wire). A test asserts no node overlaps by the same size estimate the editor uses.

## Controls and how to win
- W A S D drives the truck. The truck is auto-boarded at start. Click "Bấm để lái xe" on the start screen.
- Drive into a yellow bay (Nông trại, Kho hàng, Mỏ đá) and the truck auto-loads one item every 0.3 s, up to 2.
- A red "Giao ở đây!" label floats over the house that wants goods. Drive to its yellow door mat (the zone covers the road in front) and one item is unloaded automatically. That counts as a delivery, gives +10 money, and a new order starts with a fresh 50 s clock.
- **Win:** 5 deliveries. **Lose:** 3 orders time out (3 hearts).
- HUD: Đã giao, Tim, Tiền, Hàng trên xe, and a time bar. Esc opens the pause menu.

## Design as built
- **Bots** each run a looping Chuỗi việc.
  - Farmer (bucket) and miner (pickaxe) walk to the crop or rock, swing, and the crop or rock hides.
  - They then walk to the bay. On arrival the crop or rock shows again, a counter goes up, and Chọn theo số reveals the next of 6 goods ("Hiện lại").
  - The loader carries 6 crates one by one from a pile to the depot bay.
- **Order** logic: Số ngẫu nhiên 1..3, then Chọn theo số marks the house. Timers and counters drive hearts, deliveries and money.
- **Pacing:** the load pulse is a Hẹn giờ 0.3 s. Unload is gated by "not just unloaded", so a repeat order for the same house unloads again.
- **Start gating:** the order timer's "Chạy" is wired to the start screen's "Đã bắt đầu". Bots work before the start click, so goods are already waiting.

## Deviations from the brainstorm
- Truck capacity is 2 (brainstorm said 4), for more driving. Truck max speed is 5 and the camera zoom is 0.6.
- Goods are a finite pool: 6 per bay, 18 in total, against 5 needed. Delivered items stay beside the house. Items cannot be recycled with the existing nodes because Dỡ/Chất act on entities, not item nodes.
- The pulse timer and the crop hide go through an extra "Hoặc" node, because a wire may not connect a node to itself.

## Findings (no engine change made)
- **Wide-wall quirk:** a tool swing (`useTool`) prefers any wide solid slab that is "ahead" of a diagonally facing bot, which picks up big walls. A swing made while facing diagonally can hit the wall instead of the crop. Work spots are placed so the bot approaches along an axis, and the same-z layout of the crop and the bay does this.
- No bug fixes were made.

## Tests
- `npx vitest run`: 62 files, 867 tests pass. `npx tsc --noEmit -p .` is clean and `npm run build` passes (only the usual chunk-size warning).
- New tests cover:
  - layout and section titles;
  - seated truck and the clock waiting for the start button;
  - bots stocking bays within 25 s, and all 6 slots filled within 60 s;
  - load, deliver, counter and money (exact cargo −1);
  - **5 deliveries win**, run for 8 dice seeds;
  - **3 timeouts lose** at about 150 s, and a single timeout costs exactly 1 heart;
  - 3 minutes of erratic WASD with no throw.
- **Driving is scripted with real key snapshots.** An autopilot plans routes with the engine pathfinder and holds WASD keys. Nothing is teleported.
- Perfect autopilot wins in about 35-62 s of game time. A first-time human is estimated at about 2-3.5 min. **That is an estimate, not measured with a human**, so the 3-4 min goal is not confirmed. Raise the win count or lower the truck speed if it feels short.

## Browser check
- Dev server on 5191, headless Chromium with swiftshader, Tệp → Mở game mẫu → the sample, then the start button.
- A closed-loop autopilot drove with real key presses and won, delivering 5 orders in about 65 s wall time. It used a temporary, reverted hook exposing the world to the page. That hook was never committed.
- **FPS about 60** (rAF count, headless software GL). Console errors and warnings: **0**.
- Server stopped.
- Captures are in `plans/reports/shots-city/`:
  - `frame-sheet.png` (24 frames) and `playthrough.gif`;
  - 112 frames `f000.png` onward, every ~0.5 s;
  - `start-screen.png`, `edit-view.png`, `end.png`;
  - `board-overview.png` (Bảng nối at 30% zoom), and `board-fit.png`, which may be stale from the first run.

## Known limits
- Any goods type satisfies any order (no matching).
- The finite pool means bots idle once their goods are used, which is fine since the game ends at 5 deliveries.
- The board is large (127 nodes) and wires cross sections. The sticky notes are the only guide.
- Diagonal swings can hit wide walls (see Findings).

## Unresolved questions
- Is a 5-delivery win long enough for the "3-4 min" target? A human playtest is needed.

Status: DONE_WITH_CONCERNS
Summary: The city-delivery sample is built from existing nodes only, with 16 new tests. Gates are green, and a browser run won with 60 fps and 0 console errors. Committed as 91c662f on feat/city-delivery, not merged.
Concerns/Blockers: Session length is estimated at 2-3.5 min for a first-time player, not measured with a human. Truck capacity is 2 and goods are a finite pool of 18, both deviations from the brainstorm.
