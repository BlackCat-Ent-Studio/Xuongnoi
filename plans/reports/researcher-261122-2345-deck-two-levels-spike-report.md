# Spike: raised deck with holes, two levels (measuring only, never merged)

Date 2026-11-22. Worktree `D:\workspace\GameBuilder-spike-deck`, branch `spike/deck` (base `0d273e9`), head `da71f29`.
All runs headless vitest, 3D view, `realPhysics: true` with the rigid-body engine loaded, 60 ticks/s.
Tests: `app/tests/spike-deck/` (helper `deck-rig.ts`). Run one with `cd app && npx vitest run tests/spike-deck/q1 --testTimeout 300000 --silent=false`.

Robot used everywhere: the factory-look recipe from `tests/arm/side-tray-robot-goto.test.ts` (chassis 0.9 x 0.7 x 0.24 m, plate 0.62 x 0.74 m hinged 0.31 m from the centre line, carton 0.3 x 0.22 x 0.26 m, tilt 35 degrees), driven by "Đi tới điểm". Deck: plain "Vật thể" blocks 0.2 m thick, top at 2.6 m, above the usual ground floor block.

## Short answer

The engine is already 3D where it matters. A deck with holes can be built today from plain blocks, robots drive on it exactly as on the ground, cartons fall through, and a robot under the deck is not disturbed at all (path difference 0). Missing: 3 small things that read the world in 2D, one wrong rule in the push code, and the fact that a chassis never falls into a hole narrower than itself.

## Table

| # | Question | Today | Measured | Evidence |
|---|---|---|---|---|
| 1 | Chassis stands / drives / arrives on a block at 0.5 m and 2.6 m | Works | Arrives 8.40 s at all three heights, position error 0.003 m, heading error 1.63 degrees, chassis height above its floor 0.1200 m constant, payload reads 2.00 kg all the way, carton stays on the tray. Path against the ground run: max difference 1.1e-16 (rounding). A marker left at y = 0 steers the deck robot the same (goal has no height). | `q1-drive-at-height.test.ts` |
| 1b | Traction asks whether wheels touch | No | With nothing under it the chassis fell 2.6 m in 0.73 s and drove 0.727 m forward in the air (1.13 m/s). | same file, 3rd test; `physics.ts:417` |
| 2 | Deck with an opening from existing pieces; carton falls through | Works | Hole = 4 blocks (3 x 3 holes = 16 blocks). Standing sweep, holes 0.6 / 0.7 / 0.8 m, robot centre line 0.55-1.0 m from the hole centre: 15/15 on the ground floor. Rides (3 m, stop, square up, tip; 1 / 2 / 5 kg, both sides, 4 headings): 24/24 through for each hole size, 144/144 in the catch test. None stuck on an edge, none through the ground (deepest dip 8 mm for a tick). Robot stop error 0.022 m. | `q2-drop-through-hole.test.ts` |
| 2b | Where it rests below | Partly | It leaves sideways at 0.93 m/s and passes the deck underside at the hole centre (-0.00..0.02 m). Bare ground: first touch 0.39-0.47 m beyond the hole centre, then slides to 1.24-1.46 m (mean 1.32); 0/24 end under the hole. Bounce up to 0.095 m, still after 2.4-3.7 s. With a cage (4 blocks, 1 m walls, 0.8 m inside): 24/24 inside, rest within 0.28 m of the centre. Cage + shaft from the hole: 24/24. Tilt 20 degrees/s instead of 60: same counts. Stopping 0.3 m early or late along the lane: still through. | same file, test "what catches it below" |
| 3 | Wheel / chassis falls into or snags on a hole | No fall, no snag (not realistic) | Against blocks the chassis is a 0.9 m square. It sinks 0.0000 m over every hole up to 0.9 m, also when driving straight across the middle. It falls (clean, 2.6 m, then drives on below) only when the whole square is over the void: hole 0.95 at offset 0, hole 1.2 at offset <= 0.1, hole 1.5 at offset <= 0.3. A 0.5 m chassis falls through 0.6-0.8 m holes only when centred. Clearance needed today: none; sideways drift on a lane 0.0000 m. | `q3-chassis-at-hole.test.ts`; `collider.ts:97-99`, `physics.ts:63-68` |
| 4 | Second robot on the ground under the deck, same line, opposite direction, same time | Works | Path of each with the other present against alone: max difference 0.00e+0. Both arrive 7.02 s. Chassis middles pass 0.009 m apart on the ground plane; 0 ticks touching; 0 ticks pushing. Control with both on one floor: neither arrives, 697 ticks pushing, 699 ticks touching (the test can see a collision). | `q4-two-levels.test.ts`, first test |
| 4b | Floor markers from the wrong level | Broken | "Đọc mốc sàn" read 0,1,2,7,8 on both robots: the deck robot reads the two ground markers, the ground robot reads the two deck markers. | same; `floor-marker.ts:49-54` |
| 4c | Loose crate on the deck, robot parked under it | Broken (one rule) | 60 kg crate: deck robot alone stalls at x = -0.65 (crate stays). With a robot parked on the ground under the crate, the deck robot shoves the crate 0.79 m. 2 kg crate: same end place, 548 against 583 pushing ticks. | same file, 2nd test; `robot-push.ts:54-59, 139-141` |
| 5 | Sensors by height | Works, except markers | Zone at ground height counts 1 (ground robot), zone at deck height 1, the default-size zone (y -0.5..2.5) 1, a 6 m tall zone 2. Item zones 1 and 1. "Đọc màu" under the feet: deck robot reads only the deck colour (3), ground robot only the ground patch (1). "Dò phía trước": 0 blocked ticks, distance stays 3.00 (control: 777 blocked). "Đo khoảng cách": smallest 2.600 m (it is 3D). Payload of the ground robot under a deck crate 0.00 kg. | `q4-two-levels.test.ts`; `zone-sensor.ts:193`, `color-sensor.ts:16-27`, `probe-ahead.ts:60-61`, `view-gap.ts:18` |
| 6 | Cost | Fine | 20 simulated seconds, 3 passes, mean / p50 / p95 / p99 ms per tick. Ground, 6 tray robots: 1.68-1.82 / 1.02-1.11 / 4.1-4.5 / 8.9-9.2. Deck of 16 blocks: 1.98-2.02 / 1.34-1.38 / 4.4-4.5 / 9.2-9.9. Deck + 9 cages (36 blocks) + 6 more robots under it: 2.84-2.98 / 2.07-2.19 / 5.6-6.1 / 11.6-11.8; worst single tick 21.7 ms. Budget 16.67 ms. All 6 cartons ended on the ground floor in every run. | `q6-tick-cost.test.ts` |

