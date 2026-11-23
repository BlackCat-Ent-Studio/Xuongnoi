# Brainstorm — every level player-built (2026-11-03 20:00)
User rule: like L7, every level shows ONLY characters + objects on the board; player builds all bot logic from tray. Win/lose plumbing hidden (level rules). L5 (first 3D) must be simple.
Decisions 1a 2a 3a 4a:
- 1a: go-to general upgrade (advanced, default off): "Đích 2" input + "Dùng đích 2" bool → target switches. Use in L5 and to shorten L7.
- 2a: L5 new circuit ~4 pieces/~8 wires: Tìm vật gần nhất → Đi tới Đích; Ô kho1-3 → Ô trống kế tiếp → Đi tới Đích 2; Khiêng đồ Đang khiêng → Dùng đích 2; Đi tới Đã tới → Khiêng đồ toggle (pick/drop). 3 scattered crates hidden scenery.
- 3a: L6 guard patrol = ONE visible locked card (enemy brain); hero logic player-built.
- 4a: 3 parallel tracks: (I) go-to upgrade + L5 new + L7 shortened; (II) L1–L4 player-built, L4 simplified (~5 pieces); (III) L6 (running agent, rule updated).
Piece budget: L1 1, L2 3, L3 4, L4 ~5, L5 4, L6 ~5, L7 ~6. Keep decoys, star rule, "?" costs stars; mandatory first-visit full guide on levels with new circuits; freeHints scale with wire count.
Shared files likely conflicting (resolve keep-both): guide-script.ts WIRE_LINES/LEVEL_INTRO, guide mandatory list, levels tests, go-to.ts (I only), node count test.
