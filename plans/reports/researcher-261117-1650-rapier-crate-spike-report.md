# Rapier 3D for free crates only: feasibility spike

Date: 2026-11-17. Scope: spike only, no repo change. Scratch: `C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/59c556cb-2e9f-4c7a-9d77-47346d462571/scratchpad/rapier-spike/`.
Labels: **[M]** measured here, **[D]** documented (registry, README, .d.ts), **[A]** assumed.

## 1. Verdict

**GO, conditional.** Rapier for crates only, behind a world switch. Package: **`@dimforge/rapier3d-deterministic-compat@0.21.0`, pinned exact**.

Reasons: bit-identical traces across 5 node processes, a same-process reset, Chromium and vitest [M]. Physics matches hand formulas within 0.5–3 % [M]. Cost is about 0.8 ms per tick for 200 awake crates [M].

Conditions before P1: (1) decide the gravity and unit scale (section 6, risk R1); (2) accept about +1.7 MB gzip on the web and APK build [D/M]; (3) one on-device check in Android WebView, which is not testable here.

## 2. Package choice

| Package | Version / date [D] | Licence | Shipped JS (raw / gzip) [M] | Wasm | Node 24 plain | Vitest 5 | Vite 8 lib build |
|---|---|---|---|---|---|---|---|
| `rapier3d-compat` | 0.21.0, 2026-09-25 | Apache-2.0 | 4.34 MB / 1.65 MB (wasm base64 inlined) | inlined | **OK** | OK (2 tests pass) | 4.41 MB / **1.68 MB** |
| `rapier3d-deterministic-compat` | 0.21.0, 2026-09-25 | Apache-2.0 | 4.37 MB / 1.66 MB | inlined | **OK** | OK, bytes equal node | (same path) |
| `rapier3d` (main, no compat) | 0.21.0 | Apache-2.0 | 33.8 KB js + 3.08 MB wasm (1.17 MB gz) | separate file | **FAILS** (no `exports`, bundler-only) | not tested | 4.48 MB / 1.69 MB, one file |
| `rapier3d-deterministic` | 0.21.0 | Apache-2.0 | same shape as above | separate file | **FAILS** | not tested | not tested separately |

- Init [D]: `await RAPIER.init()` is required before any call. Measured: 44–50 ms in node. Init values must not come from `Math.sin/cos` (docs); the spike uses literal quaternions for this reason.
- ESM / CJS [D]: both `.mjs` and `.cjs` shipped. Import as default export.
- Determinism [D]: the README of the main build says it does **not** guarantee cross-platform determinism; only the `-deterministic` builds do, at a speed cost. Use the deterministic build.
- Compat vs non-compat: the compat build adds about 0.5 MB gzip from base64 overhead, but needs no wasm asset handling. The non-compat build fails in plain node and needs bundler wasm handling, so compat wins for this project.
- Abandonment / breaking changes [D]: minor releases 0.19.0 (2025-09), 0.20.0 (2026-08), 0.21.0 (2026-09). Pin exact. Expect API churn on each minor.

## 3. Determinism

Scene: floor, 4 bin walls, kinematic velocity belt (0.4 m/s), 12 crates (1–8 kg, friction 0.2–0.8), kinematic position pusher sweeping through the bin. 900 ticks at 1/60 s. Full float64 trace (88,200 values) compared byte for byte. Settings: gravity -9.81, solver iterations 4, PGS 1, CCD substeps 1, per-body CCD off, sleeping default on [M].

| Run | Package | Result (sha256 prefix) |
|---|---|---|
| node, 5 separate processes | deterministic-compat | all identical, `f0285386476ec417…` [M] |
| node, 5 separate processes | plain compat | all identical, same hash [M] |
| node, same process, world freed and rebuilt in same order | deterministic-compat | identical to run 1 [M] |
| Chromium 156 (Playwright, local http, no external requests) | deterministic-compat | identical to node, full sha256 `f0285386476ec417a2da8ef4254ee4c9bb777d83c0986729930ea8f6b28b3a78` [M] |
| Chromium 156 | plain compat | identical to node [M] |
| vitest 5.1.0 + vite 8.3.8 | both | trace bytes equal node reference [M] |

