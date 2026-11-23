# Robot line pack: "Đường line" + "Cảm biến dò line" (branch feat/robot-line, worktree ../GameBuilder-rbline)

Dev server for the user: http://localhost:5252 (npm run dev -- --port 5252 --strictPort, left running).
Shots: plans/reports/shots-robot-line/ (handbook page, try-board top 2D playing with sensor on/off, 3D playing, side preview strip, properties panels).

## What was built

### line-track "Đường line" (EN Line Track), category Vật thể
- Output: `self` Đối tượng.
- Spawns ONE non-solid zone block (look `line-track`) that carries a `track` payload (new optional `EntitySpec.track` / `EntityView.track`, additive; absent on every old entity so old hashes are unchanged). Nothing collides with it; colour sensor / probe-ahead / touch skip it (zone).
- Params (all open in the properties panel):

| id | label | default | unit / range |
|---|---|---|---|
| shape | Dạng đường | oval | oval, straight, s-curve, eight, custom |
| center | Tâm (x, z; y = độ cao mặt sàn) | (0, 0.5, 0) | m |
| length | Dài (dạng có sẵn) | 12 | m, 1..200 |
| breadth | Rộng (dạng có sẵn) | 6 | m, 0..200 |
| width | Bề rộng vạch | 0.2 | m, 0.02..3 |
| color | Màu vạch | #111111 (black) | colour; live-editable while playing |
| count | Số điểm (Tự vẽ) | 4 | 2..16 |
| closed | Khép kín (Tự vẽ) | yes | yes/no |
| smooth | Bo tròn góc (Tự vẽ) | yes | yes/no |
| radius | Bán kính bo góc | 1 | m, 0..5 |
| p1..p16 | Điểm k (x, z used) | square (-4,-3)(4,-3)(4,3)(-4,3), rest 0 | m; p9..p16 under "Nâng cao" |

- Everything except colour is create-only (needs Chơi again), same as other object pieces.
- Rendering: flat ribbon on the floor in 3D and 2d-top (rectangles + round caps = exactly the area the sensors count); thin strip (0.06 m) on the floor top in 2d-side. Visible in edit preview too.
- Geometry module `src/world/line-track.ts` (pure): `presetPath`, `smoothPath`, `distanceToPath/Track`, `onTrack`, `trackCoverage`.

### line-sensor "Cảm biến dò line" (EN Line Sensor), category Logic
- Inputs: `who` Đối tượng (required), `track` Đường line (optional filter; empty = every line).
- Outputs: `onLine` Thấy line (bool, held), `level` Độ đậm (0..1), `entered` Khi gặp line (pulse), `left` Khi rời line (pulse).
- Params:

| id | label | default | unit / range |
|---|---|---|---|
| side | Lệch ngang (− trái, + phải) | 0 | m, -20..20 |
| forward | Lệch trước (− ra sau) | 0.6 | m, -20..20 |
| spot | Cỡ vòng đọc (đường kính) | 0.3 | m, 0..5 (0 = one point) |
| threshold | Ngưỡng thấy line | 0.5 | 0..1 |
| invert | Đảo ngược | no | yes: level = 1 - covered |

- Reads the object's position AND heading each tick: `EntityView.facing` (characters, already exposed) else `vehicle.heading` (vehicles) else +x. No WorldApi change, old behaviour untouched. A sibling robot chassis only has to expose `facing` or `vehicle.heading` on its EntityView.
- Spot centre = position + forward*heading + side*right; right = (-fz, fx) (top view, z down). Side view: spot is a segment along x ahead of the feet, `side` ignored, reads along the floor only.
- Level = share of the spot disc covered by the band (fixed 128-sample pattern). Across one straight edge it is monotonic (tested); a spot wider than the band can wobble by a few samples (~2 %) at the peak.
- Unwired / missing / hidden `who` -> level 0, onLine false, no pulses (also when inverted).
- Marker dot: a flat disc (spot size) under the spot, grey when off, green (#22c55e from the traffic palette) when on. Created lazily the first tick `who` is valid, hidden when it goes. Only while playing (the edit preview runs no tick). Size is fixed at creation (WorldApi cannot resize), so a live change of `spot` does not resize the dot.

### Names, handbook, lesson
- node-names.ts: both kinds + all ports (VI + EN).
- Handbook: `content-robot-line.ts` (+ `boards-robot-line.ts`), pages for both kinds (purpose, ports, params with units, example, tips); "Thử ngay" = Cần điều khiển -> character over an oval with 2 sensors (±0.25 m) -> Hiện số levels + Hiện chữ; extra try "Thử trong 3D" (same board on a floor).
- Lesson `line-eyes` "Mắt dò line" in new file `course-pack-g.ts` + `lesson-line-eyes.ts`, new chapter "Robot" in course.ts (lesson number 34 in the menu).

## Files
New: src/world/line-track.ts, src/nodes/line-track.ts, src/nodes/line-sensor.ts, src/render/line-track-figure.ts, src/handbook/content-robot-line.ts, src/handbook/boards-robot-line.ts, src/tutorial/lesson-line-eyes.ts, src/tutorial/course-pack-g.ts, tests: tests/world/line-track.test.ts, tests/nodes/line-nodes.test.ts, tests/handbook/content-robot-line.test.ts, tests/tutorial/lesson-line-eyes.test.ts.
Edited (small, additive; expect trivial merge conflicts): engine/types.ts (+LineTrackSpec, +track fields), world/entity.ts, world/world.ts (+1 line), render/scene-view.ts (two entry types), nodes/index.ts (2 imports + 2 list entries at the end), nodes/node-names.ts (2 entries before 'map-range'), handbook/index.ts, tutorial/lessons.ts (pack G), tutorial/course.ts (chapter 'robots'), tests: step-1-nodes (57 -> 59), extra-tries (kind list gains line-sensor), no-action-without-wire (allowance for the sensor's own marker dot: spawn/show/hide), solid-off-baseline.json (+3 entries), solid-on-summary.snap.json (+3 entries, no existing entry changed).
After merging the siblings (+4 kinds): count tests need 63; if both siblings also add an extraTries kind or a no-action allowance, keep all.

## Tests
- tsc --noEmit clean.
- New: 15 geometry tests, 18 node tests (offsets rotate with heading incl. vehicle heading, side offset sign, level monotonic across an edge, threshold/invert, pulses, track filter, unwired who, side view, dot, real-world run), 11 handbook tests, 3 lesson tests.
- Baselines: all 108 old boards keep their old hash; only lesson:line-eyes, handbook:line-track, handbook:line-sensor were added.
- Full suite (npx vitest run --testTimeout 180000): 171 files, 2801 tests, all green (806 s). Committed on feat/robot-line.

## NOT verified
- Real touch/phone, performance with many sensors on big loops (64..128 samples x segments per sensor per tick; fine for 3 sensors).
- Side-view play with a real floor + character (only the unit tests and the edit-preview strip were seen).
- Marker dot in side view and when a live `spot` change happens.
- A sibling robot chassis: `facing`/`vehicle.heading` contract is assumed, not tested against their code.
- The lesson's guided steps were driven headless (editor state), not clicked in the browser.
