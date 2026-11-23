# Wave 2 design: item–item collision (B1) and robot inertia / wheel slip (B4)

Date: 2026-11-17. Scope: research + design only. No source changed. Read-only on repo except this file.
Legend: [V] verified by reading source or registry/docs. [A] assumption, to test. [?] open question.

## 1. Verdict (TL;DR)

| Rank | Option | One-line verdict |
|---|---|---|
| 1 | **D-own**: own traction model (B4) + own AABB sequential-impulse solver for free items only (B1), opt-in flag | Deterministic by construction, zero deps, exact teaching numbers, smallest coupling. Risk: stacking stability (testable in phase 1). |
| 2 | D-engine: own traction model (B4) + Rapier deterministic compat for items only | Fallback if D-own fails stacking acceptance. Same coupling surface, +15 MB package, black-box numbers. |
| 3 | A: Rapier for every dynamic body, kinematic things fed in | Most complete (rotation, tipping). Touches ~15 modules; two solvers would disagree during transition. |
| 4 | C-full: own solver for items AND wheels | Dominated by D-own: wheels need no contact solver. |
| 5 | Jolt (jolt-physics) | Strong engine, but cross-platform determinism needs own WASM build with a flag; npm package 46.7 MB unpacked. |
| 6 | cannon-es | No determinism statement found; weaker stacking (known solver, [A]); registry shows stale release. |
| 7 | Havok (@havok/physics) | Licence not verified. Blocked until licence text read. |

**Recommendation: rank 1.** Build B4 first (no new solver; extends existing `chassisAccel`/`followWheels`). Then B1 phases with a stacking kill-switch at phase 1.

## 2. What the current model does (scouted)

### 2.1 Items (B1)

| Behaviour | Where | Result |
|---|---|---|
| Free item integrates against **blocks only** (default rules) | physics.ts:366 `solids` = visible solid blocks; physics.ts:441 `stepFreeItem(..., solids, extrasFor(item))` | Items ignore each other, vehicles, robots (except top of a solid chassis, physics.ts:425-440). |
| `extrasFor` returns `undefined` unless solid-body rules on | physics.ts:381-388 | Item–item response exists **only** in "Va chạm thật" mode. |
| Contacts reported for item–item pairs but no response | world.ts:108-121 (only block–block skipped) | Event/contact data exists; physics does not use it. |
| Item on belt: moved by belt speed, each rider moved against blocks only | conveyor.ts:95-116 (`solidsFor` = blocks for items) | Crates on a belt pass through each other. **No jam** possible. |
| Crate dropped on crate | physics.ts:197-220 integrates vs blocks | Falls through the crate under it, lands on floor overlapping. |
| Crates into a bin (bin = blocks) | same | Land on bin floor; several drops at same x,z overlap. No spread at spawn (spreadOverlaps is editor-card code only, graph-geometry.ts). [V by grep] |
| Pusher (robot chassis / piston head) pushes row | robot-push.ts:47-108; linear-actuator.ts header l.5-15, `planPush` | Works: pushed chain moves as displacement, required force `F = Σ μ·(m + load)·g` (l.11-12). Kinematic: no momentum, no bounce. |
| Solid-body mode: crate pushes crate | physics.ts:381-388 + `moveAxis` soft pushOut (physics.ts:97-103) | Moving crate is stopped flush; the crate it hits **does not move**. A row cannot be pushed. |
| Item friction | physics.ts:188-213: velocity decay `v *= 1 - friction·dt` (rate 10/s default) | Not Coulomb. Material `mu` (material.ts:14, default 0.5) used only by push/grip/slope. **Two friction notions.** |

### 2.2 Robots (B4)