Notes [M]:
- The read-back timestep is `0.01666666753590107`, i.e. stored as f32. Identical on every run, so not a determinism issue. Relative error about 5e-8.
- Plain compat matches deterministic compat here only because it is the same machine. The plain build's guarantee is "locally deterministic" [D].

**Not tested:** Android WebView (Chromium-based, version unknown); other CPUs (AVX/FMA differences); Firefox/Safari; Node versions other than 24. **Documented promise:** the `-deterministic` build guarantees cross-platform determinism given the same version and init [D]. This is not verified for the APK.

## 4. Physics checks (hand-checkable)

Gravity -9.81, dt 1/60, sleep as noted. Analytic values use g = 9.81.

| Check | Setup | Analytic | Measured [M] | Gap |
|---|---|---|---|---|
| (a) push threshold | 3 × 2 kg in a row, μ 0.5, force ramp 1 N/s on dynamic pusher | 29.43 N | **29.47 N** (tick 1768, 1 mm onset) | +0.13 % (resolution 0.017 N) |
| (b) stack rest, 5 s, sleep off | 3 × 2 kg stack | drift 0 | max drift **9.3 µm**, max per-tick move 1.1 µm, tilt 0 | — |
| (b) stack rest, sleep on | same | — | bodies sleep within 1 s; drift reads 0; force readout frozen | readout unreliable when asleep |
| (b) floor force under stack | sum of contact impulse / dt | 58.86 N | **58.860 N**, max abs error 0.001 N (sleep off); 58.868 N (sleep on, frozen) | ~0 |
| (c) tall crate, quasi-static push at top (1.1 m) | 10 kg, 0.4×1.2×0.4, μ 0.5, ramp 0.5 N/s | tip at 17.8 N | **tips at 18.4 N** | +3 % |
| (c) tall crate, quasi-static push low (0.15 m) | same | slide at 49.05 N; tip at 130.8 N | **slides at 49.3 N** (x > 1 mm); tilt 2° first seen at 54.7 N | slide +0.5 % |
| (c) kinematic hit, 1 m/s, stop 3 cm inside | top 1.1 m / low 0.15 m | tip expected top, slide low | top: 2.2° tilt, 16 mm slide; low: 0.4°, 33 mm | **not reproduced** (see R5) |
| (c) kinematic hit 2–4 m/s | both heights | — | tips (≈90°) at both heights | does not separate top / low |
| (d) ramp 20°, μ 0.3 | slide after 2 s | 1.179 m | **1.190 m** | +0.9 % |
| (d) ramp 20°, μ 0.5 | hold | 0 | **0.0001 m** | holds |

Solver settings [M]: `numSolverIterations` 4, `numInternalPgsIterations` 1, `maxCcdSubsteps` 1, per-body CCD false, timestep 1/60 (f32), gravity -9.81, sleep default on.

## 5. Integration design (measured where marked)

### 5.1 Conveyor
- **API:** a `kinematicVelocityBased` body whose `setLinvel` is the surface speed. Friction carries what rests on it [M].
- **Measured:** 2 kg crate on a 0.5 m/s belt reaches 0.5 m/s in < 0.5 s (analytic: μg = 4.9 m/s², 0.1 s) [M].
- **Jam:** 3 crates pushed against a fixed wall stop with the leader at the wall face (0.65 m); the belt slips under the pinned crate (slip 0.5 m/s) [M].
- **Not available:** JS bindings 0.21 expose only `filterContactPair` / `filterIntersectionPair` in `PhysicsHooks`. No solver-contact modification, so no custom tangent speed or per-contact friction override [D, .d.ts]. Belt carry is limited to μ·m·g, the same as a real belt.

