# Brainstorm — L7 player builds whole circuit; L8 archived (2026-11-03 17:50)

## Decision (user 1a 2a 3a 4a)
- L7: board shows only characters/objects: Rô-bốt chân + Ô kho 1..3 (Vật thể). Crates, pads, floor, zones, win-lose, camera = hidden scenery. Player builds ALL logic.
- 1a: shortest reference circuit (~8 pieces, ~14 wires): Chạy theo tuyến (stop at each point, faceAtStop item) + Đọc màu + Đảo ngược + Và ×2 (match AND atPoint AND not holding) → Khiêng đồ Nhấc lên; Khiêng đồ Đang khiêng → route Dừng + Đi tới Cho đi; Ô kho → Ô trống kế tiếp → Đi tới Đích; Đi tới Đã tới → Thả; Phép tính cộng moveX (and moveY if needed). Drop speed-sensor + Hoặc gate (atPoint replaces "still").
- 2a: tray = exactly needed pieces + 1 decoy; par = reference piece count; stars rule unchanged.
- 3a: first visit = mandatory full step-by-step cat guide (free, like L1); afterwards freeHints 7 (was 3); beyond that "?" costs stars as now.
- 4a: L8 moved to levels/archive (out of PUZZLE_LOOKS map), L7 = last level → ending screen after L7.
