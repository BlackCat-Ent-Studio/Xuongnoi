# Audit: physics and logic errors in the 3D levels (5–8)

Date 2026-11-02. Read-only audit: no app source edited, nothing committed.

How I checked:
- I read `app/src/world/physics.ts`, `world.ts`, `collider.ts`, `nodes/carry.ts`, `nodes/zone-sensor.ts`, `puzzle/stage/cozy-stage.ts`, `render/scene-view.ts` and `render/humanoid-model.ts`.
- I ran each level's reference solution headless, plus 3 wrong answers. The probe checked every 1/60 s tick for overlapping collision boxes and for overlaps of the drawn 1.6× figures. The probe lives in the session scratchpad (`probe/tests/physics-probe.test.ts`).
- I took Playwright shots of levels 5–8 running with only the locked wiring. Script: `plans/browser-scripts/audit-3d-physics-shots.mjs`. Shots: `plans/reports/shots-3d-audit/`.

## The short answer

The engine never makes **characters collide with items** or with **other characters**, and it never makes **items collide with each other**. The only things that block anything are solid blocks (and vehicles). On top of that:
- characters are drawn 1.6× bigger than their collision box;
- the store zones count a crate that is still being carried;
- a dropped crate is placed without checking for other crates.

So the robot walks through crates, crates pile up inside each other, and a level can be won before the last crate is put down.

## Shared root causes (engine)

| # | Root cause | Where | Effect |
|---|---|---|---|
| R1 | Only blocks block items, characters and vehicles. Blockers: `solids` = visible solid **blocks** only. `walkSolids` adds vehicles. A character moves against `walkSolids`, so items and other characters never block it. | `app/src/world/physics.ts:279`, `:282-283`, `:316` | Characters walk through crates and through each other. |
| R2 | Free items only collide with blocks (`stepFreeItem(item, …, solids)`). | `physics.ts:333`, `:160-183` | Crates fall into each other and stack in the same spot. Nothing stops a character from standing inside a crate. |
| R3 | Pick-up drop spot only avoids solid blocks. It ignores other items and characters, so every drop at the same place lands in the same spot. | `app/src/world/world.ts:217-232` (filter `:218`, check `:229`) | 2–3 crates sit at exactly the same position and look like one crate. |
| R4 | A carried item is moved to above the head every tick, with no collision. Grab moves the item instantly into the hands. | `physics.ts:186-200`, `:323-331`; `world.ts:383-392`; reach `nodes/carry.ts:5` (1.2) | Carried crates can pass through walls, doors and other crates. Nothing stops the carrier when the crate hits something. |
| R5 | Zone sensor counts carried items. It only skips `inHand` tools, not items carried above the head. | `app/src/nodes/zone-sensor.ts:142` | Levels 5 and 7 are won while the robot still holds the 3rd crate (shown in the headless run). |
| R6 | Characters are drawn bigger than they collide. The collision box is 1×1×1 (`nodes/character.ts:70`). The drawing is 1.6× (`puzzle/stage/cozy-stage.ts:15`, applied in `render/humanoid-model.ts:101-104`). | as listed | Drawn bodies overlap by up to 0.6 before any contact counts. The cats visibly overlap before "caught" fires. Even with R1 fixed, the drawn robot would still sink 0.3 into a crate. |
| R7 | The legs robot is drawn holding its crate **in front, low**: centre about 0.70 above the floor, 0.66 ahead. The physics keeps the crate **above the head** (y≈1.45). | `render/scene-view.ts:147-157`, `cozy-stage.ts:265` | On screen the carried crate passes through crates on the floor. The physics never sees that. |
| R8 | Props are placed at the bottom of their box. The goal pad block is at y=0.5, height 0.2, so its bottom is 0.4 above the floor. | `cozy-stage.ts:73` (`floorY`), `:220`; level data | The goal pads in levels 6 and 8 float 0.4 above the floor. Found in code, not checked in a shot (top-down camera). |
| R9 | Thin coloured pads are not solid (`type: 'pickup'`), so crates rest on the floor below the pad top. Any red flat block is drawn as a round **button**. | `nodes/block.ts:127`; `cozy-stage.ts:55-59` | Crates sink 0.04–0.06 into pads. In level 7 the red pads look like buttons with a crate on top. |
| R10 | Nothing checks that level objects start apart. | level data | Level 5 and level 8 start with two crates inside each other. |

Not a problem: closed doors (solid blocks) do stop characters. In level 8, the "door never opens" answer leaves the cat stuck at the door (x=-5) until timeout. No character fell off the tray in any run. The brains keep everyone inside the floor, but nothing would catch a fall: there is no edge wall, no respawn and no fall-out-means-lose rule.