### 5.2 Gripper
- **Pads:** dynamic bodies with `enabledTranslations(true,false,false)` (x only) and `gravityScale(0)`. The arm owns the vertical position. Without this lock the pads fall with the crate: a setup error, found and fixed here [M].
- **Measured hold threshold** (2 kg, μ 0.6, two pads): holds at 16.5 N, slips at 16.25 N per pad. Analytic `gripHolds` (mechanics.ts): 16.35 N [M]. Matches within 1 %.
- **Held item:** switch the crate to `KinematicPositionBased` (`setBodyType`) while held, and back to dynamic on release [D]. Keep `gripHolds()` in the game as the authority for slip decisions, not Rapier.
- **Crush:** per-pad squeeze = Σ `contactImpulse(i)` / dt [M]. Measured 40.000 N vs 40 N applied, sd 0. Compare against `crushLimit` (material.ts). Caveat: reads are frozen while the crate sleeps; keep sleep off for held or weighed crates.
- Alternative (not tested): `ContactForceEvent` via `EventQueue.drainContactForceEvents` [D].

### 5.3 Cost per tick (node, this CPU, single thread) [M]

| Crates | Sleep | Mean ms | p95 ms | Max ms | Share of 16.7 ms frame |
|---|---|---|---|---|---|
| 50 | sleeping | 0.05 | 0.09 | 4.5 (warm-up) | < 0.5 % |
| 200 | sleeping | 0.08 | 0.16 | 1.0 | < 0.5 % |
| 50 | awake | 0.22 | 0.35 | 1.8 | 1.3 % |
| 200 | awake | 0.79 | 1.01 | 1.7 | 4.7 % |

Stacked 4-layer grid, not a deep pile. Real bin piles may cost more [A].

## 6. Risks and mitigations

| # | Risk | Evidence | Mitigation |
|---|---|---|---|
| R1 | **Gravity / unit mismatch.** `physics.ts` integrates at -30 units/s²; `mechanics.ts` uses 9.81 m/s² with 1 unit = 1 m [D]. Rapier at -9.81 falls about 1.75× slower than the rest of the game. | Read in source | Owner decides one scale. Use one constant for Rapier gravity and the formulas. Test the feel on P1. |
| R2 | Cross-CPU / APK determinism unproven | Only one machine tested | Keep `-deterministic` build; golden-hash vitest test; one on-device run in Android WebView before enabling for players. |
| R3 | No contact hooks in JS 0.21: belts only by friction | .d.ts [D] | Accept friction belt for crates. Keep exact-carry for other items. |
| R4 | Sleep freezes contact readout; scale and crush reads go stale | Measured (58.868 N, sd 0 while asleep) | Disable sleep on crates that are weighed or gripped; or wake on read. |
| R5 | Tipping from kinematic impacts not predictable | Top hit at 1 m/s did not tip; 1 m/s shove tipped low too (suspect pusher overlap) | Use dynamic pushers (force-driven, verified in (c2)) for tipping cases. Investigate kinematic impulse with CCD before using kinematic hits for gameplay. |
| R6 | Bundle +1.7 MB gzip (compat, base64) | Measured vite lib build | Decide budget. Code-split and lazy-load Rapier only when the switch is on. |
| R7 | API churn (minor bumps every 1–2 months) | Registry dates [D] | Pin exact. Wrap in one adapter module. |
| R8 | Dynamic pads / joints need arm-owned constraints | Found during test | Model grip as x-only dynamic pads, or fixed pads plus kinematic crate. |

## 7. Phased build plan (each phase shippable behind the switch)