| Behaviour | Where | Result |
|---|---|---|
| Wheel rpm → chassis speed by least squares | robot-drive.ts:57-79 `solveDrive` | Chassis speed is *fixed by wheel speed*: no wheel slip, no ground/wheel speed difference. |
| Accel = min(grip, motors·6 N / mass); braking = grip only | robot-drive.ts:21, 96-101 (`chassisAccel`) | **Mass already matters for starting** (motor-limited). Braking is mass-independent. |
| Grip floor 0.02 | robot-drive.ts:25 | — |
| Turning: α = accel / (width/2) | robot-drive.ts:114-115 | Not an inertia. No yaw moment of inertia `I`. Turning limit reuses linear accel. |
| Payload adds mass; overload = no motion | robot-drive.ts:221-225 | Mass-only; no CoM, no load transfer. |
| Wheel spin integrates rpm, independent of ground | robot-drive.ts:229-232 | Visual only. |
| Push force per motor 30 N × |power| (`maxForce`) vs drive 6 N per motor | motor.ts:50, 89; robot-drive.ts:21 | **Two force constants** for the same motor. |
| Vehicles: accel constant, mass unused | vehicles.ts:151-154 `speedRate` | Vehicle mass (1000 kg default, material.ts:12) has no effect. |

Physics statement to tell the owner: with friction braking, stop distance `v²/(2μg)` does **not** depend on mass. "Heavier load → longer braking" is only true if braking is motor-limited (back-EMF/torque) or load shifts. This needs an explicit decision (§7 Q3).

### 2.3 Interactions a rigid model must reproduce or coexist with

| Existing thing | Where | Coexistence rule |
|---|---|---|
| Belts (friction-free exact surface speed) | conveyor.ts:95-116 | Keep exact carry for old boards. In rigid mode a belt = kinematic surface with friction-driven carry (or keep exact carry, decide §7 Q8). |
| Pistons / linear actuator | linear-actuator.ts; nodes/linear-actuator.ts:270-284 | Head = kinematic pusher with force cap = `maxForce`. planPush stays for old boards. |
| Joint/link "Chắn vật" (solid arm cubes) | arm-solid.ts:68-128 `sweepCubes`, `resolveTurn` | Cubes are kinematic boxes moved by the joint. Torque `τ = Σ F·r` (l.14-15) is a formula, must stay. Rigid items pushed by cubes need the same force cap. |
| Gripper holding (friction grip) | mechanics.ts:65 `gripHolds`; nodes/gripper.ts:164-166 | Held item = kinematic-follow (not solver body) in both modes. Keeps `gripHolds` formula authority. |
| Cargo riding on vehicles | cargo.ts:36-71; conveyor.ts:140-167 | Cargo keeps `cargoPositions` (not solver). Vehicle ride = kinematic carrier. |
| Robot chassis top riding | robot-push.ts:25-29 `restsOnChassis` | Rider on chassis = friction-coupled kinematic carrier. |
| Platforms / moving blocks | platforms.ts:267 | Kinematic (velocity from node). |
| Solid bodies "Va chạm thật" | solid-bodies.ts:33-37, physics.ts:378-388; world-options.ts:8-13; graph-world-options.ts:10-12 | Existing mode; rigid mode must choose: replace or coexist (§7 Q9). |
| Crush limit | material.ts:52-59 `squeeze` | Impact-force crush is new; keep squeeze from grip only (old formula). |
| Scale reading weight | material.ts:82-97 `massOn` (stack walk by `rests`) | Reads mass on top: must still work when items are solver bodies (same data). |
| Hidden invariants | dev/physics-watch.ts, physics-check.ts:8-18 (`item-in-item`, `item-in-block`) | Good: rigid mode should pass these invariants. Currently only checked in solid mode. |

### 2.4 Determinism and test harness [V]

- TICK_DT = 1/60 (types.ts:913). Fixed-step.
- Random seed `Math.random()` at world creation (world.ts:77); nodes use `runSeed`. Physics itself has no randomness.
- Hash: FNV-1a over `JSON.stringify(world.entities())`, numbers rounded to 1e-4, every 2nd tick, 15 s = 900 ticks (solid-helpers.ts:47-57, 78-99).
- Baseline: solid-off-baseline.json = 138 boards (samples, lessons, handbook). solid-on-summary.snap.json = ON-mode summary.
- Any new field in `EntityView` changes the JSON (world.ts:177-192 `viewOf`). **New fields must be emitted only when the new flag is on**, or all 138 baselines move.
- Test files touching robot / push / belt / vehicle / cargo by grep: 48 / 81 / 12 / 35 / 15 of 215 (loose keyword match, not exact).
- Unit tests that pin current formulas: tests/world/robot-drive.test.ts (e.g. l.124-125 `chassisAccel`), tests/actuator/push-plan.test.ts, tests/mechanics/mechanics-formulas.test.ts.

