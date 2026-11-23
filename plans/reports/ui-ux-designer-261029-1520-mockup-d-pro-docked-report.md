# Mockup D "Xưởng Pro": pro docked editor layout

Date: 2026-10-29. Files:
- `D:\workspace\GameBuilder\plans\ui-mockups\d-pro-docked\index.html` (single file, inline CSS+JS, about 1,320 lines; the only external resource is Google Fonts Be Vietnam Pro with the Vietnamese subset)
- `D:\workspace\GameBuilder\plans\ui-mockups\d-pro-docked\preview.png` (1440x900)

## Design read
This is an Operate-mode tool, with dials set to VARIANCE 3, MOTION 3 and DENSITY 8. It uses a dark graphite palette in 4 neutral steps (bg / chrome / panel / panel2), one mint accent (#3ecf8e) for primary actions, selection and the play state, and amber for warnings. The type family is Be Vietnam Pro, on a fixed 11.5–14.5px scale with tabular numbers. Radii are 5–8px throughout. All icons are authored SVG symbols in one 24px grid with a 1.8 stroke. There are no emoji, no em-dashes and no gradient text. Middle dots are used sparingly.

Colour rule: the port types use yellow circle = Đúng/Sai, blue diamond = Số and pink square = Vật thể. Categories appear only as a 24px tinted icon tile (teal, violet, lime, orange, coral, sand, slate) and never as a node header fill, so wires never share a meaning with categories. Node headers are neutral.

## What was built
| Area | Contents |
|---|---|
| Top bar (40px, 3-col grid, never wraps) | Logo; menus Tệp/Sửa/Xem/Trợ giúp (fixed-position dropdowns, arrow and Esc keyboard support, hover-switch); game name; centred cluster with state label, Chơi, Tạm dừng, Từng bước, Dừng; layout preset select; save status ("Đang lưu..." then "Đã lưu lúc hh:mm"); help button |
| Play states | Edit: Chơi is primary and the rest are disabled. Play: the first button becomes "Chơi lại" (restart) and Dừng is enabled in red. Pause: "Tiếp tục" appears and "Từng bước" runs 1 frame. The game frame gets a green (play) or amber (pause) ring, and a "Đang chơi" chip shows on the centre tabs |
| Left dock "Cảnh" | ARIA tree (arrow keys, expand/collapse): Màn 1 > Nhân vật, Vật phẩm, Hộp 1/2, Kẻ địch, Sàn, Cờ đích; Giao diện > Số xu; Camera. Items backed by a node select that node. Hộp and Kẻ địch open a position inspector that moves them live in the game |
| Left dock "Khối" | Search ignores diacritics (NFD + đ→d) and matches title, description and synonyms, with title matches first. "nhan vat" returns Nhân vật first. Enter adds the top result, Esc clears. 26 blocks in 7 collapsible sticky categories, each with an icon and a one-line description. Click to add, or drag onto the graph. Empty-result state shows a hint |
| Centre "Màn chơi" | Canvas 2D side-scroller: parallax hills, ground with gaps, 2 boxes, 5 coins, a patrolling enemy, a flag and a cat player. It is driven by the actual graph: player inputs read Phím through wires, Chạm resolves Mèo + Đồng xu, then Bộ đếm, then the Hiện số HUD. The Hẹn giờ countdown fires Thua. The hint strip sits below the canvas (never over it) with keys, timer and a "Toàn màn hình" button |
| Centre "Bảng nối" | 9 nodes (Phím, Nhân vật, Vật phẩm, Chạm, Bộ đếm, Hiện số, Hẹn giờ, Thắng, Thua) and 8 wires. Port rows are stacked full width, nowrap, and the node sizes to its content. Thắng shows a "Thiếu 1 dây" badge plus a hollow amber dot and a "cần nối" tag. Nodes drag by header. Wires drag from either end: compatible ports pulse, others dim, the wire snaps within 24px, and a wrong type shakes the target node and shows a toast plus a log line naming both types. Dropping on an occupied input replaces the old wire. Clicking a wire selects it and Delete removes it. Toolbar: − / % (reset to 100) / + / Vừa màn hình / Sắp xếp gọn (layered auto-layout, animated). Permanent type legend. Clickable and draggable minimap. Wheel zoom happens at the cursor. Fit-to-screen is floored at 0.6, and below 0.6 the semantic zoom hides labels and enlarges titles. During play every wire shows a live value chip (Đúng/Sai/number/Mèo) and nodes glow when they fire |
| Smart placement | When a node is added from the palette, a ring search near the viewport centre (or the drop point) finds a free spot with 24–28px clearance. The new node pulses, gets selected and focused, and the view scrolls to it. Verified: 0 overlapping node pairs after adding |
| Right dock "Thuộc tính" | Header (category tile, name, instance name), description at 13px in body colour, editable "Tên riêng", number steppers (− / input / + / unit), toggles (role=switch), look swatches (radiogroup). Cổng section: every port with its shape, type, one-sentence help and what it connects to (click to jump). Nhân đôi and Xem trong Màn chơi, with Xóa khối kept apart. During play a live note appears and numbers and colours stay editable (speed and jump change the running game), while Nhân đôi and Xóa are disabled. The empty state lists tips and shortcuts |
| Bottom dock "Bảng tin" | A pinned "việc cần sửa" list is recomputed live (missing required ports, no Nhân vật), each item with a "Xem khối" button. A timestamped log with info/ok/warn/error icons and filters Tất cả/Cảnh báo/Lỗi, plus a clear button. The tab badge shows the issue count |
| Bottom dock "Bài học" | Lesson list with progress ticks on the left. Step card with a segmented progress bar, copy, "Chỉ cho tôi" (highlights the palette item and the target port), and Quay lại / Bước tiếp. Steps auto-complete when the right wires exist. The card sits in the dock, never over the game |
| Splitters | Left, right and bottom. Pointer drag, arrow keys (16px), double-click to reset. The hit area is extended to 13px |
| Layout presets | Mặc định (tabs), Chia đôi (game and graph side by side, both live), Rộng bảng (bottom dock collapses to its tab bar and expands again on tab click) |
| Extras | Undo/redo (60 snapshots), Ctrl+D, Delete, F, +/-, Ctrl+K, Ctrl+S, Ctrl+Enter play/stop, "?" opens a shortcut and glossary dialog. Custom tooltip on `data-tip` (380ms delay, also on keyboard focus). Toasts at the bottom right of the editor, away from the game HUD, with an undo action after delete or new board. Empty-board launchpad. Themed selection, scrollbars, caret and focus rings. `user-select:none` on the chrome. `prefers-reduced-motion` disables all animation |

## How the 15 audit problems are addressed
| # | Problem | Solution in mockup D |
|---|---|---|
| 1 | VN port labels wrap and get clipped | Single-column stacked port rows, `white-space:nowrap`, content-sized nodes (min 168px). Playwright check: 0 clipped labels at 1440, 1280 and 1024 |
| 2 | Overlaps and new nodes landing on others | Free-spot ring search for click and drop, pulse on the new node, "Sắp xếp gọn" layered auto-layout, re-laid sample. Overlap count is 0 after adding |
| 3 | Unreadable fit, no zoom controls | − / % / + / Vừa màn hình toolbar, readout in the toolbar and status bar, fit floor 0.6 that pans to the inputs, semantic zoom below 0.6, minimap |
| 4 | "Khối" is ambiguous | "Khối" now means only a graph node (the palette tab as briefed). The solid object node is called "Hộp". Every node shows an instance subtitle (Mèo, Số xu, Mèo nhặt xu) and has an editable "Tên riêng". A glossary is in the help dialog |
| 5 | Palette is a 41-button wall with no search | Diacritic-insensitive search with synonyms, sticky collapsible categories with counts, icons, one-line descriptions, Enter to add the top hit, drag or click |
| 6 | Header and category contrast fails | Headers are neutral, with text #e7e9ec on #23272e (about 13:1). Category colour appears only on icon tiles (non-text). Secondary text #aab2bd on the panel is about 8:1, and tertiary #8f98a4 is about 5.5:1 |
| 7 | No wire legend, colours clash with categories | Permanent legend, shape plus colour per type (circle/diamond/square), type hues never used for categories, compatible ports pulse and others dim while dragging |
| 8 | "Chơi" turns into "Sửa" and the editor locks | Separate Chơi / Tạm dừng / Từng bước / Dừng. While playing the first button becomes "Chơi lại". Numbers and colours stay live-editable during play, and only structural edits lock. Coloured state ring plus "Đang chơi" label |
| 9 | Game view small and covered by hint, HUD and toast | Game gets the full centre tab or half in Chia đôi. The hint strip is below the canvas. Toasts sit at the bottom right outside the game. "Toàn màn hình" button |
| 10 | Top bar crowded and wrapping | 40px, 3-column grid, verified 1 row at 1440, 1280 and 1024. At ≤1180 the secondary play buttons become icon-only with aria-labels, and the game name hides at ≤1320 (it is also in the status bar). File actions live in the Tệp menu, away from Chơi. Góc nhìn moved to Tệp as "đổi khi tạo mới". SVG icons only |
| 11 | No "why it doesn't work" feedback | "Thiếu N dây" badge, hollow amber dot and "cần nối" on the port, pinned issue list with jump links, fire glow and live value chips on wires during play, contextual warning ("Đã nhặt đủ 5 xu nhưng khối Thắng chưa nối...") |
| 12 | Properties panel under-used | Ports section with help text, connections and jump links; Tên riêng; Nhân đôi; Xem trong Màn chơi (outlines the player); description in body colour; tips plus shortcuts in the empty state |
| 13 | Hidden interactions | Coach strip on the canvas ("Kéo nền... lăn chuột..."), "?" dialog with shortcuts and glossary, shortcut hints in menus and tooltips, status bar hint. Fullscreen is a button that works in any state |
| 14 | Dragging selects page text | `user-select:none` on the chrome (inputs re-enabled), the whole port row is the hit area, and the wire snaps within 24px |
| 15 | Empty board is a dead end | Launchpad with Học từ đầu (primary), Mở game mẫu and Tự làm. The lesson gallery with progress ticks lives in the bottom dock. "Chỉ cho tôi" coaching |

## Verification
- Playwright (Chromium headless), viewports 1440x900, 1280x720 and 1024x700. Results: no console errors or warnings and no page errors. `scrollWidth ≤ innerWidth` at all 3 sizes. Top bar is 40px, with no left-group clipping at all 3 sizes. 0 clipped text in port labels, node titles, palette titles, buttons, tabs and menus. 0 node overlaps on load and after a palette add.
- Interactions tested in the script:
  - Search "nhan vat" returned [Nhân vật, Kẻ địch]. Kẻ địch matches through its description, "...nhân vật".
  - Wrong-type wire (Số → Đúng/Sai) shook the node and showed the toast.
  - Right-type wire connected and the badge cleared.
  - Play gave "Chơi lại" with Dừng enabled.
  - Chia đôi plus pause showed value chips.
  - Lesson tab, Tệp menu, Tạo mới (launchpad) and splitter drag (236 to 314px) all worked.
- Extra screenshots (wiring, reject, play, split-pause, lesson, menu, empty, 1280, 1024) are in `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\28feef90-daae-4318-8ffa-6bf07e972cef\scratchpad\d\`.
- Playwright is not installed under `app/node_modules`. I imported an existing install from an earlier session's scratchpad by absolute path: `...\091c5a2d-...\scratchpad\smoke\node_modules\playwright`. Nothing was installed.

## Not verified / limitations
- Contrast ratios are computed by hand from the hex values, not with a tool run. Disabled controls (#626a75) are below 4.5:1, which WCAG allows for inactive UI.
- The splitter visual is 5px with a 13px hit area, so it is below the 24px target. Keyboard arrows and layout presets are the alternative.
- No real screen-reader pass. ARIA roles are present (tablist, tree, menu, switch, radiogroup, separator, live regions), but roving focus is partial: tabs and tree support arrow keys, while palette items are plain buttons.
- Behaviours that are not simulated: Não bot nodes, Di chuyển, Sinh vật thể, Âm thanh and Chuột produce no game effect. The enemy patrols on a hardcoded path. Lessons 1 and 3–5 are list entries only.
- Quick-add from a canvas double-click or a wire dropped on empty space (audit #5 extra) is not built. A wire dropped on empty space just cancels.
- At 1280x720 the fit zoom is 65% and at 1024 it is 60%, so labels are about 8px and readable only up close. Wider screens get 84%. The minimap hides automatically when the graph is under 480px tall.
- Touch input, the 3D view and persistence (saving is cosmetic) are out of scope.
- Fonts: if Google Fonts is blocked, it falls back to system-ui/Segoe UI. Vietnamese still renders, but it looks less consistent.

## Estimated effort to port into the plain-DOM TypeScript app
| Piece | Est. |
|---|---|
| Tokens, CSS, SVG icon sprite, top bar and menus | 1–1.5 d |
| Dock grid, splitters, tabs, layout presets (persist sizes) | 1–1.5 d |
| Node rendering rewrite (stacked ports, badges, shapes), wire drag with compatibility, snap and shake, value chips | 2–3 d (touches `wiring-canvas.ts`) |
| Zoom toolbar, fit floor, semantic zoom, minimap, smart placement, auto-layout | 1.5–2 d |
| Palette search, categories, drag-add | 1 d |
| Inspector (ports section, live-edit during play, steppers, swatches) | 1.5 d |
| Scene tree bound to real entities | 1–1.5 d |
| Console, issue list, play/pause/step/stop state machine (engine needs pause/step hooks) | 1.5–2 d |
| Lesson dock and launchpad rewiring of the existing tutorial | 1–1.5 d |
| A11y pass, tests, sample re-layout | 1.5 d |
| **Total** | **about 13–17 dev days** (1 dev). The riskiest parts are engine pause/step and live-edit during play |

## Unresolved questions
- Keep "Khối" as the palette tab name, as the brief asked, with the solid object renamed "Hộp"? Saved files and lesson text currently say "Khối", so this needs a migration.
- Should live edits made during play persist after Dừng (the mockup keeps them), or revert like some engines do?
- Can the bundled samples be re-laid out (the mockup's sample uses new coordinates)?
- What should the default layout be for 1280x720 users: tabs (current) or Chia đôi?

Status: DONE_WITH_CONCERNS
Summary: Built a complete interactive pro-docked mockup that addresses all 15 audit problems, with no console errors, no overflow and no clipped text at 1440, 1280 and 1024. The concerns are that some blocks are not simulated, splitter targets are under 24px, readability at 1280 fit zoom is low, and Playwright was borrowed from another scratchpad.
