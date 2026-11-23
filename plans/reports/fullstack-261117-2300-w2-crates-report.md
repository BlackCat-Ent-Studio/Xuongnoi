# Crates as rigid bodies, "Vật lý thật" switch (worktree GameBuilder-w2-crates, branch feat/w2-crates, base 384ae4d)

Nothing pushed or merged. One commit on feat/w2-crates (see end). Labels: **[M]** measured here, **[D]** by design/reading, **[N]** not verified.

## What was built

| Piece | How |
|---|---|
| Engine | `@dimforge/rapier3d-deterministic-compat` **0.21.0 pinned exact** (package.json). Only reached through `src/world/rapier-loader.ts` (dynamic `import()`); a test greps `src/world` so no file imports it statically. |
| Crates | `src/world/crate-engine.ts`: loose items (not bullets, not held, not in hand, not cargo) are dynamic boxes (balls = sphere). Mass and mu from the item material, `bounce` = restitution, `gravityScale` kept. Never asleep (see R5). 4 engine steps per game tick, 8 solver passes. |
| Scenery shown to the engine | solid blocks = fixed boxes; a block a node moves = kinematic box (interpolated over the 4 steps); belt = kinematic box that keeps its place and lends surface speed; solid robot/vehicle chassis = kinematic AABB; characters only when "Va chạm thật" is also on. |
| Robots | untouched model. `beginShove` still decides the push cap (motor force x power, capped by wheel grip) and stalls the robot; the chassis then pushes the crate by contact. `finishShove` no longer displaces rigid crates (they move by contact). |
| Held / moved by game code | held (`heldBy`), in hand, vehicle cargo: body freed, crate upright again on release. Teleported by game code each tick (gripper, piston, arm cube, portal): body disabled for that tick, re-enters where it was put. |
| Gravity | `settings.gravity` (m/s², default 9.81, stored only when different, 0..100 accepted). With the switch on it drives Rapier **and** the old fall code of every body (characters, vehicles, robots, fallback crates). Switch off: 30 as before. |
| UI | one row "Trọng lực (m/s²)" (stepper + "?") under the switch, same `pn-setting` style. History key `gravity` coalesces typing; panel does not rebuild under the typing hand. |
| Loading | `play-options.ts` + `game-view.ts`: first Chạy with the switch on shows "Đang tải bộ máy "Vật lý thật"..." (existing HUD banner), game starts only when the engine is up; stop/restart in between cancels. Failure: banner in Vietnamese, game runs on the old item rules (robots keep traction). Old world's engine memory freed when a new world is built (`World.dispose`). |
| Rendering | `EntityView.rotation` (unit quaternion, only on crates under the engine). Item pose group turns about the crate centre in 3D, side and top views; tick-blend nlerps it. |
| Handbook | page "Vật lý thật" gets sections 4 (crates), Gravity, extra "Chưa mô phỏng" lines, worked examples 4 and 5 (tip/slide numbers, fall time); new "Thử ngay" button on topic pages (`HandbookTopic.tryBoard`) with the board `boards-real-physics.ts` (two tall boxes, one pushed at 1.1 m tips, one at 0.15 m slides). |

## Files

New: `src/world/{rapier-loader,crate-engine,play-options}.ts`, `src/handbook/boards-real-physics.ts`; tests `tests/world/{crate-helpers,crate-physics,crate-2d,crate-integration,crate-load}.ts(.test.ts)`, `tests/io/gravity-setting.test.ts`, `tests/editor/real-physics-on-hash.test.ts` + `real-physics-on-baseline.json`; `plans/browser-scripts/w2-crates-check.mjs`.
Changed: `engine/types.ts` (gravity setting, `rotation`, `World.dispose`), `io/save-format.ts`, `world/{world,world-options,graph-world-options,physics,entity,platforms,conveyor,robot-push}.ts`, `render/{game-view,scene-view,tick-blend,text-vi,hud}.ts`, `editor/{editor-state,properties-panel}.ts`, `editor/panels/panels-text-vi.ts`, `handbook/{topic-real-physics,topic-solid-bodies,handbook-dialog}.ts`, `tests/helpers/arm-rig.ts` (optional engine argument), package.json + lock.
Not touched: `nodes/motor.ts`, `world/robot-traction.ts`, off-mode baseline test and JSON files. No change to them is needed: the push cap is read through the existing `beginShove`/`availablePushN`.
Small edits outside the crate files worth a look: `platforms.ts` (`movable()` skips rigid crates; a moving block refuses a step that would crush a crate against a solid, like it did for every other body), `hud.ts` (error banner `top` 12 -> 52 px so it is not under the "Phóng to" button), `conveyor.ts` (`beltVelocity` exported).