Machine for row 6: i7-11800H, processor load 9 % before and 18 % after the run, headless (no drawing).

## Single-floor assumptions (file:line, all under `app/src/`)

Real problems for the target design:

1. `nodes/floor-marker.ts:49-54` `markerUnder` compares x and z only; `:34` a marker spot keeps no height. Measured (4b).
2. `world/robot-push.ts:54-59` `restsOnTop`: "bottom at or above the chassis top", no upper limit, so anything in the column above a chassis rides on it. Used at `:139-141` (taken off the push plan of every robot) and `physics.ts:555-557, 661`. Measured (4c).
3. `world/collider.ts:97-99` + `physics.ts:63-68, 280`: a chassis is held up by any block under any part of its square; no wheel contact. It crosses holes narrower than itself. Measured (3).
4. `world/physics.ts:417-431` + `robot-traction.ts:13`: wheels grip whether or not the chassis is on something. Measured (1b).
5. `nodes/floor-marker.ts:40-42` + `floor-marker-find.ts:21`: marker numbers are one list for the whole board (1-99, first made wins); the two levels share it.
6. `nodes/line-sensor.ts:94-95` + `world/line-track.ts:221`: paint is read by x, z only. Read in code, not measured.
7. `nodes/robot-goto.ts:29-36, 126`: goal is x, z only. Harmless (measured in 1), but a robot can be sent to a marker on the other level and will stop above or below it.

Smaller or cosmetic (read in code, not measured):

8. `nodes/route-follow.ts:117, 191-195, 393`, `nodes/next-free-slot.ts:21-22`: distances on x, z only.
9. `nodes/zone-sensor.ts:66-67`: default zone is y -0.5..2.5; fine for a 2.6 m deck, wrong for a lower one.
10. `render/cameras.ts:459, 482`: follow and pan target at y = 0 in the 3D and top views.
11. `render/scene-view.ts:577-582`: editor grid at y = 0. `render/game-view.ts:604`: pointer-to-world plane defaults to y = 0 (dragging an existing piece keeps its height, `editor/entity-drag.ts:79`).
12. `world/navigation/plane-nav.ts:52-58`: the route grid of "leo bục" is one layer for walking characters and knows no holes. Robots do not use it (`robot-goto` steers straight).

Already 3D (no change needed): chassis against chassis (`collider.ts:101-105` outline has height), crates (rigid-body engine), contacts (`physics.ts:71-87`), weighing (`material.ts` `holds`), zone, colour under the feet, ahead sensor, distance.

## Smallest general design

### Piece "Sàn nâng có lỗ"

A node that spawns plain solid blocks, as the belt already spawns its side walls from one card (`world.ts:500-508`): params = position, size x / z, height of the top, thickness, holes per row and per column, hole size, pitch. It lays full strips between hole rows and short pieces between holes (the `holeDeck` helper in `tests/spike-deck/deck-rig.ts` is that rule, 16 blocks for 3 x 3). No engine change.