### 2.5 Unit and constant mismatches (must resolve before any engine)

- Gravity: `GRAVITY = -30` (physics.ts:15) vs `G = 9.81` (mechanics.ts:10, robot-drive.ts:23). Falling items and grip formulas use different g.
- Lengths: unit = 1 m assumed [A]. Block 1 unit. Robot width 0.7 units (robot default, robot-drive.ts:165).
- Max wheel speed default 120 rpm (motor.ts:48) → ~2.5 units/s at 0.2 radius [A].

## 3. Options evaluated

### 3.1 Source facts (registry and docs, checked 2026-11-17)

| Package | Version / date | Licence | Size | Determinism claim | Notes |
|---|---|---|---|---|---|
| @dimforge/rapier3d-compat | 0.21.0 (dist-tag latest) | Apache-2.0 | 15.0 MB unpacked (all targets) | Docs (rapier.rs determinism page): JS/WASM "fully cross-platform deterministic" given same init and version. [V] | WASM inlined base64 (no extra file fetch). `await RAPIER.init()` required (rapier.rs JS guide). [V] |
| @dimforge/rapier3d-deterministic-compat | 0.21.0, published 2026-09-25 | Apache-2.0 | 15.1 MB unpacked | Its README: standard build does **not** guarantee cross-platform determinism; the `-deterministic` build does; it is "less optimized". [V, README 0.19.3] | Use this one if Rapier chosen. Docs warn: init values must not come from Math.sin/cos (rapier.rs). [V] |
| jolt-physics (WASM port of Jolt) | 1.1.1 | MIT | 46.7 MB unpacked | Jolt release notes: `CROSS_PLATFORM_DETERMINISTIC` makes Emscripten WASM build deterministic (v5.1.0). [V] Prebuilt npm build flag: sources conflict (secondary PlayCanvas guide says prebuilt not set). [?] | Multithread WASM builds exist in exports. Threads need SharedArrayBuffer (COOP/COEP) [A, not checked]: bad for static site / APK. |
| cannon-es | 0.20.0 (dist-tag latest) | MIT | not checked | No determinism statement found. [V by absence] | Release date not in registry payload; treat as stale [A]. |
| @havok/physics | not retrieved | unknown (Havok licence model via Unity package: Microsoft Havok Limited Term Licence) [V] | — | — | Licence for npm package not confirmed. Blocked. |

Rapier JS docs say JS version 0.21; the search index said 0.19.3 at one point. Registry 0.21.0 is authoritative. Pin exact version.

Rapier body model [V, rapier.rs JS docs]: Dynamic, Fixed, KinematicPositionBased, KinematicVelocityBased. Kinematic bodies ignore contact forces (pass through walls). CCD per body. Sleeping. Ray-cast vehicle controller exists (no wheel-slip or friction curve detail, no determinism note) [V].

### 3.2 Trade-off matrix

