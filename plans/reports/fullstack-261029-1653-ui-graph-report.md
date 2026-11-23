# Agent C (Graph): wiring canvas redesign report

Branch `feat/ui-graph` in `D:\workspace\GameBuilder-ui-graph`, commit `b164fc4`. Gates: vitest 667/667, `tsc --noEmit -p .` clean, `npm run build` OK.

## Files
- `editor/wiring-canvas.ts` 616 -> 321 lines (orchestrator).
- New `editor/graph/`: `canvas-pointer.ts` (202), `wire-drag.ts`, `node-view.ts`, `note-view.ts`, `node-actions.ts` (flash, placement, animated arrange), `node-placement.ts`, `auto-layout.ts`, `port-compat.ts`, `minimap.ts`, `graph-toolbar.ts`, `graph-geometry.ts`, `missing-wires.ts`, `graph-text-vi.ts`, `graph.css`.
- `engine/types.ts`: `PortDef.required?: boolean` only (CRLF preserved).
- `nodes/*.ts`: only `required: true` added. `block.ts` untouched.
- Test: `tests/editor/graph-helpers.test.ts` (13 tests).

## API added
- `createWiringCanvas` signature unchanged. `WiringCanvas` gains two optional-to-use methods:
  - `findFreeSpot(want, kind?) -> {x,y}`: nearest spot with no overlap with nodes/notes.
  - `arrange()`: animated layered auto-layout.
- Pure exports for wave 2 / palette:
  - `listMissingWires(graph) -> {nodeId, portId, label}[]` (`editor/graph/missing-wires.ts`).
  - `findFreeNodeSpot(want, size, boxes)` and `occupiedBoxes(...)` (`editor/graph/node-placement.ts`).
  - `computeLayout`, `checkPortPair`, geometry helpers.
- Smart placement works WITHOUT touching app.ts: the canvas detects a single newly added node (palette path `state.addNode`), moves it to the nearest free spot via `state.moveItems`, selects (already selected by state) and pulses it. Pasting several nodes is not nudged.
- Existing DOM hooks kept for tutorials: `.wc-node[data-id][data-kind]`, `.wc-port[data-node][data-port][data-dir]`, `.wc-note*`. Added `data-type` on ports. Port row is the whole hit area.
- Delete key still handled by app.ts (global); canvas only selects the wire on click.
- Wrong-type messages go through the existing `notify` (so `onMessage` was not needed) plus an inline tip near the cursor.

## Ports marked `required: true`
touch (a, b), distance (a, b), show-number (value), chase (self, target), fight (self, target), go-to (self, target), patrol (self), health (self), teleport (who, dest), portal (partner), carry (character), hand-tool (character), interact (character), enter-exit (character), shooter (shooter), spawner (spawn), win-lose (win only).
Judgement: win-lose `lose` left optional (a game may only have a win condition; both required would nag). Camera, math, compare, counter, timer etc. left optional (they have usable defaults).

## Browser check (Playwright, 1280x720, real app, port 5175)
- Added 5 nodes via palette: 0 overlaps, 0 clipped labels, badges "Thiếu 1 dây / 1 / 2".
- Wrong-type drag (Đúng/Sai -> Số): no wire created, tip and top-bar message name both types, 8 rows dimmed / 4 pulsing.
- Wiring Phím bấm -> Thắng/Thua.win clears that node's badge.
- Snap: release 16px outside a compatible row creates the wire. Dropping on an occupied input replaces it (wire count unchanged).
- Sắp xếp gọn: 0 overlaps afterwards. Click wire + Delete removes it. Wheel zoom below 0.6 adds `lowzoom`.
- No console errors. Screenshots in scratchpad `shots/graph-*.png`.

## Not verified / concerns
- Dark look judged with an injected token stub only. Until shell (A) lands the tokens and removes old `.wc*` rules from `style.css`, the canvas background is light (old `.wc` rule wins by source order) and old `.wc-port.ok` colours are neutralised only for that class. After merge, check `style.css` has no leftover `.wc-*`, `.type-*`, `.wc-dot` rules (note styles were copied into `graph.css`, so they can be deleted from `style.css`).
- Instance subtitle reads `node.params.name` (string). Panels agent (D) must store "Tên riêng" there, or tell me the field; one-line change in `node-view.ts` `instanceName`.
- Replacing an occupied input = 2 undo steps (delete wire, add wire). Smart-placement nudge = a second undo step after add. Both because `editor-state.ts` is not mine; a `replaceWire` / `addNodeAt` in state would fix.
- Minimap hides under 480px canvas height; at narrow widths toolbar + legend are stacked to avoid overlap. Not tested below 1280.
- Play mode value chips and live badges kept but not re-verified in a running game (play uses WebGL; not exercised). Existing tutorial selectors checked by grep only; lesson bot flows were not run in browser.
- "Khối lạ" fallback changed to "Mảnh ghép lạ". Existing `TEXT_VI.canvasEmpty` still says "khối" (E's file).
- Touch/pinch not handled (desktop only per decision 7a).

Status: DONE_WITH_CONCERNS