| File | Change | Size |
|---|---|---|
| `nodes/raised-deck.ts` (new), `nodes/index.ts`, `nodes/node-names.ts` | The node, about 150 lines | S: only spawns blocks |
| handbook text, a look (grating, rail, see-through option), tests | Words and drawing | M: the look needs the user's eyes on the real game |
| `world/robot-push.ts:56` | A ceiling for "rides on the chassis" (experimental patch on the branch, 2 lines, flag `VITE_SPIKE_REST_CEILING=1`: the 60 kg case becomes identical with and without the robot below; 165 existing tests pass with it on) | S |

Old boards: a new node kind touches no saved board. The ceiling changes a result only when an item is more than the ceiling above a chassis top in its column; with 1 m a falling plain item is still caught (fastest fall 0.67 m per tick).

Not in the smallest version, by choice: a chassis falling into a hole. Doing it right means holding the chassis up by its wheel points (item 3 above), which can change every board where a robot stands at a platform edge; M, and it moves hashes unless tied to the new piece. Until then lanes keep robots off holes, and nothing punishes a wrong route.

### "Levels do not disturb each other"

Physics needs nothing (0.00 difference measured). Two readers need the height:

| File | Change | Size |
|---|---|---|
| `nodes/floor-marker.ts:49`, `floor-marker-sensor.ts:29` | Among tiles under the point, take those nearest in height to the feet, then the nearest middle (experimental patch on the branch, 4 lines, flag `VITE_SPIKE_MARKER_LEVEL=0.3`: deck robot then reads 0,1,7 and ground robot 0,2,8) | S |
| `nodes/line-sensor.ts:94` | Same idea for paint | S, not tried |
| handbook | Zones must be sized to one level; marker numbers differ per level | S |

Old boards stay byte-identical with the rule "nearest height first" because it only changes the answer where tiles at different heights overlap the same point. A plain tolerance against the feet would NOT be safe: the marker card's default y is 0.5 (`floor-marker.ts`, param `position`), so old markers may float above the floor.

## Alternatives

| | What | For | Against | Size |
|---|---|---|---|---|
| A | No new piece: 16 plain blocks + the two small fixes + a written recipe | Works today, proven by every test here | 16 cards for one deck, no look, a learner cannot resize it | S |
| B (recommended) | Piece that spawns plain blocks + the two small fixes | One card, engine untouched, old boards untouched, cost +0.3 ms per tick | Robots still cross holes unharmed | S engine, M with look |
| C | A "level" tag on entities that filters 2D queries | Would also split markers, lines, routes in one stroke | Touches physics, contacts, push, sensors, crate engine; a carton must change level while it falls through the hole, which is the feature itself; measured independence makes it unnecessary | L |
| D | Deck only 0.3 m high | Camera and zones stay simple | No room for cages or tugs under it; the ahead sensor separates levels by height overlap (`probe-ahead.ts:60`), so 0.24 m robots on both sides would see each other; drops the user's ground-floor fleet | S, changes the decided design |
| E | True 3D chassis (wheel contact, tipping, dynamic body) | Robots fall into holes and off edges correctly | Moves hashes of every "Vật lý thật" board | L |

Recommendation: B. Add the wheel-support rule later only if falling into a hole must be shown.

## Risks and not verified

- The carton does not land under the hole on bare ground (slides 1.3 m away). The catcher must have walls; a cage of blocks worked 24/24, a movable cage and a tug carrying it were not tried (no such pieces).
- Several cartons piling up in one cage: not tried (one carton per run).
- Nothing was looked at on screen: no screenshots, camera at height, see-through deck, shadows, editor placement of a new piece at 2.6 m all unverified.
- "Bệ di chuyển" as a lift, ramps, a robot going from one level to the other: not tried.
- Robots meeting each other on the deck beside holes, and a tray swinging over a hole: not tried (same-level meeting is covered by existing tests on the ground only).
- Deck outer edge: by the rule of row 3 a robot falls only when its whole square is off; not measured.
- Line sensor, route-follow, next-free-slot at height: code reading only.
- Whether any shipped board has overlapping markers at different heights: not checked (my sample scan found no marker cards, so I do not trust it).
- Runs are 14-22 s; no long run. Default gravity only. 3D view only. Holes under 0.6 m and bigger cartons not tried.
- Cost is headless; drawing 180-200 entities in the browser is not in the numbers. The whole test suite was not run (focused runs only).
- The two engine patches are experiments behind flags and off by default; without the flags the branch plays as main.

## Unresolved questions

1. Must a robot that drives onto a hole fall or get stuck (teaching value), or is "routes keep it off" enough for the first version?
2. Is a cage with fixed walls acceptable as the catcher for now, or is the movable roll cage needed first?
3. 99 marker numbers for both levels together: enough for the grid floor plus the tug lanes?
