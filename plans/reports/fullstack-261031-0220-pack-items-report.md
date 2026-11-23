# Pack items report

Branch `feat/pack-items` (worktree `D:\workspace\GameBuilder-pack-items`).

## Changes
- `app/src/render/item-shapes.ts`: deleted builders for key, ball, crate, veggie, ore, bucket. Shapes in `ITEM_PACK` go through `buildPackItem` (PackSlot, 'inside', unit-cube placeholder box in entity colour until loaded). `buildItem(shape, color, seed = '')` got a seed; `ItemFigure` got optional `update?(view)`. `update` counter-scales an inner group by 1/size once the model is ready and lays the slot into `view.size` (uniform fit, bottom on box bottom), so non-cubic entity sizes keep proportions. Kept tools/box/lock unchanged (no `update`).
- `app/src/render/scene-view.ts` (item branch only): `buildItem(..., `${ownerNodeId}|${id}`)` and `entry.figure.update?.(e)` in `sync`.
- `humanoid-model.ts`: no edit needed. In hand `buildItem(shape,color)` seed '' -> unit-cube layout; the slot re-lays itself when the model arrives. `handGrip`/`IN_HAND_SCALE`/`liesFlat` untouched.
- Tests: `tests/render/item-polish.test.ts` (new "pack items" block: pool coverage, placeholder, variant by seed, proportions + floor for 0.6x1.2x0.4, hand build + swap-in, tools have no `update`); `tests/render/block-looks.test.ts` one line (`children.length > 2` -> `> 0`, pack item has one wrapper child).

## Seed decision
World: `ownerNodeId|entityId` (entity id is stable within a play session; spawners/cargo with the same owner get variety; verified 4 crates with different ids show 3 different models). Hand: `tool` carries only shape+colour (no id; world.ts off limits), so seed is the shape -> a picked-up item may show a different variant than on the ground. Fixing this needs an id/seed in `EntityView.tool` (world.ts) - not done.

## Tests
- tsc: clean.
- `vitest run tests/render`: 12 files, 119 tests pass.
- Full `vitest run`: 97 files, 1486 tests pass (no failures, none pre-existing).

## Visual check (shots in `plans/reports/shots-pack-items/`, scripts `plans/browser-scripts/pack-items-*.mjs`)
- Real samples (city-delivery-3d, key-door, side-stars, cleaner-bot, pickaxe-rock) loaded and played in 3D, 2D side and 2D top: no console errors. cleaner-bot (2D top) shows pack crates clearly visible (one seen top-down, one planked). key-door (2D side) shows the key + tag standing on the floor.
- Temporary gallery page (deleted afterwards) with all shapes at 3 sizes (cube 0.8, 0.5x1.2x0.5, 1.3x0.5x0.9) and characters holding each shape: `gallery-3d.png`, `gallery-hands.png`. Items rest on the floor, proportions kept, no stretching; kept tools/box/lock look the same. Held crate/veggie/ball/bucket/key visible and sensible at hand; bucket hangs from hand at about thigh height.

## Known issues
- Hand vs ground variant can differ (see seed decision).
- Key model is small/thin in a 0.8 cube (model aspect), still readable.
- city-delivery-3d play shots show only the intro overlay (did not drive the truck), so carried cargo there was checked only in the gallery.
