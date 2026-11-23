# Editor board: routed wires + knots, tap focus, drop settle (branch feat/editor-board)

Worktree `D:\workspace\GameBuilder-edboard`, dev server `http://localhost:5242/` (left running). Shots: `plans/reports/shots-editor-board/`.

## What changed
| Id | Behaviour in the editor board |
|---|---|
| B routing | Wires are right-angle paths that go around cards (puzzle `routeWires`, grid 16 px, own-card exits). Group blocks and group stubs count as cards, so wires crossing a group edge route normally. Wire energy / badges follow the routed path. |
| B knots | Double-tap a wire -> knot (drag it, snaps to 8 px grid). Drag a knot onto another knot of a wire from the same pin -> merge (same toast as puzzle). Double-tap a knot -> removed. One gesture = one undo step. |
| B save | Optional `graph.knots {pos, chain}`; key absent when none. Chain key = wire id on the main board, `group@wire` inside a group (a group has its own coordinates). Loader drops bad entries quietly. Pruned when the wire/group goes. |
| B perf | Auto-route only when the open board/group has <= 60 cards (`ROUTE_CARD_LIMIT`), else today's curves (knotted wires get a curve chain). Card drag redraws only that card's wires, once per rAF, in place (no layer rebuild). A drop/render re-routes only wires whose ends moved or that a moved card now sits on. Press with <= 6 px wobble = tap. Pan/zoom never redraw wires. Arrange animation uses fast curves, one routed draw at the end. |
| C focus | Tap a card/group block: it + its wires clear, other cards fade to .62, other wires to .2, knots .25 (opacity only, same numbers as puzzle). Tap again, tap empty board or Esc clears. Edit mode only (off while playing). |
| D drop | A single dragged card dropped overlapping another card moves to the nearest free spot (gap 12, step 4, `freeSpotNear`); free space or just touching = stays exactly. Jump is instant, no slide animation. Multi-select drags and notes are not settled. |

## Files
- New: `src/editor/graph/board-knots.ts`, `knot-editor.ts`, `drop-settle.ts`, `tests/editor/board-knots.test.ts`.
- Edited: `src/editor/wiring-canvas.ts`, `graph/canvas-pointer.ts`, `graph/node-actions.ts`, `graph/graph.css`, `graph/node-cards.css`, `editor-state.ts` (`setKnots`, prune), `io/save-format.ts` (parse knots).
- Outside the stated ownership (needed, small, additive):
  - `src/engine/types.ts`: `GraphKnots` + optional `Graph.knots`.
  - `src/puzzle/ui/wire-geometry.ts`: optional `RouteOptions.grid` (default unchanged, puzzle output identical; all puzzle tests green).
- Puzzle modules `wire-geometry.ts`, `wire-knots.ts`, `wire-tidy-text.ts`, `board-arrange.ts` are imported in place, not moved (no puzzle import churn). Return object of `createWiringCanvas` untouched (room left for `setStepLight`).
- DOM change: each wire is now `<g class="wc-wire-g">` holding path + hit (+ flow/glow); selectors `.wc-wire`, `.wc-wire-hit[data-wire]` unchanged.

## Tests
- `npx tsc --noEmit -p .`: clean.
- `npx vitest run --testTimeout 120000`: 163 files, 2722 tests passed (includes `solid-off-unchanged`, all samples, groups, puzzle).
- New vitest (15): knot save/load round trip, no `knots` key for boards without knots (old files byte-identical, all 16 samples re-serialise identically), bad knots dropped, wrong shape ignored, knots survive Ctrl+G, group-scoped keys, `setKnots` undo/redo + empty drops the field + wire delete prunes, `settleDrop` on editor coordinates (free spot stays, negative coords OK, overlap slides, 2x2 block never lands on a card).
- Playwright (`plans/browser-scripts/editor-board-check.mjs`, `-group.mjs`, `-flat.mjs`, `-perf.mjs`): small sample routed 30/31 wires; double tap adds a knot; knot drag; undo x2 / redo; tap focuses (22 faded, 4 lit wires); Esc / tap board clears; 6 px wobble leaves wires byte-identical; drop on card slides with no overlap; free drop moves exactly by the pointer delta; city 3D main board double-tap knot with groups present; inside the 57-card "truck" group wires routed, its knot kept apart from the main-board knot, returning to main shows only the main knot. 15/15 + group checks pass, no console errors. PNGs read: 01, 02, 03, 04, 05, 08.

## Measurements (headless Chrome + software WebGL, so absolute numbers are pessimistic)
| Case | Cards / wires | First draw (route all) | Card drag, JS per frame | Drop re-route |
|---|---|---|---|---|
| small sample "Nhặt sao" | 26 / 31 | ~10 ms avg, 76 max | ~1.6 ms | ~3 ms |
| synthetic and-gate grids | 40 / 66 | 15 ms | 0.5 ms | 3 ms |
| | 120 / 216 | 91 ms | 0.6 ms | 4 ms |
| | 150 / 274 | 122 ms | 0.5 ms | 2 ms |
| city-3d main board (32 groups) | 32 / 72 | ~100 ms | ~2 ms | - |
| city-3d group "truck" (largest wired group) | 58 / 115 | 378 ms | ~8 ms | 17 ms |
| city-delivery flat | 128 / 165 | 1031 ms | ~4.6 ms | - |

- Frames (rAF) while dragging a card on the synthetic boards: 16.5 ms avg, p95 16.7 ms, routed and unrouted alike (40 and 150 cards). Panning calls the router 0 times.
- In the city-3d sample frames are 90-370 ms with or without routing: the software-rendered 3D preview dominates. Its largest group (113 cards) has 0 wires. No scope of that sample goes above 60 cards except that group, so city-3d is routed everywhere except inside the 113-card decor group (curves there, nothing to route).
- Threshold: 150 was the start. Real boards are costlier than the synthetic grid (flat city 128 cards = 1 s freeze on open), so `ROUTE_CARD_LIMIT = 60` (<= ~0.4 s first draw). Only the first draw of a board sets the limit; later edits are cheap. Easy to change in one constant.

## NOT verified
- Real GPU / touch device / pinch: only mouse in headless Chrome.
- Wire energy on routed paths while playing: code path unchanged (same path element, `getTotalLength`), covered by `wire-energy` unit tests, but I did not watch a play session with sparks on routed wires.
- Knot behaviour while playing is disabled (pointer-events none, drag blocked); not exercised in browser.
- Tutorial / lesson overlays that point at wires (selectors unchanged, but not re-run). Handbook try-boards and 31 lessons load through the same parser; only the vitest suite covers them.
- Focus while a wire is mid-drag or with the minimap clicked: not tried.
- Drop slide has no animation (instant); multi-select drop is not settled.
- Wires of a card that is dragged by the sibling's step-light panning: untested together.

## Decisions to confirm
- Threshold 60 vs the planned ~150 (above).
- Knots are per board: a wire crossing a group edge has separate knots on the main board and inside the group.
- Focus fade for cards is .62 (puzzle focus value), not the .2 of step mode.

Status: DONE_WITH_CONCERNS
