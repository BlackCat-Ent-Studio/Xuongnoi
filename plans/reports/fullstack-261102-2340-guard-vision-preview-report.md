# Guard-vision preview (L6 "Lẻn qua mắt lính gác") - report

Output: `D:\workspace\GameBuilder\plans\ui-mockups\guard-vision\` (index.html, build.sh, sim-check.mjs, shot-guard-vision.mjs, shots/, src/). Nothing under `app/` touched, no commits, nothing published.

## What it is
Standalone page (needs internet for three.js CDN + Google fonts, same as cozy-stage). Same cozy tray floor, goal pad, plant, crate and cat-chibi (hero) / cat-quad (guard) code copied from `cozy-stage/src` (note: cozy-stage has its own three.js copies of the cats, not imports from app/src; I copied those, so look matches the cozy mockups). Sim is pure JS (`src/05-sim.js`) shared by the page and `sim-check.mjs`.

Layout: hero walks along z=2.6 from x=-10 to goal x=10. Guard patrols a lane at x=0.5 from z=-4.1 toward the path (length 0.5..3.4), looks where it walks (+z = toward path, -z = away), swings head ~0.35s at each end (0.4s pause). Crates (1.7 wide, drawn 1.25x taller than wide) sit between lane and path.

UI: 3 run buttons + "Đặt lại", banner Thắng/Thua with reason, live chip (not seen / crate hides / seen but still = safe / seen and running = danger), floor rings (red = seen+moving, amber = seen+still), "!" over guard when seen, "Kiểm tra cả 3 cách" table (runs the headless sim with current sliders), sliders: patrol length, guard speed, range (ô), angle (độ), hero speed, grace (s), crate preset A/B/C + count 0-4, lane toggle, floor style, "Sao chép thông số" (JSON incl. crate coords + results).

## Rules used (match real sensors)
- Seen = distance <= range AND angle off facing <= angle/2 AND no crate on the segment guard-hero (slab test, same as `line-of-sight.ts`, ground plane, graze 0.02). Fan drawing cuts rays at crates (and the back wall); the "seen" decision uses centre-to-centre line like the real node.
- Lose = seen AND hero speed > 0.05 (real speed-sensor `STILL_BELOW`) continuously longer than grace. Standing still while seen is safe.
- Correct answer: go = NOT(seen from previous tick) - one tick delay like a real graph. Hero brakes at 28 ô/s², so it slides max 0.117 s / ~0.19 ô after being seen.
- Old answer: go = distance(hero, guard) >= 3 (old threshold). Guard never gets within 3 ô of the path, so it never stops - behaves like "no wire". That is the story: "guard sees from far".
- Win = hero x >= 9.2 (arrived). Time limit 60 s.

## Defaults chosen
patrolLen 3.2, guardSpeed 1.6, range 7.5, angle 80, heroSpeed 3.2, grace 0.3 s, preset A with 3 crates [(-2.8,0.5),(0.4,0.5),(3.6,0.5)], guard starts at 75% of lane (hidden `startFrac` 0.75, chosen by sweep so the straight-walking hero meets the fan).

## Sim results (`node sim-check.mjs`, fixed 1/60 s)
Default (A x3): correct WIN 6.92 s (max slide 0.117 s <= grace 0.3) | old LOSE at 4.08 s | no-wire LOSE at 4.08 s.
All 15 preset rows (A/B/C x 0..4 crates): correct always WINs (6.92 s - 8.27 s), old and no-wire always LOSE (3.5 - 4.08 s). 15/15 OK, exit code 0.
grace=0 makes the correct answer lose (brake slide counts), confirms the knob works; any grace >= ~0.15 s wins.
Slider sweeps (one slider at a time off default, 24 points): correct answer WINs in all 24; wrong answers still lose in 14. In 10 extreme points the wrong answers get lucky (timing misses the fan): guardSpeed 0.8/1.2/2, range 5/6, heroSpeed 2.6/4/5, grace 0.5/1. Preview page shows "(sai ý!)" in the check table when this happens. For the real level, lock these values (do not make them editable).

## Shots (`shots/`, all read and checked)
gv-0-full-page (whole UI + check table), gv-1-start, gv-2-hide-behind-crate (fan yellow, hero behind crate), gv-3-seen-standing-still (red fan, amber ring, chip "an toàn"), gv-3b-seen-moving (red ring, danger chip), gv-4-lose-banner-nowire, gv-4b-lose-banner-old, gv-5-win-banner, gv-6-correct-run-waiting (hero waits behind crate, fan yellow), gv-7-preset-C. Console clean. Fixed during review: fan z-fighting with floor boards (polygon offset), banner covering action (moved to top), camera framing/pitch, fan yellow contrast, back-wall clipping.
Visual caveat: SwiftShader renders slowly; animation smoothness only checked by deterministic seek, not by watching real-time.

## Porting notes for the real game (app/, puzzle-only)
New render code: a "vision fan" renderer for 3d mode, drawn only for puzzle levels (flagged on a character/level param, e.g. `showVision`), reading the vision-sensor's params + viewer facing: build N rays across the angle (N ~ angle/2.5, max 72), clip each at range and at solid-block AABBs (slab ray test, reuse collider boxes), draw as one triangle-fan mesh at y~0.08, vertex alpha 0.8 centre -> 0.42 edge, plus outline line. Colour yellow `#ffe033`, red `#ff3a2a` when the hidden sensor's `seen` is true. Needs polygonOffset (-6) against floor planks. Extras (optional, cheap): "!" sprite over viewer and floor ring under target (red moving / amber still).
Hidden nodes for level 6 `base`: `vision-sensor` (viewer guard, target hero, range 7.5, angle 80, walls yes), `speed-sensor` (hero), AND of seen & NOT still -> `win-lose.lose`; `patrol` guard between (0.5,-4.1) and (0.5,-0.9) with wait 0.4 (guard must face its heading: check physics sets `facing` from move direction, else add it); `go-to` hero as now; crates as 3 solid `block`s size ~1.7 x 2.2 x 1.7 (must be taller than ~2 since line-of-sight tests the line between entity centres in 3D, a 1-high crate would NOT block); remove the old `touch` lose. Locked/hidden checks so the player cannot edit them.
Player tray: `vision-sensor`, `not`; keep `distance` as decoy. Solution: vision-sensor(viewer guard, target hero).seen -> not -> walk.go.
Fidelity gaps: preview hero brakes with fixed 28 ô/s² decel and 1-tick delay; real physics slide may differ, so tune `grace` (or the "moving" rule) in the real headless test; preview ignores y (cat eye height) - real sensor uses 3D distance; guard head-swing is simulated (9 rad/s) while real `facing` may snap.

