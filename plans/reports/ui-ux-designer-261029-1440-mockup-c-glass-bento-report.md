# Mockup C: "Kính mờ hiện đại" (glass bento) editor

**Mockup:** `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\c6588d98-de8b-47ca-8a66-fd5282a3c2b1\scratchpad\ui\c-glass-bento\index.html`
**Preview:** `...\c-glass-bento\preview.png` (1440×900, edit state, state switcher open)
**Extra state shots:** `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\091c5a2d-ceff-4dfe-a2af-61a656b30d1c\scratchpad\c-{play,tutorial,cmdk,empty,max}-1440.png`, `c-play-1280.png`, `c-placed.png`
**Deep links:** `index.html?state=play|tutorial|cmdk|empty|max|toast`. These can be combined, e.g. `play,max`.

The app was not modified. The mockup is one self-contained file. Google Fonts is optional (Be Vietnam Pro, with a system fallback). There are no other network calls and no console errors.

## Direction
- **Theme:** light, because the user is a non-programmer working at home in daylight. A soft ambient backdrop (blue / peach / mint radial light) sits under frosted panels.
- **Where glass is used:** only on the frame (top bar, palette, game and properties tiles, zoom, minimap, legend). Anything people have to read is solid: node cards, the game screen, the coach card, toasts.
- **Glass fallback:** every glass surface falls back to solid `#F6F8FB` when `backdrop-filter` is unsupported or `prefers-reduced-transparency` is on. AA contrast never depends on the blur.
- **Main motion moment:** pressing Chơi. The button turns dark into "Dừng", "Chơi lại" appears, live wires start flowing, wires that are off dim to 32%, live values show inside node rows, the status pill pulses and the cat walks to the stars. Everything else is quick feedback at 140–240ms with ease-out `cubic-bezier(.16,1,.3,1)`.

## Tokens
| Token | Value |
|---|---|
| Font | Be Vietnam Pro 400/500/600/700, Vietnamese subset; tabular numbers |
| Ink | `#0F172A` / `#334155` / `#556378` (≥4.6:1 on glass fallback) |
| Accent | `#4F46E5` (hover `#4338CA`, soft `#EEF0FF`) |
| Port colours (unique on canvas) | bool `#16A34A` circle · number `#2563EB` rounded square · object `#EA580C` diamond |
| Category colours (avoid port hues; pale tint + dark ink) | Đầu vào violet `#6D28D9/#EDE9FE` · Logic slate `#334155/#E2E8F0` · Tính toán wine `#9D174D/#FCE7F3` · Vật thể ochre `#92400E/#FEF3C7` · Hành động red `#B91C1C/#FEE2E2` · Bộ não indigo `#4338CA/#E0E7FF` · Kết quả fuchsia `#A21CAF/#FAE8FF` |
| Glass | `rgba(255,255,255,.62)` + `saturate(170%) blur(22px)`; strong variant `.84` |
| Radius | tiles 16 · nodes 12 · controls 10 · pills 999 |
| Elevation | tile: soft offset shadow + inset highlight (no 1px border plus wide shadow); node: `0 1px 2px, 0 6px 16px -6px` |
| Motion | 140 / 240 / 420ms; one easing curve; with reduced motion, wire flow, ring pulse and character movement stop, but state colours stay |
| Layout | 12px gutters; top bar 60px; columns 248 / 1fr / 320 (232 / 1fr / 320 below 1360px) |

## Audit points handled (from `ui-ux-designer-261029-1440-editor-ux-audit-report.md`)
1. **Narrow cards:** cards are now 216px with 13px rows. Labels like "Đang chạm đất" and "Giây còn lại" fit on one line.
2. **Overlap on add:** `findFree()` searches outward in a spiral until it finds a slot with a 16px margin. A dashed ghost outline flashes where the node lands, the view pans if the slot is off-screen, and a toast says "vào chỗ trống gần giữa bảng". Tested: 4 nodes added, 0 overlaps.
3. **Busy boards:** zoom −/+ with a % readout, a labelled "Vừa màn hình" button, Ctrl+wheel zoom, drag to pan, and a minimap showing the viewport rectangle.
4. **"Khối" means two things:** palette items are now "khối lệnh". The box object is renamed "Hộp" (its description notes the old name).
5. **Palette:** search with Ctrl K hint, category filter chips, icon tiles, and 2-line descriptions for all 41 kinds. Search ignores diacritics: "dem" finds "Bộ đếm".
6. **Contrast:** there is no white text on category colours anywhere. The dark-on-tint pairs reach ≥7:1.
7. **Colour clash:** category hues avoid green, blue and orange, so those three mean port type only. Ports also differ by shape. A port legend pill sits at the top-left of the canvas.
8. **Chơi button:** Chơi becomes **Dừng** (stop glyph), and **Chơi lại** appears next to it while playing. "Sửa" is gone.
9. **Game view:** hints moved to a caption under the screen. The HUD uses the screen's top corners. Toasts sit top-centre of the viewport, never in a game corner, and are fixed-position so nothing shifts.
10. **Top bar:** measured `scrollWidth == clientWidth` at 1280 and 1440 in both play and edit states. Below 1360px, Tạo mới / Mở / Lưu / Hướng dẫn collapse to icons with tooltips. File actions sit on the left, far from Chơi. Ghi chú appears once (canvas toolbar). All icons are authored SVG.
11. **Missing / overlapping values:** a required input with no wire gets a red dashed port, a red label, a "Thiếu dây" badge and a rose outline (the second "Hiện số" node). Live values are pills inside node rows, not chips on wires, so they cannot cover labels.
12. **Empty board:** a card titled "Bảng nối đang trống" with 3 steps and three actions: Học bài 1 (opens the tutorial), Mở game mẫu, and Thêm khối lệnh (Ctrl K).

