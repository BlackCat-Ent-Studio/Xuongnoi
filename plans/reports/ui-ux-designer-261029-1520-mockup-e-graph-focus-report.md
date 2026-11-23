# Mockup E "Tập trung nối dây": report

Date: 2026-10-29. Files: `plans/ui-mockups/e-graph-focus/index.html` (1169 lines, ~100 KB, inline CSS+JS, only Google Fonts Be Vietnam Pro) and `preview.png` (1440x900).

## Direction
- Operate mode (impeccable). Dials VARIANCE 4, MOTION 4, DENSITY 6.
- Dark cool-graphite shell. One accent: workshop orange `#FF8A3D`, used only for Chơi, the current selection and the "ĐANG CHƠI" frame. Warnings are amber (`#FFCC4D` on `#3A2D0C`).
- Not the A palette (warm yellow), not Unity/Unreal greys or blues.
- One family (Be Vietnam Pro, which has Vietnamese glyphs), tabular numerals, themed selection, scrollbars and focus ring.
- Authored SVG icon set, all 1.75 stroke. No emoji, no em or en dashes (grep shows 0).
- Port types use colour plus shape: Đúng/Sai is a green circle, Số is a blue diamond, Vật thể is a pink square. Category colours are pastels that only tint icon chips. They are never used as header fills.

## What was built
- **Top bar (44px, never wraps; measured at 1280 and 1440).** It holds:
  - Logo, a Tệp menu and an editable project name.
  - Undo and redo icons.
  - A segmented control: Nối dây / Chơi thử / Cân bằng.
  - Chơi / Dừng / Chơi lại, with disabled states.
  - Live save status ("Đang lưu..." changes to "Đã lưu"), a Tìm Ctrl K button and "?".
  - Below 1360px the wordmark and save label hide. Destructive and settings items (Tạo mới, Góc nhìn) are in the Tệp menu.
- **Icon rail and palette drawer.**
  - The rail has a toggle, search, 7 category icons that open the drawer at that category, and Bài học.
  - The drawer has 31 mảnh ghép. Sticky, collapsible category headers. Each item shows an icon, name and a one-line description (wraps, never clipped).
  - Search ignores diacritics using NFD plus đ→d: "nhan vat" finds Nhân vật, and highlights the match.
  - Has an empty-result hint.
  - Click adds the node at a free spot in the visible viewport. Drag-drop adds it at the drop point, then spirals to a free spot. Both avoid other nodes and the overlays, flash the new node and select it.
- **Graph.**
  - 10 sample nodes and 8 wires: Phím → Nhân vật; Nhân vật + Đồng xu → Khi chạm → Bộ đếm → Hiện số / So sánh → Thắng; Hẹn giờ; Thua.
  - Single-column ports with full-width nowrap labels; the node grows to fit.
  - Each header has an instance subtitle ("Mèo cam", "Màn thua").
  - The unwired required port shows a hollow dot, a "cần nối" tag, a "Thiếu 1 dây" header badge and an inline suggestion box with "Nối giúp tôi".
  - Wire drag: compatible ports pulse and incompatible ones dim. It snaps within 24px. A wrong-type drop shakes the port and the toast explains why ("dây mang Đúng/Sai, còn cổng này nhận Số").
  - Dropping a wire on empty space opens quick-add filtered by port type and auto-wires the new node.
  - Dragging an input that already has a wire detaches it. Click a wire, then press Delete to remove it.
  - Undo and redo work via snapshots.
- **Canvas tools.**
  - Vertical zoom stack: + / % (click returns to 100%) / − / Vừa màn hình / Sắp xếp gọn. Sắp xếp gọn lays nodes out in columns by data-flow depth, with animation.
  - Minimap (click or drag to jump) with the type legend under it.
  - Wheel zoom around the cursor. Drag the background to pan. Double-click opens quick-add at that spot.
  - Fit chooses the largest zoom at which no node sits under the tutorial card, the issues chip, the tools or the PiP. Below 50% it switches to semantic zoom (titles only).
- **Tutorial card.**
  - Docked top-left as a wide, short strip: lesson, progress segments, step, text, "Nối giúp tôi" and "Chỉ chỗ".
  - "Chỉ chỗ" draws a dashed ghost wire. The lesson advances when the wire exists, then offers "Chơi thử ngay".
  - In the Chơi thử and Cân bằng presets it collapses to its header. It never covers the game.
