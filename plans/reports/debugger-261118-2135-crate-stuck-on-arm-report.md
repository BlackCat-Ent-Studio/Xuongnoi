# Crate stuck on the arm (auto-arm sample, "Vật lý thật") - root cause and fix

Branch `fix/gripper-hold-real`, worktree `D:\workspace\GameBuilder-gripper-hold`, app in `app/`.

## 1. Reproduction (before any change)

- Headless: `playReal(createAutoArmBoard())`, per-tick metrics of the held crate in the hand frame (along the finger axis, across, up from the arm), SAT overlap depth against both fingers, palm, forearm link, finger-to-face gap.
- Browser: own vite on :5299, `plans/browser-scripts/gripper-hold-shots.mjs`, bursts every 0.5-0.6 s from two camera angles. `before-*` frames taken on the unfixed code.
- The owner's picture = the first pick, **step 4 "Nang len va quay" right after the grab** (sim t = 18.4 s .. 21 s; before-b-05 at wall 19.0 s and before-a-08/-10 at 19.4-20.7 s show the same picture: brown crate hanging beside/below the hand, dark finger and wrist over it).
- Numbers, first pick (hand pitch -70 deg: the taught "down" pose 21.2/-95.8 points the hand 20 deg off vertical):

| tick | crate in hand frame (along / rise) | palm overlap | what happened |
|---|---|---|---|
| 18.383 grab | +0.348 / -0.033, grasp point 0.038 m ABOVE the crate top | gap 0.137 | `betweenFingers` accepted it (see cause 1) |
| 18.400 | -0.122 / +0.138 | **0.278 m sunk** | crate jumped 0.873 -> 1.373 (+0.5 m) in one tick |
| 18.6-19.3 | -0.134 / +0.100 | **0.318 m sunk** | carried like that (fingers 2 mm from faces, palm and wrist inside the crate) |
| 19.4+ (swing, belt left behind) | +0.348 / -0.033 | gap 0.137 | crate slid back 0.47 m along the fingers |

## 2. Root cause

Candidates tested: (a) accepts a crate that is not between the fingers: **CONFIRMED (cause 1)**. (b) held crate carried sunk in hand: **CONFIRMED (consequence of 1 + 3)**. (c) drawn pose != simulated pose: ruled out (drawn finger/palm boxes and crate entity are the same objects the metrics read). (d) re-grab / re-entry inside the hand: ruled out (`latched`, closing only; release leaves crate free, test below). (e) geometry vs crate width: **PART of it (cause 2)**. (f) "Chan vat" arm solids: ruled out for this board (links are `solid: no`; the sample does not set it).

1. `betweenFingers` tests the grasp point against the crate's *shadow on each hand axis separately*. With the hand tilted 20 deg off the crate's axes the shadow of a 0.6 crate on the finger axis is 0.77, so "inside" is accepted 0.385 m from the centre; the grasp point was really 3.8 cm outside the crate (above its top). Step 2 of the sample also ended on the first tick of `inReach`, i.e. while the arm was still moving, so the pose was frozen at that edge.
2. Geometry: palm 0.15 deep, fingers 0.3 long, grasp point 0.3 from the wrist, crate 0.6: a crate centred on the grasp point (which is exactly what the old taught pose did, grasp y 0.90 = crate centre) is 0.15 m INSIDE the palm. No pose that the old rule accepted as "squarely centred" was physically possible; the gripper rule never looked at palm or link.
3. The frozen relative pose was then teleported every tick through `findFreeSpot` (`app/src/world/teleport.ts`): the frozen pose dips 27 mm into the belt as the arm finishes lowering, `findFreeSpot` lifts it in 0.5 m steps (the +0.5 m jump), later the crate slides back when the belt is out of reach. Fingers were always placed at +-gap around the *grasp point*, not around the crate, so an off-centre crate (allowed up to 0.2 m by the opening) overlapped one finger.

## 3. Fix (general, `Vat ly that` only; switch OFF untouched)

New `app/src/world/grip-fit.ts` (pure maths) + `app/src/nodes/gripper.ts`. For a rigid crate (one that has a rotation, i.e. the engine is on), under either "Cach kep":
- taken only when the crate lies between the open fingers, the grasp point is inside its REAL box (not per-axis shadows), and it does not sink > 0.5 mm into the palm or the link the hand hangs on; so `inReach` / `candidate` (and the wired steps) only come true when the hand really stands round the crate;
- flat pads (3D / top view, close axis z): the crate's nearest face must face the pads within 10 deg and closing turns it flat; side view (finger bars): the crate keeps its turn and the gap is its outline width;
- each finger closes until it touches its face (finger gap = crate width along the grip axis, turned crates included): pads sit on both faces, crate is never moved by the closing, an off-centre crate is clamped where it lies (pad middle = crate centre);
- a held crate the hand drives into a solid (`teleport` result > 2 cm from the wanted spot, or null) is let go where it is, counted as slipped, instead of being thrown 0.5 m;
- grip-force slip rule unchanged (fingers x min(mu) x force >= m g); non-rigid items, old boards and OFF behave exactly as before (original `solid-off-unchanged` 140/140 green with the old board files + new engine).

