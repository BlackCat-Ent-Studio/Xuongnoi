# Wave 1: upper level (deck, grid routing, right of way, route code, "Thu hồi", outline + wheel-support physics)

## Context
- Binding: `../reports/brainstorm-261122-2332-sorting-factory-grid-two-levels-report.md` (wave 1 row) + user answers 11-23 (D1 = b, D2 = a, robot on a hole must FALL).
- Deck spike: `../reports/researcher-261122-2345-deck-two-levels-spike-report.md` (summary table in [phase 00](phase-00-measuring-spikes.md)). Gate G1 passed.
- Nav facts: `../reports/fullstack-261119-1540-robot-nav-report.md` (straight lines only; head-on deadlocks; grid gaps 7-14 mm with 4 robots).
- Station facts: `../reports/fullstack-261119-1900-factory-stations-report.md` §4 gaps 1, 3; §6 hand-over.
- Still waiting: traffic spike (gate G2, B items), user pick D3, user look at the D1 preview (card + carton).

## Result
SECOND menu entry "Xưởng phân loại kiện hàng (đang dựng: sàn lưới)" (id `sorting-factory-grid`): 2 feeding stations on the deck edge, 6 robots on a one-way grid, 9 holes, each robot tips its parcel into the hole of its code, a walled catch box under each hole (plain blocks, replaced by roll cages in wave 2) with a zone that counts, and "Thu hồi" takes the counted parcel back. The one-floor station sample stays in the menu (with its stand-in) until wave 3.

