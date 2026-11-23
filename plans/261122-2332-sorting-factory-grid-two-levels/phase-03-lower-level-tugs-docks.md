# Wave 3: lower level (latch piece, tug fleet, empty cages, docks, trucks, retire the stand-in)

## Context
- Needs wave 2 in main (cages, lock pins). Behaviour to match: `../reports/fullstack-261122-2130-mockup-outbound-report.md` steps 4-8 and "Design choices" (3 tugs on A, swap = empty cage first, door per row of holes, truck = 4 cages).
- Binding numbers: tug called at 5 / 6; may leave with 5 / 6 after waiting 6 s; 3 doors (routes 1-3 / 4-6 / 7-9); truck leaves at 4 cages, an empty one backs in; empties enter through a wall door.

## Result
Full flow on two levels with pieces only. The old one-floor station sample (with "Chuyển tạm (thay xe)") leaves the menu; the grid sample becomes the one entry.

## Reuse check (real ports, verified at 0d273e9)
| Need | Existing piece | Ports / limits | Verdict |
|---|---|---|---|
| Call a tug at 5 / 6, share among 3 tugs, carry the hole number | `dispatcher` | in `job` (rising edge), `jobId`, `busy1..12`; out `give1..12`, `lastCode`, `code1..12` (advanced), `waiting`; queue keeps every job (nodes/dispatcher.ts:51-68, :96-112) | enough for sharing and for the hole number. Gap: 9 holes feed ONE "Có việc", two calls in one tick would merge → note 1 |
| Swap steps | `sequence` | max 12 steps, `done1..12` level inputs (nodes/sequence.ts:4, :24-30, :99) | swap needs 12, delivery 4 → TWO chained sequences per tug |
| Step → target cell; hole → cells; route → door | `value-table` | 12 rows, in `index`, out `value` (nodes/value-table.ts:4, :29-30) | enough (9 holes, 3 doors, 12 steps) |
| Tug busy flag | `latch` "Công tắc nhớ" | in `set` / `reset`, out `on` (nodes/latch.ts:18-22) | enough |
| Tug routing + right of way on ground lanes | `grid-route`, `grid-traffic` (wave 1) | second copies with their own grid params | enough if markers read by height (wave 1 item 4) |
| Truck that leaves and returns | `moving-platform` | in `run`; out `moving`, `arrived`; A ↔ B, speed, wait (nodes/moving-platform.ts:29-43) | recipe; needs a draw-only truck look (D5) |
| Dock door, hole cover | `block` Ẩn / Hiện | nodes/block.ts:57-58 | recipe |
| Empty cage back to the wall door | `teleport` | in `who`, `go`, `dest`; out `done` (nodes/teleport.ts:17-21) | recipe; places onto other objects (stations report gap 2) → queue slots via `next-free-slot` (out `slot`, `full`; nodes/next-free-slot.ts:34-35) |
| Count cages on a truck | `zone-sensor` follow the truck | `follow`, `count` (nodes/zone-sensor.ts:75-80); filter list has no "container" [UNVERIFIED: filter options at :95-108] | may need one filter option added (owner: agent H, with the piece) |
Note 1: two `Sắp đầy` edges in the same tick: `dispatcher` reads ONE `job` edge per tick (dispatcher.ts:96). Recipe: each hole circuit holds its call in a `latch` until "Giao" answers; a `sequence` (loop, 9 steps, 1 step per tick) scans the holes and raises `job` with `jobId` = scanned hole. Pieces exist; if it proves unreadable, STOP and report (candidate general change: dispatcher input ports per caller).

