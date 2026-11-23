# Factory asset looks ported into the app (2026-11-19)

Worktree `D:\workspace\GameBuilder-assets`, branch `feat/factory-assets` (start ab21c74; main f6e26db, which contains 8ee9d8b, merged in; head e45c0ed). Not merged to main, nothing in `D:\workspace\GameBuilder` touched except this report and `plans/reports/shots-factory-assets/`.

Picks ported: AGV A, arm A, chute 1, belt 1 + scan gate, floor marker 2, orange, toon. Parcels: Parcel 1-5, Box 1, code cartons (Package 1/2 left out).

## How each look is selected (default = old look everywhere)

| Piece | Where | Values | What reaches the entity |
|---|---|---|---|
| Thân robot | new select "Kiểu dáng (chỉ đổi hình vẽ)" | `classic` (default) / `agv` | `look: 'agv'` only when chosen |
| Thanh nối | same select | `classic` / `factory` | `look: 'factory'`; bar = arm link A, link with "Bề rộng" = AGV tray |
| Khớp xoay | same select (Nâng cao, next to Màu) | `classic` / `factory` / `hinge` | arm joint A, or a slim hinge pin for the tray joint |
| Tay kẹp | same select (Nâng cao) | `classic` / `factory` | palm + both fingers |
| Đồ vật, Tạo đối tượng | new select "Kiểu kiện hàng" | `classic` / `parcel-carton` / `parcel-1..5` / `parcel-box` / `parcel-mix` | `look` on the item; shape, size, mass unchanged |
| Vật thể | 4 new values in the existing "Kiểu dáng" | `belt-frame`, `scan-gate`, `chute`, `arm-base` | `blockStyle` |
| Mốc sàn | no option: look 2 replaces the placeholder figure (as instructed) | | |

- A board that never mentions a look spawns entities with no `look` field (test: entity lists are deep-equal apart from `look`), so world state and hashes are untouched.
- Colours follow the existing "old default colour = look colour" rule: chassis default blue -> orange `#ff9f2e`, link grey -> orange, block grey -> the look's colour. Any other colour is the user's.
- Node edits are one select + one `createOnly` id + one spread into `spawn` per piece. No change in `world/`, `editor/`, `circuits/`. `engine/`: new `factory-looks.ts` (look ids/labels) and 4 values in `block-styles.ts`.
- Handbook: one sentence per new option (tests require every param to be explained).

## Files (app/)

- New: `src/engine/factory-looks.ts`; `src/render/factory-kit.ts` (bake parts into one vertex-coloured toon mesh, caches), `factory-agv.ts`, `factory-arm.ts`, `factory-parcels.ts`, `factory-blocks.ts`.
- Changed: `src/render/scene-view.ts` (pick figure by look), `block-looks.ts` (dispatch 4 styles), `arm-part-models.ts` (export the overload cue), `floor-marker-figure.ts` (look 2), `src/engine/block-styles.ts`, `src/nodes/{robot-body,link,joint,gripper,item,spawner}.ts`, `src/handbook/content-{robot-drive,robot-arm,action-brain,math-object-output}.ts`.
- Tests: `tests/render/factory-looks.test.ts` (29), `tests/render/floor-marker-figure.test.ts` (+1), `tests/render/block-looks.test.ts` (style list).
- Dev only, not shipped: `tests/showcase/scene-harness.{html,ts}`, `tests/showcase/factory-showcase-board.ts`.

## Verification

- `npx tsc --noEmit -p .`: clean.
- `npx vitest run tests/arm tests/render tests/editor/solid-off-unchanged tests/editor/real-physics-on-hash`: 39 files, 590 tests passed; hash guards passed without re-recording (no baseline file touched by me).
- Whole suite, once, on the final merged state e45c0ed: 279 files passed, 1 skipped; 4184 tests passed, 1 skipped; 359 s. (An earlier whole-suite run was stopped unfinished when main moved.)
- Dev server on 5184 stopped.
- Pixel compare: see table section.
- Showcase shots read by me: `plans/reports/shots-factory-assets/showcase-*.png` (3D), `showcase-side-view.png`, `showcase-top-view.png`, `app-light-*.png`, `app-dark-*.png` (real editor, board opened through "Mở file…", played).

