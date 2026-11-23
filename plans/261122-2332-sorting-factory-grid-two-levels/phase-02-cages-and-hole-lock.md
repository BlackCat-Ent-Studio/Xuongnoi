# Wave 2: movable roll cages with REAL cartons, hole lock, 3-colour lamp, robot waits / laps

## Context
- Needs wave 1 in main (deck, holes, code, recall, spawner limit 200, P's physics rules).
- User decision 11-23 (D4 = b, against the planner's recommendation): the cage holds REAL cartons as bodies. The cage is a MOVABLE roll cage from the start, not fixed walls.
- Mock-up behaviour to match: `../reports/fullstack-261122-2130-mockup-outbound-report.md` ("The outbound flow" steps 1-3; capacity 6; amber at 5).
- Deck spike facts: walled cage (walls 1 m, 0.8 m inside) caught 24 / 24, rest within 0.28 m of the centre; bare floor 0 / 24 (slides 1.24-1.46 m). NOT measured: several cartons piling in one cage, a movable cage, a carried cage.
- User picks the looks of D5 (cage, lamp, hole cover) before porting.

## Result
A roll cage stands under each hole; cartons fall in and STAY as bodies; the cage reports its count; lamp green → amber at 5 → red at 6; at 6 the hole is covered; a robot heading to a locked hole waits 4 s beside it, then takes a lap and comes back. No tugs yet: a board button "Đổi lồng" stands in (takes the cage's cartons back with "Thu hồi"), named as such on a note.

## Carton budget (real bodies)
| Where | Worst case | Note |
|---|---|---|
| Cages under holes | 9 x 6 = 54 | |
| Cages on trucks | 3 doors x 4 cages x 6 = 72 | the instant before a truck's cartons are taken back |
| Cages on tugs | 3 x 6 = 18 | wave 3 |
| On belts, tables, trays, falling | ~10 | 2 stations + 6 robots |
| TOTAL | 154 | typical 60-100 (cages half full, trucks half loaded) |
- Two stations share them → up to ~80 each, uneven → spawner limit 200 (wave 1, agent R; nodes/spawner.ts:22), sample sets "Số lượng tối đa" per station to 160, "Sống bao lâu" 0.
- Cartons leave the world ONLY by "Thu hồi": wave 2 at the button "Đổi lồng"; wave 3 when the truck is gone (phase 03).
- PERF GATE (first task of agent C, before building the piece): 60 / 100 / 154 cartons at rest in 9 + 12 walled cages on the wave 1 sample: p99 ≤ 16.7 ms per tick headless, quiet machine; mean and worst tick recorded. Start point without piles: mean 2.84-2.98, p99 11.6-11.8, worst 21.7 ms (deck + 9 block cages + 12 robots). If 154 fails but 100 passes: report with options (a: trucks' cartons taken back as each cage is loaded on the truck, max ~82 alive; b: general engine work on resting bodies by a perf agent; c: truck leaves at fewer cages = a binding number, user only). Never a silent switch to a drawn pile.

## Code facts (verified at 0d273e9 unless marked)
| Fact | Where |
|---|---|
| Spawner limit 50 today (raised in wave 1) | app/src/nodes/spawner.ts:22, :167 |
| `block` has inputs Ẩn / Hiện and "Đặt màu" (1-3 = đỏ / vàng / xanh lá) | app/src/nodes/block.ts:57-59; app/src/engine/block-styles.ts:55 |
| Solid blocks can be moved as bodies and carry what stands on them | app/src/world/platforms.ts:63, :98, :225-233; `moveBlock` keeps cached views (world.ts:86) |
| One card can spawn several plain blocks (belt + walls) | app/src/world/world.ts:500-508 [from the spike report, not re-read] |
| Rigid crates touching a MOVING wall block: behaviour not measured | [UNVERIFIED] → C's first task |
| `select-number` turns a number into N bools (no piece picks one of N live signals by number) | app/src/nodes/select-number.ts:33-34 |

## New general piece
### `container` "Lồng chứa" (Vật thể), kinds 81 → 82
- A movable open-top roll cage: floor plate + 4 walls as solid bodies that move TOGETHER (one card, one object on wires). Things fall in and stay as real bodies; the cage only counts them.
- Out: `self` Đối tượng, `count` Số vật bên trong, `full` Đã đầy, `took` Khi nhận vật (one tick), `first` Vật bên trong (object, for "Thu hồi" / "Đọc mã").
- No inputs (emptying = "Thu hồi" of each carton through `first`; no hidden "delete" inside the piece).
- Params: `position` (place), `inside` Lòng lồng (default 0.8 x 0.8 m), `wall` Cao thành (1 m), `capacity` Sức chứa (1-24, default 6; only sets `full`, never blocks a carton), `clearance` Khoảng hở gầm (m, for a carrier that drives under; tug chassis is 0.24 m tall → default 0.35), `mass`, `look` Kiểu dáng (classic box / `roll-cage`, draw-only, mesh walls so the cartons are visible), `color`.
- Counted = items whose middle is inside the cage volume, each tick (so a carton that bounces out is un-counted: honest count).
- Moving: the cage keeps its heading (never rotates; under-ride tug, mock-up choice); when it moves, floor and walls move as one and the cartons inside ride along.
- Not in scope: lids, stacking cages, tipping a cage out, cage rotation.
- Use outside this sample: any bin / box / cart that counts what is put in (handbook try board: a belt filling a cart, then a piston pushes the cart away).

### C's measuring step before the build (answers what the spike did not)
1. 6 cartons (1 / 2 / 5 kg mixed) dropped one by one from 2.6 m into a 0.8 m cage: all inside, at rest ≤ 4 s after the last, top of the pile below the wall top? (0.26 m cartons: 6 fit in two layers; if the pile reaches the rim → report the capacity / wall height that works; capacity 6 is a binding number.)
2. Cage with 6 cartons moved 5 m at tug speed with a stop: 6 / 6 still inside, no carton through a wall or the floor (overlap < 1 mm per tick), cartons at rest ≤ 2 s after the stop.
3. Cost per tick (the perf gate above).
If a moving block cannot carry rigid crates → STOP; the controller spawns a world owner for a general rule "a moved solid body carries / pushes rigid crates" (agent P if free). No workaround in the piece.

## Recipes from existing pieces (sample agent; no new kind)
```
Lồng chứa ─ Số vật bên trong ─▶ So sánh ≥ 5 ─┐
            Đã đầy ───────────────────────────┼▶ Phép tính (1 đỏ / 2 vàng / 3 xanh → số màu) ─▶ Vật thể "Đèn" · Đặt màu
            Đã đầy ─▶ Vật thể "Nắp lỗ" · Hiện      (Đảo ngược ─▶ Ẩn)
            Đã đầy ─▶ pin "Lỗ k đang khoá" ─▶ circuit "Xe phân loại"
            Vật bên trong ─▶ pin "Vật cần thu hồi" (2 trạm)      nút "Đổi lồng" + Hẹn giờ nhịp ─▶ "Thu hồi"
```
Circuit "Lỗ thả" (x9): pins out `Số kiện`, `Sắp đầy` (≥ 5), `Đang khoá`, `Lồng` (object); in `Khoá thêm` (swap in progress, used in wave 3). The wave 1 catch box of plain blocks is replaced by the cage.
Robot side, inside "Xe phân loại": locked AND at the cell beside the hole → timer 4 s → goal switches to a lap cell (`value-table`), back when reached. Dump only when NOT locked.
Lock of "my" hole (9 live signals, one number): `select-number` + 9 "Và" + "Hoặc" wrapped as circuit "Lỗ của tôi có khoá không" (10 pins). If the main board gets unreadable (54 wires to 6 robots), STOP and propose one small general piece "Chọn tín hiệu theo số" with a preview; do not add it unasked.

## Agent split (kinds after the wave: 82)
Controller contract first: `nodes/container.ts` stub (final ports + params), `nodes/index.ts`, `node-names.ts`, count test → 82, `handbook/content-container.ts` stub + index line, `tutorial/course-pack-p.ts` (returns `[]`, `COVERS`), `lessons.ts` spread. Looks (D5) picked from a preview page BEFORE porting: page built by C in `plans/ui-mockups/cage-lamp-cover/` (mock-up figures in app/tests/showcase/factory-mockup*.ts are reference only; no code moves from tests/showcase into src).
| Agent | Worktree / branch / port | OWNS | Must not touch |
|---|---|---|---|
| C container | `../GameBuilder-container` · `feat/container-piece` · 5341 | `nodes/container.ts`; `render/container-figure.ts` + ONE registration edit in `render/scene-view.ts` (keep CRLF); `engine/factory-looks.ts`, `render/factory-blocks.ts` (cage, beacon, cover looks, opt-in); handbook content + boards; `course-pack-p.ts` + `lesson-container.ts`; `tests/nodes/container*.test.ts`, `tests/render/container-figure.test.ts`, `tests/perf/**` (carton-count plan) | samples; `src/world/**` (gap → STOP and report) |
| S2 sample | `../GameBuilder-sample-lock` · `feat/sorting-grid-lock` · 5342, starts when C is merged | `samples/sorting-factory-grid*.ts`, `tests/samples/**`, `tests/helpers/factory-run.ts`, the grid sample's baseline entries | src/world, src/nodes, src/engine, render |
Optional head start (disjoint files): agent H of wave 3 (`hitch`) may run beside C once C's measuring step 2 has passed (H owns src/world in that case; C owns none).

## Tests
- Container: N cartons dropped → count = N; `took` pulses = N; two in one tick counted as two; a carton beside the mouth not counted; one that bounces out is un-counted; `full` at capacity; a 7th carton still counted (count 7, `full` stays on); cage moved 5 m: walls + floor offsets constant (< 0.1 mm), 6 / 6 cartons inside, carton-wall overlap < 1 mm every tick; switch off: counts and moves (plain item rules).
- Per-tick geometry (sample, 300 s): every carton that passed hole k is inside cage k or still falling; none on the ground floor outside a cage; no carton dumped while the hole is covered; a locked robot stands clear of the cover and of other robots; all wheels supported; conservation: made = on deck + falling + in cages + taken back.
- Anti-forced: cut `Đã đầy` → cover never shows, count passes 6 → named; cut the lamp wire → lamp stays green; cut the lock pin to the robot → a carton lands on the cover; cut the 4 s timer → robot never laps (standstill > 30 s); cut "Vật bên trong" → "Đổi lồng" empties nothing.
- Perf gate (above) as a recorded run in tests/perf; numbers in the agent report.
- Hash guards: off 0 changed; on: only `sample:sorting-factory-grid` re-recorded (by name, reason: cages).
- A chassis under a cage with 0.35 m clearance: 0 contact ticks, payload 0 kg (spike measured this under the deck; the ceiling rule of agent P covers cartons above the tug).

## What the user opens
First the look preview (cage, lamp, cover). Then :5173 → the grid sample → one hole fills with real cartons: green, amber at 5, red + cover at 6, a robot waits then laps; press "Đổi lồng" → cartons go, green again.

## Risks, fallback, rollback
| Risk | L x I | Mitigation / fallback |
|---|---|---|
| Six cartons do not fit / pile above the rim / one bounces out | M x H | measuring step 1 first; tune `inside` + `wall`; honest count; if capacity 6 cannot hold → user decides (bigger cage or capacity) |
| Cartons fall through or jitter when the cage moves | M x H | measuring step 2 first; general world rule by a world owner; never a per-sample fix |
| 100-154 resting bodies cost too much | M x H | perf gate first; options a / b / c above go to the user with numbers |
| A robot that falls through a hole (new fall rule) lands on a cage and its cartons | L x M | sample test asserts no robot ever falls; outside the sample that is correct behaviour; handbook says so |
| Count flickers while cartons settle (5 ↔ 6 → lamp and lock chatter) | M x M | lock through "Công tắc nhớ" set at 6, reset only by the swap; test: `Đang khoá` never drops between full and swap |
| Lock wiring too dense | M x L | circuit wrap; else propose "Chọn tín hiệu theo số" |
Rollback: revert the two merges; the wave 1 sample (catch boxes + recall) still runs.
