# Robot navigation pieces: go to a point, floor markers, tray, right of way

Date 2026-11-19 · worktree `D:\workspace\GameBuilder-nav` · branch `feat/robot-nav` · base ab21c74 · last commit 8ee9d8b (8 commits, not pushed, not merged). Node kinds 73 -> **77**. tsc clean. Dev server 5183 stopped.
Headless numbers: 60 ticks/s, "Vật lý thật" on unless said, chassis 0.9 x 0.7 x 0.3 m, 5 kg, friction 0.8, default motors (30 N, 120 rpm, ramp 400 rpm/s), controller defaults (power 0.6 = 1.13 m/s).

## Pieces as built

### `robot-goto` "Đi tới điểm" (Go To Point, group Bộ não) — `app/src/nodes/robot-goto.ts`, maths `app/src/world/robot-goto.ts`
- In: `robot` Robot (object, required), `target` Đích (object: a marker or anything), `go` Chạy (bool; unwired = never drives, like "Di chuyển" and "Động cơ"). Optional: `x` Đích X, `z` Đích Z (only when "Đích lấy từ" = two numbers), `face` Hướng khi tới (degrees; only with the advanced toggle).
- Out: `left` Trái, `right` Phải (power -1..1 = the motor's "Công suất"), `arrived` Đã tới, `arrivedPulse` Khi tới nơi (one tick), `distance` Còn cách (m), `headingError` Lệch hướng (degrees, + = goal on the right).
- Params: `targetFrom` Đích lấy từ (wired object, default / fixed point / two number ports), `targetPos`, `power` 0.6, `tolerance` 0.1 m, `slowDistance` 1 m, `turnGain` 0.02 per degree, `pivotAngle` 45 degrees; advanced `turnDamp` 0.002, `minPower` 0.08, `faceOnArrive` (No).
- It only outputs two numbers. It never calls a world command; no new world call, nothing added to `KEEPS_VIEWS`.
- Rules: forward power fades with heading error and is 0 from the pivot angle (turns on the spot); inside the slow-down distance power falls with the distance left; inside the tolerance it rolls on to a quarter of it, then stops; "Đã tới" needs 1.5 x tolerance + 1 cm to switch off again. No goal (nothing wired, hidden object, unknown marker number) = waits, "Đã tới" off.
- Deviation from the first draft: a null target used to fall back to the fixed point (as "Di chuyển" does). A lookup loop then reported a false arrival on tick 0, so the goal source is now one explicit choice.
- "Vật lý thật" off: works (robots drive there today through the plain drive); tested for 4 headings and the 6-marker tour. All shipped handbook / lesson boards of these pieces run with the switch off. Top view = 3D. Side view: rolls forward / back along x, no turning.

### `floor-marker` "Mốc sàn" (Floor Marker, group Vật thể) — `app/src/nodes/floor-marker.ts`
- Out: `self` Đối tượng, `x` X, `z` Z, `number` Số mốc. Params: `number` 1-99, `position` (y = floor height), `size` 1 m, `color`.
- A non-solid zone block with look `floor-marker`; the number travels as the block's `label`. No change in `engine/types.ts` or `world/`. Not seen by "Dò phía trước", weighs on nothing, a robot's trajectory across it is tick-identical to bare floor (tested).
- Drawing: `app/src/render/floor-marker-figure.ts` (flat tile, darker rim, number). `scene-view.ts`: +12 / -3 lines to register it, nothing else.

### `floor-marker-sensor` "Đọc mốc sàn" (Marker Reader, group Logic) — which marker a thing stands on
- In: `who`. Out: `number` (0 = none), `on` Đang trên mốc, `entered` Khi vào mốc, `marker` Mốc. No params. Rule: the middle of the thing is inside the tile; overlapping tiles = nearer middle.
- Chosen over an output on an existing sensor: no existing sensor reads the floor except the line sensor, whose outputs mean something else.

### `floor-marker-find` "Tìm mốc sàn" (Find Marker, group Logic) — number -> marker
- In: `number`. Out: `marker` Mốc, `x`, `z`, `found` Có mốc. No params.
- **Is it needed?** Existing pieces can already do it: two "Bảng giá trị" (one for X, one for Z) indexed by the chute number, into "Đích X" / "Đích Z" (tested, arrives within tolerance). "Chọn theo số" gives bools only; "Nhớ số" and the dispatcher's code carry the number but not a place. I still added the lookup because the table way stores every marker position twice (8 robots x 2 tables x 6 rows = 96 typed numbers that go stale when a marker moves), and with it the chain is one wire: dispatcher code -> "Số mốc" -> "Mốc" -> "Đích". If you prefer 76 kinds, this piece can be dropped without touching the other three.

## Measured

| | Result |
|---|---|
| 5 m leg, start heading 0 / 90 / 180 / -135 | "Đã tới" after 6.32 / 6.42 / 6.83 / 6.97 s; stops 21-22 mm from the marker middle (switch off: 23-24 mm, 6.42-7.17 s) |
| 11 start headings (incl. 179.9) | all arrive < 8 s, error <= 0.1 m, path <= 1.02 x straight line, turn <= first turn + 10 degrees, distance never grows by 1 mm in a tick |
| settle | from 0.5 s after "Đã tới", for 4 s: ground speed 0, turn speed 0 (exact), still "Đã tới", both outputs 0 |
| goal 0.3-0.6 m beside / behind | arrives, total turn < 200 degrees, no circling |
| 6 markers in commanded order 3,1,6,2,5,4 | legs 6.15 / 8.72 / 7.23 / 10.40 / 13.97 / 8.52 s, errors 21-23 mm, reader shows the right number at each; then stays |
| 20 kg + weak motors (6 N, 90 rpm); grip 0.1 | arrive and settle (grip 0.1: ends within 0.16 m) |
| final heading 0 / 90 / 180 / -90 | within 4 degrees, then no turning |
| anti-forced | both motor wires cut: controller asks > 0.5 power, robot position identical after 10 s; one wire cut: never arrives |
| determinism | 6-marker tour, tray ride, 4-robot loop, 4-robot grid: same hash twice |

## Tilt tray (no new piece)

Joint (pitch, at the chassis back edge, hub "Chắn vật" = Không, 60 degrees/s, 150 N.m) + link 0.6 x 0.05 m, "Bề rộng" 0.6, on a 1.2 x 1 m chassis, crate 0.4 m. Driven only by "Đi tới điểm"; tray tips when "Đã tới".

| | Result |
|---|---|
| ride, power 0.6 (turn on the spot, 5.8 m, stop, square up) | on the tray every tick; slide 1.6-11.6 mm along, 0.2-4.6 mm across; overlap <= 0.41 mm; payload reads the crate (1 / 5 kg) |
| ride, power 1.0 | still on; slide 125 mm along, 41 mm across |
| tip 35 degrees after squaring up to 0 / 90 / 180 / -90 | leaves 1.13 s after "Đã tới", rests 1.32 m behind the chassis middle, chassis moves < 3 cm (1 and 5 kg, 4 start headings) |
| 35 / 45 / 60 degrees, robot along a world axis | dumps; 20 degrees/s joint too; 15 degrees: stays on |

**Rule missing (reported, not worked around in src):** a chassis collides as an upright square that does not turn with it. When the robot stands askew, a corner of that square reaches out under the tray's back edge and catches the sliding crate. Pivot on the back edge, by arrival heading:

| Tilt | 0 | 10 | 20 | 30 | 45 | 60 | 80 | 90 | 135 |
|---|---|---|---|---|---|---|---|---|---|
| 35 | dump | dump | dump | **hangs** | **hangs** | **hangs** | dump | dump | **hangs** |
| 45 | dump | dump | **hangs** | dump | dump | dump | dump | dump | dump |
| 60, 80 | dump at every heading | | | | | | | | |
| any, pivot 0.25 m behind the edge | dump at every heading | | | | | | | | |

Ways that work today (tested): square up before tipping ("Hướng khi tới" a multiple of 90), or tip 60 degrees. On a grid with chutes along the axes the first is natural. A real fix is a chassis box that turns; that is a physics change I did not make.

## Right of way (test boards only, 120 simulated seconds each)

Each robot: chassis, 2 motors, "Đi tới điểm", "Tìm mốc sàn", "Dò phía trước" -> Hoặc -> Đảo ngược -> Và -> "Chạy". Routes from a latch (shuttle) or a counter + "chia lấy dư" (loop).

| Pattern | Robots | Result |
|---|---|---|
| One-way loop, stop and wait behind (front eye, reach 1.2 m), speeds 0.35-0.9 | 2 | works: never touch (nearest 237 mm), 8 / 11 legs, longest wait 1.4 s |
| same | 4 | works: nearest 348 mm, 8-10 legs each, longest wait 2.4 s |
| Crossing, give way to the right (second eye: 3 m strip on the right, 1.7-3.7 m ahead) | 2, five speed pairs | works: never touch (nearest 277 mm), 6-12 legs, longest wait 4.5 s |
| Grid 2 x 2 lanes, four crossings, give way to the right | 4, three speed sets | works: never touch, 4-9 legs each, longest wait 5.2 s. **Nearest gap 7 mm and 14 mm** in two sets: no overlap, but thin |
| Two robots nose to nose in one lane | 2 | **does not work**: both stop 0.96 m apart and stand for the remaining 115 s |
| Crossing with the front eye only | 2 | no standstill, but **they touch** on 96 ticks (one runs into the other's side; solid, 0.0 mm overlap) |

So: one-way lanes with stop-and-wait, and crossings with a give-way-to-the-right eye, hold for 2 and 4 robots. Lanes must be one-way per robot. Not tried: 8 robots, robots with trays and crates in traffic, two-way roads, four robots reaching one crossing at the same moment (give-way-to-the-right can lock there in theory), a zone-based crossing lock.

## Handbook, lesson (new visible content, not previewed by you)

- `content-robot-nav.ts` + `boards-robot-nav.ts`: 4 pages, 4 try boards (top view, switch off). `handbook/index.ts` +2 lines.
- Lesson **`robot-to-marker` "Robot tự tới mốc"**, 16 steps, chapter Robot, placed just before `share-jobs` (an existing test wants `share-jobs` last). Learner adds marker 1, "Tìm mốc sàn", "Đi tới điểm", wires them to the two motors, then adds "Đọc mốc sàn". `lesson-robot-to-marker.ts`; one-line edits in `course-pack-l.ts`, `course.ts`.
- Only its headless play-through is tested; the lesson was not clicked through in a browser.

## Tests

| File | Tests |
|---|---|
| `tests/nodes/robot-goto.test.ts` | 34 |
| `tests/nodes/floor-marker.test.ts` | 9 |
| `tests/arm/tray-robot-goto.test.ts` | 16 |
| `tests/world/robot-right-of-way.test.ts` | 14 |
| `tests/render/floor-marker-figure.test.ts` | 4 |
| `tests/handbook/content-robot-nav.test.ts` | 13 |
| helper `tests/helpers/nav-rig.ts` | — |

- Edited: `step-1-nodes.test.ts` (73 -> 77); `circuits/expand-placement.test.ts` (+2 names in the list of world positions).
- Baselines, added by hand, nothing re-recorded: `solid-off-baseline.json` +5 (`handbook:robot-goto` 5e7ed583, `handbook:floor-marker` 9f044ab1, `handbook:floor-marker-sensor` 3b8a6a36, `handbook:floor-marker-find` 16137d45, `lesson:robot-to-marker` e6e7abad, all :900); `solid-on-summary.snap.json` +95 lines, 0 removed. `real-physics-on-baseline.json` untouched. `solid-off-unchanged` and `real-physics-on-hash` green.
- Full suite: one run on 7b6a22b: 277 files, 4132 passed / 1 failed / 1 skipped, 563 s. The 1 failure was `tests/circuits/expand-placement` (its list of world-position settings lacked `robot-goto.targetPos` and `floor-marker.position`); added the two names in 8ee9d8b and reran `tests/circuits` alone: 52/52. The whole suite was NOT run again after that one-line test edit. No timeout this run.

## Shots (read) — `D:\workspace\GameBuilder\plans\reports\shots-robot-nav\`

Script `take-shots.mjs` there. Học sinh, light theme. I read four: `1-cards-board.png`, `1-goto-selected-panel.png` (cards and panel, no clipped label on any of the four cards), `2-top-play-t4.0s.png` (top view, robot between tiles 1 and 2, numbers readable), `3-3d-play-t10.0s.png` (3D, "Vật lý thật" on, robot between markers 1 and 2). Other shots in the folder were not read. One 404 for a resource in the page log, not identified. Boards were loaded from the autosave; "Thử ngay" was not clicked.

## Limits

- Straight lines only: no path around obstacles; a wall between robot and goal stops it.
- Arrival heading is the approach direction unless "Hướng khi tới" is on.
- The tray limit above (askew chassis).
- Reader uses the middle of the body: a 1 m tile is crossed in under a second at full speed.
- Two markers with one number: the first made wins, no warning.
- Marker tile look is a placeholder for the render port.
- A placed copy of a circuit board moves `floor-marker.position` and `robot-goto.targetPos`, but not numbers wired into "Đích X" / "Đích Z" or "Hướng khi tới" (they are wire values, not settings).
- docs / HANDOFF node count not edited.

## Unresolved questions

1. Keep "Tìm mốc sàn" (77 kinds) or drop it and use two "Bảng giá trị" (76)?
2. Keep the `robot-to-marker` lesson and its place before `share-jobs`?
3. Chassis collision box that turns with the robot: wanted? It would remove the tray limit and change how robots meet walls.
4. Is "Chạy" unwired = never drives right, or should it default to on?
5. Grid gaps of 7-14 mm at crossings: acceptable, or should the sample use wider eyes / slower speed?