## Tests
- `npx tsc --noEmit`: clean.
- Full run `npx vitest run --testTimeout 300000` (595 s): **224 files, 3420 tests; 3419 passed, 1 failed**. The failure was `chrome-wording` (my banner text said "Game"); fixed ("Bảng") and re-run alone: 4/4 pass. Off-mode guard `solid-off-unchanged` + both baseline JSONs untouched and green (138 boards same hash); `solid-on-*` green.
- Before this work the traction report counted 3332 tests. New here: 85 tests in 6 files: crate-physics 16, crate-integration 13, crate-2d 5, crate-load 5, gravity-setting 6, real-physics-on-hash 40 (38 boards + coverage list + re-run). Running slices without `--testTimeout 300000` makes the slow sample tests in tests/io hit the 5 s default under load (3 timeouts seen once); they pass with the flag.
- On-mode baseline: `tests/editor/real-physics-on-baseline.json`, 38 boards (every shipped sample/lesson/handbook board with an Item or Spawner, plus the topic try-board), 15 s each with the switch on and the engine loaded. Recorded twice in two fresh processes: byte-identical.


## Measured physics numbers [M]

| Case | Hand value | Measured |
|---|---|---|
| Fall 4.905 m, g 9.81 / 4.905 | 1.000 s / 1.414 s | 1.000 s / 1.417 s |
| 3 crates x 2 kg stack, 5 s, drift | 0 | 57 um (test bound 1 mm) |
| Tall crate (10 kg, 0.4 x 1.2, mu 0.5) pushed at 0.3 m/s by a block at 1.1 m | tips (17.8 N < 49.05 N) | tips to 90 deg |
| same at 0.15 m | slides (tip needs 130.8 N) | peak tilt 0.5 deg, slides |
| Belt 0.5 m/s, mu 0.5 / 0.1: time to belt speed | 0.102 s / 0.510 s | 0.133 s / 0.533 s (2-3 ticks of contact build-up) |
| 3 crates against a wall at the belt end | leader at 2.7, 0.4 apart | 2.700 / 2.301 / 1.901, belt slips under them |
| Robot push cap (2 kg, mu 0.8, 2 wheels) | 15.696 N | 3 kg crate (14.7 N) pushed along; 4 kg (19.6 N) does not move, robot stops at it, `pushForce` 15.696 |
| 1 kg crate (1.055 m/s) hits 4 kg, no bounce | both leave at 0.211 m/s | 0.208 / 0.212 |
| Top view, sliding crate deceleration | mu g | within +-10 % for mu 0.5 and 0.2 |

### R5 (kinematic hit that "did not tip") explained and fixed
Two causes found. (1) The spike crate had fallen asleep: a hit by a moving kinematic body wakes a sleeping crate one step too late and the first impulse is lost (measured: crate velocity -0.012 m/s instead of +0.44). Fix: crates never sleep. (2) At one 1/60 s step a block moving 1 m/s sits 1.7 cm inside the crate before contact is seen, and the engine's push-out adds energy (a 3 cm top hit then tipped it). With 4 steps per tick the 3 cm hit at 1 m/s leaves peak tilt about 16 deg (tip point 18.4), matching the hand energy (about 2.2 J given, 3.1 J needed); a 10 cm stroke tips. That case is near the threshold, so it is pinned in a test but is sensitive to solver settings (8 passes x 4 steps).

## Bundle [M] (vite build, base 384ae4d vs this branch)

