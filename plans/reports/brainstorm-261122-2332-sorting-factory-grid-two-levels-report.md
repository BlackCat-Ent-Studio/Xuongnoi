# Sorting factory, layout A on two levels: user answers + proposed build order

Date: 2026-11-22 23:32. main = 0d273e9 (local, not deployed). Status: answers RECORDED; build order PROPOSED, waiting for the user's "ok".

## Answers (user, 11-22 23:32)

| # | Topic | Pick | Meaning |
|---|---|---|---|
| 1 | Station calls a 2nd robot while the 1st loads | a | keep (13.1 cartons/min on A) |
| 2 | Button "Sàn trong suốt" | a | keep |
| 3 | Tug type | a | under-ride + latch, no trailer |
| 4 | Cage may leave at 5/6 after 6 s | a | keep |
| 5 | Empty cages | a | come in through a wall door |
| 6 | Two levels in the real game | a | YES: deck with holes above, cages + tugs below |
| 7 | Warehouse scenery in the game | a | YES, draw-only, built last |
| 8 | Sorting rule on 9 holes | a | each parcel carries route number 1–9, hole k = route k |
| 9 | Stand-in "Chuyển tạm (thay xe)" | a | keep until the fleet exists |
| 10 | Counted cartons | b | add "Thu hồi" to "Tạo đối tượng" (piece change approved) |
| 11 | Class 5 mass 4 → 3 kg | a | agreed (moot once 8a replaces the colour + mass rule) |
| 12 | Pin "Đã lấy kiện" on Trạm nạp | b | ADD the pin (one tick when the carton leaves the table) |
| 13 | Menu label | b | "Xưởng phân loại kiện hàng (đang dựng: phần trạm)" |
| 14 | Walls / blocks meet the turned chassis outline | a | DO IT NOW (user chose against the ⭐ "wait") |
| 15 | Sensors / pistons / arm pieces read the turned outline | a | DO IT NOW (same) |
| E 16–24 | lesson strip, formula box, fold, puzzle look, lesson robot-arm, UI C step 2, deploy, X-ray, APK chunk | — | parked by the user ("tạm để sau") — no defaults taken |

Mock-up v4 needs no change (1a–5a all = keep).

## Scout facts used

- Exist already: `dispatcher`, `sequence` "Chuỗi bước", `value-table` "Bảng giá trị" (route → door lookup), `latch` "Công tắc nhớ", `next-free-slot`, `robot-goto`, floor marker trio, `moving-platform`, world/navigation (plane-nav, side-nav; "Tìm đường" param says it climbs platforms).
- `SPAWNER_MAX_CLASSES = 6` (src/nodes/spawner.ts:33) → 8a needs 9 or a route label.
- No piece: raised deck with holes robots drive on, grid routing for `robot-goto` robots, cell right of way, container that counts and can be moved, hole lock, under-ride latch, truck / dock sink, object removal.
- Not known yet (must be measured, not guessed): how far the existing height / platform support carries a robot chassis under "Vật lý thật"; traffic of 6 robots on a one-way grid built from pieces.

## Proposed build order (each wave ends with something on :5173; pieces only in the sample)

| Wave | Content | Why here |
|---|---|---|
| 0 Measure (no change to main) | spike A: chassis driving on a raised deck + carton falling through an opening into a body below; spike B: 6 robots on the 3×3 one-way grid with a prototype routing rule: jams, gaps, ms per tick | the two biggest risks; numbers before design |
| 1 Upper level | "Sàn nâng có lỗ"; "Tìm đường trên lưới" (cell + goal → next cell); one-robot-per-cell right of way; parcels with route 1–9 (8a); "Thu hồi" (10b); turned outline vs walls + sensors / pistons / arm pieces (14a, 15a; own agent, owns src/world collision files, re-records NAMED baseline entries only); station: pin "Đã lấy kiện" (12b), menu label (13b). Sample = 2 stations + 6 robots + 9 holes, parcels counted per hole then removed | traffic first |
| 2 Cages and lock | container piece (counts, holds, reports full, movable body); hole gate + 3-colour lamp; robot waits / laps at a locked hole | needs wave 1 holes |
| 3 Lower level | under-ride latch piece; tug fleet on its own lanes via the existing dispatcher + sequence; empty-cage source at the wall door; dock + truck (capacity, leaves when loaded, returns); route → door with "Bảng giá trị"; remove the stand-in block | needs cages |
| 4 Scenery and hardening | warehouse scenery draw-only (factory-kit); handbook pages + lessons for every new piece; anti-forced tables; perf with 6 robots + tugs; real-GPU look; full vitest on a quiet machine | last |

Rules for every wave: general pieces (usable outside this sample), handbook page + lesson coverage, anti-forced test, old boards hash-identical unless a named entry is justified, agents on Fable in worktrees, controller merges and reads shots.

## Risks, said plainly

- Two levels may need engine work the spikes will size; if wave 0 shows it is very large, come back to the user with the number before building.
- Grid traffic with 6 robots is untested; head-on in one lane deadlocks today. Fallback stays "painted loop", told to the user if used.
- 14a / 15a change shipped physics under "Vật lý thật": baseline entries move; each must be named and explained.
- Time: an honest range is several working sessions (roughly 3–5 days of agent time), dependent on the weekly model limit; not a promise.

## Unresolved questions

1. User's "ok" on the build order (and: start wave 0 right after the plan, or show the plan first).
2. Group E (16–24) parked.
3. 8a detail, for the plan: raise the spawner to 9 classes, or a separate route label on the parcel read by a "Đọc mã" piece (decide after reading spawner + colour sensor; propose with a preview of the card).