Known limit: fingers are still drawn boxes that pass through a crate they refuse; "crate that cannot fit is pushed by solid fingers" is NOT done (would change every board's collision set).

## 4. Measured before / after (auto-arm, 300 s)

| | before | after |
|---|---|---|
| held crate vs palm | sunk 0.28-0.32 m | gap +0.045 m (never overlaps) |
| finger-face gap | +2 mm then +10 mm | 0.000 (< 1 mm) on every held tick |
| crate jump at grab | +0.5 m | none |
| crates picked/placed | (first pick dropped later, same run) | 37 made, every one that arrived placed, 0 slips, 0 crushes (`gripper-hold-pose.test.ts`) |

## 5. Boards retuned (pieces only)

- **auto-arm**: down pose 21.2/-95.8 -> **28.7/-99** (grasp 1.145 m up, palm rests just above the crate top; computed by IK, numbers in the board header comment). Step 2 now ends on `arrived` (shoulder AND elbow "Da toi goc") AND `inReach` (new cards `arrived`, `hand-ready`). The cycle is **6 steps**: lift (4) and swing (5) were one step, the crate was swept sideways through the belt's side rail (0.1 m x 0.3 m, top y 0.9) 0.1 s after the grab and was knocked off; closed in steps 3-5 (`close-3-5`). Notes and the step text updated.
- **agv-shuttle**: pose "down at crate" 146/95 -> **142/95** (146 sank the palm 4 cm into the 0.5 crate); the lift (shoulder ramp) moved from step 3 to step 4 so the arm closes on the crate before it leaves; a 0.6 s `timer` card ("cho-kep") holds step 3 until the grip has held, otherwise the "next" level never fell and the step never advanced.
- **robot-arm** (2D side view, key-driven): the 0.6 crates only fit hand poses that are near-vertical; poses (key counts [6,2], [6,4], [4,7]) unchanged, crates resized/moved to fit: light 0.6 -> 0.3 (x -0.24, y 0.75), heavy 0.6 -> 0.5 (x 0.61 -> 0.78, y 0.85), fragile 0.6 -> 0.4 (x 1.37 -> 1.52, y 0.8). Masses unchanged.
- **handbook "Tay kep" board**: crate x -0.7 -> -0.5, down-arrow angle -20 -> -12 deg (valid window -17..-7 deg).
- Handbook pages (`content-robot-arm.ts`) and node description updated with the rule.

## 6. Tests

New `app/tests/arm/gripper-hold-pose.test.ts` (10 tests) + `app/tests/helpers/grip-metrics.ts` (independent measurement). Written first; before the fix 3 of 8 gripper cases failed (palm-sunk crate accepted, 30 deg turned crate accepted, off-centre clamp) and the old auto-arm run had 0.32 m overlap. Tolerances: overlap < 1 mm, face gap < 1 mm, belt-line centring < 1 cm.
Existing tests changed (physical reason in the comment): `gripper-turned-crate` (crate 7 cm forward: palm ends at x 0.95), `gripper-resting-crate` + `robot-arm-sample` (light crate is now a 0.3 cube: y 0.75), `auto-arm-sample` + `agv-sample` (new wires, `timer` allowed).
Baselines re-recorded, only these keys: `sample:robot-arm`, `sample:agv-shuttle`, `handbook:gripper` in `solid-off-baseline.json` and `real-physics-on-baseline.json`, and the same three plus "sensor-without-contact first at 0.0 s instead of 3.9 s" for handbook:gripper in `solid-on-summary.snap.json` (the crate now stands next to the hand from the start; the pre-existing checker note that drawn hand blocks overlap a crate just shows earlier). All other 137 board hashes unchanged; deterministic (same hash on 2 separate runs).

## 7. Result

- `npx tsc --noEmit` clean.
- ONE full `npx vitest run --testTimeout 300000`: 236 files, **3544 tests: 3543 passed, 1 failed** (968 s). The failure is `city-delivery-3d-sample > cars stop at a red light` (180 s timeout under load, no gripper in that board); alone it passes (`-t "red light"`, 93 s). So effectively 3544/3544.
- Two fresh runs of the re-recorded boards gave identical hashes (cee76ba8 / 5bd70320 for robot-arm / agv real-on, a1e1715c / cfdfd033 off).
- Commits on `fix/gripper-hold-real`: `b75a94d` (engine fix + new tests), `ecac6a9` (samples, handbook, baselines). No merge, no push.
- Browser proof: `plans/reports/shots-gripper-hold/` (before-a-* / before-b-* on the unfixed code, after-a-* / after-b-* on the fix, same sample, same first pick). before-b-05 (wall 19.0 s): crate hangs below-beside the hand, dark finger and wrist over it, tilted - the owner's picture. after-b-06 (19.5 s, step 5 banner) and after-a-08 (19.2 s): the crate sits under the palm with the dark finger running along its side, no wrist/finger sunk into it. Server on :5299 stopped.

## 8. Not verified / remaining gaps

- Browser: after-frames show the crate under the palm with the dark finger along its side; a 3D picture cannot prove no overlap, the numbers above do.
- Browser frame time is wall-clock; sim time matched by step banner ("4. Nang thung len khoi bang").
- Fingers are not solid: a refused crate is passed through by the fingers visually; pushing it away was not built.
- 2D side view: no turn-flat snap (fingers are bars), so a tilted hand over an upright crate needs a higher hand (palm bar tilts); the robot-arm sample was re-sized for that.
- `reach` rule + rigid crate now also needs the full clamp fit (stricter than before); non-rigid unchanged.
- AGV after-fix: lift+carry is now one joint-space sweep in step 4 (was lift then carry); verified by the 3-minute and anti-forced tests, not looked at in the browser.