## Code facts the design rests on (verified at 0d273e9)
| Fact | Where |
|---|---|
| Spawner classes capped at 6; class picks colour + mass only; no tag on spawned things | app/src/nodes/spawner.ts:33, :176-188 |
| A spawner keeps at most 50 alive: constant used as the max of the setting and as a clamp | app/src/nodes/spawner.ts:22, :125, :167 |
| A spawner object ends only by lifetime; a pool forgets a member once it is hidden | app/src/world/spawner.ts:14-27 |
| Spawner hides optional ports behind an advanced toggle so old cards keep their size | app/src/nodes/spawner.ts:72-81 |
| Items already carry a free-text goods tag read by `tagOf` ("Loại hàng"; zone filter "Chỉ tính loại hàng") | app/src/engine/types.ts:521, :766; app/src/nodes/zone-sensor.ts:118, :177; app/src/nodes/item.ts:114 |
| Marker reading ignores HEIGHT (measured: each level reads the other's tiles) | app/src/nodes/floor-marker.ts:49-60 |
| Marker numbers 1-99, one list for the board; first made wins | app/src/nodes/floor-marker.ts:6, :41-44 |
| Blocks meet the UPRIGHT chassis square; a chassis is held up by any block under any part of that square | app/src/world/collider.ts:97-99, :118-124; app/src/world/physics.ts:63-67 |
| Wheels grip whether or not the chassis stands on something (spike 1b) | app/src/world/physics.ts:417-431 [line from the spike report, not re-read] |
| Anything in the column above a chassis "rides" on it: no upper limit | app/src/world/robot-push.ts:54-59 |
| Turn against rivals is settled by backing off (reuse for walls) | app/src/world/physics.ts:480-496 |
| One card can spawn several plain blocks (the belt and its walls) | app/src/world/world.ts:500-508 [from the spike report, not re-read] |
| Menu entry appends the long text to the short name | app/src/io/samples.ts:40 (name const: app/src/samples/sorting-factory-stations.ts:427) |
| Class 5 is already 3 kg (nothing to do) | app/src/samples/sorting-factory-stations.ts:18 |
| "Đã lấy kiện" = `cho-giao.exited` ("Khi đối tượng ra") | app/src/samples/sorting-factory-stations.ts:272, :286-288; app/src/nodes/zone-sensor.ts:79 |

## D1 (DECIDED b): the parcel carries a code, "Đọc mã" reads it
```
┌ Số ngẫu nhiên ┐   ┌ Tạo đối tượng ───────────────┐      ┌ Đọc mã ──────────┐
│     1…9     ● │──▶│ ○ Mã gắn lên vật (Nâng cao)   │      │ ○ Vật cần đọc     │
└───────────────┘   │ ○ Tạo        Đối tượng mới ● │─────▶│           Mã số ● │──▶ tuyến
                    │ ○ Vật cần thu hồi (Nâng cao)  │      │           Có mã ● │
                    │ ○ Thu hồi     (Nâng cao)      │      └───────────────────┘
                    └──────────────────────────────┘
```
- Spawner advanced toggle "Gắn mã cho vật mới" → optional input `code` (number → the existing goods tag as text "1".."99").
- `code-reader` "Đọc mã": in `thing` object; out `code` number (0 = none / not a number), `has` bool; no params. Also reads any "Đồ vật" whose "Loại hàng" is a number.
- The number is DRAWN on the code-drawn carton look only (other parcel looks unchanged).
- Before porting: one preview page (the two cards + a carton with its number, 2-3 label styles, on a real game shot); the user picks. Agent R builds the page first, ports after the pick.
- Option a (9 spawner classes read by "Đọc màu") is dropped: `color-palette.ts`, `color-sensor.ts` are NOT touched.

## D2 (DECIDED a)
Second entry as in "Result". Station sample: keeps the stand-in; gets the short label, the pin "Đã lấy kiện", pins "Vật cần thu hồi" + "Thu hồi", and its chutes use "Thu hồi" instead of the 4.8 m out belts.

## D3 (open): card of "Điều độ ô"
Preview with 6 robots (18 rows) and at the maximum 12 (36 rows). a (recommended): one central card as specified below. b: a per-robot card "Ô có trống không" inside each robot circuit (tidier main board, but two robots can enter a crossing in the same tick). Final shape: REVISE AFTER SPIKE: B1, B5.

## New general pieces and rules (smallest scope)
### 1. `raised-deck` "Sàn nâng có lỗ" (Vật thể): a node that spawns plain solid blocks, no engine change
- Full strips between hole rows, short pieces between holes (rule proven by the spike helper `holeDeck`; 16 blocks for 3 x 3 holes; +0.3 ms per tick). Optionally a numbered marker tile on every lane cell (same `floor-marker` look, so the marker trio reads them).
- Out: `self` Đối tượng. Params: `position` (place), `top` Cao mặt sàn (default 2.6 m), `thickness` (0.2), `holeCols`, `holeRows` (1-5, ODD counts give one consistent outer ring: HANDOFF lesson on one-way grids), `hole` Cạnh lỗ (default 0.7 m; 0.6-0.8 measured 144 / 144), `pitch` Khoảng cách giữa hai lỗ, `markers` Đánh số ô (Không / Có), `first` Số của ô đầu, `color`.
- Look (grating, rail): draw-only, needs the user's eyes → plain blocks first, look in D5. The mock-up button "Sàn trong suốt" stays in the mock-up.
- Not in scope: stairs, ramps, lifts.
- REVISE AFTER SPIKE: B2 (pitch and lane width for a 0.9 x 0.7 m chassis that must pivot; cells = lanes around 3 x 3 holes, guess 7 x 7 → 40 tiles).

### 2. `grid-route` "Tìm đường trên lưới" (Tính toán, pure maths, no world call)
- In: `cell` Ô đang đứng, `goal` Ô đích. Out: `next` Ô kế tiếp, `arrived` Đã ở ô đích, `noPath` Không có đường.
- Params: `cols`, `rows`, `first`, `blocked` Ô cấm đi (text), `lanes` Luật làn (Tự do / Một chiều xen kẽ).
- REVISE AFTER SPIKE: B1, B2 (the lane rule that held 900 s).

### 3. `grid-traffic` "Điều độ ô" (Bộ não, pure maths, one card for the fleet; port pattern of `dispatcher`, nodes/dispatcher.ts:22-35)
- Per robot k (2-12): in `cellK` Ô của xe k, `wantK` Ô xe k muốn vào; out `goK` Xe k được đi. Params: `robots`, `rule` (Số nhỏ đi trước / Chờ lâu đi trước).
- Rule: a cell is granted to one robot; the grant holds until that robot stands on it; a robot is never granted an occupied cell.
- REVISE AFTER SPIKE: B1 (central or per robot), B5 (is a reservation needed or does give-way suffice).

### 4. Marker trio: two levels (agent G)
- Among the tiles under the reader, take those NEAREST IN HEIGHT to its feet, then the nearest middle (spike patch: 4 lines; deck robot then reads only deck tiles). Not a tolerance: the marker card's default y is 0.5, old markers may float. Old boards change only where tiles at different heights overlap one point → off / on guards must show 0 changed.
- `MARKER_MAX_NUMBER` 99 → 999 so each level has its own number range (deck from 1, ground lanes from 101; `first` on the deck piece). "Tìm mốc sàn" stays one list; the handbook says: different numbers per level.
- Not in scope: paint lines by height (line-sensor.ts:94-95), route-follow / next-free-slot distances.

### 5. Spawner (agent R)
- "Thu hồi": advanced toggle "Hiện ô Thu hồi" → optional inputs `recallThing` Vật cần thu hồi (object), `recall` Thu hồi (bool, rising edge). Takes back the named object only if this card made it. Toggle off = card and behaviour as today.
- Code input (D1).
- "Số lượng tối đa": limit 50 → 200 (the constant at spawner.ts:22; the setting's max at :125 and the clamp at :167 follow). Hash-neutral: default stays 3, every saved value ≤ 50 clamps to itself. Test: every shipped board's spawner settings give the same clamp before / after + both hash guards 0 changed. Why 200: worst case 154 cartons alive across 2 stations (phase 02).

### 6. Physics rules, "Vật lý thật" only (agent P, RUNNING)
- a) Turned chassis outline meets walls / blocks; a turn that would put a corner into a block is settled like a turn against a rival (physics.ts:480-496), else undone. Zone sensor, "Dò phía trước", touch, pistons, arm / hand solids read that outline.
- b) WHEEL SUPPORT (size M): a chassis is held up only where its wheels / outline have support; unsupported → it tips or falls; no traction while in the air. A robot that drives onto a hole falls to the floor below.
- c) Ceiling for "rides on a chassis" (robot-push.ts:54-59): only what is within about 1 m above the chassis top (spike: a plain item falls at most 0.67 m per tick, so a falling item is still caught).
- Switch off: nothing changes (`hasChassisOutline` needs traction, collider.ts:88-90). Switch on: every moved entry of `real-physics-on-baseline.json` re-recorded BY NAME with its reason; expected movers: boards where a traction chassis touches a block or stands at a platform edge.

