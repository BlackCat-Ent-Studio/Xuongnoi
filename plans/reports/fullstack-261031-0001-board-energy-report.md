# Board energy ("dong dien") report

Branch `feat/board-energy` in `D:\workspace\GameBuilder-board-energy`, one commit.

## What changed
- `app/src/editor/graph/wire-energy.ts` (new): settings (localStorage `xuongnoi.wireEnergy`, try/catch, reduced-motion check), pure logic (`isActive`, `stepWire`, `canSpawnSpark`, `sparkFrame`), DOM driver (`createWireEnergy`).
- `app/src/editor/graph/wire-energy.css` (new): `.is-live/.is-dim` wires, `.wc-wire-glow`, `.wc-spark`, edit-mode `.wc-wire-flow`.
- `wiring-canvas.ts`: minimal hooks (reset + addWire in drawWires, own rAF loop while playing, redraw on setting change).
- `app.ts` + `shell-text-vi.ts`: Xem -> "Hieu ung dong dien" checkbox item (default on).
- `engine/runtime.ts` + `types.ts`: optional `Runtime.takeRisen()` = bool outputs that went false->true on ANY tick since last read. Needed because app.ts reads badges every 100 ms (not every frame) and one-tick pulses ("Vua cham") would be missed. Backward compatible (optional).
- `tests/editor/wire-energy.test.ts`: 11 tests (value->look, edge->spark, pulse hold, number rate limit, cap, spark travel).

## Behaviour
- Play: bool true = bright + glow, false = dim; rise edge (incl. engine-seen pulse) = one spark out->in ~0.5 s, wire stays lit 220 ms. Number non-zero = bright, sparks on change (>0.02, max 1 per 140 ms per wire). Object present = soft glow, none = dim.
- `data-live="on"` on `.wc-port` / `.wc-stub` of both wire ends, `is-hot` on the source `.wc-node` (group boxes too). node-view / group-view / node CSS untouched; no `.wc-port-val` (kept badges).
- Edit: dots flow via CSS stroke-dashoffset on extra path (`steps(12)`, 2.4 s), hidden at low zoom and under reduced-motion.
- Performance: sparks capped at 60, pooled circles, glow path created lazily only for wires that ever light, path length computed lazily once per redraw, only class toggles on change.
- Reduced motion: no sparks/flow, steady glow still on. Toggle off: wires plain, no flow, no loop, attributes cleared.

## Verification
- Gates in app/: vitest 95 files / 1467 tests pass (full run before CSS tweak; wire-energy test re-run after), `tsc --noEmit` clean, `npm run build` ok.
- Browser (port 5232, headless Chromium + swiftshader, 0 console errors, server stopped). Shots in `D:\workspace\GameBuilder\plans\reports\shots-board-energy\`: 1-edit, 2-play-spark (sparks=3 caught), 3-play, 4-menu, 5-edit-off, 6-play-off, 7-city-edit, 8-city-play, `play-wires.gif`, `result-after.json`.
- Counters: side-stars edit: 31 wires, 31 flow paths; play: 12 live wires, 20 live ports, 7 hot nodes, flow 0; after stop everything cleared; toggle off: 0 flow/live in both modes; localStorage `off` then `on`.
- FPS, 3D city sample (72 wires drawn), headless software rendering so absolute numbers are pessimistic:

| Case | Effect off | Effect on |
|---|---|---|
| City play, first version (blur glow + drop-shadow sparks) | 60.2 | 3.8 |
| City edit, first version (continuous dash animation) | 60.3 | 4.3 |
| City play, final (no filters) | 60.0 | 56.7 (51.8 in the other run) |
| City edit, final (stepped dots) | 60.3 | 60.2 |
| Side-stars play | - | 60.4 |

  "Before" = effect toggled off (same build). The first version was a real regression; removing CSS filters and stepping the dash animation fixed it.

## Deviations / notes
- Small board: used sample "Nhat sao" (side-stars; key, stick, character, stars, touch, counter, win) instead of hand-building one; it is dense at 60% zoom. GIF is from a 1280x720 screen recording, 6 s.
- Glow is a wide translucent stroke, not a blurred layer (filters caused the FPS collapse), so it is flatter than the preview.
- Not measured: a real 650-wire board (city has 72) and a real GPU.

Status: DONE_WITH_CONCERNS
Summary: Wire current implemented and committed on feat/board-energy; all gates green, 0 console errors, city 3D play ~57 fps with effect vs 60 without in swiftshader.
Concerns: touched engine (`runtime.ts`, `types.ts`, optional `takeRisen`) beyond the listed files to catch one-tick pulses; glow is flatter than the preview; 650-wire scale untested; small board is the existing sample.
