# WT-C objects report (branch `feat/objects`, worktree `D:\workspace\GameBuilder-objects`)

Commit: `6d99d52 feat(objects): moving and rotating platforms, shooter, spawner, dodge-shoot sample` (on top of 01ed58e).

## Verify
- `npx vitest run`: 570 pass (513 baseline + 57 new). `npx tsc --noEmit -p .` clean. `npm run build` ok.
- Browser (own server on 5183, stopped): palette shows the 4 new nodes; `dodge-shoot` plays: rock falls on idle player (lose), calm variant (rain timer 600s) -> ride lift across pit, shoot target 3x past the turning shield -> "Thang!". Zero console errors/warnings. Screenshots: `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\c6588d98-de8b-47ca-8a66-fd5282a3c2b1\scratchpad\wt-c\` (01-edit, 02-rock-falling, 04b-riding-lift (player stepping onto lift, mid-step), 05-shot-in-flight (shield flat, target hp 2), 06-end), script `check.mjs`.

## What was added
New files: `src/world/platforms.ts`, `src/world/projectiles.ts`, `src/world/spawner.ts`, `src/nodes/{moving-platform,rotating-platform,shooter,spawner}.ts`, `src/samples/dodge-shoot.json`, tests `tests/world/objects.test.ts`, `tests/nodes/object-nodes.test.ts`, `tests/io/dodge-shoot-sample.test.ts`.

Shared-file hooks (append-only, small):
- `engine/types.ts`: `EntitySpec.disposable`, `ShotSpec`, `EntityView.angle`, WorldApi `moveBlock`, `setBlockAngle`, `shoot`, `shotHits`.
- `world/world.ts`: the 4 methods, `markMover`, `dropDisposed` (hidden disposable entities are removed from list so shots/spawns do not accumulate), `stepBullets` call after `stepPhysics`, `settleTurns` at step start, `solidBoxes()` skips movers, `spawn` copies `disposable`.
- `world/physics.ts`: `touching()` uses rotated outline for spinners; free-item loop skips bullets.
- `world/entity.ts`: fields `mover/turn/bullet/disposable`; view gets `angle`.
- `render/scene-view.ts`: block mesh rotation from `angle` (2 lines).
- `nodes/index.ts`: 4 imports + 4 list entries (node count 29 -> 33; `step-1-nodes.test.ts` updated).
- `io/samples.ts` + `tests/io/samples.test.ts`: sample id/mode/idle-exclusion lines. `tests/nodes/fake-world.ts`: 4 stubs.
Merge hints: conflicts are only lines in these append points; other WTs adding WorldApi methods/fake-world stubs/nodes/samples will need trivial union merges. `tests/io/samples.test.ts` expected-lists need all new ids/modes in merge order.

## Behaviour (honest notes)
- **Moving platform** (`moving-platform`, "Bệ di chuyển"): A = position, B = `to`; speed, wait, ping-pong or one-way, `run` input (default true); outputs self/moving/arrived. Motion is driven by the node via `world.moveBlock` (immediate, sub-stepped 0.25 so it cannot tunnel). Riders (characters, loose items, vehicles whose feet are within 0.06 of the top and overlap horizontally) are carried on every axis; non-riders overlapping the new box are pushed along the move axis. No crush: if a carried/pushed body would end inside another solid, that axis step is reverted and the platform waits (node retries; reports not moving). Held items/seated drivers skip (they follow their holder/vehicle). 2d-top: no "standing on" (no vertical), so it acts as a moving wall that pushes; documented limitation. Seated vehicle solids/other vehicles are not counted as crush blockers (only solid blocks).
- **Rotating platform** (`rotating-platform`, "Bệ xoay"): `step` mode = solid, quarter turns on `turn` edge or every N s; width/depth swap (x<->y in side view, x<->z otherwise) so the AABB is exact; picture eases (angle offset decays 9 rad/s) while collision is already the final shape (visual mismatch up to ~0.17 s). People inside the new footprint are moved to the nearest free spot (max 2.5 units, up preferred by distance); if none exists the turn waits and retries. `spin` mode = non-solid continuous spin (deg/s, run gate); touch uses the exact rotated rectangle (SAT) vs the other's AABB in the view plane, so it is not a bounding-sphere approximation (stricter than plan). Spinner does not push/hurt anyone; wire touch -> lose/health yourself.
- **Nav**: first move/turn marks a block as `mover`; it leaves `solidBoxes()` (bumps `solidRevision` once) so the cached nav grid treats it as empty. `solidAt()` still includes it (instant probes). Consequence: bots plan as if platforms are air, do not ride them deliberately, and may stall against a rotated wall until it opens; not handled further (YAGNI).
- **Shooter** (`shooter`, "Bắn đạn"): inputs shooter, optional target (aim incl. height), fire (edge); params speed/lifetime/damage/size/color/gravity/cooldown; outputs hit pulse (one tick) + lastHit (remembered). Shots are non-solid ball items (flagged `bullet`, moved by `stepBullets`, not item physics), cap 150, disposable. They stop at solid blocks/solid vehicles, hit the first other visible live character (strike via combat if Máu present, else just consumed), expire by lifetime, optional gravity (-12, ignored in top view). Owner never hit.
- **Spawner** (`spawner`, "Sinh vật thể"): block or item template (size, color, shape, solid/pickup, carryable), position or offset relative to `at` object, maxAlive, lifetime (0 = forever); outputs lastSpawned, count (alive), spawned pulse, plus extra `toucher` input -> `touched` output (any live copy touches that object). Copies are ordinary entities so touch/etc work with `lastSpawned` (tested). Copies are disposable.
- Deterministic (no RNG, fixed step); tested in 2d-side, 2d-top and 3d where applicable.
- Sample `dodge-shoot` "Né và bắn" (2D side): lift over a pit, shield (step-rotating wall) in front of a 3-hp robot target, F shoots, rocks (spawner) fall at the player's x every 2.5 s (touch = lose), falling in pit = lose. Engine tests: idle loses, pit loses, lift crosses, shield alternates, scripted autopilot wins in < 90 s, deterministic.

## Not done / caveats
- Spin outline is exact only for the view plane; third-axis uses AABB extents. In 3D the spin is about the vertical axis only.
- No tutorial lesson, no docs/HANDOFF edits (controller's job at merge).
- Screenshot of a perfect mid-ride frame not captured (04b shows stepping onto the lift; the browser run still crossed the unjumpable pit and won).

Status: DONE_WITH_CONCERNS
Concerns: bots treat movers as air (documented); possible merge touches in WorldApi/fake-world/samples tests.
