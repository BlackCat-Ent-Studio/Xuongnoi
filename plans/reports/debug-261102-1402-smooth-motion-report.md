# Debug: puzzle characters look jerky (smooth-motion) - 2026-11-02

Branch `fix/smooth-motion` (worktree GameBuilder-smooth), commit 44e81af.

## Root cause (proven)
Sim steps at fixed 60 Hz inside rAF (`render/game-view.ts frame()` -> `pacer.stepsFor(dt)`), but the scene drew the **raw latest tick state** with no interpolation. Per frame the screen shows 0, 1 or 2 ticks of movement depending on the frame/tick phase:
- 120/144 Hz screen: hero stands still on every 2nd (120) / ~5th-of-12 (144) frame while the world moves it; steps alternate 0,d -> judder at 60 fps effective.
- 60 Hz screen with uneven frames (any real browser): 0 or 2 ticks per frame -> visible hitches.
- Secondary: `Humanoid.animate` derives walk speed from frame position delta / dt, so the 0/2-tick pulses also made leg swing amplitude + phase rate pulse (walk-speed CV 0.10-0.24 raw).
- Camera follow was NOT a cause: already dt-based exponential ease (`FIT_EASE`, `smoothValue`), it low-passes the stepped target (cam roughness 0.07-0.09 raw vs 0.06 blended). It was only fed stepped targets.

## Eliminated
- Solid-body push-back oscillation: tick-level trace of every character/item/vehicle in L1-8 with the reference solutions: 0 reversals in L1-4; L5 e7 5 flips spaced ~270 ticks (patrol turns), L6 1, L7 5+3+..., L8 3 chars 3-6 flips spaced 100-240 ticks. Only a handful of single flips within 12 ticks (crate drop/pickup), no high-frequency vibration. Same reversal counts raw vs blend.
- Camera lerp fighting target / frame-rate dependent smoothing: dt-based, see above.
- Steering jitter near targets: no repeated tick-level flips near arrival (see above).
- Not measured (no real GPU here, swiftshader only): canvas drawn full-size under CSS scale / double-render cost; cannot prove or exclude real-GPU fps drops. Render loop does one `renderer.render` per rAF (read `draw()`), no double work found by reading.

## Method
Deterministic harness `app/tests/render/smooth-motion.test.ts`: real world+runtime+reference solution per level (`PUZZLE_LEVELS[i].solution`, puzzle world options), real `createSimPacer/createAccumulator`, real `CameraRig` (stage fit + follow, 844x390) and real `Humanoid`; emulated frame times: 60 Hz with +-25% jitter, 120 Hz, 144 Hz (+-5%), up to 20 s per level. "Raw" = world.entities() as the old code drew; "Blend" = new `TickBlender` with `pacer.alpha()`. Metrics on hero horizontal motion in frames where the sim moved it: stalls = frames hero did not move on screen; step CV; roughness = mean |step_i - step_{i-1}| / mean step; walk-speed CV from Humanoid; reversals along travel axis.

