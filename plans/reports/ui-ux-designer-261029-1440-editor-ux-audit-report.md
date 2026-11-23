# Xưởng Nối: editor UX audit (beginner lens)

Date: 2026-10-29. Method: impeccable `audit.md` + `clarify.md` + `craft-floor.md`, read-only. App not modified.
Screenshots (abbreviated below as `SS/<name>`): `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\c6588d98-de8b-47ca-8a66-fd5282a3c2b1\scratchpad\ui\audit\`. Default viewport is 1440x900. Files ending `-1280` are 1280x720, and `16-viewport-1024` is 1024x700. Scripts are `shots.mjs` and `shots2.mjs` in the same folder.

Measured facts: 41 node kinds plus a "Ghi chú" (note) item. The palette is 2079px tall, about 2.4 screens at 900px. The top bar is 56px high at 1440 and wraps to 95–97px at 1280 and below. The "Né và bắn" sample has 23 nodes and 18 wires. Category header colours against white measure: input 2.77, math 2.49, object 2.80, action 3.09, brain 2.94, output 3.53, logic 4.23. All fail AA for 12–14px text.

## Category scores (0–4)

| Category | Score | Key finding |
|---|---|---|
| Hierarchy | 2 | "Chơi" stands out, but the canvas, palette and props panel all have the same visual weight |
| Discoverability | 1 | No search, zoom or fit controls. Node help only appears in a hover `title` |
| Palette (41 nodes) | 1 | One long list of identical text buttons with no icons, search, favourites or "recent" |
| Node readability | 1 | Port labels wrap one word per line, nodes overlap and labels get clipped |
| Wire legibility | 2 | Type colours are good but there is no legend. Colours clash with category colours and wires run under nodes |
| Top bar density | 2 | 11 controls plus 2 fields on one row. Wraps below 1280. A destructive action sits next to the primary one |
| Properties panel | 2 | Clear form, but ports are not explained, there is lots of dead space, and only one action (delete) |
| Game view | 2 | Small. The hint text covers about a third of it. The toast and HUD collide |
| Tutorial panel | 3 | Good copy and highlight. It covers the canvas, and the lesson menu is an 850px dropdown |
| Feedback/status | 2 | The toast is transient and sits on top of the game. No "why it doesn't work" hints for the graph |
| Keyboard/mouse | 2 | Undo, copy and delete exist but cannot be discovered. Dragging selects text across the page. F is dead in play mode |
| Empty states | 2 | One line of grey text. No "start from a sample" or tutorial button there |
| A11y/contrast | 1 | Category colours fail AA, text inside nodes is unreadable at fit zoom, emoji are used as icons |
| Vietnamese text fit | 1 | Diacritics render fine, but nodes are too narrow for VN labels. "Khối" means two different things |

## Top 15 problems

### 1. [P0] Node bodies are too narrow for Vietnamese port labels, so text wraps word by word and gets clipped
- **Evidence:** `SS/12-zoom-100-nodes`, `SS/03-busy-dodge-shoot`. Labels break one word per line ("Đang / chạm / đất", "Vừa bị / dùng / lên"). The last port ("Vị trí X/Y/Z") is cut off by the node below.
- **Cause:** In `style.css`, `.wc-node{min-width:170px}` with two flex columns and `gap:14px`. Each column gets about 70px.
- **Why it hurts a beginner:** Ports are the whole language of the app. If you can't read a port, you can't wire it. Wrapped labels also make nodes taller than the sample layouts expected, which is what causes the overlaps (#2).
- **Fix:**
  - Use a single-column port layout: inputs stacked on top, outputs below, each row full width. Or size the node to its content: `min-width:220px`, `white-space:nowrap` on port labels, and let the node grow.
  - Shorten long labels and move the detail into the port tooltip ("Vị trí xuất hiện" becomes "Vị trí").

### 2. [P0] Nodes overlap and new nodes land on top of existing ones
- **Evidence:** `SS/03` (Nhân vật covers Hằng số; Hẹn giờ, Hoặc and Khối stacked), `SS/14-added-node-click` (a node added by click lands on top of Sinh vật thể).
- **Why it hurts:** Hidden ports and wires leave the user thinking something is missing. Clicking a palette item makes a node appear under another one, so it looks like nothing happened.
- **Fix:**
  - Auto-place new nodes in the nearest free spot in the visible viewport, then flash or pulse the new node.
  - Add a "Sắp xếp gọn" (auto-layout, left-to-right by data flow) command.
  - Re-layout the samples after #1 is fixed.

### 3. [P0] Fit-to-content zooms busy boards down to unreadable sizes, and there are no zoom controls
- **Evidence:** `SS/07-busy-race`. Zoom is clamped at 0.3, so node text is about 4px. In `SS/03`, port text is about 7px.
- **Cause:** In `wiring-canvas.ts`, the only way to zoom is the mouse wheel (MIN 0.3, MAX 2). There is no fit button, no zoom readout and no minimap.
- **Why it hurts:** Opening a sample, which is the first thing a non-programmer does, shows an unreadable blob. Wheel zoom is not obvious, especially on a trackpad.
- **Fix:**
  - Add a bottom-left canvas toolbar with − / % / + / "Vừa màn hình".
  - Floor auto-fit at about 0.6 and pan to the input nodes instead of shrinking further.
  - Optional: a minimap for boards with more than 15 nodes.
  - Add semantic zoom: below 0.6, show only the node header (big title) and type-coloured port dots.

### 4. [P0] "Khối" means two different things: the palette's word for every node, and one specific node (a solid box)
- **Evidence:** `SS/11-tutorial-step2` says `Kéo khối "Khối"`. The palette title is "Khối". The sample has 4 identical nodes titled "Khối" (`SS/03`).
- **Why it hurts:** The core noun is ambiguous right in lesson 1. Four nodes with the same title can't be told apart without clicking each one.
- **Fix:**
  - Rename the palette concept to "Mảnh ghép" or "Thẻ". Rename the node to "Hộp" or "Bục / Vật cản".
  - Show an instance subtitle on the node header (its colour swatch plus position, or a user-editable name such as "Sàn 1").
  - Keep a short terminology glossary covering khối, cổng, dây and vật thể.

### 5. [P1] Palette: 41 identical text buttons, about 2.4 screens of scrolling, no search
- **Evidence:** `SS/01`, `SS/08-palette-scrolled`, `SS/08b-palette-bottom`. Only a 5px left stripe separates categories, and the headers scroll away (`SS/11` highlights "Khối" with no category context).
- **Why it hurts:** Users can't find "Hiện số" without scrolling and reading every item. Descriptions only appear in a native `title` tooltip after about 1s of hovering.
- **Fix:**
  - Add a search box at the top that matches label, description and synonyms, without diacritics ("hien so" finds "Hiện số").
  - Make category sections collapsible with sticky headers, or use an icon category rail plus a flyout.
  - Give each node an icon and a one-line description under the label.
  - Add a "Hay dùng" (frequent) group and filter by "dùng được với vật đang chọn".
  - Add a canvas quick-add: double-click empty space opens search, and dragging a wire into empty space opens a search filtered by port type.

### 6. [P1] Node header colours and palette category labels fail contrast
- **Evidence:** White on category colour measures 2.49–3.53 for 6 of 7 categories. Header text is 14px/600, which needs 4.5. See `SS/01` (the "ĐẦU VÀO" and "TÍNH TOÁN" headers look washed out).
- **Fix:**
  - Darken category tokens to at least 4.5:1 with white (for example input #0369a1, math #0f766e, object #c2410c, action #4d7c0f, brain #a16207, output #be185d).
  - Or switch to a light tinted header with dark text plus a coloured icon.
  - Category label text should use the dark variant of each colour.

### 7. [P1] Wire and port colours have no legend and clash with category colours
- **Evidence:** The bool wire (#22a559) and action category (#65a30d) are both green. The number wire (#2f6fe4) and input category (#0ea5e9) are both blue. The object wire (#f08a24) and object category (#f97316) are both orange. Wires pass under nodes (`SS/03`: orange object wires cross 3 columns).
- **Why it hurts:** Beginners can't learn that "green dot = Đúng/Sai", and colour alone carries the type (WCAG 1.4.1).
- **Fix:**
  - Add a permanent mini legend on the canvas: ● Đúng/Sai ● Số ● Vật thể.
  - Give each type a dot shape as well as a colour (bool = round, number = diamond, object = square).
  - Move category colours to a different hue family, or drop them from node headers.
  - While dragging a wire, dim incompatible ports and pulse compatible ones across the whole board.

### 8. [P1] Play/Edit toggle: "Chơi" turns into "Sửa" rather than "Dừng", and the whole editor locks
- **Evidence:** `SS/05-play-mode`. The button becomes amber "Sửa". The palette is greyed out. The props panel shows "Đang chơi: bấm 'Sửa' để chỉnh."
- **Why it hurts:** The mental model is play/stop. "Sửa" doesn't read as "stop the game". There is no restart button. A user who wants to tweak speed has to stop, edit and press play again, which makes the loop slow.
- **Fix:**
  - Use separate ▶ Chơi / ■ Dừng / ↻ Chơi lại controls attached to the game view.
  - Let number and colour properties stay live-editable during play, and lock only structural edits.
  - Show a clear "ĐANG CHƠI" state frame around the game.

### 9. [P1] The game view is small, and hint text, HUD and toast all cover it
- **Evidence:** `SS/05`: the hint "Mũi tên: đi, Space: nhảy…" covers about 30% of a 420x300 view. The "Đã mở game" toast and the "Máu mục tiêu" HUD share the top-right corner (`SS/03` vs `SS/05`). `SS/15-maximized-play` works well.
- **Fix:**
  - Put the game hint in a strip below the game view, not overlaid on it. Allow collapsing it.
  - Move app toasts to the bottom-centre of the canvas, away from the game.
  - Make the game view bigger by default (about 40% width), or auto-enlarge on Play.
  - Keep ⛶ but label it "Toàn màn hình".

### 10. [P1] The top bar is crowded, wraps at ≤1280px, and mixes destructive, primary and settings controls
- **Evidence:** `SS/03-busy-dodge-shoot-1280` and `SS/16-viewport-1024`: the bar becomes 2 rows (95px), which steals canvas height. "Tạo mới" sits right next to "Chơi". "Ghi chú" appears twice (top bar and palette). "Góc nhìn" (which changes game type and can disable nodes) sits next to the name field like a cosmetic setting.
- **Fix:**
  - Group as [Logo · Game name (editable title)] … [Undo/Redo icons] … [▶ Chơi (big)] … [File menu: Tạo mới / Mở / Lưu / Game mẫu] [Hướng dẫn].
  - Move "Góc nhìn" into the new-game dialog and the File/Settings menu.
  - Remove the duplicate "Ghi chú" from one of its two places.
  - Use real SVG icons instead of the emoji ↩️ 📝 📘 🎯 (craft-floor bans emoji standing in for icons, and they render inconsistently across OSes).

### 11. [P1] No feedback on why a game doesn't work
- **Evidence:** In `SS/05`, wire value badges ("Sai", "0.00") are the only runtime insight. Badges overlap port labels ("Sai" over "Số cần hiện"). Nodes have no warning state for a required input that isn't connected, and nothing indicates an orphan node.
- **Why it hurts:** A beginner's main question is "tại sao nhân vật không chạy?". Right now they have to debug by reading badges.
- **Fix:**
  - Mark unconnected required inputs with a hollow dot plus an amber "cần nối" chip.
  - Pulse a node's header when it fires during play (activity glow).
  - Place badges at the wire midpoint with collision avoidance.
  - Add a "Kiểm tra" list of issues ("Nhân vật chưa có điều khiển").

### 12. [P2] Properties panel is under-used and doesn't explain ports
- **Evidence:** `SS/04-node-selected-props`: name pill, 12px grey description, one field, "Xóa khối". About 70% of the panel is empty.
- **Fix:**
  - Add a "Cổng" section listing each input and output with its type icon and a one-sentence explanation, plus what it is currently connected to (click to jump there).
  - Add "Nhân đôi", "Xem trong game" (highlight the entity) and a mini usage example.
  - Make the description 13–14px in body text colour.
  - Empty state: show tips plus the keyboard shortcuts list.

### 13. [P2] Hidden interactions: shortcuts, wheel zoom, pan, marquee, double-click splitters
- **Evidence:** Undo, copy/paste, Ctrl+D, Delete, F and Esc only appear in `title` attributes. The F shortcut is disabled during play (`app.ts:234`), which is exactly when users want fullscreen, even though the tooltip says "phím F". Panning is drag-on-empty, and marquee selection exists but nothing shows it.
- **Fix:**
  - Add a "?" button that opens a shortcut sheet in Vietnamese.
  - Show a one-time coach mark on the canvas: "Kéo nền để di chuyển · Lăn chuột để phóng to".
  - Make the fullscreen button work in play mode (it does), and drop the "phím F" claim or move fullscreen to a key that doesn't conflict.

### 14. [P2] Dragging on the canvas selects text across the whole page
- **Evidence:** `SS/13-wire-dragging` and `SS/15`: a missed drag from a port highlights the top bar, palette labels and props in blue, and the highlight stays into play mode.
- **Fix:** Set `user-select:none` on the app chrome (top bar, palette, panel titles) and keep it only on inputs, notes and the props text. Make the port hit area larger than the 18px dot by using the whole row (it already has `cursor:crosshair`). Snap the wire to the nearest compatible port within 24px.

### 15. [P2] The empty board and first-run experience are a dead end
- **Evidence:** `SS/01`: grey centred text only. `SS/00`: the tutorial invite is a small popover under the top bar, easy to dismiss with "Không" and never offered again.
- **Fix:**
  - Make the empty canvas a launchpad with 3 big cards: "Học từ đầu (Bài 1)", "Mở game mẫu" (thumbnails) and "Tự làm".
  - Keep the hint "kéo mảnh ghép từ trái sang" with an illustrated arrow.
  - The tutorial lesson menu (`SS/09`, 850px tall dropdown) should become a lesson gallery with progress ticks and a "tiếp tục bài X" button.

## Must-have in any redesign
- [ ] Node layout that fits VN labels on one line (single-column ports or content-sized nodes). No overlaps, and new nodes go to a free spot.
- [ ] Palette search that ignores diacritics, plus collapsible sticky categories, icons and one-line descriptions. Quick-add from the canvas and from a wire drop.
- [ ] Canvas toolbar with zoom −/+/%, "Vừa màn hình", auto-layout, and a type legend. Readable minimum zoom or semantic zoom.
- [ ] One unambiguous term for nodes, distinct from the "Khối" object node. Node instance subtitles.
- [ ] Separate Play / Stop / Restart attached to the game view. Live-tweak numbers during play.
- [ ] Game view not covered by app UI: hint strip below it, toasts away from the HUD.
- [ ] Top bar on one row at ≥1024px: File menu, editable title, icon undo/redo, one dominant ▶ Chơi. No destructive action next to the primary.
- [ ] Port types shown by colour and shape. Compatible ports highlighted during a wire drag. Missing required input states.
- [ ] Category and header colours ≥4.5:1. SVG icon set instead of emoji. Visible focus rings. `prefers-reduced-motion` respected (the tutorial pulse loops forever).
- [ ] Empty-state launchpad (lesson / sample / blank) and a discoverable shortcut sheet.
- [ ] Tutorial panel that docks rather than floating over the drop zone, plus a lesson gallery with progress.

## Unresolved questions
- Are touch and tablet in scope? Nothing is responsive below 1024px, and the panels are fixed widths.
- Can samples be re-laid out, or must saved board coordinates stay stable for existing user files?
- Is renaming "Khối" (palette and node) allowed, given that lesson text and saved files reference it?

Status: DONE
Summary: 15 prioritised UX problems, each with screenshot evidence and a concrete fix, plus a redesign must-have checklist. The biggest blockers are node labels that don't fit, overlapping nodes, unreadable fit-zoom, and the ambiguous term "Khối".