### Pixel compare (old boards must not change)

Script: `plans/reports/shots-factory-assets/scripts/sample-pixels.mjs` (`take <tag>` / `compare <a> <b>`), through the dev page `tests/showcase/scene-harness.html`: real `SceneView` + the app's `CameraRig`, same renderer settings as the game view, clock and `Math.random` pinned, exact tick count, 1280x800.
BEFORE = source at ab21c74 (harness commit only). Every one of the 24 boards (7 menu samples + 17 archived, so the "8" are included) at ticks 0, 1, 60, 300 = 96 pictures.

| Set | Pictures | Pixels each | Differing pixels | Largest channel difference |
|---|---|---|---|---|
| 24 boards x tick 0 | 24 | 1,024,000 | 0 | 0 |
| 24 boards x tick 1 | 24 | 1,024,000 | 0 | 0 |
| 24 boards x tick 60 | 24 | 1,024,000 | 0 | 0 |
| 24 boards x tick 300 | 24 | 1,024,000 | 0 | 0 |
| **Total** | **96** | | **0** | **0** |

AFTER was taken three times (branch alone, after merging 8ee9d8b, after merging f6e26db = final state e45c0ed): 0 differing pixels each time.

Notes: each picture is drawn twice and the two must be byte-equal ("repeatable"); one or two first-run pictures per pass were not (always `city-delivery-3d` tick 0, once also `cleaner-bot` tick 0 and `auto-arm` tick 1: pack models still arriving), the saved one is always the second. Tick-0 pictures of 5 arm boards are a blank backdrop both before and after (arm pieces are parked far below until the first tick, so the camera frames nothing); ticks 1/60/300 cover those boards. Full table: `shots-factory-assets/pixel-compare/compare-table.md`.

### Per-figure cost (one render pass; shadow pass doubles calls)

| Figure | Draw calls | Triangles | Classic equivalent |
|---|---|---|---|
| AGV body + 4 wheels | 7 (body, lights, strip, 4 wheels) | 1,936 | 16 calls, 960 tris |
| Tray (plate, base, rod) | 3 | 592 | link: 2 calls, 56 tris |
| Hinge pin | 1 | 112 | joint: 17 calls, 560 tris |
| Arm joint | 1 | 560 | 17 calls, 560 tris |
| Arm link | 1 | 416 | 2 calls, 56 tris |
| Palm / finger | 1 / 1 | 176 / 120 | 2 / 2 calls, 120 / 120 tris |
| Carton | 1 | 120 | |
| Pack parcel | model meshes + 1 sticker mesh | model + 480 | |
| Belt 2.4 m | 2 (frame, moving surface) | 1,214 | conveyor: 6 calls, 176 tris |
| Scan gate | 2 | 492 | |
| Chute | 2 (+2 number planes) | 940 | |
| Arm base | 1 | 352 | |
| Floor marker | 3 | 6 | placeholder: 3 |

All geometry is cached by size + colour and shared: 8 AGVs = 4 geometries, 56 calls, ~15.5k tris; 30 cartons = 1 geometry, 30 calls, 3.6k tris. Whole showcase board: 152 calls with the factory looks vs 322 with the classic looks (same camera), so the new looks cost fewer calls, more triangles (35k vs 22k). Not instanced: per-entity entries in `SceneView` would need a rework; not needed at these numbers.

## Differences from the preview (each one I saw)

