# WT-B logic nodes and sensors report

Branch `feat/logic-sensors` (worktree `D:\workspace\GameBuilder-logic-sensors`). Status: DONE. Tests: 531 pass (513 baseline + 18 new), tsc clean, build ok.

## New files (app/)
- `src/nodes/random.ts` (kind `random`, seeded mulberry32; exports `createRng`)
- `src/nodes/latch.ts` (`latch`), `src/nodes/map-range.ts` (`map-range`)
- `src/nodes/zone-sensor.ts` (`zone`), `src/nodes/distance.ts` (`distance`)
- `src/samples/dice-zones.json` (2d-side, "Xúc xắc và vùng")
- `tests/nodes/logic-sensors.test.ts`

## Shared-file hooks (small, append-only; merge watch list)
- `src/engine/types.ts`: `EntitySpec.zone?`, `EntityView.zone?`, WorldApi `listEntities()` + `runSeed()`
- `src/world/world.ts`: `seed` const, `listEntities`, `runSeed`, `zone` passed in spawn; `src/world/entity.ts`: `zone` field + toView
- `src/render/scene-view.ts`: translucent material (opacity 0.28) for zone blocks
- `src/nodes/index.ts`: 5 imports + 5 entries in STEP_1_NODES
- `src/io/samples.ts`: import + entry `dice-zones`
- tests: `tests/nodes/fake-world.ts` (+listEntities, runSeed), `step-1-nodes.test.ts` count 29 -> 34 (other WTs will also bump this: sum on merge), `tests/io/samples.test.ts` id/mode lists
- Line endings: CRLF preserved in the files that had CRLF.

## Behaviour notes
- Random: modes press / tick / start; seed 0 -> world run seed (random per run), else fixed; mixed with nodeId so two dice differ. In press mode output is 0 until first roll (documented in description). Outputs value + rolled pulse. Swapped min/max tolerated.
- Latch: set/reset/toggle edges; same-tick set+reset -> reset wins.
- Map range: clamp option, zero-width input scale -> outMin.
- Zone: spawns a non-solid zone block at create() (visible in edit preview), hidden at tick 0 so invisible in play; flat views ignore unused axis; filters character/player/bot/item/vehicle; skips hidden, seated, in-hand. Outputs inside/entered/exited/count/first.
- Distance: center to center, flat-plane aware; unconnected -> 0 and within false.
- Sample: stand in green zone (player filter) + press E to roll; 5 or 6 sets the latch; with latch on, reaching the red flag (distance <= 1.5) wins; distance mapped via map-range to "Gần cờ (%)". Scripted engine tests cover zone gating, luck, win, and no win without luck.

## Browser (port 5182, stopped)
Palette shows all 5 nodes; sample loads; zone is a translucent green box in edit, absent in play; HUD shows "Xúc xắc: 0" and "Gần cờ (%)"; no console errors. Screenshots in `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\c6588d98-de8b-47ca-8a66-fd5282a3c2b1\scratchpad\wt-b\` (1-edit, 2-play, 3-rolled). Headless key presses did not visibly move the player; logic verified by engine tests instead.

## Unresolved
- No editor UI test for the zone marker being clickable (it carries ownerNodeId so picking maps to the zone node; untested).