| Criterion | A Rapier all | D-engine (Rapier items) | **D-own (own AABB + traction)** | C-full own | Jolt | cannon-es | Havok |
|---|---|---|---|---|---|---|---|
| New runtime deps | +1 (WASM) | +1 | 0 | 0 | +1 (own build) | +1 | +1 (licence) |
| Bundle (gz, est.) | ~0.8 MB+ [A from 0.19.3 aggregator] | same | ~10–20 KB [A] | ~20 KB | large | small | unknown |
| Async init in node tests | yes (await init) | yes, items only | no | no | yes | no | yes |
| Offline APK | inlined base64: OK [A] | OK [A] | OK | OK | needs own asset plan | OK | unknown |
| Determinism guarantee | docs claim, deterministic pkg needed [V] | same | by construction (IEEE +−×÷√ only) [A: no Math.sin/cos in new path] | same | needs flag build [V] | none stated | unknown |
| Stacking stability | good (rapier solver) [A] | good | **needs phase-1 test** [A] | same risk | good [A] | weak [A] | good [A] |
| Rotation / tipping | yes | no (AABB) | no | no | yes | yes | yes |
| Teaching: student predicts N, kg, μ | poor (black box) | poor for contacts; ok for pushers if pusher is formula | **good** (F = μ·N·dt, impulse) | good | poor | poor | poor |
| Coupling: modules changed | ~15 | ~6 | ~6 | ~8 | ~15 | ~15 | ~15 |
| Old-board hash safety | opt-in possible | opt-in | opt-in per flag | opt-in | opt-in | — | — |
| Tuning effort | low (defaults) | low | **medium-high** | high | medium | high | medium |
| Maintenance / abandonment | active (Dimforge, Apache) [V registry date] | same | our code | our code | active (MIT) | stale [A] | licence risk |

Adoption risk: Rapier is an active project with a dedicated deterministic build (positive). Breaking changes in 0.x: expect API churn between minor versions (assumption, not checked). Jolt is mature (JoltPhysics upstream, multiple years). cannon-es: small team, low recent activity.

### 3.3 Why D-own beats A and D-engine here

1. **Coupling.** Items are the only new dynamic bodies. Everything else (pushers, belts, cubes, vehicles, cargo, grip) stays formula-driven with a force cap. An engine would force a second source of truth for ~15 modules during transition.
2. **Teaching.** The owner's rule is that students predict numbers. D-own emits per-tick N, impulse, μ·N limits. An engine emits results only.
3. **Determinism without a gamble.** No WASM, no init race, no build flag. Node, vitest and APK all run the same JS.
4. **Scope match.** Stacking, belts, piles and a row pushed by a pusher need axis-aligned boxes. Tipping is not in the wave-2 list.
5. **Fallback exists.** If phase 1 fails its stacking test, D-engine swaps only the item solver (same interface), with Rapier deterministic compat.

Cost of D-own: we own a solver. Mitigate with a narrow feature set (boxes only, no rotation, mass ratio clamp, sleep threshold) and a kill-switch at phase 1.

## 4. D-own design (sketch)

### 4.1 Traction (B4)

- Per wheel: `F_i = min(τ_i / r, μ · N_i)`; `τ_i` = motor torque curve (new param, default = current 6 N-equivalent so old boards unchanged) [A design].
- `N_i` = static share of weight by position (CoM) + load transfer `ΔN = m·a·h / L` [A design].
- Chassis: `m·a = Σ F_i`; yaw: `I·α = Σ F_i · y_i`, `I = m(w² + L²)/12` [formula, textbook].
- Wheel rpm is **a state**, not an input: `ω_i` integrates `(τ_i − F_i·r)/J_wheel`; slip = `ω_i·r − v_contact`.
- Old path (`solveDrive` + `followWheels`) kept behind flag. Robot with no new params takes the old path → identical hashes.

### 4.2 Items (B1)

- Boxes only (AABB, no rotation). Dynamic = free item. Static = blocks. Kinematic = pushers (cube/head), belt surfaces (velocity), held items (follow).
- Sequential impulses, 8–10 iterations, warm start, Baumgarte/split slop 0.005 units, substep rule reused (physics.ts:22, `MAX_SUBSTEP_DISTANCE = 0.4`).
- Coulomb friction cone with `mu` from material.ts (single friction notion in rigid mode; §7 Q6).
- Mass ratio clamp (e.g. 1:100) and sleep threshold (speed < 0.01 for 0.5 s) for hash stability.
- Pushers: kinematic velocity capped by force: `F_needed ≤ maxForce` else stall (same rule as planPush `exceeds`, linear-actuator.ts header).
- Iteration order: entity list order (deterministic, world.ts:69).

### 4.3 Flags and compatibility