## Level 5 "Đủ ba thùng" (`app/src/puzzle/levels/level-05.ts`)

| What happens | Why (code) | Severity |
|---|---|---|
| Crates 2 and 3 start inside each other (0.3 deep). In the shots they look like one T-shaped crate. | Positions `:18-20`: (-8,0.3) and (-7.7,0), both 0.6 wide. R10 | Medium |
| The robot walks into the crate pile and stands inside it (up to 0.6 deep). | The patrol's `pointA` (-8,0) is the centre of the pile `:21`. R1 | **High** |
| Delivered crates end at the **same point** (8.66, 0.30, 0). The store shows 1 crate where there are 2. | R3 | **High** |
| The level is won at 26.2 s while crate 3 is **still carried** (robot at x=6.52, just inside the zone). | R5 (zone `center` rule; the carried crate is inside the 3×3×3 zone) | Medium (logic) |
| The robot is drawn holding the crate low in front, but the physics has it above the head. | R7 | Low here |

Shots: `du-ba-thung-t4_2-*.png` (fused crates, robot at the pile), `du-ba-thung-follow-t25-*.png` (store shows 1 crate).

## Level 6 "Né lính gác" (`level-06.ts`)

| What happens | Why (code) | Severity |
|---|---|---|
| Wrong answer: the drawn cats overlap at 1.71 apart (centre to centre). "Caught" only fires 0.15 s later, when the 1×1 boxes touch. In the shot the guard's head covers the small cat. | R6. Touch = collision boxes within 0.01 (`physics.ts:52-63`) | Medium |
| The cats can pass through each other. It only shows as the overlap above, because touching ends the game. | R1 | Low here |
| The green goal pad floats 0.4 above the floor. | `:83` y=0.5 with height 0.2. R8 | Low (top-down camera hides it) |
| Both cats are black, so hero and guard are hard to tell apart. `color` is ignored for cats (fixedColor). | `render/character-styles` | Low (readability, not physics) |

Shot: `ne-linh-gac-t1_8-*.png`.

## Level 7 "Phân loại thùng màu" (`level-07.ts`) — the user's complaint

| What happens | Why (code) | Severity |
|---|---|---|
| The robot walks **through every crate** on the row, 0.8 deep (red ones always, blue ones when its hands are full). Every round trip crosses all 6. | Crates sit **on** the patrol line z=0 (`:10-17`, `:46-54`). Patrol -10→11 `:55`. R1 | **High** |
| On the way back, the carried blue crate is drawn low in front and passes through the red crates. | R7 | **High** (visual) |
| Two delivered blue crates end at the identical spot (-9.96, 0.40, 0). | Drop on the drop-zone's rising edge always at the same x. R3 | **High** |
| Won at 27.3 s with blue crate 6 **still carried** (x=-7.51, edge of the 5-wide store). Same mechanism: carrying a red crate into the store area loses at once, even with no drop. | R5 | Medium (logic) |
| The grab happens while the crate is still ~0.95 from the robot's centre. It looks like a magnet pull, but the 1.6× figure already overlaps the crate, so it reads OK. | R4, reach 1.2 | Low |
| Red pads are drawn as round buttons. Crates sink 0.06 into the pads. | R9 | Low |

Shots: `phan-loai-mau-t1_4-*.png` (robot inside the blue crate), `phan-loai-mau-t2-*.png` (just passed through the red crate), `phan-loai-mau-follow-t1-*.png` (robot standing on crate 2).

## Level 8 "Xưởng tổng hợp" (`level-08.ts`)

| What happens | Why (code) | Severity |
|---|---|---|
| Crates 2 and 3 start inside each other. | `:151-153` (same layout as level 5). R10 | Medium |
| The wheel robot drives into the crate pile (up to 0.6 deep) on every trip. | Patrol `pointA` (-12,3) is the pile centre `:160`. R1 | **High** |
| All 3 crates end at **one point** (-6.32, 0.30, 3). The bay looks like it holds 1 crate. | R3 | **High** |
| The "door" is a wall piece in the middle of an open floor. It covers z -7.5..-0.5, and the floor is open from z -0.5 to +8. It only stops the cat because the cat's go-to brain walks straight (`pathfind: 'off'` `:158`). | `:165` | Medium (puzzle logic is not physical) |
| Wrong answer: the drawn cats overlap at 1.96 apart before "caught" fires. | R6 | Medium |
| The goal pad floats 0.4. | `:149`. R8 | Low |
| A carried crate is held 1.35 up with no collision. Today no carrier crosses the door, so it can't go through it yet, but any redesign could. | R4 | Low now |

Shots: `xuong-tong-hop-t1_5-*.png` (robot with a crate overhead, standing in the pile), `xuong-tong-hop-follow-t8-*.png` (door strip in the open floor).

