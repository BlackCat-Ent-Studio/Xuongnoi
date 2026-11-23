# Logistics (Agent C) report

Branch feat/city-logistics, worktree D:\workspace\GameBuilder-logistics. One commit, not merged.

## Delivered
- Cargo ("Chất / Dỡ hàng"): new text params "Loại cần chất" and "Loại cần dỡ" (empty = old behaviour). Dỡ and Dỡ hết take the top-most item of that type. New output "Số hàng loại này" (typeCount). With a type set, "Hàng trên cùng" also reports the top item of that type. Old outputs kept.
- "Loại trên cùng" (text output) SKIPPED: PortType is only bool/number/object, no text port.
- "Loại cần dỡ" is a param only (no text input port, same reason).
- Shared API (minimal, additive): `WorldApi.tagOf(id): string`, `EntitySpec.tag?`, `Entity.tag?` (items only). `loadCargo(..., tag?)` and `unloadCargo(vehicle, tag?)` got an optional trailing arg.
- New node `guide-arrow` ("Mũi tên chỉ đường", category output): inputs Từ (required), Tới, Hiện (default true); params colour + "Hiện khoảng cách" (Có/Không); output "Khoảng cách" (ground-plane x/z distance, unrounded). Hidden when Tới empty/hidden, Hiện off, or distance < 1.5.
- Render channel: `HudItem.guide?: { to, showDistance }` (new optional field, anchor = Từ, value = rounded distance). New `render/guide-arrows.ts` (pure `guideArrowShapes` + DOM `GuideArrowLayer`). Direction is the ground direction projected through the camera, so it works in 3D, 2D trên, 2D ngang. Hook-up in `render/game-view.ts` is 6 lines (create layer, sync per frame, clear on reset/play).
- Palette search keywords added for the node (editor/panels/palette-search.ts, 1 line).

## Files
- engine/types.ts, world/{world,cargo,entity}.ts, nodes/{cargo,index}.ts, render/game-view.ts, editor/panels/palette-search.ts
- new: nodes/guide-arrow.ts, render/guide-arrows.ts
- tests new: tests/nodes/cargo-types.test.ts, tests/nodes/guide-arrow.test.ts, tests/render/guide-arrows.test.ts
- tests edited: cargo-and-zone-follow (ports list + typeCount in an exact-equal), step-1-nodes (kind count 48 -> 49), fake-world (`tagOf: () => ''`)
- CRLF kept for types.ts, world.ts, game-view.ts; mixed index.ts edited only on LF lines.

## Gates (app/)
- vitest 67 files / 911 tests pass (one run saw a timeout-type flake in city-delivery-sample "dice seed 8" under load; passes alone and in the full rerun).
- tsc --noEmit clean; npm run build OK.

## Browser check (port 5195, stopped)
Board injected into `xuong-noi:autosave`: truck, house, 2 items, arrow truck -> house, follow camera. 3D and 2D trên: arrow floats above the truck pointing at the house with label "24"; 0 console errors/warnings. Shots: D:\workspace\GameBuilder\plans\reports\shots-logistics\ (3d-1-start, 3d-2-moved, 2d-top-1-start, 2d-top-2-moved). Script: smoke\logistics-arrow.mjs in the scratchpad.
Cargo types are covered headless only: no item param for the tag exists on this branch (Agent A adds "Loại hàng"), so board JSON cannot set it.

## Merge notes
- Expected trivial conflicts: types.ts (WorldApi `tagOf` identical signature to A's; remove duplicate), world.ts tagOf, nodes/index.ts import/list, step-1-nodes.test kind count (B adds a route node: sum the counts), fake-world.ts `tagOf`.
- A should read `tag` into the spawn spec via `tag` (same field name) so cargo filtering works with their item param.
- Junction app\node_modules left for the controller to remove.

Status: DONE_WITH_CONCERNS
Summary: Cargo type filtering, guide arrow node + renderer, tests and gates done; committed on feat/city-logistics.
Concerns: "Loại trên cùng" text output skipped (no text port type); item tags not settable from board JSON until A's param merges; city-delivery-sample test can time out under heavy parallel load (pre-existing slowness, 22 s alone).