## What the learner wires (one robot; the sample wraps it as circuit "Xe phân loại" x6)
```
Thân robot ─▶ Đọc mốc sàn ─ Số mốc ─▶ ┌ Tìm đường trên lưới ┐
Đọc mã (kiện trên khay) ─▶ Bảng giá trị │ Ô đang đứng          │─ Ô kế tiếp ─▶ Tìm mốc sàn ─ Mốc ─▶ Đi tới điểm ─▶ 2 Động cơ
   (mã k → ô cạnh lỗ k) ─────────────▶ │ Ô đích     Đã ở ô đích│─▶ nghiêng khay (Khớp xoay)        ▲ Chạy
                                       └──────────────────────┘                                   │
Số mốc ─▶ [Điều độ ô] Ô của xe k        Ô kế tiếp ─▶ Ô xe k muốn vào        Xe k được đi ─────────┘
```
Hole k (circuit "Lỗ thả"): catch box of 4 plain blocks under the opening (inside 0.8 m, walls 1 m: 24 / 24 in the spike; bare floor loses every carton, it slides 1.2-1.5 m) + `zone` inside it → "Bộ đếm"; the zone's "Đối tượng đầu tiên" → pin "Vật cần thu hồi" of BOTH stations, a timer beat → "Thu hồi" (only the owner station takes it back).
Tip: robot centre line 0.55-1.0 m from the hole centre, squared up, tilt 35° (spike recipe `tests/arm/side-tray-robot-goto.test.ts`).
Stations: robots 1-3 serve station 1, robots 4-6 station 2; the second robot waits on the queue cell. Hand-over: the robot parks on the hand-over cell and the arm sets the carton on its tray; `Cho nạp tiếp` ← "a robot stands there, tray empty". Station on a 2.6 m slab was NOT measured (A6): first check of agent S; if the arm or belt misbehaves at height → STOP and report. REVISE AFTER SPIKE: B4.

