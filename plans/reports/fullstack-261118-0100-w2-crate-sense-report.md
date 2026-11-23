# Crates sensed by their real shape (branch feat/w2-crate-sense)

Labels: [M] measured/tested here, [D] by design, [N] not verified. Nothing pushed or merged to main. Main (d2c0b42) merged into the branch.

## Shared helper
`src/world/oriented-box.ts` (new): oriented box (centre, half sizes, axes), separation along 15 axes, point/inside/ray tests, footprint overlap, shadow length, quaternion helpers. `collider.ts` gets `orientedBox`, `boundsBox`, `isTurnedBody`; `boxOverlap`/`colliderOffset` read the turned bounds. A ball is never treated as turned (its box does not roll). Upright crates and switch OFF take the old code path (no rot set).

## Readers
| Reader | Status |
|---|---|
| `physics.touching` (contacts, isTouching, contact card default) | changed: real outline (SAT) |
| Touch card "grow"/center/inside modes | changed: real outline, flat views flattened |
| Zone card touch / inside | changed: real outline in the zone's yaw frame. "center" rule unchanged (centre is exact) |
| `massOn` (scale, force sensor) | changed: see rule below |
| Click picking in play (`pickEntities`) and editor/scene `pick` | play: changed (ray vs oriented box). Scene mesh pick: not affected (raycasts the already-turned mesh) [M] |
| Gripper reach / between fingers / finger gap | changed: shadow of the turned outline |
| Gripper release orientation | changed: crate keeps turn relative to the hand, new `WorldApi.setItemRotation`; crate-engine re-enter applies `e.rot` |
| `solid-bodies` overlapsBox / isCovered | changed (outline / real heights) |
| `robot-push` pushBodies, restsOnChassis; `platforms` standsOn, crushesCrate; crate-engine `restsOnSomething` | changed to bounds of turned crate |
| `world.useTarget` (swing target) | changed: bounds |
| `probeAhead`, `lineOfSight`, vision sensor, color sensor | not affected: they never consider items (only blocks/vehicles/robots/characters); handbook says so |
| distance card, nearest-item, next-free-slot | left: centre-based, centre of a tipped crate is exact |
| projectiles | left: bullets only hit blocks/vehicles/characters |
| solidAt / solidBoxes / line-of-sight boxes | not affected: blocks only |
| Linear actuator / joint (nodes) boxes from `listEntities` | left: sibling work, uses engine for crates |
| cargo load/unload, carry positions | left: carried crate stands upright when released by a character or vehicle (kept old behaviour) |

## Weighing rule (scale)
A turned crate loads a base when (1) its lowest point is within 0.05 m of the base's highest point and (2) the patch formed by its lowest corners overlaps the base's top patch by positive area seen from above. Any overlap loads the whole mass, as for an upright crate; stacked crates add through the chain. Lying flat on the scale: full mass; half over the edge: full mass; slid off or on the floor beside it: 0 [M tests, hand numbers in crate-sense.test.ts].

## Measured [M]
- Tipped 0.4x1.2x0.4 crate (pushed at 1.1 m): lies along x, centre y 0.2. Touch card with reach 0.4 misses and 0.6 hits a probe 0.5 m from the near face (face at 0.6 from middle, upright box would be 0.2): both ends, symmetric.
- Contact card: fires 5 mm from the lying end; not for a box in the old upright space (0.9 up).
- Zone: counts crate by footprint (zone beyond old box under lying end: 1; zone over old box: 0); "inside": 2 m wide zone 1, 1 m wide zone 0.
- Leaning 45 deg 2 m crate: contact at the tip yes, empty corner of old box no.
- Picking: hits lying end at 0.8 m, misses 0.9 m above; scene pick the same.
- Gripper: arm lifted 30 deg -> held crate tilt 30 deg; after release still 25-40 deg.
- Browser (plans/reports/shots-w2-crate-sense, own server 5294, stopped): switch on, 800 ms upright: card 0 / zone 0; once tipped (4.5 s, 11 s): card 1 / zone 1; crate lies, displayed readouts. Switch off: crate stays upright (pushed, not tipped).

## Hash baseline (real-physics-on-baseline.json)
Re-recorded (two fresh runs identical, off baselines untouched, solid-off-unchanged green):
- `sample:auto-arm` a7c98609 -> 4a79df4f: gripper now keeps turn relative to hand and uses turned shadow (bisected: gripper changes + contact change).
- `sample:agv-shuttle` 3bea87b6 -> 6ed8609c: scale/contact reads of tipped crates (bisected: scale rule change + re-enter rotation).
- `topic:real-physics` 825cf914 -> b91a9735: crate tipped; the hash covers turned-crate state through contact/bounds helpers.
- `handbook:linear-actuator` ffc16e32 -> 69406f3: its zone card now counts the piston-pushed crate by its rotated footprint (main value was the sibling's re-recording).

## Files
New: src/world/oriented-box.ts; tests/world/{oriented-box,crate-sense}.test.ts, tests/arm/gripper-turned-crate.test.ts; plans/browser-scripts/w2-crate-sense-check.mjs. Changed: engine/types.ts (+setItemRotation), world/{collider,physics,material,solid-bodies,robot-push,platforms,world,crate-engine}.ts (crate-engine: only the rest-check bounds and rotation on re-enter, no pusher code), nodes/{touch,zone-sensor,gripper}.ts, render/ui-input.ts, handbook/topic-real-physics.ts, tests/nodes/fake-world.ts, baseline json. Not touched: motor.ts, robot-traction.ts.

## Tests
tsc clean. New tests: oriented-box 15, crate-sense 17, gripper-turned-crate 3. Full run: see end of report.

## NOT verified / gaps
- Ray/overlap queries through the Rapier engine were not used: one shared helper in JS instead (single source of truth, works with switch off path untouched).
- Vision/ahead sensors deliberately do not see items (existing contract).
- Zone with a yaw-turned zone and a turned crate in flat views: logic present, tested only in 3D.
- Crate carried by a character/vehicle still stands upright on release.
- Rolling balls are sensed by their box (no turn).
- Browser: SwiftShader only.
