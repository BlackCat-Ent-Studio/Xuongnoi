# Mockup A: "Studio tối" (dark pro studio) - design report

- Mockup: `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\c6588d98-de8b-47ca-8a66-fd5282a3c2b1\scratchpad\ui\a-dark-studio\index.html` (one self-contained file, inline CSS/JS/icons; Google Fonts is optional and falls back to Segoe UI / Consolas)
- Screenshot: `...\a-dark-studio\preview.png` (1440x900, edit state, node selected)
- Extra state shots: `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\091c5a2d-ceff-4dfe-a2af-61a656b30d1c\scratchpad\shots\` (tut, play, empty, toast-nosel, w1280, w1280play, search, add, cmdk, mock-open)
- URL flags for review: `?tut` `?play` `?empty` `?nosel` `?toast` `?closed` (collapses the mockup bar)
- The app was not modified.

Design read: a work tool for a non-programmer, dark studio language, calm and dense. Dials: variance 4, motion 4, density 6. Light/dark: dark suits long building sessions and makes the colored wires and the game view stand out.

## Design tokens

| Group | Tokens |
|---|---|
| Neutrals (cool graphite, one family) | bg `#0E1014`, canvas `#111318`, surface `#161920`, raised `#1D2129`, raised-2 `#252A34`, line `#2A303B`, line-strong `#39404D` |
| Text | `#ECEEF2` (primary), `#B4BBC8` (secondary, about 9:1 on surface), `#8A93A3` (meta, about 5.6:1), `#5D6574` (disabled only) |
| Accent (one only) | amber `#F5C451` / hover `#FFD36E`, ink on accent `#1B1606` (about 11:1). Used for: Chơi, selection, focus ring, tutorial ring, slider fill |
| Port types (color + shape) | bool `#4ADE80` circle, number `#60A5FA` diamond, object `#FB923C` square. Legend pinned top-left of the canvas |
| Categories (pastel, placed between the port hues) | Đầu vào `#67E8F9`, Logic `#A78BFA`, Tính toán `#F9A8D4`, Vật thể `#D9F99D`, Hành động `#FCA5A5`, Bộ não `#E879F9`, Kết quả `#CBD5E1`. Only used as icon tint, a 2px marker, or text on dark (all at least 7:1 on surface). Never a fill under white text |
| Status | ok `#5EE09A`, danger `#FF7A7A` |
| Type | Be Vietnam Pro 400/500/600/700 (full Vietnamese support) + JetBrains Mono 500 for keys, numbers, values. Scale 11.5 / 12.5 / 13.5 (body) / 15 / 18 / 22. Node title 14.5, port 13. Tabular figures on numbers |
| Radius (fixed rule) | 6 kbd/chip, 8 buttons/inputs, 12 cards/nodes/panels/popovers, 50% only on swatches/dots |
| Spacing | 4pt scale: 4 / 8 / 12 / 16 / 20 / 24 / 32 |
| Motion | ease `cubic-bezier(.16,1,.3,1)`. 120-300ms for state changes. The main moment: Chơi changes the grid columns (450ms), the game view grows and the canvas fades under a veil while the wires show moving dashes. `prefers-reduced-motion` turns off the loops (star bob, run, ring pulse) |
| Layout | top bar 56, palette 248, side 360 (playing + enlarge: canvas 360, game takes the rest), node width 216 |
| Z scale | canvas-ui 5, overlay 20, pop 30, toast 40, modal 50, mock 60 |

## How the audit findings are handled (from the controller's message)

1. **Port labels wrapping in narrow cards**: cards are 216px wide with ports in two columns; long labels like "Đang chạm đất" and "Giây còn lại" fit on one line at 84%. Parameter values sit in their own footer row of chips, so they never overlap port labels (11).
2. **Overlap and smart placement**: clicking a palette item or using Ctrl+K searches outward in a spiral on a 24px grid for the nearest free slot. A dashed slot preview appears, then the new card flashes. The toast says "Đã thêm X vào chỗ trống gần nhất" and offers Hoàn tác. Dropping a card also snaps to a free spot.
3. **Busy boards**: zoom -/+, a % readout, "Vừa màn hình", Ctrl+scroll to zoom, drag the background to pan, and a minimap with the viewport outlined.
4. **"Khối" meant two things**: palette items are called **khối lệnh** everywhere (search box, Ctrl+K, properties, footer "41 khối lệnh"). The box object is renamed **Hộp** (package icon) in the Vật thể group.
5. **Palette**: live search that ignores accents ("nhay" finds "nhảy", "dem" finds "Bộ đếm") with the match highlighted, an icon on every item, color-coded categories that collapse, and a hover/focus popover with the description and port list.
6. **Category contrast**: categories are no longer used as button fills. They are pastel tints on dark, so text passes AA by a wide margin.
7. **Wire vs category colors**: the two palettes are separate (see the token table). Ports also differ by shape, so color is never the only cue.
8. **Chơi becomes Dừng**: while playing, the main button shows "Dừng" (stop icon, Esc) and a "Chơi lại" button (Ctrl+R) appears next to it. The canvas veil also has a Dừng button.
9. **Game view clutter**: the hints "Kéo vật trong khung..." and the control keys moved to a caption under the stage. The HUD stays in the stage's top corners. Toasts are centered over the canvas and never sit over the game. When enlarged, the stage keeps its 16:10 ratio so nothing is cropped.
10. **Top bar**: no wrapping at 1280, in both edit and play (checked: overflow 0). Below 1360px the "Góc nhìn" label and the save-state text hide, and the mode switch hides while playing. File actions are on the left, Chơi is on the far right. There is one Ghi chú entry (palette only). All icons are Phosphor SVGs, no emoji.
11. **Required inputs not connected**: required ports show a hollow ring plus a "cần nối" tag, and the card header gets a red dot. A canvas chip "1 cổng cần nối trước khi chơi" jumps to that card. The example is Máy quay with "Bám theo" left unconnected.
12. **Empty board**: three starting options. The main one is "Học bài 1: Đi và nhảy", then "Mở một game mẫu", then "Tự làm: thêm Nhân vật đầu tiên". Properties shows a shortcut cheat sheet when no node is selected.