1. Tray is 5 cm thick, not 3 (link thickness has a 5 cm minimum).
2. Tray hinge: the app's link hinges at its start, so the natural tray is hinged at the BACK of the AGV (shot `agv-rear-hinge-*`). The preview's side hinge is reproduced with a turntable joint (yaw 90) under the hinge (shot `agv-side-hinge-*`).
3. Light strip: blue (empty) / green (world reports a payload). The preview's amber "tray tilting" state is not ported: the chassis figure cannot see the tray joint.
4. Arm: joints and gripper are the app's real sizes (hub 0.3 m, palm 0.15 x 0.25 m, fingers 0.3 x 0.12 m), so the collar and hand are bulkier than in the preview. No carton "held" pose staged (shots show open / closed only).
5. Arm base is a separate block style ("Đế tay máy"); the preview drew it as part of the arm.
6. Cartons: tape band = the object's colour (preview: always cream). Set colour `#ecd2a2` for the preview look. kg tag comes from the existing tag layer (front/back in 3D, top in top view), so no tag on top in 3D, and none when the mass is the default 1 kg.
7. Pack parcels are stretched per axis to fill the real box (preview: uniform fit to 0.5 m) and carry a round colour sticker on top and both ends.
8. Chute: number board stands on the back kerb inside the footprint (preview: on a post outside the corner). Bag and board take the block colour (default = preview blue).
9. Belt: no physical side walls and it does not auto-run (see limits); gate is its own block, lamp = block colour (preview: blinked by itself when a parcel passed).
10. Floor marker: ring in the marker's colour (piece default `#f59e0b` amber; preview `#ffd23f`), number added in the front-right corner, no direction arrow (the piece has no heading).
11. Deck top sits exactly at the chassis top (preview 9 mm above).

## Tinting pack models

All pack models share ONE palette material, and the parcels are already strongly coloured, so a multiply tint turns them muddy. They keep their own colours; the class colour is a round sticker (object colour on a dark backing) on the top and both ends, always shown. Cartons show it as the tape band. Both read the entity colour, so "Sinh ngẫu nhiên theo loại" colours are readable (shot `showcase-parcels*.png`).

## 2D views and themes

- Side / top views draw the same figures (shots `showcase-side-view.png`, `showcase-top-view.png`): AGV, tray, parcels, chute, belt, gate, markers all read correctly. Finger pads move to the y faces in the side view as the classic look does. In the top view an arm in the vertical plane shows mostly its base, as before.
- Themes: nothing in `src/render` reads the theme, the scene backdrop is fixed. Real-editor shots in light and dark show the same scene.

## Limits

- `belt-frame` only moves things when "Tốc độ băng chuyền" is not 0, and has no side walls: `beltOf` in `nodes/block.ts` treats only style `conveyor` as an auto-running belt, and I was not to change node behaviour. One line there (`isBelt` also true for `belt-frame`) would make it behave like "Băng chuyền".
- Tray stand/hinge/rod assume the plate's underside is 5 cm above the chassis top (mount y = height/2 + 0.05 + thickness/2) and a level base; on other mounts the stand floats or sinks. Rim (3 cm) and wheels/fenders are drawn outside the physical boxes.
- Chute is draw-only like every block style: for parcels to fall in, the block must be "Vật nhặt (đi xuyên qua)" in a floor hole.
- Parcel looks apply in the world only; an item carried in a character's hand is still drawn by its shape.
- Headless SwiftShader shots only; real-GPU look and frame rate not measured.
- New dropdown entries are visible UI the user has not seen in the app yet (wording in `engine/factory-looks.ts`, `block-styles.ts`).

## Questions for the user

1. Carton tape: object colour (now) or always cream with a colour sticker?
2. Should pack parcels show the colour sticker only when classes are on? (Needs a flag from the spawner; render cannot tell.)
3. Floor marker ring: keep the piece's amber default or switch the default to the preview's yellow `#ffd23f`?
4. Belt "khung xanh": make it auto-run with walls like the old belt (one-line node change)?
5. Tray hinge at the back (simple) or at the side (needs the extra turntable joint) for the AGV sample?
