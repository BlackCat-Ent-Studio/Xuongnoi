# Mockup B "Sáng thân thiện" — editor redesign

- Mockup: `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\c6588d98-de8b-47ca-8a66-fd5282a3c2b1\scratchpad\ui\b-bright-friendly\index.html` (one file, inline CSS/JS, only Google Fonts loaded from the network; falls back to system-ui)
- Preview: same folder `preview.png` (1440×900, editing + tutorial step 2/5, Nhân vật selected)
- Extra state shots (scratchpad `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\091c5a2d-ceff-4dfe-a2af-61a656b30d1c\scratchpad\`): `b-play.png`, `b-nosel.png`, `b-empty.png`, `b-add.png`, `b-search.png`, `b-1280.png`
- App not modified.

## Direction
Light theme fits the use: a beginner at home, in daylight. The background is warm paper (#F3EFE8). Each zone is a white floating panel (tray) separated by an 8px gap, with soft diffused shadows instead of 1px grey borders. Primary actions are pill-shaped. Colour does the explaining: category = pastel header tint, port type = solid dot colour + dot shape. Friendly but not childish: no mascot, no emoji, authored 1.75-stroke SVG icons, Be Vietnam Pro (designed for Vietnamese) for UI, Nunito 900 for the wordmark only.

## Tokens (all in `:root`)
| Group | Values |
|---|---|
| Surfaces | bg #F3EFE8, tray #FFF, canvas #FBF9F5 (dot grid #E3DDD2), input well #F6F3EE, note #FFF4C2 |
| Ink | #1E2230 (15.6:1), ink-2 #4E5466 (7.5:1), ink-3 #60667A (5.9:1 on white, 5.2:1 on wells) |
| Brand | #5145CD (white text 6.8:1), tint #ECEAFE, focus ring = 2.5px brand outline |
| Ports (fixed by type) | bool #16A34A circle · number #2563EB diamond · object #D9670A rounded square (all ≥3:1 vs canvas, shape = colour-blind backup) |
| Categories (hue, ink on tint, ratio) | Đầu vào rose #9F1239/#FFE4E6 6.7 · Logic violet #5B21B6/#EDE9FE 7.6 · Tính toán yellow #713F12/#FEF9C3 8.1 · Vật thể sand #5C3A1E/#F3E8DC 8.4 · Hành động fuchsia #86198F/#FAE8FF 7.1 · Bộ não teal #134E4A/#D5F5EF 8.2 · Kết quả slate #1E293B/#E6EBF1 12.2 |
| Status | warning #B4231F on #FEE7E5 5.6:1; value badges bool #14532D/#DCFCE7 8.3, number #1E3A8A/#DBEAFE 8.5 |
| Radius | 8 / 10 / 14 (cards) / 18 (trays) / pill |
| Elevation | e1 rest, e2 floating chrome and nodes, e3 hover/drag/popover; every level = offset + soft blur, warm-tinted |
| Type | 11.5 / 12.5 / 13.5 / 15 / 18; tabular numbers on all values |
| Motion | ease cubic-bezier(.32,.72,0,1), spring (.34,1.56,.64,1); 140/260/520ms; `prefers-reduced-motion` turns motion off |

## Audit items (controller UX audit) → how the mockup solves them
1. **Narrow cards / wrapped labels** → ports are stacked (outputs on top, right-aligned; inputs below a dashed divider). Cards are 150–192px minimum and grow to fit, max 260. Labels never wrap (`nowrap`). Playwright check: 0 overflowing labels at 1440 and 1280.
2. **Overlap / palette drops on top** → `freeSpot()` scans the visible area on a 24px grid, keeps 24px clearance from every node and note, and skips the toolbar/toast lane. If the view is full it looks below and pans there. A dashed "ghost" box marks where the node landed, then a spring "land" animation plays. The toast says "Đã đặt … vào chỗ trống" with a Hoàn tác (undo) button. Check: 0 overlaps after adding.
3. **Busy boards** → zoom − / % / + buttons, "Vừa màn hình" (fit to all nodes), Ctrl+wheel zoom, drag the empty board to pan, minimap with viewport box, and `+ − 0` keys.
4. **"Khối" overloaded** → the palette is now "Kho khối lệnh · 41 khối lệnh"; the box object is renamed **Hộp** (its hover card says "Trước đây tên là ‘Khối’"). Elsewhere "khối" now only means a node.
5. **Search + icons** → live search ignores diacritics ("cham" finds "chạm"), highlights the match, auto-expands groups, Enter adds the first result, `/` focuses the box. Category icons are colour-coded; groups collapse; hovering or focusing an item shows a card with its description.
6. **AA with white text** → headers use dark ink on pastel tint (6.7–12.2:1). White text only on brand/ink.
7. **Port vs category clash** → category hues deliberately avoid green/blue/orange, and a "Chấm nối" legend sits bottom-left of the board.
8. **Chơi → Dừng + Chơi lại** → the primary button changes Chơi ▶ to Dừng ■ (dark). "Chơi lại" (restart, key R) appears next to it. Banner button: "Dừng để sửa". Esc stops.
9. **Game view hints / toast vs HUD** → the old full-cover hint is gone. A caption below the stage shows the hint (controls while playing). HUD sits in the top-left/top-right stage corners. Toasts only appear over the board area, never in a stage corner.
10. **Top bar at 1280** → file buttons and Hướng dẫn collapse to icons with tooltips and aria-labels below 1400px and during play. Verified no overflow or wrap at 1280 and 1440. "Tạo mới" is far left, Chơi far right. Ghi chú appears once (board toolbar, key N). All icons are SVG.
11. **Unconnected required inputs** → hollow red-ringed dot + red label, plus a floating "Thiếu 1 dây" badge on the card (shown on Cảm biến chạm · Vật B). The badge floats so it never widens the card. Value badges sit inline before the label (flex), so they cannot overlap it.
12. **Empty board** → "Bảng trống" toggle: friendly headline, a small drawing of two linked nodes, 3 actions: Học bài 1 (primary, opens the tutorial), Mở game mẫu, Tự kéo khối lệnh đầu tiên (filters the palette to "nhân vật").

## Other UX improvements vs current app
- Live values while playing show as badges next to output labels ("Đúng"/"Sai"/numbers) instead of pills in the middle of wires.
- Bool/number wires with live signals animate a dash flow; wires touching the selected node are bolder, the rest fade to 50%.
- Wiring by drag: compatible inputs enlarge and incompatible ones dim. Dropping on a wrong type explains why ("Hai chấm khác hình…").
- Rarely used ports collapse behind "+4 cổng ít dùng" (Đồ vật).
- Tutorial coach card is docked in the palette tray, so it covers neither the board nor the game. It has a step pill, progress bar, tip box, and a pulsing highlight ring with a label placed per step.
- Board name editable in place, with a saved/unsaved dot ("Có thay đổi chưa lưu" → Ctrl+S).
- Properties: in-place rename, 6-look picker (radio group), colour swatches + custom picker, sliders with value readout, segmented Vai trò control, X/Y/Z fields, key capture ("Nhấn một phím bất kỳ…"), and an empty state listing keyboard shortcuts. While playing, fields lock and a notice explains why.
- Game view maximize (F / Esc).

## 21st.dev patterns used (re-implemented, no source copied)
Browsed the component directory (Docks, Tabs, Toasts, Tooltips, Sidebars, Search Bars, Empty States, Onboarding, Steppers, Toggles, Sliders, Radio Groups).
- Floating dock / toolbar → floating board tools, zoom + minimap cluster, mockup state dock
- Segmented tabs with a sliding thumb → 2D ngang / 2D trên / 3D and Vai trò (arrow keys work)
- Sidebar with collapsible groups + search bar → palette
- Toast with action → bottom-anchored-free overlay with Hoàn tác (undo); slot-limited, so it never shifts layout
- Tooltip with shortcut → `data-tip` CSS tooltips (hover delay, show on keyboard focus)
- Onboarding stepper / spotlight → tutorial coach + highlight ring
- Empty state with ranked CTAs → empty board
- Toggle switch → state toggles

## Implementation effort for our plain-DOM TS app
| Piece | Effort | Notes |
|---|---|---|
| Tokens + tray layout + fonts | S | Move `:root` into the existing CSS. Grid columns are the same three zones, so `layout-splitters.ts` keeps working |
| Top bar (segmented, Dừng/Chơi lại, icon collapse) | S | `top-bar.ts`; the sliding thumb is ~15 lines |
| Node card restyle + stacked ports + port shapes | M | `wiring-canvas.ts` render plus port-position math (must use the dot centre) |
| Required-input marks | S | Needs a `required` flag on port defs in `engine/types` (new contract) |
| Smart placement | S | `note-placement.ts` already exists. Generalize to nodes with the grid scan |
| Live value badges + wire flow | M | Engine must expose last port values to the editor each frame (throttle to ~10Hz) |
| Palette search/collapse/hover card | S–M | `palette.ts`. Descriptions exist for some nodes, so write the missing ones in `text-vi.ts` |
| Minimap, zoom, fit, pan | M | Canvas transform likely exists. Minimap = scaled rects + viewport box |
| Tutorial coach in palette + ring | M | Reposition the existing lesson panel and add a ring overlay that follows `getBoundingClientRect` (on resize, pan, and drag) |
| Empty board | S | |
| Rename Khối → Hộp | S | Label only; keep `kind` id so saves stay compatible |

Suggested order: tokens/layout → node cards → top bar → palette → smart placement → required marks → empty state → tutorial → live values.

## Verification done
Playwright at 1440×900 and 1280×800, in edit, play, no-selection, empty, after-add, and search states: 0 console errors, 0 label overflow, 0 node overlaps, top bar has no horizontal overflow. At 1280, the right output column starts partly off-screen at 85% zoom; reachable by pan, minimap, or "Vừa màn hình". Contrast computed with the WCAG formula; two tokens failed first (ink-3 on wells 4.4, object port 2.9) and were darkened.

## Unresolved questions
- Rename "Khối" → "Hộp" or "Vật cản"? The mockup uses Hộp. Saved files keep the `block` kind either way.
- Required ports: which inputs are truly required per node? This needs engine knowledge; the mockup only marks Cảm biến chạm A/B.
- Live value badges need an engine→editor value feed. Acceptable cost?
- Tutorial coach docked in the palette hides the lower palette groups during lessons. OK, or prefer a right-side dock?

Status: DONE_WITH_CONCERNS
Summary: Interactive single-file mockup B with all requested states, plus fixes for all 12 audit items; verified via Playwright at 1440 and 1280 with no errors or overlaps.
Concerns/Blockers: Mockup-only "Xem thử" dock overlaps the board's top edge at 1280px (harmless, review-only); palette-added nodes use placeholder ports; drag-from-palette not implemented (click/Enter only).
