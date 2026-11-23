# Sense finish: share weighing, carried crates keep tilt, surface distance (branch feat/w2-sense-finish, commit b9bcf69)

Switch ON only. Nothing merged or pushed. Labels: [M] measured, [N] not verified.

## Weighing rule
Engine contact forces NOT used: a static lever rule from positions (same every tick, a pupil can check it with a ruler).
A crate rests on a support when its part below (support top + 2 cm) overlaps the support's top face seen from above (area > 0), and the crate is not sunk > 5 cm into it (crate pressed against a side loads nothing). Each support pushes up at the middle of that patch; pushes add to the weight and balance about the crate's centre of mass (2 supports: share_A = W x dist(G,B) / dist(A,B); 3+: least sum of squares, negatives dropped). A crate carries what stands on it (weight at the patch middles) down the chain. Sum of all supports = weight by construction. Other bodies (people, robots, blocks) split their mass equally between what they stand on. Code: world/weighing.ts, world/footprint-2d.ts, material.ts `massOn`. Switch off / no rigid crates: old code path untouched. `massOn`, scale and force-sensor card share one function [M].

## Holders
| Holder | Status |
|---|---|
| Gripper | already kept turn |
| Character carry (grab) | keeps turn vs holder heading while carried, drawn turned, re-enters turned [M 30 deg] |
| Hand tool (equip) | turn kept and restored on release [M]; drawn on the figure's hand so tilt not visible there |
| Vehicle cargo | keeps tilt on board and on unload [M]; slots still laid out by upright height (tilted crate may poke into neighbour) - by design kept |
| Unload / drop spot | now uses turned bounds so a tilted crate does not start inside the floor |
Crates with turn < ~0.6 deg ride upright (rounding wobble).

## Cards
| Card | Status |
|---|---|
| Distance | crate = nearest surface point (upright too, flat views flattened); two crates = gap between surfaces |
| Nearest-item | ranks and reports by floor distance to the crate outline |
| Next-free-slot | centre based, kept: card rule is "middle of an item over the marker"; a crate across two slots would otherwise fill both |
| Projectiles | unchanged: bullets never target items |
| Piston / joint | sibling's pusher side |
| Cargo carry positions | see holders |
| Grab / equip / load reach (centre distance) | NOT changed (gap) |

## Hand vs measured
| Case | Hand | Measured |
|---|---|---|
| Half on scale, half on block, 10 kg | 5 / 5 | 5.0 / 5.0 (tol 0.05 kg: patch middles move mm as crate settles) |
| Fully on | 10 | 10 (6 decimals) |
| 0.05 m on scale | 1.25 / 8.75 | within 0.05 (browser 1.2 / 8.8) |
| Stack 4 kg on 10 kg, on scale | 14 | 14; half-on pair 7 / 7 |
| 30 deg lean on 0.8 m scale edge | 5.53 / 4.47 | 5.42 / 4.58 (0.11 kg = 1.1%: 2 cm contact band; tol 0.15; sum exact) |
| Read-out jitter at rest 2 s | < 1% | tests bound 1% (half-on and stack); exact figure not printed |
| Carried tilt | 30 deg | 30.000 carried (character, hand, vehicle); 25-35 one tick after release |
| Distance, lying 1.2 m crate | 2.4 / 2.8 above / 1.8 two crates | match to 0.005 |
| Nearest-item | picks long crate (4.4) over small (4.6) though its centre is farther | yes |

## Weight-sorter sample
With shares a 7 kg crate reads >= 5 only at 71% on the scale, so the push (timer from heavy-detect) came 0.4 s late and crates missed the side belt (test failed). Fix in the sample: the wait now starts from `Co tai` (first overlap, same instant in both modes) via a latch `here`, plus `busy/idle/forget` to cancel for light crates. Off-mode trajectories identical (solid-off-unchanged and its baselines untouched, green). I edited tests/io/weight-sorter-sample.test.ts: essential-wire list (wait.run now from here, loaded->here.set) and the `limit` wire case moved to its own test (with the compare always on, the first crate of any weight is pushed). crate-pusher-samples green.

## Re-recorded hashes (real-physics-on-baseline.json), two fresh runs identical
- sample:cleaner-bot 35571bce:768 -> a992a980:767: tilted crates now keep tilt while carried/put down (bisected: reverts with keep-turn off).
- sample:city-delivery 9ce9a5e3 -> 8219d465: same cause (cargo/carry).
- sample:agv-shuttle 6ed8609c -> a2c4833d: robot payload weighed by share (bisected: reverts with old massOn).
All other entries unchanged (incl. weight-sorter).

## Docs
topic-real-physics (rule, example 6 with hand numbers, holders, distance, new gaps), distance / nearest-item / force-sensor card text and handbook entries. Handbook tests green.

## Tests
tsc clean. New: crate-weighing 9, crate-carried-turn 4, crate-distance 6. Full `npx vitest run --testTimeout 300000`: 232 files, 3492 tests, all passed (764 s). Browser shots (own server 5296, stopped): plans/reports/shots-w2-sense-finish/ (half 5.0/5.0, quarter 1.2/8.8, switch off 10/10), script plans/browser-scripts/w2-sense-finish-check.mjs. Both folders are git-ignored.

## Not verified / gaps
- Read-out follows positions, not engine forces: no spike when a crate lands or is pushed; leaning-contact friction ignored.
- Grab/equip/cargo-load reach still centre based.
- Cargo slots ignore tilt; tool tilt not visible in hand; stage-themed carried drawing not checked [N].
- Sibling edits to topic-real-physics.ts line ~54 may conflict on merge (I edited the next lines).
- Chromium SwiftShader only.