- `settings.rigidItems` (graph setting, like `solidBodies`; graph-world-options.ts:10-12). Default off. Off = today's code path, byte-identical.
- `settings.robotTraction` (separate flag, so B4 can ship alone). Default off.
- New EntityView fields emitted only when flag on (world.ts:177-192).
- Node params (motor torque, wheel inertia, mu) optional, default absent = legacy.
- New hash baselines for ON mode in a new JSON. Never re-record off baselines.

## 5. Phased build plan

Each phase: own flag section, tests, shippable. Acceptance numbers use `g = 9.81` (pending §7 Q1).

| Phase | Scope | Files (new/changed) | Acceptance (plain words, numbers) |
|---|---|---|---|
| P0 Guard | Flags, no behaviour. Freeze off baselines. Decide g, unit, friction notion. | graph-world-options.ts, world-options.ts, world.ts (flag plumbing only), tests/editor/solid-off-unchanged.test.ts (unchanged) | All 138 off hashes identical. 3197 tests green. |
| P1 Stacking | Free item vs block and vs free item, AABB SI, rigid flag only. | new world/item-contacts.ts; physics.ts (item loop l.426-443 branch); tests/world/item-contacts.test.ts | 1 kg crate dropped on 1 kg crate: top rests within 0.01 units of bottom's top, overlap < 0.001, after 3 s. Stack of 3 crates × 2 kg stands 5 s, drift < 0.005 units. Two crates dropped side by side into a 3×3 bin: no overlap at end. Same board: same hash twice. **Kill-switch: if stack drifts > 0.02 units in 5 s, stop and switch to D-engine.** |
| P2 Belt jam | Belt surface as kinematic velocity for riders; queue at end wall. | conveyor.ts (rigid branch), physics.ts | Belt 1 unit/s, 3 crates 1 kg, wall at end: crates stop in a queue, no overlap, belt slides under the first crate (μ 0.5, belt pulls 0.5·1·9.81 = 4.9 N max). |
| P3 Pusher row | Kinematic pusher with force cap for robot chassis and piston head in rigid mode. | robot-push.ts (rigid branch), linear-actuator.ts (rigid branch), tests/actuator/rigid-push.test.ts | 60 N pusher moves 3 crates of 2 kg, μ 0.5, row starts at rest: all three move ~same distance. 20 N pusher: nothing moves. Threshold 29.43 N (= 0.5·6·9.81) within ±5%. Parity with planPush on the same board: same threshold. |
| P4 Wheel traction | Per-wheel force = min(τ/r, μN); slip when τ/r > μN. | robot-drive.ts (new `tractionStep`), motor.ts (optional torque param), robot-push.ts | 2 kg robot, 2 motors at 6 N, μ 0.8: accel 6 m/s² (motor-limited). Payload 1 kg more: 4 m/s². μ 0.2: accel 1.96 m/s² (grip-limited, wheels spin: rpm shows > ground speed). |
| P5 Yaw inertia | Turning by wheel torque difference; I = m(w²+L²)/12. | robot-drive.ts | 2 kg, track 0.7, 6 N opposite wheels: α = 2·6·0.35 / 0.2483 = 16.9 rad/s² (within 5%). Heavier chassis turns slower by same ratio. |
| P6 Braking and load shift | Braking as friction-only; load transfer on CoM. | robot-drive.ts, material.ts (CoM field, optional) | 2 kg and 5 kg from 1 m/s, μ 0.8, friction braking: both stop in 0.064 m (= v²/(2μg)). Tipping shift: 5 kg load at front of 0.5 m-long chassis at 2 m/s² accel: front wheel load up by m·a·h/L (numbers given in test). |
| P7 Doc and handbook | Engineering handbook entries for N, kg, μ, slip. | handbook/content-*.ts, docs/ | Only after owner accepts. |

Units: all numbers in SI with 1 unit = 1 m [A].

Phases P1–P3 deliver B1; P4–P6 deliver B4. B4 can ship first (no solver risk).

## 6. Not covered (and why it matters)