## Before > after (raw > blend)
| Level @ screen | stalls raw>blend | step CV raw>blend | max/median raw>blend | roughness raw>blend | cam rough raw>blend | walk-speed CV raw>blend | reversals (sim) |
|---|---|---|---|---|---|---|---|
| L1 60Hz uneven | 68 > 0 | 0.727 > 0.205 | 2.00 > 1.39 | 1.059 > 0.297 | 0.339 > 0.307 | 0.121 > 0.003 | 0 |
| L1 120Hz | 197 > 0 | 0.876 > 0.062 | 1.00 > 1.09 | 1.533 > 0.064 | 0.090 > 0.065 | 0.112 > 0.018 | 0 |
| L1 144Hz | 257 > 0 | 1.000 > 0.054 | 1.00 > 1.09 | 2.000 > 0.059 | 0.070 > 0.060 | 0.099 > 0.026 | 0 |
| L2 60Hz uneven | 77 > 0 | 0.731 > 0.212 | 2.00 > 1.39 | 1.063 > 0.300 | 0.336 > 0.305 | 0.122 > 0.014 | 0 |
| L2 120Hz | 220 > 0 | 0.876 > 0.060 | 1.00 > 1.09 | 1.533 > 0.063 | 0.090 > 0.065 | 0.112 > 0.019 | 0 |
| L2 144Hz | 287 > 0 | 1.000 > 0.052 | 1.00 > 1.09 | 2.000 > 0.058 | 0.070 > 0.060 | 0.099 > 0.025 | 0 |
| L3 60Hz uneven | 73 > 0 | 0.731 > 0.212 | 2.00 > 1.40 | 1.063 > 0.301 | 0.336 > 0.306 | 0.124 > 0.020 | 0 |
| L3 120Hz | 210 > 0 | 0.879 > 0.061 | 1.00 > 1.09 | 1.543 > 0.064 | 0.090 > 0.066 | 0.112 > 0.018 | 0 |
| L3 144Hz | 272 > 0 | 1.000 > 0.054 | 1.12 > 1.09 | 2.000 > 0.060 | 0.071 > 0.061 | 0.099 > 0.026 | 0 |
| L4 60Hz uneven | 91 > 0 | 0.740 > 0.215 | 2.00 > 1.48 | 1.088 > 0.313 | 0.349 > 0.321 | 0.205 > 0.160 | 0 |
| L4 120Hz | 252 > 0 | 0.871 > 0.058 | 1.00 > 1.09 | 1.517 > 0.061 | 0.091 > 0.066 | 0.147 > 0.092 | 0 |
| L4 144Hz | 332 > 0 | 1.000 > 0.060 | 1.12 > 1.09 | 2.000 > 0.060 | 0.073 > 0.061 | 0.130 > 0.082 | 0 |
| L5 60Hz uneven | 291 > 2 | 0.744 > 0.234 | 2.00 > 1.48 | 1.081 > 0.304 | 0.343 > 0.313 | 0.225 > 0.187 | 4 |
| L5 120Hz | 804 > 0 | 0.874 > 0.100 | 1.00 > 1.09 | 1.502 > 0.064 | 0.088 > 0.064 | 0.166 > 0.121 | 4 |
| L5 144Hz | 1070 > 0 | 1.007 > 0.099 | 2.89 > 1.10 | 2.000 > 0.063 | 0.072 > 0.063 | 0.146 > 0.110 | 4 |
| L6 60Hz uneven | 99 > 0 | 0.750 > 0.241 | 2.00 > 1.49 | 1.088 > 0.314 | 0.335 > 0.306 | 0.201 > 0.154 | 1 |
| L6 120Hz | 280 > 0 | 0.888 > 0.119 | 1.00 > 1.09 | 1.544 > 0.064 | 0.087 > 0.064 | 0.152 > 0.104 | 1 |
| L6 144Hz | 363 > 0 | 1.010 > 0.111 | 2.98 > 1.10 | 2.000 > 0.058 | 0.070 > 0.061 | 0.135 > 0.098 | 1 |
| L7 60Hz uneven | 287 > 1 | 0.739 > 0.227 | 2.00 > 1.48 | 1.071 > 0.304 | 0.346 > 0.316 | 0.223 > 0.190 | 4 |
| L7 120Hz | 808 > 0 | 0.875 > 0.097 | 1.00 > 1.09 | 1.510 > 0.064 | 0.087 > 0.063 | 0.169 > 0.118 | 4 |
| L7 144Hz | 1070 > 0 | 1.006 > 0.091 | 2.98 > 1.10 | 2.000 > 0.062 | 0.073 > 0.064 | 0.148 > 0.111 | 4 |
| L8 60Hz uneven | 176 > 0 | 0.762 > 0.250 | 2.00 > 1.51 | 1.100 > 0.302 | 0.345 > 0.314 | 0.240 > 0.202 | 3 |
| L8 120Hz | 484 > 0 | 0.886 > 0.138 | 1.00 > 1.10 | 1.510 > 0.061 | 0.088 > 0.064 | 0.172 > 0.134 | 3 |
| L8 144Hz | 640 > 0 | 1.016 > 0.137 | 2.98 > 1.10 | 2.000 > 0.060 | 0.075 > 0.062 | 0.157 > 0.121 | 3 |

Reversals are identical raw vs blend (they are real patrol turns / crate handling, not render jitter). max/median column is weak at 120 Hz raw (median step is itself the doubled step); roughness is the honest number. Camera roughness drops slightly too since its target is now smooth.

## Fix
- `render/tick-blend.ts` (new): `TickBlender` captures positions (+angle) after the last two sim steps of a frame; `blend(entities, alpha)` lerps position and shortest-way angle; teleports (>2 units per tick), new/hidden entities and alpha 1 are drawn unchanged.
- `render/game-loop.ts`: `Accumulator.alpha()` and `SimPacer.alpha()` (acc/dt; 1 while paused).
- `render/game-view.ts`: capture after steps, blended entities go to `sceneView.sync`, `rig.update` and the HUD floating labels / guide arrows (so labels stay glued to characters); raw entities when the world ended (fall-over finish) and for static redraws (editor edit mode untouched). Play start seeds the blender, session reset clears it.
- Simulation untouched: only render path changed. Cost: scene shows the world up to one tick (16.7 ms) late.

## Verification
- `tsc --noEmit` clean.
- Full `npx vitest run --testTimeout 120000`: 122 files, 1984 tests passed (includes new smooth-motion 24 level/rate cases + tick-blend unit tests; every level solution still wins, physics-invariants green).
- `npm run build` OK.
- Browser smoke (swiftshader, port 5209, 844x390): levels 6 and 8 run via CHAY, no console errors/warnings, screenshot sane. Port stopped.
- CRLF kept: `git diff --stat` == `--stat -w` (game-loop, game-view).

## Unresolved / concerns
- Real GPU/phone feel not tested; in-browser per-frame probe not recorded (swiftshader too slow), proof is via deterministic emulation of the real classes.
- Item pickup tick: an item moving < 2 units to a holder's head is blended for one tick-fraction, so `findCarried` may miss it for ~1 frame (cosmetic, not observed).
- Vehicle heading and non-position state still step at 60 Hz (not blended).
- Editor play uses the same `game-view`, so it also gets the blend; not hand-tested beyond tests (editor render tests green).