| Phase | Scope | Acceptance (plain words) |
|---|---|---|
| P0 | Adapter module: lazy `init`, pinned package, world switch off by default. Golden-hash vitest test. | Switch off: all ~3300 baselines unchanged. Switch on: the golden hash matches node and Chromium. |
| P1 | Free crates fall, stack and fill a bin; floor and walls fixed. | Three crates stacked stay put for 5 s (drift < 1 mm). Crates in a bin do not pass through walls. 50 awake crates < 1 ms per tick. |
| P2 | Pushers (dynamic force-driven) and belts (kinematic velocity). | Push threshold matches μ·m·g within 2 %. A crate on a 0.5 m/s belt reaches belt speed in 0.2 s. A pinned crate holds against a wall. |
| P3 | Grippers: x-only dynamic pads, kinematic hold, release to dynamic. | Grip holds above the `gripHolds` threshold and slips below it (within 2 %). Release drops the crate. |
| P4 | Tipping and crush readout. | Tall crate tips when pushed high (within 5 % of quasi-static), slides when pushed low. Crush reading matches applied N within 2 %. |
| P5 | Device check: Android WebView determinism and frame time. | Same golden hash on device. Frame time within budget on the target phone. |

## 8. Alternative if NO-GO (not needed now)

Own OBB (oriented box) solver: no tipping without SAT and contact manifolds; no ready-made determinism guarantee. Effort not measured. Estimate [A]: 2–4× the P1–P4 work, plus long tuning. Not recommended unless R2 fails on device.

## 9. Limitations

- Single machine, single CPU (Windows 11), Chromium 156 and node 24 only.
- Crate size 0.2 m and units of 1 m are assumed (not checked against the game's item sizes).
- Kinematic impact tipping (R5) not explained; the top-hit result conflicts with the quasi-static result and was not resolved.
- Contact force events (`ContactForceEvent`) not tested.
- Android WebView, iOS, Firefox not tested.
- Cost measured on a stacked grid, not on bin piles with many contacts.
- The app's own vite and vitest config were not used; a separate spike config was.

## 10. Scripts (all in `C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/59c556cb-2e9f-4c7a-9d77-47346d462571/scratchpad/rapier-spike/`)

| File | Purpose |
|---|---|
| `scene.mjs` | Shared determinism scene (no imports; literal trig). |
| `determinism-node.mjs` | Node run, `--reset` for same-process reset. Writes `out/*.bin`. |
| `browser-determinism.mjs` + `browser/index.html` | Chromium run via Playwright, local server only. |
| `physics-checks.mjs` | Push threshold, stack, tall-crate tip (kinematic and quasi-static), ramp. |
| `integration-checks.mjs` | Belt carry, belt jam, gripper squeeze and threshold. |
| `cost.mjs` | Step cost, `awake` argument disables sleep. |
| `rapier-vitest.test.mjs` | Vitest byte-equality test. |
| `bundle-entry.mjs`, `vite.spike.config.mjs`, `vite.spike-nc.config.mjs` | Vite lib builds for size. |
| `noncompat-node-check.mjs` | Plain node import check for non-compat builds. |
| `debug-friction.mjs`, `debug-pads.mjs`, `debug-pads2.mjs`, `debug-pads3.mjs` | Debugging the pad and belt setups that gave wrong first results. Keep as evidence. |

## 11. Unresolved questions

1. Which unit scale and gravity does the game use: -30 units/s² (integrator) or 9.81 m/s² (formulas)? Owner decision; blocks P1 feel.
2. Is +1.7 MB gzip acceptable for the static site and APK? Current bundle size not measured.
3. Android WebView minimum version, and whether its wasm engine keeps the deterministic guarantee?
4. Crate sizes in the game (0.2 m assumed): does the tall-crate test need to match real items?
5. Why does a 1 m/s kinematic hit not tip the tall crate at the top, while a quasi-static push does at 18 N? Needs CCD or substep investigation.
6. Do held or weighed crates need sleep off permanently (cost is still low)?

Status: DONE_WITH_CONCERNS
Summary: Rapier 0.21.0 deterministic-compat is bit-deterministic across node processes, reset and Chromium, and its physics matches hand formulas within about 3 %. GO for crates-only behind a switch, conditional on the gravity/unit decision and an Android WebView check.
Concerns/Blockers: gravity mismatch (-30 vs 9.81); cross-CPU and APK determinism untested; kinematic-impact tipping unexplained; +1.7 MB gzip.
