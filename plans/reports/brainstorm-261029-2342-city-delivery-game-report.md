# Brainstorm: sample game "Thành phố giao hàng"

Date: 2026-10-29 23:42. Status: user approved 1a 2a 3a 4a; 5 defaults to 5a (game sample plus a playthrough capture).

## Game
- **View:** 2D trên (top view). Built only from the 48 existing nodes, as one board. Added to "Mở game mẫu" as `city-delivery`, label "Thành phố giao hàng (lái xe tải giao hàng, nhìn từ trên)".
- **Town:** small. A road loop, 3 work zones (Nông trại, Mỏ đá, Kho hàng) and 3 houses (Nhà 1/2/3). Colours make the zones easy to tell apart, and each zone and house has a "Hiện chữ" label.
- **Bots, which loop forever with Chuỗi việc plus "Làm lại từ đầu" or equivalent:**
  - **Farmer:** walks to the field, "Dùng" the tool on the crop; then a goods item at the farm bay shows again ("Hiện lại").
  - **Miner:** holds a pickaxe ("Cầm tay"), swings at a rock; the rock hides and later shows again. Ore goods appear at the mine bay.
  - **Loader:** carries crates (Cầm / Thả) from the storage to the warehouse bay.
- **Player:** only drives a 'Xe tải nhỏ', starting in the seat (or auto-entered). Driving into a bay zone auto-loads with "Chất / Dỡ hàng" (zone "Vừa vào" or while-in-zone pulse → Chất), up to capacity 4.
- **Orders:**
  - "Số ngẫu nhiên" 1..3 → "Chọn theo số" picks the active house, marked with "Hiện chữ" ("Giao ở đây!").
  - "Hẹn giờ" gives 50 s, shown on a "Thanh đo".
  - The truck entering the active house zone with Số hàng ≥ 1 → Dỡ 1 → delivered counter +1, money +10, new order, timer reset.
  - On timeout, hearts −1 and a new order.
- **Win / lose:** delivered 5 → Thắng. Hearts 0 (start 3) → Thua.
- **HUD:** "Màn hình bắt đầu" with the title and the rules. HUD shows Đơn đã giao, Tim, Tiền and Hàng trên xe. The camera follows the truck.

## Acceptance
- Headless test (sim with scripted input or direct intents):
  - bots produce goods over time;
  - the truck loads at a bay and delivers to the active house;
  - the counter increments;
  - 5 deliveries win, and 3 timeouts lose;
  - no runtime errors over 3 minutes of sim.
- **Browser:** play from the start screen to a win with scripted keys. Save screenshots plus a short animated capture (GIF or a frame sheet) to `plans/reports/shots-city/`. Measure FPS roughly; it must stay playable with the 3 bots and pathfinding.
- The board opens in Bảng nối, laid out readably by group (bots, orders, player, HUD), using sticky notes ("Ghi chú") as section titles.
- Gates green.

## Known limits
- Orders accept any goods type, with no matching of goods to houses (keeps the board smaller). Possible later upgrade.
- There is no grouping, so the board is large; sticky notes mitigate this.
