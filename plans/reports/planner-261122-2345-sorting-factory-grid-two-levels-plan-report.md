# Plan report: sorting factory, grid floor on two levels

Written (documents only): `plans/261122-2332-sorting-factory-grid-two-levels/` = plan.md + phase-00 (spikes, gates G1-G4) · phase-01 (upper level) · phase-02 (cages + lock) · phase-03 (lower level) · phase-04 (scenery + hardening). Replaces phases 3-4 of the 11-19 plan. Spike reports were not there yet. Not run: `set-active-plan.cjs` (outside my write scope).

New kinds proposed: `raised-deck` Sàn nâng có lỗ, `grid-route` Tìm đường trên lưới, `grid-traffic` Điều độ ô, `code-reader` Đọc mã (option B only), `container` Lồng chứa, `hitch` Chốt gài. Count 77 → 81 → 82 → 83 (80 / 81 / 82 with option A). Hole cover, lamp, truck, dock door, empty-cage return, job sharing, swap steps, route → door = recipes from existing pieces.

## Open decisions for the user
1. Route number 1-9 (sketches in phase-01): a) spawner classes 6 → 9, read by "Đọc màu" (0 new kinds, route = one of 9 tape colours); b) code on the parcel + small piece "Đọc mã", reusing the existing goods tag (+1 kind, number drawn on the carton). Recommend b.
2. While building: a) grid sample = second menu entry "…(đang dựng: sàn lưới)", station sample kept until wave 3; b) replace in place now. Recommend a (keeps answer 9a).
3. "Điều độ ô": a) one central card, 3 rows per robot; b) a small card inside each robot. Recommend a; preview first.
4. Cage content: a) cage takes the parcel in and draws the pile (cheap, no 50-object limit); b) real cartons stay as bodies. Recommend a.
5. Looks to pick from previews before porting: cage, lamp, hole cover, truck, dock door, number label on the carton, warehouse density.

## REVISE AFTER SPIKE
- Deck: plain blocks enough or world work (A1, A8) · cell pitch, hole size, grid cols x rows (A2, B2) · scatter under a hole → cage mouth / funnel (A3) · pile (A4) · headroom under deck and under a cage (A5) · station on a slab (A6).
- Traffic: shape of the routing / right-of-way rule, central or per robot (B1, B5) · lane rule (B2) · throughput and the 2-robots-per-station design (B4) · marker tile size vs speed (B7).
- Perf: ms per tick (A7, B6) → acceptance number, cage pool size 27, timing of the perf agent.

## Binding decisions vs code
- "Class 5 = 3 kg": already so, app/src/samples/sorting-factory-stations.ts:18. No work.
- "Menu label …(đang dựng: phần trạm)": the name const is already short (same file :427) but the menu entry appends the long text, app/src/io/samples.ts:40. One-line fix in wave 1.
- "Latch piece": kind id `latch` is taken by "Công tắc nhớ", app/src/nodes/latch.ts → proposed `hitch` "Chốt gài".
- Two levels + "floor marker on every cell": marker reading ignores height, app/src/nodes/floor-marker.ts:49-60, and numbers stop at 99 (:6) → a tug under the deck would read the deck tile; fixed as a general rule in wave 1.
- "Cage holds 6, trucks hold 4 cages": a spawner keeps at most 50 objects alive, app/src/nodes/spawner.ts:22 → real cartons in 9 cages + 3 trucks do not fit; decision 4a avoids it.
- "Tug called at 5 via the dispatcher": it reads one "Có việc" edge per tick, app/src/nodes/dispatcher.ts:96 → two holes going amber in one tick need a scan recipe (phase-03 note 1).
- "Swap by sequence": 12 steps max, app/src/nodes/sequence.ts:4; swap + delivery = 16 → two chained sequences.
- Turned outline vs blocks: today excluded on purpose "so a chassis can turn beside a wall", app/src/world/collider.ts:97-99, :120 → wave 1 adds a settle-or-undo turn rule (pattern at app/src/world/physics.ts:480-496).

