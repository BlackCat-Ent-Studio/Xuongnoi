# Arm family look B ported to the app (2026-11-16)

Worktree `D:\workspace\GameBuilder-armlook`, branch `feat/arm-look` (from main 15cfec5). Dev server left running on :5276 (`npm run dev -- --port 5276 --strictPort`). Shots: `plans/reports/shots-arm-look/`. Shot script: `plans/browser-scripts/arm-look-shots.mjs`.

## Files
New:
- `app/src/render/arm-part-models.ts` - look B parts (link, joint, palm, finger, piston housing/rod/head), warning ring + "!" sprite, shared toon material per colour, geometry cache by size.
- `app/src/render/load-tag.ts` - "N kg" tag layer.
- `app/src/engine/render-hints.ts` - side table that tells the renderer which block is which arm part.
- `app/tests/render/arm-look.test.ts` - colours, parametric sizes, triangle caps, hints, squeeze axis, chassis.

Changed:
- `app/src/render/scene-view.ts` (+20/-2): new entry type `arm`, `matches()` rule, creation + per-frame update branch, `LoadTagLayer` sync/dispose.
- `app/src/render/robot-models.ts`: chassis + wheels restyled (rounded orange body, dark deck, black bumper with yellow strip, black tyres with yellow hub and a dark bar so spin shows).
- `app/src/render/damaged-look.ts`: flatten along `squeezeAxis` when present, else height as before.
- `app/src/nodes/{joint,link,gripper,linear-actuator}.ts`: one `setArmHint(...)` call after each spawn; joint also refreshes `{axis, overloaded}` each evaluate. No logic, ports, params or physics touched.
- `app/src/engine/types.ts`, `app/src/world/{entity,material,world}.ts`: the optional squeeze direction (below).

## Render-only vs not
Render-only: everything in `src/render/**`, `render-hints.ts` and the `setArmHint` calls. The hint table is a module-level Map keyed `ownerNodeId|entityId`; nothing in the simulation reads it. I did NOT put a `look` on the spawned blocks because `EntityView` JSON is what the baseline hashes cover, so a new `look` value would have changed every arm board hash.

Not render-only (the one allowed exception): optional squeeze direction.
- `WorldApi.applySqueeze(id, forceN, direction?: Vec3)`; gripper passes its grip axis (`normalOf(base)` in the side view, `lateralOf(base)` elsewhere).
- When a squeeze first breaks a body and the direction is mostly horizontal, the entity stores `squeezeAxis: 'x' | 'z'` and `toView` emits it only for a damaged body with that field. A vertical, missing or non-finite direction stores nothing, so the body is flattened in height exactly as before. Old hashes unchanged unless a gripper breaks something sideways (then the view gains the one field).
- Limitation: the axis is snapped to x or z (items are not rotated), so a tilted gripper in the side view whose normal is mostly vertical still flattens height-wise (visible in `arm-side-crush.png`); in the 3D view the squash runs along z (`arm-3d-crush.png`).

## What each part draws, triangles in the app (default params)
| Part | Drawn as | Triangles |
|---|---|---|
| Link (1.8 x 0.22) | tapered bevelled slab + lighter stripe (stripe = link colour +22% lightness) | 56 |
| Joint (0.3 cube) | dark collar, motor cap per side (colour +12%), yellow pin, 6 bolts per side | 560 (about +340 while overloaded: ring, glow sphere, sprite) |
| Palm | rounded box + yellow stripe | 120 |
| Finger | rounded box + yellow pad | 120 |
| Piston housing / rod / head | colour cylinder + 2 dark caps / chrome cylinder / rounded black block + yellow band | 240 / 48 / 120 |
| Chassis (1 x 0.7, 2 wheels) | rounded body + deck + bumper + strip; wheel = tyre + hub + bar | 696 |
| "N kg" tag | 3 planes sharing one geometry, texture per label | 2 per plane |

(Measured with the real figures; `tests/render/arm-look.test.ts` caps link < 300, other parts < 400, chassis < 1000.) Geometry is cached by size and materials by colour, so repeated parts share both; tag textures are cached per label.

## Colours
Default detection happens at draw time: a piece whose colour param still equals the old default (joint #8b5cf6, link #a3a3a3, gripper #f59e0b, piston #0ea5e9, chassis #3b82f6) is drawn in look B (dark grey joint, orange link, black claw, orange piston body, orange chassis with dark deck). Any other colour is used as given with shades derived. Rod is always chrome and head black. Side effect: a user who deliberately typed one of the old default hex values gets the look colour.

## Tag
`load-tag.ts`: box and crate items with an explicitly set mass get a yellow "N kg" tag (front and back in side/3D, top in the top view), sized to the squashed size when damaged. Mass is read from `EntityView.mass` (present only when the node set it).

## Checks run
- `npx tsc --noEmit -p .` clean.
- Full `vitest run --testTimeout 300000` (198 files before adding my test): 195 files / 3116 tests passed, 2 failed by timeout only: `tests/io/city-delivery-3d-sample.test.ts` ("cars stop at a red light", 900 s per-test budget) and `tests/puzzle/level-7-decoy.test.ts`. Both are long puzzle/sample searches unrelated to rendering; I re-queued them alone but the machine is busy and they take > 15 min, so see NOT verified.
- Baseline hashes: `tests/editor/solid-off-unchanged.test.ts` (every sample, lesson and handbook board) passes with `solid-off-baseline.json` untouched (`git diff` on tests/editor is empty); `tests/arm/**` pass (incl. the sample's slip / crush / overload scripts). `solid-on-*` pass in the full run.
- `git diff --numstat` equals `--numstat -w` (CRLF kept per file; new files LF).
- Playwright on :5276 (software GL): sample "Tay máy gắp thùng" in side and 3D (start, slip, hold, crush, overload), handbook piston try-board in 3D, sample "Robot dò đường" in top and 3D. Shots: `arm-side-{slip,hold,crush,overload}.png`, `arm-3d-{slip,hold,crush,overload}.png`, `piston-01..05.png`, `robot-2d-top*.png`, `robot-3d*.png`.

## Compared with the preview
Same: orange tapered links with lighter stripe, dark servo collars with caps and bolts, black claw with yellow pads, orange piston body with chrome rod and black head, orange chassis with dark deck and black wheels with yellow hubs, yellow "N kg" tags, red pulsing ring + "!" on overloaded joints (ring drawn without depth test so a pillar cannot hide it).
Different: base pillar stays the user's plain block (no hazard plate; the pillar is any block). Gripper palm is as long as the opening (the node's own geometry), so it reads as a bar with two short fingers. Link colour tags/crates keep their own colours (box item look unchanged; only the tag added). Joint hub is fixed 0.3 m by the node, so a link thicker than ~0.28 m is wider than its joint.

## NOT verified
- The two timed-out tests above were not re-run to completion.
- No phone/touch run, no real GPU (software GL only), no check of the puzzle (cozy stage) screens - they do not use arm nodes.
- Overload "!" for the elbow joint was not shot (the sample only overloads the shoulder with the 6 kg crate; code path is the same).
- The `look` of a joint with axis `yaw` was only unit-built, not shown in the app.
- The sibling branch feat/s-push may touch `scene-view.ts` / `src/world/**`; my edits there are small, expect a trivial merge at worst.

## Open questions
1. Snap the squeeze direction to x/z only (current), or also allow items to rotate with the gripper so a tilted claw flattens along its real axis?
2. Should the plain pillar block under the arm get the hazard-striped plate from the preview (needs a hint on the base block, which is user-built)?
3. Keep the module-level hint table, or later move arm part identity into the entity (changes hashes, needs a baseline re-record)?