- **Inspector "Thuộc tính" (collapsible to a 44px rail).**
  - Shows the title, category and a 13.5px description.
  - An issue box with "Nối giúp tôi".
  - A "Tên riêng" field.
  - Thông số fields with steppers, marked "chỉnh được khi đang chơi". They are live, so Tốc độ changes the cat's speed at once.
  - Port list: type shape, type name, a one-sentence explanation, and "Nối với" links that jump to the other node.
  - Nhân đôi, plus Xem trong game for objects. Xóa sits on its own row.
  - Empty state: tips and a 4-term glossary (Mảnh ghép, Cổng, Dây, Vật thể).
- **Game view.**
  - A canvas top-down collect game. It reads the graph live:
    - Movement only works if Phím is wired to each axis. Speed comes from Nhân vật's Tốc độ.
    - Coins are collected only if Khi chạm is wired, the counter only counts if Khi chạm → Bộ đếm is wired, and the HUD only shows if Hiện số is wired.
    - The game is won at the So sánh Mốc, and lost on timeout only if Thua is wired. Otherwise a warning toast explains why it didn't end.
    - Number wires show live value badges during play. Nodes glow when they fire.
  - Three modes:
    - PiP at bottom-right, minimizable.
    - Docked to the right edge: 52% wide in Chơi thử, 420px in Cân bằng.
    - Full: covers the work area. Esc exits. It has its own Chơi / Dừng / Chơi lại.
  - The key hint sits in a strip below the canvas, not over it. An orange frame plus a "ĐANG CHƠI" chip show while playing.
- **Layout presets actually move panels.**
  - Nối dây: drawer open, inspector open, PiP game.
  - Chơi thử: drawer and inspector collapsed, large docked game.
  - Cân bằng: drawer collapsed, docked game plus inspector.
- **Ctrl+K palette.** Searches nodes and commands without diacritics, with arrow, Enter and Esc. The "?" popover lists the shortcuts.
- **Launchpad (Tệp > Tạo mới).** Three rows: Học từ đầu, Mở game mẫu, Tự làm. Plus "Quay lại".
- **Toast.** A fixed-position lane under the tutorial card, `role=status`. It never shifts layout and never sits over the game HUD.

## The 15 audit problems
| # | Problem | How E solves it |
|---|---|---|
| 1 | VN port labels wrap or clip | Single-column ports, nowrap labels, nodes grow to fit. The automated clip check found 0 clipped labels at 1280 and 1440. |
| 2 | Overlaps, new node lands on another | Free-spot search inside the viewport that avoids nodes and overlays, then a flash and select. "Sắp xếp gọn" auto-layout. Measured overlaps: 0, including after adding a node. |
| 3 | Unreadable fit, no zoom controls | Zoom stack with % readout, Vừa màn hình and a minimap. Fit is about 75% at 1440 in Nối dây. Semantic zoom applies below 50%. |
| 4 | "Khối" ambiguous | The palette concept is "Mảnh ghép". The box node is "Hộp". Instance subtitles. Glossary in the inspector. |
| 5 | 41 buttons, no search | Diacritic-insensitive search with highlight, a category rail, collapsible sticky headers, icons and descriptions. Ctrl+K, double-click and wire-drop quick-add. |
| 6 | Header contrast fails | Headers are neutral with light text (about 12:1). Category colour appears only as a pastel icon on a dark chip. The lowest text token, `#8F9AAA`, measures about 5.3–6:1 on the panels. |
| 7 | No legend, type and category colours clash | Permanent legend. Shape per type. Categories moved to pastels on icons only. Compatible ports pulse and incompatible ones dim during a drag. |
| 8 | "Sửa" instead of Dừng, editor locks | Separate Chơi / Dừng / Chơi lại. Nothing locks: numbers and wires stay editable live during play. |
| 9 | Game small and covered | Hint strip below the game. Toast moved away from it. Docked or full modes. HUD drawn by the game only. |
| 10 | Top bar crowded and wraps | 44px at 1280 with scrollWidth equal to clientWidth. Tạo mới and Góc nhìn moved into Tệp. No destructive control next to Chơi. SVG icons. |
| 11 | No "why it doesn't work" | Missing-port states, a "N việc cần sửa" chip that jumps to the node, suggestions with Nối giúp tôi, live wire badges, fire glow, and an explanatory toast when the game can't win or lose. |
| 12 | Inspector under-used | Ports explained with type and connection links, an issue box, live number steppers, Nhân đôi, Xem trong game, and a separated Xóa. |
| 13 | Hidden interactions | "?" shortcut sheet, a one-time coach chip ("Kéo nền để di chuyển. Lăn chuột để phóng to."), tooltips on icon buttons, and Esc exits fullscreen. |
| 14 | Drag selects page text | `user-select:none` on the chrome (inputs excepted). The whole port row is the hit area, with a 24px snap. |
| 15 | Dead-end empty state | Launchpad with lesson, sample and blank options. Tutorial strip with progress and a "Nối giúp tôi" escape hatch. |