## Unresolved questions
- [UNVERIFIED] `moveBlock` can carry a cage with a tug (hitch without a new world call); zone filter for containers; cargo slotting reusable outside vehicles. Each is the first task of the owning agent.
- How the arm hands a carton to a parked robot (tray vs table + piston): left to the sample agent with a STOP rule.

## Revision 11-23 (user answers 1b, 2a, 4b + fall rule; deck spike read)
- Decided: route = number printed on the carton + new piece "Đọc mã" (preview of cards + carton before porting; `color-sensor.ts` / `color-palette.ts` no longer touched); grid sample = second menu entry "(đang dựng: sàn lưới)"; cage = MOVABLE roll cage holding REAL cartons. Kind counts fixed: 81 after wave 1, 82 after wave 2, 83 after wave 3. Open decisions 1, 2, 4 above are closed; 3 ("Điều độ ô" card) and 5 (looks) stay open.
- Real cartons: worst case alive = 9 x 6 (holes) + 3 x 4 x 6 (trucks) + 3 x 6 (tugs) + ~10 (belts, trays, falling) = 154; typical 60-100. Spawner limit 50 → 200 (agent R, app/src/nodes/spawner.ts:22, only the bound of a setting: old boards identical, proven by both hash guards). `container` lost "Đổ hết" and the drawn pile: it only counts; cartons leave the world by "Thu hồi" (wave 2: button "Đổi lồng"; wave 3: after the truck is gone, one carton per 0.1 s). Perf gate = first task of the cage agent: 60 / 100 / 154 cartons, p99 ≤ 16.7 ms.
- Fall rule + agent P (running, ../GameBuilder-outline, feat/chassis-outline-support, 5331): turned outline, wheel support (no traction in the air), ceiling for "rides on a chassis". Phase-01 split table updated: P running without a contract; D (no src/world, no look), G (marker height + numbers to 999, own traffic test file), R (spawner + limit + code + preview), S not started; merge order D, R → P alone → G → S.
- Deck spike resolved every A item: deck = node spawning plain blocks (16 for 3 x 3, engine S, gate G1 passed); hole 0.7 m; catcher must have walls (bare floor: cartons slide 1.2-1.5 m; walled 0.8 m cage 24 / 24) → wave 1 uses catch boxes of plain blocks; marker reader takes the tile nearest in height (a tolerance is unsafe: marker default y = 0.5); cost deck + 9 cages + 12 robots mean 2.84-2.98 / p99 11.6-11.8 / worst tick 21.7 ms → acceptance changed from "max" to "p99 ≤ 16.7 ms, worst tick explained".
- Still marked REVISE AFTER SPIKE (traffic spike running): B1, B5 rule shape and card of "Điều độ ô"; B2 pitch, lane width, grid size; B4 throughput and station queue; B6 ms per tick. Agent G's contract waits for them.
- New risks, real cartons: (1) piles and a MOVING cage were not measured by the spike (one carton per run, fixed walls) → two measuring steps before the piece is built; a moved block that cannot carry rigid crates needs a general world rule and a world owner; (2) 6 cartons may pile above a 1 m rim or bounce out → honest count, capacity 6 may need a bigger cage (user decides); (3) count flicker while settling → lock held by "Công tắc nhớ"; (4) 100-154 resting bodies may break the tick budget → options with numbers to the user, never a silent drawn pile; (5) spill when a tug brakes or a truck starts; (6) browser cost of ~200 drawn bodies unmeasured.
- New risks, fall rule: (1) hashes of shipped boards with a robot at a platform edge move → named re-records; if behaviour changes visibly on many boards P stops and the user is asked; (2) a 2 cm stop error or a traffic slip now loses a robot for the whole run → per-tick "all wheels supported" assert, lane margin from B2; (3) tray over a hole and robots meeting beside holes were not tried by the spike; (4) P is long-running while main moves → merges main before its final run, lands alone.
- Not verified by anyone yet: station (arm + belt) on a 2.6 m slab; anything on screen at height (camera, shadows, editor placement); physics.ts:417-431 and world.ts:500-508 are cited from the spike report, not re-read by me.