| Chunk | before (raw / gzip) | after |
|---|---|---|
| **rapier chunk (new, lazy)** | - | **4,366.82 kB / 1,677.19 kB gzip** |
| main | 203.31 / 64.16 kB | 204.11 / 64.46 kB (+0.3 kB gzip, my code only) |
| fullscreen (three + world) | 1,337.43 / 385.17 | 1,347.79 / 388.68 (+3.5 kB gzip: crate engine adapter) |
| handbook-dialog | 311.51 / 82.19 | 316.37 / 83.79 |
Rapier is not in any entry chunk; with the switch off no request for it is made (browser script, below).

## Browser check [M, looked at]
Script `plans/browser-scripts/w2-crates-check.mjs`, own dev server on 5292, shots in `plans/reports/shots-w2-crates/`:
1-2 gravity row (typed 1.62, saved in autosave), 3 handbook page, 4-* try board in side view (box leaning under the high push at 1.5 s, lying flat later, low one slid), 5-* 3D scene (stack, tall boxes, tumbling pile, belt queue, robot pushing the 3 kg crate), 6-* top view (long crate pushed off-centre turns), 7-* engine fetch blocked (red Vietnamese banner, scene still runs, crates upright old rules), 8 switch off (no engine request). Requests for the engine chunk: none before play, none with the switch off, one with it on.

## NOT verified
- Android WebView / phone, other CPUs, Firefox/Safari, real GPU (SwiftShader only). Determinism proven only: node vs node (two fresh processes, 38 boards identical), same process re-run, vitest; not Chromium-vs-node for this integration (spike proved it for its own scene).
- Cost per tick measured in node on this PC [M]: 50 awake crates in a walled box 1.21 ms mean (p95 1.46), 200 crates 4.82 ms mean (p95 5.48, max 8.7): about 29 % of a 16.7 ms frame; a phone is likely 3-5x slower, so 200 crates there is [N]. Cost is 4 engine steps per tick (the price of the tipping accuracy). Spawner caps at 50 alive per node.
- Heavy piles (> 50 crates) and thrown crates faster than about 15 m/s (no CCD: may pass thin walls).
- Contact force readout / crush from impact (not built; grip squeeze stays the old formula).

## Gaps and honest deviations
1. **Robot payload does not leave the simulation.** A crate lying on a chassis stays a body and rides by friction (verified: it follows the robot, and would slide at hard acceleration). Gripped, carried and vehicle-cargo crates do leave and re-enter. I judged "payload leaves" as less physical for crates merely lying on top; say if you want them parked instead.
2. **Piston head, arm cubes and joints still push crates by displacement** (old `planPush`, force-capped, no momentum, no tipping). Moving blocks/platforms and robot chassis push through the engine (tip, momentum). A tall crate pushed high by a piston will not tip.
3. **Robot push is capped only for sliding friction.** The chassis is a kinematic body: once it moves it gives a crate whatever impulse it needs (no slowing down on impact), same as the old model.
4. **Friction**: the item's own mu decides (blocks/robots count as 0, "largest" rule), so an icy floor block does not make crates slide; item `friction` ("Độ trượt") is unused while the switch is on (handbook says so). `bounce` is used.
5. Balls roll forever on a flat floor (no rolling resistance). Terminal speed 40 not applied to crates.
6. **Bots' jump planning** (`navigation/side-nav.ts`) still assumes gravity 30: with another gravity, path-finding bots mis-predict jumps. Not changed (outside the task); needs a follow-up if bots matter in "Vật lý thật" games.
7. Rotation is shown only; sensors, contacts, `massOn`, probes still use the unrotated box of the crate.
8. A carried crate loses its rotation and stands upright when released.
9. The first Chạy of a session with the switch on waits for the download (about 1.7 MB gzip, once); the editing preview world never loads the engine (crates there stay plain).
10. Hash baseline depends on the pinned engine version; a version bump needs a deliberate re-record.

Unresolved questions: (a) payload parked vs simulated (gap 1); (b) should the piston/arm also push through the engine (tipping) with a force cap, or stay as is (gap 2)?; (c) accept the 1.7 MB gzip lazy chunk for the APK?

Commit: f00aa32 on feat/w2-crates.
