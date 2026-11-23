# G2: graph canvas bottom-left corner report

Branch `feat/ui-graph-corner` in `D:\workspace\GameBuilder-ui-graph-corner`, commit `17ee42e`.
Gates: vitest 718/718 (10 new), `tsc --noEmit -p .` clean, `npm run build` OK.

## What changed
- `graph/graph-toolbar.ts`: now builds one `.wc-corner` cluster = coach hint (top) + row [slim rail: + / % / - / fit / arrange (icons, `aria-label` + title)] + minimap card (map over the legend). Signature is now `createGraphToolbar(actions, minimapEl)`.
- Coach: "Kéo nền để di chuyển. Lăn chuột để phóng to." with x; dismissal stored in `localStorage['xuongnoi.graph.coachDismissed']='1'` (storage errors are swallowed).
- `graph/graph.css`: old `.wc-bar/.wc-tool/.wc-lbl` and absolute bottom-right minimap replaced by mockup E styling. Minimap is now 176x96. When canvas height < 480 only the map hides; legend stays.
- `graph/graph-geometry.ts`: `fitView(content, viewport, insets?)` avoids corner overlays; new `CornerInsets`, `CORNER_GAP`, `screenRectToWorld`. No insets gives identical result to before.
- `graph/node-actions.ts`: `blocked?: () => Box[]` so palette-added nodes avoid overlays. `findSpot()` also uses it.
- `wiring-canvas.ts`: measures the corner cluster, feeds fit and placement; dims the cluster (`.dim`, opacity .35, still clickable) while a dragged node/wire passes within 16px of it.

## API for the merger (bottom-right reserve)
`canvas.setOverlayInsets({ right: number, bottom: number })` on `WiringCanvas`. Default 0/0. Meaning: a `right` x `bottom` px box pinned to the canvas bottom-right corner (use the game window size plus its margin, e.g. `{ right: 332, bottom: 252 }` for 320x240 + 12px).
- Affects: next `fitToContent` / Vừa màn hình / default fit on board load, and `findFreeSpot` + palette-add placement.
- Does NOT auto refit. Call it whenever the window moves/resizes/hides (pass 0s when hidden); call `fitToContent()` after if you want to reframe immediately.
- Non-finite or negative values are treated as 0.
- No CSS variable was added (YAGNI); the method is the only contract.

## Fit math
For each corner overlay, fit either gives up a side column or a bottom strip (+16px gap); of the 4 combinations the one with the largest zoom wins. Zoom floor 0.6 and cap 1 unchanged.

## Browser check (Playwright, real app, port 5183), samples key-door and maze-chase
| Check | 1440x900 | 1280x720 |
|---|---|---|
| nodes intersecting cluster after Vừa màn hình | 0 / 0 | 0 / 0 |
| after Sắp xếp gọn | 0 / 0 | 0 / 0 |
| 5 palette nodes added (key, show-number, win-lose, touch, timer) | 0 under cluster | 0 under cluster |
| refit after adding | 0 | 0 |
| coach dismiss, stays hidden after reload | yes | yes |
| drag node over cluster dims it, releases on drop | yes | yes |
| console errors | none | none |

Screenshots: `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\28feef90-daae-4318-8ffa-6bf07e972cef\scratchpad\corner-1440x900.png` and `corner-1280x720.png`; reference `...\Screenshots\Screenshot 2026-10-29 163109.png`. Layout matches (rail left, map card with legend right, coach above).

## Selectors
grep of `app/src` and `plans/browser-scripts`: no tutorial or script references `wc-bar/wc-tool/wc-pct/wc-tbtn/wc-lbl/wc-legend/wc-minimap` outside `editor/graph`. Kept: `.wc-node`, `.wc-port`, `.wc-note*`, `.wc-badge`. Renamed/new: `.wc-corner`, `.wc-rail`, `.wc-tbtn` (now icon buttons, `aria-label` "Vừa màn hình" / "Sắp xếp gọn" / "Phóng to" / "Thu nhỏ"), `.wc-pct`, `.wc-mini`, `.wc-coach`.

## Concerns
- Pre-existing: fit floor 0.6 means a large sample (19-24 nodes) still leaves 3-12 nodes off-screen after Vừa màn hình at these sizes. Not changed (zoom floor was out of scope); nothing sits under the cluster, but a huge graph clamped at 0.6 could still reach the cluster.
- Coach wraps to 2 lines (width capped to cluster width so the obstacle rect stays small); the reference shows it on one line.
- Overlay rect is the cluster bounding box, so the coach strip is also kept clear.
- Bool legend dot uses the existing yellow token (reference shows green).
- Dim detection uses pointer position or selected node boxes; a wire drag dims only when the pointer is near the cluster, and only for drags that start on a node/note (wire drags start on ports inside nodes, so covered).
- `setOverlayInsets` is untested in a live browser (no game window yet); covered by unit tests of fit/placement math only.

Status: DONE_WITH_CONCERNS
