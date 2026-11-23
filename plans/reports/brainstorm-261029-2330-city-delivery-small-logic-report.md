# Brainstorm: small and medium logic pieces needed by the city-delivery game

Date: 2026-10-29 23:30. Status: user approved ("làm logic từ nhỏ tới vừa trước"). The game itself and grouping (item 6) are deferred.

## Context
Target game, built later as one board: a small town in 2D top view. Farmer, miner and loader bots produce goods; the player drives a truck, picks goods up at the zones and delivers them to houses before a deadline. A scout of 46 nodes found these gaps.

## Items (all additive and backward compatible; empty new ports mean the old behaviour)
| # | Piece | Change |
|---|---|---|
| 1 | Hộp, Đồ vật | New input "Hiện lại" (rising edge shows a hidden entity again at its current spot, unless it is occupied by a solid; then it shows at the original spot or waits). A hidden item that was held stays released |
| 2 | Bộ đếm | New inputs "Cộng thêm (số)": add N on a rising edge of a bool? Better: number input "Số cộng thêm" plus bool "Cộng số". And "Đặt về số": number plus bool trigger. Keep +1/−1/Về đầu |
| 3 | New node "Chọn theo số" (Logic) | Number in → bool outputs "Là 1".."Là N" (N param, 2..6) plus "Vừa đổi". Optional bool input "Bật" |
| 4 | Cảm biến vùng | New object input "Bám theo vật". When wired, the zone centre follows that entity (offset = the old centre param treated as an offset). Size unchanged |
| 5 | New node "Chất / Dỡ hàng" (Hành động), for vehicles | Inputs: Xe (object, required), "Chất" (bool: takes the nearest carryable item within reach of the truck bed, or one in a wired zone), "Dỡ" (bool: drops the top item behind or next to the truck), "Dỡ hết". Outputs: "Số hàng" (number), "Vừa chất", "Vừa dỡ", "Hàng trên cùng" (object). Params: sức chứa (default 4), tầm với. Cargo is rendered stacked on the truck bed in 2D and 3D, and moves with the truck. Bots or the player may also drop items into a zone; that is a separate concern |

## Split
- **Agent S1 (feat/logic-small):** items 1, 2, 3.
- **Agent S2 (feat/vehicle-cargo):** items 4, 5.
- **Shared:** `engine/types.ts` (WorldApi), `world/world.ts`, `nodes/index.ts`, node-count tests. Keep edits additive and minimal; the controller resolves merge conflicts.

## Acceptance
- Headless tests for each item, in 2d-side, 2d-top and 3d where relevant.
- Old saves and samples behave the same.
- A browser smoke for 5: truck loads 3 crates, they are visible on the bed, it drives, unloads at a zone.
- Gates green. Palette text in simple Vietnamese.