## Order and agent split (kinds after the wave: 81)
Agent P is already running from 0d273e9 and owns src/world → it needs no contract. For D, G, R the controller commits the shared contract first (one commit on main, suite green):
- `nodes/raised-deck.ts`, `grid-route.ts`, `grid-traffic.ts`, `code-reader.ts`: final kind, label, ports, params; inert `evaluate`. (`grid-*` ports only after the traffic spike; D and R may start before G: then the contract lands in two commits, each bumping the count: 77 → 79 with deck + code reader, → 81 with the grid pair.)
- `nodes/index.ts`, `nodes/node-names.ts` (rows + new spawner port names), `tests/nodes/step-1-nodes.test.ts`.
- `handbook/content-raised-deck.ts`, `content-grid-floor.ts`, `content-parcel-code.ts` (stub page per kind) + lines in `handbook/index.ts`.
- `tutorial/course-pack-m.ts` (deck), `-n.ts` (grid), `-o.ts` (parcel): each returns `[]` and names its kinds in a `COVERS` list (keeps tests/tutorial/course-coverage green); `tutorial/lessons.ts` spreads them; a lesson id enters `course.ts` when the lesson exists (controller adds the line at merge).
- Tell P the new main hash after each contract commit (it merges main before its final run).

| Agent | State | Worktree / branch / port | OWNS | Must not touch |
|---|---|---|---|---|
| P physics | RUNNING | `../GameBuilder-outline` · `feat/chassis-outline-support` · 5331 | `src/world/**` except `world/spawner.ts`; `src/nodes/{zone-sensor,touch,ahead-sensor,vision-sensor,linear-actuator,gripper,joint,link,force-sensor}.ts`; `tests/world/**`, `tests/arm/**`, `tests/actuator/**`, `tests/mechanics/**`; NAMED entries of `real-physics-on-baseline.json` + rows of `solid-on-summary.snap.json`. Tasks: 6a, 6b, 6c | everything of D, G, R; `nodes/floor-marker*.ts`; `nodes/spawner.ts`; samples; registries |
| D deck | not started | `../GameBuilder-deck` · `feat/raised-deck` · 5332 | `nodes/raised-deck.ts`; `handbook/content-raised-deck.ts` + `boards-raised-deck.ts`; `tutorial/course-pack-m.ts` + `lesson-raised-deck.ts`; `tests/nodes/raised-deck.test.ts`. No look in this wave (plain blocks) → no `render/**`, no `scene-view.ts` | `src/world/**` (the spike says none is needed; a gap → STOP, report → P) |
| G grid | not started (waits for the traffic spike) | `../GameBuilder-grid` · `feat/grid-route-traffic` · 5333 | `nodes/grid-route.ts`, `grid-traffic.ts`, `floor-marker.ts`, `floor-marker-sensor.ts`, `floor-marker-find.ts`; `render/floor-marker-figure.ts` (3-digit numbers fit the tile); `handbook/content-grid-floor.ts` + boards; `tutorial/course-pack-n.ts` + `lesson-grid-route.ts`; `tests/nodes/grid-*.test.ts`, `tests/nodes/floor-marker.test.ts`, `tests/render/floor-marker-figure.test.ts`, NEW `tests/nodes/grid-right-of-way.test.ts` | `src/world/**`, `tests/world/**` (P's), spawner |
| R parcel | not started | `../GameBuilder-parcel` · `feat/parcel-code-recall` · 5334 | `nodes/spawner.ts`, `world/spawner.ts`, `nodes/code-reader.ts`; `render/factory-parcels.ts` (number label, after the pick); preview page in `plans/ui-mockups/parcel-code/`; `handbook/content-parcel-code.ts`; `tutorial/course-pack-o.ts` + lesson; `tests/nodes/spawner-*.test.ts`, `code-reader.test.ts`, `tests/render/factory-parcels*.test.ts` | rest of `src/world/**`, `scene-view.ts`, `color-sensor.ts`, `color-palette.ts` |
| S sample | not started; starts when P, D, G, R are in main | `../GameBuilder-sample-upper` · `feat/sorting-grid-upper` · 5335 | NEW `samples/sorting-factory-grid.ts` (split by circuit if > 600 lines); `samples/sorting-factory-stations.ts` (D2 list); `io/samples.ts` (short label at :40, new entry); `tests/samples/**`, `tests/helpers/factory-run.ts`, `tests/io/samples.test.ts`; entries `sample:sorting-factory` (re-recorded by name, reason: pins + recall) and `sample:sorting-factory-grid` (new) | src/world, src/nodes, src/engine; gap → STOP and report |

Conflict P vs D inside src/world: gone. The spike showed the deck needs NO world change, so D never opens src/world, and the three world fixes the spike found (marker height excepted: that is in nodes, agent G) are all P's. `world/spawner.ts` (32 lines, no collision code) is carved out for R.
Merge order: D and R as they land → P when its named baseline list is complete (alone, own merge) → G → S. P's ownership of `tests/world/robot-right-of-way.test.ts` stands; G writes its traffic tests in its own new file.
Every agent adds its own `handbook:<kind>` / `lesson:<id>` entries to `solid-off-baseline.json` by hand; no one else's.

## Tests
- Deck: block count and footprint for 1 x 1, 3 x 3, 5 x 3 holes; chassis path on the deck = path on the ground (≤ 1e-9); carton through each hole size.
- `grid-route` truth tables (every cell → every goal, never a blocked cell, obeys the lanes); `grid-traffic` (two robots wanting one cell: exactly one goes, both orders; 4 at one crossing: no lock in 10 000 ticks, seeded property test).
- Markers: deck robot and ground robot on the same x, z read only their own level (spike case 4b); old one-floor boards unchanged.
- Spawner: recall of own / foreign / hidden object; limit 51..200 honoured; ≤ 50 unchanged.
- Physics (P): chassis at 0 / 30 / 45 / 60° against a wall: corner overlap < 1 mm every tick; pivot beside a wall backs off or is undone; zone / "Dò phía trước" / piston / gripper meet the turned face within 1 cm. Wheel support: over a 0.7 m hole with one wheel pair unsupported it tips / falls and has 0 forward drive in the air (spike 1b drove 0.73 m); on a lane beside a hole, sink 0.0000 m; at a platform edge: named behaviour. Ceiling: spike case 4c (60 kg crate on the deck, robot parked below: identical with and without the robot below).
- Per-tick geometry on the sample (300 s): robot-robot overlap < 1 mm; every wheel supported every tick; every robot inside its granted cell ± half a tile; carton leaves the tray only at its goal cell; every carton ends inside its catch box; conservation every tick.
- Anti-forced: cut each wire of "Xe phân loại", of "Lỗ thả", each pin wire on the main board → named failure (cut the route wire → the robot stops, or drives onto a hole and FALLS: named). Recall: cut "Thu hồi" → alive count reaches "Số lượng tối đa" and the stations stop.
- Hash guards: `solid-off-unchanged` 0 changed; `real-physics-on-hash`: only P's named entries; two runs same hash for the new sample.
- Perf recorded for the sample; reference from the spike: deck + 6 robots mean 2.0 / p99 9.2-9.9 ms. REVISE AFTER SPIKE: B6.
- ONE full vitest on merged main, quiet machine, `--testTimeout 300000`.

## What the user opens
First the previews (local HTML opened with `start`): D1 cards + numbered carton; D3 card. Then http://localhost:5173 → Tệp › Bài mẫu › "Xưởng phân loại kiện hàng (đang dựng: sàn lưới)" → Chạy → tab Mô phỏng. Controller checks on screen what the spike did not: camera at 2.6 m, shadows, placing the deck card in the editor.

## Risks, fallback, rollback
| Risk | L x I | Mitigation / fallback |
|---|---|---|
| 6 robots jam on the grid | M x H | gate G2; `grid-traffic` reservation; fallback painted loop, said plainly |
| Wheel support moves hashes of shipped boards (robot at a platform edge, bridge, ramp) | H x M | named re-records with reasons; off guard 0; if > ~10 shipped boards change behaviour visibly (not just numbers) → P stops and the controller asks the user |
| With the fall rule a small routing or stop error now loses a robot for the rest of the run | M x H | stop error measured 22 mm vs lane margin from B2; per-tick "all wheels supported" assert; lanes wide enough to pivot (REVISE AFTER SPIKE: B2) |
| Tray swinging over a hole / robots meeting beside holes (not tried by the spike) | M x M | covered by the 300 s per-tick test before the user sees it |
| Turned outline wedges a robot pivoting beside a wall | M x M | settle-or-undo rule + test at 4 headings |
| P is long-running while main moves under it | M x M | controller sends each new main hash; P merges main before its final full run; P merges alone |
| Baseline JSON conflicts between 5 branches | H x L | additive named entries; controller keeps both, script-compare (HANDOFF §4 items 47, 75) |
| Arm cannot set a carton on a parked tray (± 2 cm), or the station misbehaves on a slab | M x M | table + piston pushes the carton onto the tray (pieces exist); else STOP and report |
Rollback: `git revert -m 1` per merge; the station sample keeps working throughout (D2).
