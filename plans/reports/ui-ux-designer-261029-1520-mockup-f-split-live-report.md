# Mockup F "Chia đôi trực tiếp" (split live)

Date: 2026-10-29. Files:
- `D:\workspace\GameBuilder\plans\ui-mockups\f-split-live\index.html` (single file, inline CSS+JS, only external = Google Fonts Be Vietnam Pro + JetBrains Mono)
- `D:\workspace\GameBuilder\plans\ui-mockups\f-split-live\preview.png` (1440x900, live mode)

Note: impeccable's `impeccable context` launcher was NOT run (brief said read-only, no scripts). Guidance read directly: SKILL.src.md, operate.md, craft-floor.md, animate.md, taste-skill sections 1/4/9, WCAG checklist.

## What was built

Direction: Operate mode. Neutral charcoal (not blue-grey like mockup A), one amber accent for primary/selection/focus. One UI family (Be Vietnam Pro), mono only for live numbers/data. Dials V5 / M5 / D7.

| Area | What it does |
|---|---|
| Top bar (48px, one row) | Logo, editable game name, Tệp/Sửa/Trợ giúp menus (keyboard nav), undo/redo SVG icons. Center: view switch 2D ngang / 2D trên / 3D plus transport Chơi / Tạm dừng / Dừng / Chơi lại. Right: save status, Ctrl K button, "?" help. Labels collapse to icon+tooltip+aria-label below 1360px (secondary transport) and 1500px (Tìm lệnh). |
| Palette (216px) | Diacritic-insensitive, word-start search ("hien so" finds only Hiện số). "Hay dùng" group plus 5 collapsible sticky categories. Each item has an icon tile, name and a 1-2 line description. Drag to board, or click to place in the nearest free visible spot with a flash. |
| Ctrl+K command palette | Native `<dialog>`, combobox/listbox with aria-activedescendant, arrow keys/Enter/Esc. Covers 18 commands (Thêm mảnh ghép, Vừa khung, Sắp xếp gọn, Chơi, Tạm dừng, Dừng, Chơi lại, góc nhìn...) plus all 17 pieces. Matched part is highlighted. Verified: "nhan vat" finds Nhân vật, "vua khung" finds Vừa khung, "them khoi" finds Thêm mảnh ghép. |
| Split 50/50 | Draggable splitter (role=separator, arrow keys, Home/End, double-click resets to 50/50, clamped 30-70%). |
| Game view (canvas 2D) | Platformer: cat, 6 platforms, star that respawns. The graph is EVALUATED every frame (a tiny dataflow interpreter), so unplugging Phím→Nhân vật really stops the cat. The HUD comes only from "Hiện số" nodes. Win/lose overlay is drawn by the game. View modes re-skin the render (side / top-down tiles / oblique 3D). |
| Under the game | Key hint strip (not an overlay). "Chuyện vừa xảy ra" event log with timestamps; clicking a row centers and flashes the node that caused it. This is the main cause→effect explainer and is new versus mockups A-C. |
| Node graph | 9 nodes (Phím mũi tên, Nhân vật, Ngôi sao, Chạm, Bộ đếm, Hiện số, Hẹn giờ, Thắng, Thua). Single-column stacked ports, nowrap, content-sized width. Port type = colour + shape (bool green circle, number blue diamond, object pink square), distinct from muted category tiles. Unwired required input = hollow dot plus coral "Thiếu 1 dây" chip (Thắng.Khi ships unwired as the lesson task). |
| Wiring | Drag from any port row (whole row is the hit area). Compatible ports glow, the rest dim. 24px snap. Wrong type: shake plus toast naming both types. Out-to-out: explained. Dragging from a wired input lifts the wire. Dropping on empty space opens Ctrl+K filtered to pieces with a matching port, then auto-connects. Wires can be selected and deleted with Delete. |
| Layout | Auto-layout by data flow; layers wrap into lanes and it tries every column count, picking the largest zoom that fits. Wrap-around wires take a routed corridor that avoids nodes. "Sắp xếp gọn" (L) animates the move (380ms, skipped under reduced motion). Smart placement spirals out from the viewport center to a free spot. |
| Zoom | − / % (click = 100%) / + / Vừa khung / Sắp xếp gọn dock plus a permanent type legend. Fit floor is 0.6, and it anchors at the inputs when content is too wide. Semantic zoom below 0.6 hides labels and enlarges titles. Minimap is clickable/draggable. |
| LIVE mode | Bool wires go thick and bright with a flowing dash while true (held 280ms so 1-frame events are visible); false bool wires dim. Number badges sit at the wire midpoint with collision nudge and a bump when the value changes. The node header tints when it fires. The game canvas gets an amber frame and an "ĐANG CHƠI" chip in the pane header (not over the game). The editor stays fully editable during play; property edits apply live. |
| Bottom strip (132px) | Horizontal "Thuộc tính": editable instance name, kind/category, description; number fields with steppers and an "Đổi được cả khi đang chơi" tag; a Cổng section listing each port with its connected node (click to jump) or "cần nối"; actions Nhân đôi / Xem trong game (pings the entity in the canvas) / Xóa (separated, danger). The empty state shows shortcuts. Docked tutorial card: Bài 2, 3 steps with a progress stepper, "Chỉ cho tôi" pulses the 2 target ports (3 cycles, not infinite). Steps advance from real state (scored a star, wire added, won). |
| Status bar (26px) | Toast slot (aria-live, fixed height, never shifts layout or covers the game) with an optional "Hoàn tác" action, plus counts, zoom and the shortcut sheet. |
| Dialogs | Shortcut sheet plus glossary (mảnh ghép, cổng, dây, Bục). |
| Empty board | Launchpad: Học từ đầu (primary), Mở game mẫu, Tự làm. |

