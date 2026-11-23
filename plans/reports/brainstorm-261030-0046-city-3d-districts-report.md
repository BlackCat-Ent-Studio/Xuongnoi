# Brainstorm: "Thành phố giao hàng 3D", districts, traffic, groups

Date: 2026-10-30 00:46. Status: user approved 1a, 2ab, 3a, 4a, 5a. 6 takes the default 6a (2 waves, parallel agents).

## Game (wave 2)
- **View:** 3D, tilted top-down camera (about 60°) following the truck. Graphics are made in code (low-poly procedural three.js; no external assets).
- **Map:** a 3×3 road grid.
  - 3 source districts: Nông trại → rau, Mỏ đá → quặng, Cảng kho → thùng hàng.
  - 6 residential or commercial districts, each named with its own style; each needs 1–2 goods types.
- **Traffic and people:** bot cars drive route loops, stop at red lights and stop when blocked. Pedestrians cross the streets. Traffic lights cycle.
- **Crash into a bot car (2ab):** the truck stalls for 5 s AND drops 1 item.
- **Orders:** "Khu X – Nhà Y cần N <loại>, còn T giây". Only the right goods type counts. 3 hearts, win after N orders.
- **Old 2D city-delivery sample is kept.** The new sample has id `city-delivery-3d`.

## Wave 1: parallel agents (all changes additive; old boards behave the same)
| Agent | Owns | Delivers |
|---|---|---|
| A Looks | render/* (block/item meshes, lights, shadows), nodes/block.ts, nodes/item.ts | Hộp "Kiểu dáng" param: hộp (default), nhà ở, cửa hàng, sạp chợ, nhà xưởng, cây, cột đèn, đèn giao thông, mặt đường (vạch), vỉa hè, ruộng rau, núi đá, hàng rào, biển tên. Đồ vật shapes: bó rau, cục quặng (crate exists). Hộp input "Màu mới" (runtime colour change, for traffic lights). Đồ vật param "Loại hàng" (text tag). Directional sun and soft shadows in 3D, kept cheap. Camera node: verify or add a tilted top-down follow preset |
| B Traffic | world/physics.ts and vehicles.ts (collision), nodes/vehicle.ts, new nodes/route-*.ts | Vehicle–vehicle collision (solid vehicles block each other, with a push-back, no tunnelling). Vehicle outputs "Vừa va chạm" pulse and "Va với" object. Vehicle input "Dừng" (bool, brakes while true, used for the 5 s stall). New node "Chạy theo tuyến": a waypoint list param (2–8 points), loop or ping-pong, speed, input "Dừng", auto-stops when an obstacle is ahead within N; drives a vehicle with no driver, or a character. Outputs "Đang bị chặn", "Tới điểm" |
| C Logistics | nodes/cargo.ts, world/cargo.ts, new nodes/guide-arrow.ts, render for the arrow only | Cargo: "Dỡ loại" (text param or input) so unload picks the top-most item of that type; outputs "Số loại" (count of the chosen type) and "Loại trên cùng" (text). Drop one random/top item on a crash via the existing Dỡ. "Mũi tên chỉ đường" node: inputs Từ (object), Tới (object), Hiện; draws an arrow above the "Từ" entity pointing to the target, plus a distance label, in 2D and 3D |
| D Groups | editor graph (wiring-canvas, graph/*), editor-state, io/save-format (+migration), runtime graph flattening | "Nhóm mảnh ghép": select → Gom nhóm (Ctrl+G), named block with auto-derived boundary ports (wires crossing the selection); double-click to enter, breadcrumb, Quay ra; Bung nhóm; Ctrl+D duplicates a group; undo/redo. The runtime flattens groups so engine behaviour is identical. Save format stays backward compatible (old files load; groups saved as an optional field). Lessons unaffected |

Shared-file rule: keep edits to engine/types.ts and nodes/index.ts minimal and additive. The controller resolves conflicts.

## Acceptance
- Each agent: headless tests, a browser check with screenshots in plans/reports/shots-<topic>/, and 0 console errors. Old samples and lessons unchanged; gates green.
- Wave 2: the city board is built using groups (one per bot, car, district, order system).
  - Playthrough GIF.
  - FPS measured with about 10 cars, about 10 pedestrians and about 200 buildings. Target ≥ 50 fps on this machine; optimise (instancing or merged static meshes) if needed.

## Risks
- **Groups (D) is the largest change.** It touches save, undo and the canvas.
- **Performance of many solid entities.**
- **Board size.**
