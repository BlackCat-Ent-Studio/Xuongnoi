# Brainstorm: conveyor belt + train + riding on vehicles

Date: 2026-10-30 04:01. Approved: conveyor = Hộp params (not a new node); train full (rail mode, 32 points, locomotive+wagon models, "Kéo theo bởi", rail style); riding on vehicles now; 2 parallel agents. Defaults taken for unanswered: choosing style "Băng chuyền" auto-sets speed 2 along the long axis; low side walls on by default with toggle.

## Agent 1: conveyor + rail style + riding (block.ts, block-styles, block-looks, physics/platforms)
- Hộp advanced/normal params: "Mặt băng chuyền" speed (0 = off), direction (Theo chiều X / Z / -X / -Z, or angle), inputs "Chạy" (default on), "Đảo chiều". Pushes characters, items, vehicles resting on top (surface velocity, collider-aware). Works with any style.
- Kiểu dáng "Băng chuyền": frame, end rollers, belt with stripes scrolling at the real speed/direction, optional low side walls ("Thành chắn hai bên" Có/Không) that are real colliders. Picking this style with speed 0 behaves as speed 2 along long axis (document rule).
- Kiểu dáng "Đường ray": sleepers + 2 rails, tiles with length.
- Riding: characters/items standing on a moving vehicle (top surface) are carried along (translation + yaw), like moving platforms.
## Agent 2: train (route-follow.ts, vehicle.ts, world/vehicles.ts, render vehicle meshes)
- Chạy theo tuyến: mode "Bám ray" (position/heading locked to the polyline, smooth corners, no steering drift; respects Dừng, probe-ahead stop); max points 8 -> 32 (old boards unchanged).
- Phương tiện: models "Đầu máy", "Toa tàu"; input "Kéo theo bởi" (object): this vehicle follows the leader's trail at distance "Khoảng cách toa" (advanced, default by model length); wagons chain; collisions between coupled cars ignored.
## Acceptance
- Defaults unchanged for every old board; all tests green; headless tests per feature; browser shot/GIF per agent; 0 console errors.