## New general piece
### `hitch` "Chốt gài" (Hành động), kinds 82 → 83. (`latch` is taken: nodes/latch.ts)
- A carrier takes hold of a movable body and carries it rigidly; releasing sets it down where it is.
- In: `carrier` Xe (object, required), `on` Gài (bool, level). Out: `holding` Đang gài, `thing` Vật đang gài (object), `took` Khi gài, `released` Khi nhả.
- Params: `reach` Tầm gài (m), `what` Gài được (Lồng chứa / Vật thể rời / cả hai), `offset` Vị trí vật so với xe (vec3; default: on the back, for under-ride), advanced `maxMass`.
- Rule: with `on`, the nearest free body within reach is held; each tick it is put at carrier position + offset and KEEPS ITS OWN HEADING (a cage never rotates: its walls stay square and the real cartons inside are not swung); the body and what lies in it weigh on the carrier ("Vật lý thật"); the real cartons inside a held cage ride along (rule measured in wave 2); other bodies meet carrier and cage as solids; a body held by one hitch cannot be taken by another.
- Implementation hint for the agent, to verify first: `moveBlock` (world.ts:86, platforms.ts:225) may suffice with no new world call. If a new call is needed, decide whether it belongs in `KEEPS_VIEWS` (world.ts:80) and add a reference test like the existing shortcuts.
- Not in scope: trailers, towing with swing, chains of carts.
- Use outside: AGV carrying a shelf, forklift pallet, toy train coupling (handbook try board: robot fetches a box cart).