## Other UX improvements vs the current app
- A clear primary action: an amber Chơi button with the F5 hint. Undo and redo are icon buttons with shortcut tooltips, and redo shows a disabled state.
- The board name can be edited in place, with "Đã lưu / Chưa lưu" status.
- Mode switch is a segmented control (2D ngang / 2D trên / 3D) with a sliding thumb and arrow-key support. Changing mode shows a reassuring toast.
- Wires are smooth bezier curves. Wires on the selected node are highlighted and the rest are dimmed. You can drag a wire from an output to an input. A type mismatch makes the port shake and shows a toast that explains the problem.
- The properties panel has a description header, a name field, the 6-look picker (radio group with arrow keys), color swatches plus a custom color, a Người chơi/Bot segmented control, value sliders, an XYZ vector input, and a "Dây đang nối vào" list.
- Tutorial: step 3/12, a progress bar, a task checklist, a ring around the target port labeled "Kéo từ chấm này", and a dashed animated ghost wire to the destination. "Tiếp" stays locked until the task is done, and "Nối giúp tôi" does it for you.
- Ctrl+K quick add (accent-insensitive, arrow keys, Enter). "/" focuses the search box.
- Toasts are a fixed overlay with aria-live, so they never shift the layout, and they can carry an action (Hoàn tác).
- Browser surfaces are themed: selection color, caret, scrollbars, and focus rings.

## 21st.dev patterns (re-implemented in our own code, no source copied)
21st.dev categories looked at: Search Bars, Sidebars, Tabs, Toggles, Tooltips, Toasts, Popovers, Empty States, Onboarding, Steppers, Docks, Menus.
- Command palette / search bar: the Ctrl+K quick-add dialog
- Segmented toggle / tabs with a sliding indicator: the mode switch and the role picker
- Sidebar with collapsible groups: the palette
- Tooltip and popover: `data-tip` tooltips with shortcuts, and the node info popover
- Toast with action: save, add, and error toasts
- Onboarding / stepper: the tutorial card with progress and a spotlight ring
- Empty state: the empty-board start cards
- Floating dock: the zoom controls and the mockup state bar

## Implementation notes for the plain-DOM TS app (rough effort)
- **Tokens and theme (S)**: a `:root` variable block plus a font swap in the existing CSS. Self-host Be Vietnam Pro (vietnamese subset) rather than loading it from Google.
- **Top bar (S)**: restructure `top-bar.ts`, add a segmented control helper, the Dừng/Chơi lại swap, and the save-state indicator.
- **Palette (M)**: in `palette.ts`, add groups and collapse, the accent-insensitive `norm()` search, the popover, and icons. Icons: add a small `icons.ts` map of Phosphor path strings (MIT license); about 30 are needed.
- **Node cards (M)**: in `wiring-canvas.ts`, set width 216, add port shapes by type, the params chip footer, the required-port state (needs a `required` flag on PortDef in `engine/types` plus a renderer check), and selection/dim on wires.
- **Smart placement (S)**: the spiral free-slot search, about 15 lines in `note-placement.ts` or the canvas add path.
- **Issues chip (S)**: derived from required ports that have no wire.
- **Minimap, zoom, fit (M)**: zoom and pan may already exist in the canvas; the minimap is a single SVG redrawn when the board changes.
- **Properties (M)**: restyle `properties-panel.ts`. `look-picker.ts` already has the radio-group behavior and only needs a restyle. Add the slider fill using the `--v` variable.
- **Tutorial ring and ghost wire (M)**: the tutorial engine needs a target-port selector per step.
- **Play layout (S)**: a body class plus a transition on grid-template-columns. The "enlarge vs keep layout" choice is a user setting.
- **Ctrl+K (S/M)**, **empty state (S)**, **toast overlay (S)**.
- Total: about 4-6 dev days for the full set. Tokens, top bar, and node cards alone (1.5 days) deliver most of the visual change.

## Unresolved questions
1. The "Hộp" rename touches saved boards and tutorials. Should it be a display-label change only, keeping the internal kind `block`?
2. Which ports are truly required? It needs a per-node product decision (Máy quay "Bám theo" and Cảm biến chạm "Vật A/B" are the guesses here).
3. Should the "Chơi: phóng to game / giữ bố cục" preference live in settings or be remembered from the last choice?
4. The palette search uses keywords from descriptions. Should we add hand-written tags (e.g. "nhảy" for Phím bấm)?

Status: DONE
Summary: Built a self-contained, interactive "Studio tối" editor mockup (index.html + preview.png) covering every brief item and all 12 points from the UX audit. Checked with Playwright at 1440 and 1280 in edit, play, tutorial, empty, search, add and Ctrl+K states, with no page errors.