## Other improvements over the current editor
- Each node card shows its key setting under the title ("Phím Space", "Mục tiêu: 5", "30 giây"), so you don't have to open Properties.
- Bool values read "Bật / Tắt" instead of "Sai / Đúng", which is friendlier for kids.
- Properties for Nhân vật:
  - look picker (6 tiles that use the chosen colour)
  - colour swatches plus a custom picker
  - sliders paired with number inputs
  - role as a segmented control
  - spawn position as X/Y/Z
  - changes update the game scene and the node subtitle live
- Empty Properties panel explains what to do next.
- The palette locks during play and says why.
- Tutorial:
  - spotlight with a pulsing ring on the target palette card
  - coach card with "Bước 3/12", the lesson name, a progress bar, Quay lại / Tiếp and Thoát bài
  - the tip mentions click-to-add as a fallback for dragging
- Keyboard:
  - Ctrl K opens the command palette (combobox / listbox with `aria-activedescendant`, ↑↓ to move, Enter to add)
  - Ctrl S saves, `/` focuses search, Esc closes the top layer
  - segmented controls use radiogroup with arrow keys
  - visible focus rings everywhere
- Themed browser surfaces: selection, caret, scrollbars and focus ring all use the palette.

## Where the 21st.dev patterns are used
I browsed the category index: Docks, Grids & Bento, Toasts, Tooltips, Tabs/segmented, Search Bars, Onboarding/Steppers, plus the "Liquid Glass Button" and "Spotlight Card" ideas. All code is my own; nothing was copied.
- **Bento grid:** the whole editor frame, built from tiles of different sizes.
- **Floating glass dock / nav pill:** the top bar.
- **Command palette (cmdk style):** "Thêm khối lệnh nhanh".
- **Segmented control with a sliding thumb:** the mode switch and the role picker.
- **Toast stack:** fixed top-centre, slides in and out, with an action (Hoàn tác / Làm lại).
- **Tooltip:** CSS-only, shows on hover and on keyboard focus after a 350ms delay.
- **Onboarding spotlight / stepper:** the tutorial.
- **Glass card:** tiles, with solid fallbacks.

## Effort to port into our plain-DOM TS app (rough)
| Item | Effort | Notes |
|---|---|---|
| Design tokens + glass shell CSS, grid widths | S | CSS variables in one stylesheet; `layout-model.ts` / `layout-splitters.ts` keep the resizable splitters |
| Top bar regroup, segmented mode, Dừng/Chơi lại, icon sprite | S–M | `top-bar.ts`; the sprite replaces the emoji icons |
| Palette: search with diacritic folding, chips, descriptions | S | `palette.ts`; descriptions come from `NodeDef.description` (shortened) |
| Command palette | M | new `command-palette.ts`; reuses palette data and the add-node path |
| Node card restyle, port shapes, key-setting subtitle, missing-input marker | M | `wiring-canvas.ts`; needs a "required" flag on port defs (new contract) or a heuristic |
| Live value pills in rows + flow animation | M | read engine outputs once per frame; throttle DOM writes to about 10Hz |
| Smart placement | S | pure function over node rects, unit-testable; replaces the drop-at-centre logic |
| Zoom/fit/minimap | M | check what `wiring-canvas.ts` already has; minimap as a small SVG |
| Properties restyle, look picker tiles, slider + number pairs | S–M | `properties-panel.ts`, `look-picker.ts` |
| Tutorial spotlight ring + coach card | S | restyle the existing tutorial overlay; position from the target's rect |
| Empty-board state | S | |
| Rename "Khối" box to "Hộp" | S | label only in `nodes/block.ts`; keep kind `block` so saves don't break |

## Limitations
- Detailed Properties exist only for Nhân vật; other nodes show their name and description.
- Nodes added in the mockup have no ports (only the 11 sample kinds carry port data).
- Wiring by dragging between ports is not implemented; the wires are fixed sample data.
- At 1280px the canvas cuts off the right column of nodes at 85% zoom. That is intended: "Vừa màn hình" and the minimap cover it, but a real fit should compute the zoom.

## Unresolved questions
1. Should node defs gain a `required: true` port flag, or should "Thiếu dây" use a heuristic (for example, output nodes with no wired input)?
2. Is renaming the box object to "Hộp" acceptable, or would you prefer "Vật cản"? The internal kind stays `block` either way.
3. Category colours change from the current app (input was cyan, output pink) to keep green, blue and orange for ports only. Is that OK for existing tutorial screenshots and copy?

Status: DONE_WITH_CONCERNS
Summary: Glass-bento mockup delivered with every requested state plus all 12 audit points, tested at 1440 and 1280 with no console errors. Concerns: the required-port contract and the category colour change need decisions.
