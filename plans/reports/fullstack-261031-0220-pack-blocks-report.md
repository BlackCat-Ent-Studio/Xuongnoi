# Pack blocks report (branch feat/pack-blocks, commit c77ffe4)

## What changed
- `app/src/render/block-looks.ts`: styles with a `BLOCK_PACK` pool now go through `buildPackLook` (PackSlot in an inner group scaled 1/size, `update(view)` re-lays on resize, coloured unit-box placeholder while loading, owner id on every mesh). Deleted builders: house, shop, stall, factory, tree, lamppost, trafficlight body, road, sidewalk, field, rock, fence; unused templates (cyl, pyr, cone6, ico0, ico1) and cache keys. `blockLookParts` only handles sign / conveyor / rail / box.
- Traffic light: 3 round lamps overlaid on the pack model's painted lenses (positions measured from City_7_Traffic_Light_1: heights 0.85 / 0.703 / 0.558 of model height, 0.52 m in front of centre, +Z). Colour picks the lit lamp (bright), the others are dimmed. `trafficLampIndex` kept.
- `buildBlockLook(style, color, size, label, seed)`: new optional `seed`.
- `app/src/render/scene-view.ts`: only the one call site (+ `e.ownerNodeId`).
- `app/tests/render/block-looks.test.ts`: dropped tests on deleted builders; added 7 pack tests (placeholder then model, same seed same model + spread, footprint + resize via update, road tiling, owner id on meshes, traffic lamp switching + position, pool/code-drawn split).

## Tests
- `npx tsc --noEmit -p .`: clean.
- `vitest run tests/render`: 12 files, 120 tests pass (belt-look and pack-models included).
- Full run: see final message (result appended there).

## Visual check (Playwright, port 5201; shots in `plans/reports/shots-pack-blocks/`)
- city3d-edit.png (3D): houses/shops sit on footprints, trees and lamps stand at block height, sidewalks tile in grey tiles, fences run without gaps, fields tile, rocks inside their blocks, traffic lights standing with red lit.
- city3d-top.png (2D top) and city3d-view.png (2D side): all models readable from above / side.
- city3d-zoom*.png: close-ups (farm fences + field, rocks, shops, traffic light with lit red lamp, others dim).
- city2d / pickaxe / maze samples use only plain boxes (no style), unchanged.
- Console: only WebGL "context lost" on page unload and ReadPixels GPU-stall notices from swiftshader; no page errors.
- FPS not measured.

## Known issues / notes
- Lit vs dim lamps are small at city zoom level; clear only when zoomed.
- Rock block is a stack/boulder fitted `inside` the box, so it looks narrower than the box.
- Orange ground in the city sample is the pack road tile colour (baked), not a bug.
- Pack models ignore block colour now.
- Handbook text now wrong for pack styles: `src/handbook/content-math-object-output.ts` lines ~208 ("Màu của hộp. Đổi được ngay...") and ~225 ("Riêng "Màu" đổi được ngay") - colour only has an effect for box, sign, conveyor, rail (and picks the lit lamp of the traffic light). Not edited (out of scope).
- Debug scripts: `plans/browser-scripts/pack-blocks-{shots,zoom,model}.mjs` (model one needs a temporary `zz-debug.html`, removed).