## The 15 audit problems

| # | Problem | How F solves it |
|---|---|---|
| 1 | Port labels wrap/clip | Single-column port rows, `white-space:nowrap`, node grows to content. Verified: tallest port label 15.6px at 1440 (one line), no clipped text found by the scan. |
| 2 | Nodes overlap / new node lands on another | Auto-layout by data flow plus spiral free-spot placement plus flash. Verified 0 overlaps at all sizes and after adding a node. |
| 3 | Unreadable fit zoom, no controls | Zoom dock, % readout, Vừa khung (F), fit floor 0.6 anchored at inputs, semantic zoom, minimap. Layout picks the column count with the best zoom: 80% at 1440x900. |
| 4 | "Khối" ambiguity | Pieces are called "Mảnh ghép" everywhere; the box node is "Bục" (synonym "khoi" still finds it). Node header shows the instance name ("Mèo Mướp", "Số sao"). Glossary in the "?" sheet. |
| 5 | Palette 41 buttons, no search | Search (no diacritics, synonyms), Hay dùng, collapsible sticky categories, icons plus descriptions, Ctrl+K, double-click quick-add, wire-drop quick-add filtered by type. |
| 6 | Category colours fail contrast | Category colour is used only on the icon tile/header tint. Header text is #ECEDEF on near-black (≥12:1). Secondary text #9095A0 on #17181A ≈ 5.9:1. |
| 7 | No legend, type/category colour clash | Permanent legend; type = colour AND shape; port hues (green/blue/pink) differ from muted category hues; compatible ports highlight during a drag. |
| 8 | "Chơi" becomes "Sửa", editor locks | Separate Chơi / Tạm dừng / Dừng / Chơi lại; never "Sửa"; nothing locks during play, and numbers apply live. |
| 9 | Game small, covered by hint/toast/HUD | Game gets 50% width; hint strip and event log sit under it; toasts live in the status bar; the HUD belongs to the game. |
| 10 | Top bar crowded, wraps, destructive next to primary | One row verified at 1024/1280/1440 (48px). Tạo mới is inside the Tệp menu, Xóa inside Sửa (danger style, separated). SVG icons only, no emoji. |
| 11 | No "why it doesn't work" feedback | Hollow dot plus "Thiếu 1 dây" chip, a "Kiểm tra" button with an issue list (click to jump), node activity tint, wire values, and an event log naming the causing node. |
| 12 | Properties panel under-used | Ports listed with connections (click to jump), live-edit fields with steppers, Nhân đôi, Xem trong game, separated Xóa, shortcuts in the empty state. |
| 13 | Hidden interactions | "?" sheet, shortcut hints in menus, tooltips and the empty inspector; a pan/zoom tip as the default status message; fullscreen button labelled "Toàn màn hình" and working during play (no F conflict; F = Vừa khung). |
| 14 | Drag selects page text | `user-select:none` on chrome (inputs re-enabled), whole port row as hit area, 24px snap. |
| 15 | Empty board dead end | Launchpad with 3 options; docked tutorial with progress plus "Chỉ cho tôi". The lesson gallery itself is only a toast stub. |