- Box rotation and tipping: AABB only. Students cannot topple a tall stack. Matters if a "tip over" lesson is wanted → would push to option A.
- Friction-driven belt slip beyond phase 2 test: not modelled as default.
- Robot-to-robot and vehicle-to-item pushing: only chassis-top riding and chassis-as-pusher in P3; vehicles keep old rules.
- CCD for fast items (> 0.4 unit per substep): reuse existing substep rule; very fast bullets stay in old path (projectiles.ts).
- Deformation, restitution beyond existing `bounce`.
- Cross-machine proof: only node vitest + one browser run planned; no real Android WebView hash run.
- Hash determinism across browsers: Math.sin/cos differ across engines in principle [A]; new rigid path must avoid them (use only +−×÷√) and the heading→pose must be exact.
- Performance: not measured. Expected fine for < 200 items [A]; not tested.
- Havok and Jolt: not integrated. Only registry/docs checked.

## 7. Open questions (need owner decision)

1. **Gravity in rigid mode:** 9.81 (matches N = m·g and mechanics formulas) or 30 (matches current fall feel)? Recommend 9.81; old mode unchanged.
2. **Unit scale:** is 1 block = 1 m? Needed for every acceptance number above.
3. **Braking expectation:** friction braking is mass-independent. Accept, or add motor braking / back-EMF parameter (new node param)?
4. **Tipping:** are boxes ever meant to topple? If yes, reconsider option A.
5. **Opt-in granularity:** one graph switch for items ("Va chạm vật") and one for robots ("Bánh xe thật"), or per-node params?
6. **Friction notion in rigid mode:** material `mu` (Coulomb) replacing item `friction` decay (rate 10/s)? Recommend yes in rigid mode only.
7. **Motor force constants:** drive 6 N per motor vs push 30 N per motor (motor.ts:50). Keep both or unify in rigid mode?
8. **Belts:** exact surface speed (current, no slip) or friction-driven carry (can slip)?
9. **Existing solid-body mode:** keep as-is beside new flag, or replace it when rigid is on? Replacing changes a shipped game mode.
10. **Bin:** what exactly is a "bin" in current samples (blocks only?). Needed for phase 1 acceptance.
11. **Default boards:** should any sample use rigid items? Currently none; they stay old-behaviour.
12. **Robot max wheel speed and radius** defaults used for P4–P5 numbers: confirm.

## 8. Verification log

| Claim | Basis |
|---|---|
| Items ignore items in default mode | Read physics.ts:366, 381-388, 426-443 |
| Belt riders pass through each other | Read conveyor.ts:95-116 |
| Stacking/bin behaviour | Derived from physics.ts:197-220 (no item–item term); not run |
| Robot accel = min(grip, motors·6/m) | Read robot-drive.ts:21, 96-101 |
| Hash scheme and baseline counts | Read solid-helpers.ts, solid-off-unchanged.test.ts, JSON heads; counted 138 |
| Rapier 0.21.0 Apache-2.0, deterministic pkg exists | Registry fetch 2026-11-17 |
| Rapier JS "fully cross-platform deterministic" | rapier.rs determinism page |
| Rapier standard build not cross-platform guaranteed | deterministic pkg README (0.19.3 snapshot) |
| Jolt CROSS_PLATFORM_DETERMINISTIC needed for WASM | Jolt release notes (v5.1.0) |
| Jolt npm 46.7 MB unpacked, MIT | Registry fetch |
| cannon-es 0.20.0, MIT, no determinism statement | Registry fetch; absence |
| Havok licence unknown | Search only; not confirmed |
| Compat Rapier bundle ~816 KB gzip | Third-party aggregator, 0.19.3, unverified |
| Math.sin/cos not cross-platform deterministic | Rapier docs (general statement) [A for V8 vs others] |
| SI stacking stability, LOC, tuning effort | Assumption |

Status: DONE_WITH_CONCERNS
Summary: Recommend D-own (own traction model for robots, own AABB sequential-impulse solver for free items, opt-in flags, no engine); Rapier deterministic compat is the fallback. Current model: robot accel is already mass- and grip-limited, items ignore each other in default mode.
Concerns/Blockers: Owner decisions needed on gravity (9.81 vs 30), unit scale, braking expectation, and box tipping before phase 1. Havok licence and Jolt determinism build unverified. Stacking stability is an assumption until phase 1 test runs.