## Circuits the sample agent builds (pieces + wires)
```
Lỗ thả k ─ Sắp đầy ─▶ [quét 9 lỗ] ─▶ Bộ điều phối (3 máy) ─ Giao máy t ─▶ Xe kéo t
                                        Mã vừa giao = số lỗ ─▶ Nhớ số (trong Xe kéo t)
Xe kéo t:  Chuỗi bước A (12)  ─ Bước hiện tại ─▶ Bảng giá trị (ô đích theo bước, theo lỗ) ─▶ Tìm đường trên lưới ─▶ Đi tới điểm
           bước "gài / nhả"   ─▶ Chốt gài · Gài            Đã tới + Đang gài ─▶ Xong bước k
           Chuỗi bước B (4): tới cửa (Bảng giá trị lỗ → cửa 1-3) · nhả trong xe tải · tới làn LỒNG RỖNG · gài lồng rỗng
           chờ lồng đầy tối đa 6 s: Hẹn giờ 6 s HOẶC Đã đầy ─▶ Xong bước "chờ"
Cửa d:     Vùng (bám xe tải) Số ≥ 4 ─▶ Bệ di chuyển "Xe tải" · Bật ─▶ Khi tới cuối đường (xe đã ra ngoài)
           ngoài bến: Vùng "kiện trên xe" · Đối tượng đầu tiên ─▶ "Vật cần thu hồi" (2 trạm) · Hẹn giờ nhịp 0,1 s ─▶ "Thu hồi"   (24 kiện ≈ 2,4 s)
           Số kiện trên xe = 0 ─▶ Dịch chuyển 4 lồng về làn LỒNG RỖNG ─▶ xe lùi vào
```
Hole stays locked during the swap: tug's "đang đổi lồng" → pin `Khoá thêm` of that hole (wave 2).
Ground lanes: one-way outer loop on the same cell pitch as the deck (mock-up); deck columns stand on cell corners. Headroom: deck underside at 2.4 m, a robot under the deck is not disturbed (spike: path difference 0, 0 contact ticks); the tug (0.24 m) fits under a cage with 0.35 m clearance. REVISE AFTER SPIKE: B2 (pitch).
Cage pool: 9 under holes + 6 in the empty lane + up to 12 on trucks = 27 cages (each floor + 4 walls = 135 solid blocks; the spike's 36 cage blocks cost about +0.9 ms mean). Real cartons alive: worst case 154 (table in phase 02); cartons leave the world only at the truck recipe above. The perf gate of wave 2 is re-run here with tugs moving.
A cage is taken back to the empty lane only when its count is 0 (wire: "Số vật bên trong" = 0 → "Dịch chuyển"), so no carton is left hanging in the air.

## Agent split (kinds after the wave: 83)
Controller contract: `nodes/hitch.ts` stub, `nodes/index.ts`, `node-names.ts`, count test → 83, `handbook/content-hitch.ts` stub + index line, `tutorial/course-pack-q.ts` + `lessons.ts` spread. D5 preview (truck, dock door, tug look if the `agv` look is not kept) picked first.
| Agent | Worktree / branch / port | OWNS | Must not touch |
|---|---|---|---|
| H hitch | `../GameBuilder-hitch` · `feat/hitch-piece` · 5351 | `nodes/hitch.ts`; `src/world/**` (sole world owner of this wave: carried-body rule, zone filter for containers in `nodes/zone-sensor.ts`); handbook content + boards; `course-pack-q.ts` + `lesson-hitch.ts`; `tests/nodes/hitch.test.ts`, `tests/world/hitch-*.test.ts`; named baseline entries | samples, render |
| T looks | `../GameBuilder-dock-looks` · `feat/dock-truck-looks` · 5352 | `render/factory-blocks.ts`, `engine/factory-looks.ts`, `render/factory-kit.ts` (additions only), `tests/render/**`; opt-in looks `truck-bed`, `dock-door` (default look of every existing piece unchanged, pixel diff of one old board = 0) | nodes, world, samples |
| S3 sample | `../GameBuilder-sample-lower` · `feat/sorting-grid-lower` · 5353, starts when H is merged | `samples/sorting-factory-grid*.ts`; removal of `samples/sorting-factory-stations.ts` board entry + its tests / baseline entries (named, reason: sample retired; the station CIRCUITS move into the grid sample files); `io/samples.ts`; `tests/samples/**`, `tests/io/samples.test.ts` | src/world, src/nodes, src/engine, render |

## Tests
- Hitch: take / carry 10 m with 2 turns / release: held body offset error < 1 mm and its heading unchanged every tick; a cage with 6 real cartons carried the same way: 6 / 6 inside at the end, carton-wall overlap < 1 mm every tick, tug payload = cage + 6 cartons; released body rests, speed 0 within 0.5 s; two hitches cannot hold one body; carrier too weak for `maxMass` → not taken; payload of the carrier reads cage + load; switch off works (no weighing); anti-forced: cut `Gài` → cage never moves.
- Sample, 900 s (as the mock-up trial, report §"900 s trial"): conservation every tick (made = deck + cages + trucks + gone with trucks); longest hole lock ≤ 30 s (mock-up A: longest 19.6 s); every door ships ≥ 1 truck; no tug standstill > 30 s; tug-tug, tug-cage (not its own), tug-column overlap < 1 mm; a cage under a hole is centred within 2 cm.
- Anti-forced tables: every pin wire of "Xe kéo", "Cửa", "Lỗ thả", and of the main board → named failure (hole stays red, truck never leaves, empties run out, tug idles).
- Determinism: two 120 s runs same hash. Hash guards: off 0 changed; on: new sample entry by name; retired sample entries removed by name.
- Truck: after it is gone, cartons on it reach 0 within 5 s, both stations' "Số đang có" drop by the same total, cages return empty; anti-forced: cut "Thu hồi" at the dock → alive count climbs to the limit and the stations stop (named).
- Perf: p99 ms per tick with 6 robots + 3 tugs + 27 cages + the peak carton count of the run (target ≤ 16.7; peak count and worst tick recorded).

## What the user opens
:5173 → Tệp › Bài mẫu › "Xưởng phân loại kiện hàng" → Chạy: first truck leaves within about 2 minutes (start state part filled, as in the mock-up).

## Risks, fallback, rollback
| Risk | L x I | Mitigation / fallback |
|---|---|---|
| Carried cage collides badly in tight lanes (pair as one body) | M x H | per-tick tests in H before the sample; lanes ≥ cage diagonal; fallback: cage non-solid to other tugs while held (said in the handbook) |
| Swap choreography too long for kids to read | M x M | two named sequences + notes; steps listed on a `value-table`; preview of the circuit level read by the controller |
| Simultaneous calls lost | M x H | scan recipe (note 1) + test "9 holes amber in one tick → 9 jobs given" |
| Tug under the deck reads deck markers | L x H | fixed in wave 1 (height-aware reading); test here with a tug under tile n |
| 27 cages + 6 robots + 3 tugs cost > 16.7 ms | M x H | real cartons are the user's choice (D4 = b): perf gate of wave 2 first; perf agent of wave 4 pulled in early for a general fix on resting bodies; else options with numbers to the user |
| Cartons spill when a tug brakes or a truck platform starts | M x H | walls 1 m, tug and truck speed caps as open settings, per-tick "inside its cage" assert over 900 s |
| A robot falling from the deck (fall rule) hits a tug lane | L x M | the sample asserts no fall; with a cut wire the fall IS the named failure |
| Truck as a moving platform looks odd backing in | L x L | look picked from preview; movement stays a straight A ↔ B |
Rollback: revert merges in reverse order; the wave 2 sample (button "Đổi lồng") is the state to fall back to. The retired station sample is removed in its own commit so it can be restored alone.