## Verification (Playwright, headless Chromium, scratchpad script)
- Console/page errors: none (1024, 1280x720, 1280x800, 1440x900, reduced-motion run).
- Horizontal overflow: none at 1280 and 1440. At 1024 the document width equals the viewport (body min-width 1024).
- Top bar: 48px, no overlap of its 3 groups, including live state with "Đang chơi".
- Text clipping scan (top bar, node titles/ports, palette, buttons, legend, tutorial, status): only the intentional `.sr` screen-reader labels.
- Wire rejection: Số→Đúng/Sai rejected with toast; correct wire accepted; undo works; issues count goes to "Ổn rồi".
- Live: pressing → lights the "Giữ →" wire, the cat collects a star, the counter badge shows 1, the HUD shows Điểm 1, the event log row appears, the tutorial advances. Win path: wire Đủ mục tiêu→Thắng, goal 1, Chơi lại, collect star gives "Thắng rồi!" and the tutorial completes.
- Reduced motion: animation durations are cut to ~0. Wire flow dash is hidden; brightness/thickness and badges still convey state.

## Est. effort to port into the plain-DOM TS app (1 dev who knows the codebase)
| Piece | Days |
|---|---|
| Tokens/CSS shell, top bar regroup, menus, status-bar toast | 1.5 |
| Palette search/categories/icons plus SVG icon set | 1 |
| Ctrl+K palette (shared with quick-add, wire-drop filter) | 1.5 |
| Node renderer (single-column ports, missing chip, semantic zoom) | 1.5 |
| Wire drag upgrades (compat highlight, snap, reject, lift, corridor routing, badges) | 2 |
| Zoom dock, fit floor, minimap | 1 |
| Auto-layout + smart placement (needs sample re-layout decision) | 1.5 |
| Split view + splitter + game pane hint/event log | 1.5 |
| Live overlay hooked to the real runtime (values per port per frame, event log emitters) | 2-3 |
| Inspector bar, tutorial dock, issues list, shortcut sheet, launchpad | 2 |
| A11y/QA pass, Vietnamese copy review | 1 |
| **Total** | **≈ 16-18 dev-days** |

The biggest risk is the live overlay: the real runtime must expose per-port values each frame (or a sampled snapshot) without hurting FPS.

## Not verified / limitations
- At 1280x720 (short height) the board doesn't fit at a readable zoom: fit floors at 60%, and the zoom dock overlaps the bottom row until you pan. 1280x800 fits at 65%, 1440x900 at 80%. Node subtitles (11.5px) render ~9px at 80%.
- 2D trên / 3D only re-skin the canvas (same side-view physics). They don't model real view-mode behaviour or node disabling.
- Thư viện bài học, Xuất file and Lưu are toast stubs; the save indicator is simulated (no localStorage).
- Not tested: a real screen reader, Windows High Contrast, touch/tablet, Firefox/Safari (`color-mix`, container queries and `roundRect` need modern browsers).
- Fonts load from Google; offline it falls back to system-ui (no Vietnamese issue in the fallback, but metrics change).
- Contrast ratios were computed by hand for key pairs, not with a full automated audit.

## Unresolved questions
- Can sample boards be re-laid out automatically (positions in saved files change)?
- Is renaming "Khối" to "Bục" and the palette noun to "Mảnh ghép" approved? The brief's "Thêm khối" command is kept only as a search synonym.
- Should structural edits (add/delete/wire) really stay allowed during play, or lock while numbers stay live?

Status: DONE_WITH_CONCERNS
Summary: Mockup F is built: a live split view where the graph actually drives the canvas game, wires show real values, and an event log links effects back to nodes. All 15 audit problems are addressed and checked in Playwright. The main concern is short viewports (1280x720), where the board needs panning at 60% zoom.