## Verification (Playwright, Chromium)
- 1440x900 and 1280x800: 0 console or page errors. `document.scrollWidth` equals the viewport. Top bar is 44px with no overflow. 0 clipped labels across nodes, palette, buttons, legend, tutorial and hint. 0 node-to-node overlaps. 0 nodes under overlays in all 3 presets.
- Scripted flows passed:
  - Search "nhan vat" returns [Nhân vật, Đồng xu]. Đồng xu matches through its description.
  - A wrong-type wire is rejected: shake plus an explanatory toast.
  - "Nối giúp tôi" clears the issue.
  - Play with an arrow key: the cat moves, coins count, and a badge shows on the wire.
  - Preset switches, palette click-add, Ctrl+K "hen gio", and fullscreen with Esc.
- Note: Playwright is not installed under `app/` (no package in `app/package.json`). The script `require`d an existing install from an earlier session's scratchpad, read-only. The script is at `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\28feef90-daae-4318-8ffa-6bf07e972cef\scratchpad\e\shot.cjs`.

## Estimated effort to port into the plain-DOM TS app
| Piece | Est. |
|---|---|
| Shell: top bar, rail, drawer, inspector collapse, 3 presets with game re-parenting | 1.5–2 d |
| Palette: search (fold), sticky categories, click or drag add, smart placement | 1–1.5 d |
| Node rendering: single-column ports, subtitles, missing state, suggestion and auto-wire | 1.5 d |
| Wire drag: compat dim or pulse, snap, shake, detach, wire-drop quick-add | 1–1.5 d |
| Zoom stack, fit with overlay avoidance, semantic zoom, minimap, auto-layout | 1.5–2 d |
| Inspector: ports section, live props during play, actions | 1 d |
| Game view modes (PiP, dock, full), hint strip, play/stop/restart, live-edit wiring to the real runtime | 1.5–2 d |
| Ctrl+K, shortcut sheet, toast lane, launchpad, tutorial strip re-dock | 1.5 d |
| A11y and QA pass (focus order, live regions, 1024–1440) | 1 d |
| **Total** | **about 11–14 dev days** |

The biggest risk is making play mode non-locking in the real runtime, because the mockup fakes it with a small game that reads the graph each frame.

## Not verified / limitations
- No screen-reader pass or keyboard-only full walkthrough. Focus rings are defined, but the tab order wasn't audited.
- Reduced motion is handled in CSS but was not toggled in the test.
- Contrast was computed by hand for the key tokens. No automated tool was run.
- At 1280 the Cân bằng preset fits to 44%, so semantic zoom shows titles only. Nối dây at 1280 fits to 57%, and port text is about 7.7px there. The user has to zoom in or collapse the drawer. The audit's "floor about 0.6" can't hold with this sample plus the PiP plus the tutorial in a 692px-wide stage.
- 1024px was not tested. Touch was not tested.
- Icons are hand-authored SVG, because no CDN was allowed. taste-skill prefers a library such as Tabler or Phosphor for the real app.
- Some category pastels sit near type hues (math teal vs bool green, output sky vs number blue). The difference is carried by context (icon chip vs port dot) and by shape, not by hue alone.
- Tệp > Mở, Game mẫu and Góc nhìn are stubs that only show a toast.

## Unresolved questions
- Should play mode allow structural edits (adding nodes and wires) live, as in this mockup, or lock them as the audit suggested?
- Is it acceptable for the Nối dây preset to start at 57% on 1280-wide screens, or should the drawer start collapsed there?
- Rename "Khối" to "Hộp" and use "Mảnh ghép" for nodes: this affects lesson text and saved files.

Status: DONE_WITH_CONCERNS
Summary: Built a working graph-focused editor mockup in a single HTML file, with real search, wiring rules, auto-wire, presets, a PiP/dock/full game driven by the graph, and full Vietnamese UI. It addresses all 15 audit problems and passed automated overflow, clipping, overlap and console checks at 1280 and 1440. The concerns are small fit zoom on narrow presets and a Playwright install that isn't where the brief said.
