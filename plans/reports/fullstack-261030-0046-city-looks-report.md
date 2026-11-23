# Agent A "Looks" report

Worktree `D:\workspace\GameBuilder-looks`, branch `feat/city-looks`. One commit, not merged.

## Delivered
| # | Item | Result |
|---|---|---|
| 1 | Hộp "Kiểu dáng" | 14 kiểu: hộp (default), nhà ở, cửa hàng, sạp chợ, nhà xưởng, cây xanh, cột đèn, đèn giao thông, mặt đường (vạch), vỉa hè, ruộng rau, núi đá, hàng rào, biển tên. Param "Chữ trên biển". Collision stays the block box. Looks are baked into 2 merged geometries per kiểu (tinted + fixed vertex colours), shared by all blocks. Road/sidewalk/field/fence layouts follow the block proportions. |
| 2 | "Màu mới" | No colour port type exists, so input `pick` (number, "Đổi màu 1/2/3") + params Màu 1/2/3 (defaults red/yellow/green) through `setEntityStyle`. Applies when the number changes to 1..3; 0 and out-of-range ignored. Traffic light: colour hue picks the lit lamp (+ coloured cap visible in 2D trên). |
| 3 | Đồ vật | Shapes `veggie` (bó rau), `ore` (cục quặng). Text param `tag` "Loại hàng" (trimmed). `WorldApi.tagOf(id): string` ('' when unset or unknown id) — Agent C should use exactly this. |
| 4 | 3D light | Sun with shadow map 1024, window follows the camera focus (radius = orbit distance, 8..60), snapped to texels (no shimmer). Hemisphere light kept. In 3D with shadows: sun 2.0, sky 0.8 (more contrast); 2D modes unchanged. Characters, vehicles, items, blocks cast shadows. Auto-degrade: if 90 consecutive play frames average < 40 fps, shadows switch off (console.info) for the session. |
| 5 | Camera | Not achievable with old params (pitch was orbit-only). Added "Góc nhìn" select: Tự do (default, as before) / Chéo từ trên (1.05 rad ≈ 60°) / Thẳng từ trên (1.45). Additive `PlayCameraCommand.pitch?`. |
| 6 | Tests | `tests/render/block-looks.test.ts`, `tests/nodes/city-looks-nodes.test.ts` (defaults, colour switching, tagOf, all kiểu build, bounds, geometry sharing, traffic lamp, shadow state, camera pitch). |
| 7 | Browser | Shots in `plans/reports/shots-looks/`: `3d-play-*.png` (tilted camera, every kiểu + items), `2d-top-*.png`, `2d-side-*.png`, `3d-trafficlight-cycle.png` (red, yellow, green over time), `sample-city-delivery-*.png`. 0 console errors/warnings. Both dev servers stopped. |
| 8 | Gates | `npx vitest run` 908/908, `npx tsc --noEmit -p .` clean, `npm run build` OK. |

## Measurements (headless Chromium, software GL = SwiftShader, other agents running in parallel)
| Scene | fps |
|---|---|
| Showcase + 0 extra blocks | 60 |
| 200 nhà ở + ground, view far from houses | 59-60, shadows stay on |
| 200 nhà ở, camera inside the grid (about 30 houses fill the screen) | about 21 with shadows, auto-off, then 22-41 |
| Same with plain boxes (the old look) | about 20 with shadows, then 42 |

Dense full-screen scene is fill-rate bound on a CPU rasteriser; it does not reach 50 even without shadows (plain boxes: 42). Shadows turn off automatically as required. Real GPUs should be far above this; unverified.

## Existing samples
Pixel diff of the preview canvas, HEAD vs this branch: arena, city-delivery, race, top-collect, key-door, side-stars, maze-chase = 0 differing pixels (all 2D). `3d-hop` (3D) differs by 10546 of 529206 px: the new shadows and lighting balance (intended).

## Files
New: `app/src/engine/block-styles.ts`, `app/src/render/block-looks.ts`, 2 test files.
Edited: `engine/types.ts` (additive: ItemShape +2, EntitySpec/EntityView blockStyle/label/tag, WorldApi.tagOf, PlayCameraCommand.pitch), `world/world.ts` + `world/entity.ts` (store/read style, label, tag; tagOf), `nodes/block.ts`, `nodes/item.ts`, `nodes/camera.ts`, `render/scene-view.ts`, `render/game-view.ts`, `render/cameras.ts` (focus getter, pitch override), `render/item-shapes.ts`, `tests/nodes/fake-world.ts` (+1 line `tagOf`). `nodes/index.ts` not touched (no new node kinds). Line endings of each file preserved.

Status: DONE_WITH_CONCERNS
Summary: All 8 items delivered and committed on `feat/city-looks`; gates green, 2D samples pixel-identical.
Concerns:
- Merge conflicts likely (small, additive) in `engine/types.ts`, `world/world.ts`, `tests/nodes/fake-world.ts` (every agent adds a WorldApi method; Agent C needs `tagOf` as implemented).
- Nothing rotates a static block, so houses and shops always show their front (door) toward +Z; only the 2D ngang view and the +Z side show doors. A "Hướng" param would fix it; left out as out of scope.
- 3D samples (3d-hop) look different by design (shadows, sun 2.0 / sky 0.8).
- 50 fps on the dense 200-house screen is not reached in software GL; shadows degrade automatically, real GPU not tested.
- Sign text is a canvas texture (not generated in node tests); tests cover geometry only. Sign text is drawn only on the two vertical faces.
- Look/material/texture caches are global and never freed (bounded by distinct styles, colours, label texts).
- 2 timing-based city-delivery sample tests time out under heavy machine load (default 5 s); they pass with a larger timeout and also fail on HEAD under load.