## Unresolved questions
1. Does the real patrol node make the guard `facing` follow its movement, and does the guard turn instantly at ends? (If instant, fan flips instantly instead of sweeping.)
2. Keep grace 0.3 s as visible rule? Real graph has no grace; stopping relies on physics braking quickly enough (sim says needs <= ~0.12 s brake).
3. Old "distance" answer loses only because the guard never gets near; should the preview/real level show an explicit "tại sao thua" hint for that?

Status: DONE_WITH_CONCERNS
Summary: Preview built and verified (headless sim 15/15 presets: correct wins 6.9-8.3 s, old + no-wire lose 3.5-4.1 s; 10 shots reviewed, no console errors).
Concerns/Blockers: Wrong answers can accidentally win at some extreme slider values (listed above); real-game braking/facing behaviour is unverified; page needs internet for three.js CDN.


---

# v2 (2026-11-03) - cover-to-cover stealth with time calculation (replaces v1 logic above)

v1 was rejected (cat froze in front of guard, jittered at the fan edge, only ran in the open). Rebuilt in the same folder: `plans\ui-mockups\guard-vision\` (index.html, build.sh, sim-check.mjs, shot-guard-vision.mjs, shots/gv2-*.png, src/). Nothing under `app/` touched, no commits, nothing published. Guard is now the legs robot (copied from cozy-stage `20-robots.js` as `src/22-robot-legs.js`), hero stays cat-chibi.

## Behaviour
- Route: start -> cover 1 -> cover 2 -> cover 3 -> goal. Cover spot = just behind each crate as seen from the middle of the guard lane (orange rings on the floor). Cat never stops in the open: it dashes from a cover straight to the next one.
- Before each dash the cat predicts: the guard is simulated forward (1/30 s steps, up to 12 s: patrol, wait, slow head swing at 5 rad/s, range, angle, crates block) and "window" = seconds until the fan first covers ANY point of the next open gap (points every 0.4 ô). "Need" = gap length / cat speed. Rule: RUN if window >= need + 0.5 s, else stay hidden and re-think (every 3 ticks).
- Chaining: in the last 0.5 ô before a cover it decides again (window from now, need = remaining + next gap). Enough -> keeps speed through the cover, else brakes smoothly and hides there. Once a dash starts it is never cancelled.
- Guard sees the cat anywhere (cone + range + no crate in between) = LOSE at once. "!" appears over the cat only at that moment, slow gentle bob (no shaking).
- Live thinking bubble over the cat: `💭 Còn 0.0s · Cần 2.1+0.5s ✘ TRỐN` (amber, calm, still) / `Còn ∞s · Cần 1.2+0.5s ✔ CHẠY` (green). For the wrong ways the bubble shows their own reason.
- Buttons: Lời giải đúng (tính giờ), Cách cũ (đo khoảng cách) = run when guard >= 6 ô away, Chạy liều (không tính) = run whenever the guard is not looking at the next gap right now (no prediction), Không nối gì = never leaves start (time-out lose), Đặt lại, Kiểm tra cả 4 cách. Sliders: patrol length, guard speed, range, angle, cat speed, preset A/B/C (3 crates each; 4-crate layouts were tried, "Chạy liều" got lucky on them so they were dropped), floor style, copy JSON. Margin 0.5 s is fixed. The v1 "stop grace" and "crate count" sliders are gone.

## Defaults
patrolLen 3.2, guardSpeed 1.3, range 10, angle 90, heroSpeed 3.4, preset A = crates (-5,1) (0.8,1) (5.2,0.2) size 1.7, guard starts at 50% of lane (hidden `startFrac`). Route x: -9.8 -> cover spots -> 9.8 (z~2.7). Layouts were found by random search so that: all covers are hidden from every guard position on the lane, correct wins, distance + rash lose, for 4 guard start phases.

## Sim results (`node sim-check.mjs`, 1/60 s ticks, exit 0)
| Preset / phase | Correct | Old (distance) | Chạy liều | Không nối gì |
|---|---|---|---|---|
| A default (0.5) | WIN 10.28 s (3 dashes, 1 chain, 2 waits) | LOSE 4.48 s | LOSE 4.47 s | LOSE time-out 60 s |
| A 0 / 0.2 / 0.8 | WIN 11.48 / 11.03 / 9.53 s | LOSE 2.08 / 5.23 / 3.78 | LOSE 5.7 / 5.22 / 3.78 | LOSE 60 s |
| B 0 / 0.2 / 0.5 / 0.8 | WIN 10.43 / 9.93 / 9.18 / 14.23 s | LOSE 5.73 / 5.25 / 4.5 / 3.9 | LOSE 5.72 / 5.23 / 4.48 / 3.9 | LOSE 60 s |
| C 0 / 0.2 / 0.5 / 0.8 | WIN 11.42 / 10.97 / 10.22 / 15.22 s | LOSE 2.43 / 5.25 / 4.5 / 3.82 | LOSE 5.72 / 5.23 / 4.48 / 3.82 | LOSE 60 s |
All 12 rows: correct waits >= 1 and chains >= 1 (A phase 0.8 has 2 chains + 1 wait), covers hidden from the whole lane, **jitter check: stops in the open = 0; moving starts = stops = number of dashes (<= 3), i.e. stop/go toggles at most once per cover**.

Slider sweeps (one slider off default, A) - where it breaks (lock these in the real game):
- Correct answer LOSES (time-out: can never find a long enough window): patrolLen 1 and 2 (short lane = guard looks at the path almost always), guardSpeed >= 2.2, heroSpeed 2.4.
- A wrong answer WINS by luck: Chạy liều at patrolLen 2, guardSpeed 0.8 / 1 / 2.2, heroSpeed 4 / 5 / 6, range 6; Cách cũ at range 6 and heroSpeed 6.
- Safe band that keeps "correct wins, all 3 wrong lose": patrolLen 3.2-3.4, guardSpeed ~1.3-1.6, range 8-12, angle 50-160, heroSpeed 3-3.4. So in the real level lock patrol length, speeds, and layout; range/angle are free to tweak.
- Range <= 6 leaves covers/start visible edge cases; range > 10.5 is fine here only because the start is out of reach (start at x=-9.8, lane x=0.5).

## Screenshots (`shots/`, all read; no console errors)
gv2-0-full-page (UI + 4-way check table), gv2-1-start, gv2-2-waiting-tron (bubble "Còn 0.0s · Cần 2.1+0.5s ✘ TRỐN", cat hidden, fan yellow), gv2-3-chaining (bubble "✔ CHẠY", cat dashing past a cover), gv2-4a-lose-old-distance, gv2-4b-lose-rash (red fan + "!" over cat + THUA), gv2-4c-lose-nowire-timeout, gv2-5-win, gv2-6-preset-C-waiting. Deterministic seeks only; real-time smoothness not watched (SwiftShader).

## Porting notes (app/, puzzle-only)
New nodes / outputs needed (hidden or puzzle-only, none in the generic palette):
1. `gap-watch` (or an extra mode on `vision-sensor`): inputs viewer (guard) + a list of sample points / a "gap" (two cover blocks or two points). Output `lookIn` (number, seconds until the fan will cover any point of the gap; Infinity capped at ~12). Implementation = copy of `windowFor` in `src/05-sim.js`: roll the guard's patrol forward in a pure function (needs the `patrol` node's state: points, speed, wait, plus a turn-rate), then reuse the real `vision-sensor` maths (range, cone, `lineOfSight`). Must not mutate the world.
2. `dash-time` (e.g. on `go-to` or a new `route-gap` node): inputs hero + next cover; outputs `need` = distance to next cover / hero speed (+ remaining distance to the current cover while approaching). Could also expose `margin`.
3. Player wires `So sánh` (lookIn > need + 0.5 via a `plus`/number const) -> `go-to` "Chạy tới chỗ nấp kế". The `go-to` target should be a "next cover" selector (list of blocks/spots, advancing when arrived) instead of a single target; it must commit to a dash (not re-evaluate mid-way) or the level can jitter - in the preview commitment is done by the cat controller, not the wire. Alternative: latch node ("giữ tới khi tới nơi").
4. Cover spot: 3 fixed positions behind crates (see `coverSpots`: crate centre + 1.55 away from lane middle). Crates must be tall solid blocks (>= 2 high) so `lineOfSight` (centre-to-centre, 3D) blocks.
5. Hidden checks: `vision-sensor(guard -> hero).seen` -> `win-lose.lose` (immediate lose, no grace); `go-to.arrived` last cover -> win. Drop v1 speed-sensor + grace (not needed in v2).
6. Guard: legs robot (`PUZZLE_LOOKS.robotLegs`), patrol with head swing; the guard must expose its `facing` smoothly at the ends (TURN_RATE 5 rad/s, wait 0.4 s) or the fan flips and the prediction is off.
7. Render: same vision-fan renderer as in v1 notes (triangle fan on floor, clipped by crates/back wall, polygonOffset -6, yellow/red). Red only when the guard sees the cat (= the loss frame).
8. Cat controller: braking to a stop at a cover uses v^2 profile (decel 28 ô/s^2, decide in last 0.5 ô). Real physics may need a stronger stop/arrive radius; check in the real headless test that the cat never "stops in the open" and never oscillates around the cover spot.

## Unresolved questions
1. Should the margin (0.5 s) and cover positions be visible to the player as constants, or hidden?
2. Real `patrol`/`go-to` nodes: can the prediction node read the patrol route and facing turn model, or do we add a dedicated `guard-route` node that owns both? (Preview assumes the guard's motion is fully known/deterministic.)
3. 4-crate versions let "Chạy liều" win by luck; keep exactly 3 covers in the real level?

Status: DONE_WITH_CONCERNS
Summary: v2 preview rebuilt (cover-to-cover, predicted-window decision, robot-legs guard); sim-check passes 12/12 rows: correct wins 9.2-15.2 s with waits and chains and no stop/go jitter, the three wrong ways always lose.
Concerns/Blockers: Wrong answers can win and the correct one can lose at some slider extremes (listed; lock them in the real game); needs new puzzle-only prediction nodes; real physics braking/facing unverified; page needs internet for the three.js CDN.