## Fix options

### A — Fix the current engine (recommended)
The engine is already a working AABB solver: boxes on a flat floor, no rotation. The faults are missing body pairs, a sensor rule, placement code and level data.

1. **Characters vs items:** add free (not carried) items, plus other characters, to what a character collides with in `stepPhysics`. Turn it on with a world option used only by the puzzle game (`createWorld(mode, { solidBodies: true })`), so the Xưởng Nối editor, samples and lessons keep today's behaviour. That protects the ~1777 tests.
2. **Items vs items:** free items treat other free items as solid, so they stack and don't merge. `dropSpot` also avoids items and characters: try in front, then the sides, then on top.
3. **Zone sensor:** skip carried items (add a carried flag to `EntityView`; one line at `zone-sensor.ts:142`), or add a node option for it.
4. **Size match:** give puzzle characters a collision box close to the drawing (about 1.3×1.6×1.3, via the existing `colliderSize` body param), or lower the visual scale. Draw the legs robot's crate where the physics holds it, or hold it in front in the physics too and include it in the carrier's box.
5. **Level data:** move crates **beside** the walking line, not on it. Robots then stop in front of a crate and grab it (reach 1.2 already allows that). Space the starting crates apart. Patrol end points stop short of the pile. Put the goal pads at y=0.1. Make the level-8 door part of a full wall.
6. **New test:** for every level, assert that nothing overlaps at spawn and that no collision box overlaps another during the reference solution. The probe from this audit can become that test.

Effort: about 2–3 days. 1 day for engine items 1–4 with unit tests, 1–2 days to re-lay and re-prove levels 5–8 (all of them need new data anyway — the 3D redo is already planned).

Risks:
- Today the robots in levels 5, 7 and 8 reach a crate by standing **in** it. With solid crates, a patrol end point inside a crate is never reached, so `atEnd` never fires and the level stalls. Levels 5–8 and their tests (`tests/puzzle/levels-5-8.test.ts`, `level-7.test.ts`, about 33 cases) must be re-laid and re-tuned.
- Levels 1–4 (2D) are unaffected if the option is puzzle-3D only. If it is turned on for 2D too, re-run `levels-1-4.test.ts`.
- Touch still works: boxes pushed flush are still within `CONTACT_EPS`.

### B — Use the Rapier physics engine (`@dimforge/rapier3d-compat`, WASM) for 3D
What it gives:
- a real kinematic character controller (sliding, auto-step);
- dynamic crates that can be pushed, stacked and tumbled;
- sensor colliders for zones.

Effort: about 1–2 weeks for a 3D-puzzle-only path; much more to replace the whole engine. The World API also serves belts, moving and turning platforms, vehicles and trains, teleports, combat, shots, line of sight and path planning. Each would need a Rapier version, or a fragile two-way sync with the old solver.

Risks:
- **Level tests:** today's tests prove an exact outcome — the solution wins, each missing wire fails, there is no shortcut. With dynamic bodies, a robot shoves crates off their pads, so the colour sensor and grab reach become chaotic. Solutions can fail at random or win by accident, and every level test needs rework plus new tolerances.
- **Determinism:** Rapier is deterministic on one machine. Matching across CPUs or browsers needs its enhanced-determinism build.
- **Startup and size:** the WASM must start before `createWorld`, so loading becomes async (also in `runLevel` and vitest). It adds about 1.5–2 MB to the web and APK build.
- **Two physics engines:** 2D and the editor stay on the old solver, so bugs and behaviour split between the two paths.
- Pushing and tumbling are mostly **unwanted** in logic puzzles: the player should debug the wiring, not physics luck.

**Recommendation: A.** It fixes every finding above, keeps the levels deterministic and testable, and fits the planned 3D level redo. Consider Rapier only if the user wants real push/stack/tumble play.

## Not verified
- I did not check by eye whether the goal pad floats (R8); the top-down camera hides it. This finding comes from the code only.
- My screenshots ran with only the locked wiring, not the reference solution. The early wins with a crate still in hands, and the merged crate spots, come from the headless runs only.
- Screenshot timing under swiftshader lags the requested times by up to ~4 s (the real seconds are in each file name).

Status: DONE
Summary: Characters, items and other characters never collide in the engine (only blocks do). Add the 1.6× drawn vs 1× collision box size mismatch, drops that ignore other crates, and zones that count carried crates: together these cause every issue seen in levels 5–8 (the robot walks through crates in levels 5, 7 and 8; crates merge in levels 5, 7 and 8; early wins in levels 5 and 7). Recommend option A (puzzle-only solid bodies + level re-layout, ~2–3 days) over Rapier (~1–2 weeks, nondeterministic level tests).
