# Node rename proposal report (2026-11-02)

- Registry kinds: 54 (STEP_1_NODES). node-rename.json entries: 54. Skipped: none.
- Ports listed: 248 (incl. dynamic select-number "Là 1-3", sequence "Việc 1-3"; route-follow points are params, not ports). 53 ports get a new Vietnamese label, all others only gain English.
- 19 nodes get a new Vietnamese name; 35 keep it and gain an English subtitle.
- Key renames: Cảm biến chạm -> Chạm nhau (Collision); Cảm biến vùng -> Vùng kích hoạt (Trigger Zone); Cảm biến phía trước -> Dò phía trước (Raycast); Không -> Đảo ngược (NOT); Cầm / Thả -> Khiêng đồ (Carry) vs Cầm dụng cụ (Equip Tool); Sinh vật thể -> Tạo vật mới (Spawner).
- Port fixes: touch Vật A/B -> Vật chính (Self) / Vật kia (Other); Đang chạm / Mới chạm / Vừa rời (Stay/Enter/Exit); block "Ẩn khi bật" -> "Ẩn suốt lúc bật" (Hide while ON); spawner "Ai chạm" -> "Vật thử chạm".
- Port ids are not unique per node across directions, so each port has a `dir` field (extra to the requested shape) and `type`.
- Verified: Playwright (script plans/browser-scripts/node-rename-check.mjs) 54 rows, 7 sections, search, copy JSON, phone width no overflow, no console errors. Shots in plans/reports/shots-node-rename/ read and layout fixed (pin shapes for object/number types).
- No app/ source edited, no commit, not published. Reference names only from general engines/education; D:\gbg not touched. Handbook pages not read in detail; purposes taken from node descriptions.
- Unverified: the English term choices come from my own knowledge of Unity/Godot/Scratch, not web-checked.
