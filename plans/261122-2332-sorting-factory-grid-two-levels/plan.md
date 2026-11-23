---
title: "Sorting factory: grid floor on two levels (layout A + outbound)"
description: "Rebuild the sample 'Xưởng phân loại kiện hàng' as general pieces: raised deck with 9 holes, 6 grid robots, cages, tug fleet, docks."
status: pending
priority: P1
effort: "~4 days of agent time (honest range 3-5, depends on the weekly model limit)"
branch: main
tags: [sorting-factory, pieces, physics, two-levels, fleet]
created: 2026-11-22
---

# Plan: Xưởng phân loại kiện hàng, sàn lưới 2 tầng

Replaces phases 3-4 of `../261119-1106-circuit-boards-sorting-factory/plan.md` (its phases 0-2 stay done).
Binding record: `../reports/brainstorm-261122-2332-sorting-factory-grid-two-levels-report.md` + user answers of 11-23 (below). State: HANDOFF.md §A4. main = 0d273e9, 77 node kinds.
Revised 11-23: user answers D1 = b, D2 = a, D4 = b; deck spike read (`../reports/researcher-261122-2345-deck-two-levels-spike-report.md`); traffic spike still running (B items stay marked).

## Waves
| # | Phase file | Result the user opens on :5173 | Depends on | Status |
|---|---|---|---|---|
| 0 | [Spikes: deck + grid traffic](phase-00-measuring-spikes.md) | nothing (numbers only, never merged) | — | deck spike DONE (gate G1 passed); traffic spike running |
| 1 | [Upper level](phase-01-upper-level-grid-floor.md) | second menu entry "(đang dựng: sàn lưới)": 2 stations + 6 robots + 9 holes on a raised deck, parcels counted per hole then taken back | traffic spike, user picks D3 + the D1 preview | agent P running; D, G, R, S not started |
| 2 | [Cages and hole lock](phase-02-cages-and-hole-lock.md) | movable roll cage under each hole fills with REAL cartons, lamp green / amber / red, hole locks, robot waits then laps | wave 1 | pending |
| 3 | [Lower level](phase-03-lower-level-tugs-docks.md) | tugs swap cages, 3 dock doors, trucks leave at 4 cages, cartons taken back when the truck is gone, old station sample retired | wave 2 | pending |
| 4 | [Scenery + hardening](phase-04-scenery-and-hardening.md) | warehouse look, lessons, demo checklist | wave 3 | pending |

## New general pieces (kind count 77 → 83; D1 = b is decided)
| Wave | Kind id | Vietnamese name | Count after |
|---|---|---|---|
| 1 | `raised-deck` | Sàn nâng có lỗ (a node that spawns plain blocks; engine size S) | 78 |
| 1 | `grid-route` | Tìm đường trên lưới | 79 |
| 1 | `grid-traffic` | Điều độ ô | 80 |
| 1 | `code-reader` | Đọc mã | 81 |
| 2 | `container` | Lồng chứa (movable roll cage, real cartons inside) | 82 |
| 3 | `hitch` | Chốt gài (`latch` is taken by "Công tắc nhớ", nodes/latch.ts) | 83 |

Changed pieces and rules:
- `spawner`: inputs "Vật cần thu hồi" + "Thu hồi"; code input; "Số lượng tối đa" limit 50 → 200 (nodes/spawner.ts:22; only the upper bound of a setting moves, old boards identical).
- Marker trio: among tiles under the reader, the tile nearest in HEIGHT wins (not a tolerance); numbers above 99.
- Physics, "Vật lý thật" only (agent P): turned chassis outline meets blocks, sensors, pistons, arm pieces; WHEEL SUPPORT: a chassis is held up only where its wheels / outline have support and has no traction in the air, so a robot that drives onto a hole falls; a ceiling for "rides on a chassis" (world/robot-push.ts:54-59).
Recipes from EXISTING pieces (no new kind): hole cover (`block` Ẩn / Hiện), 3-colour lamp (`block` "Đặt màu" 1-3, engine/block-styles.ts:55), truck (`moving-platform`), empty-cage return (`teleport`), job sharing (`dispatcher`), swap steps (`sequence` x2), route → door (`value-table`).

## Acceptance (whole plan)
- Sample runs 5 simulated minutes: every parcel ends in the cage of its route; conservation holds every tick (made = on deck + falling + in cages + on trucks + taken back); 0 chassis overlap > 1 mm; no robot stands still > 30 s; every wheel of every robot supported every tick (no robot falls).
- Pieces only: no sample id under src/world, src/nodes, src/engine. Anti-forced: cut each pin wire of each circuit → the run fails for the named reason.
- Every new kind: handbook page + try board, one lesson, used on a board outside this sample.
- Old boards: `solid-off-baseline.json` 0 changed / 0 missing; `real-physics-on-baseline.json` changed entries listed BY NAME with a reason; `solid-on-summary.snap.json` rows only added or named.
- Cost per tick, headless, quiet machine, full sample with the worst-case carton count alive (154, see phase 02): p99 ≤ 16.7 ms; worst single tick recorded and explained. Starting point from the deck spike WITHOUT piles and tugs' cages: deck + 9 block cages + 12 robots = mean 2.84-2.98, p99 11.6-11.8, worst tick 21.7 ms. REVISE AFTER SPIKE: B6 (6 robots with the routing pieces).
- tsc clean, ONE full vitest green on the merged commit on a quiet machine (today 294 files / 4338).
- Every new visible card shape, lamp, cage, truck, label, carton number was previewed and picked by the user before porting.

## Rules that bind every wave
- Agents: `fullstack-developer`, model `fable`, manual worktrees `../GameBuilder-<name>`, junctions made by the controller (HANDOFF §4 item 4), one dev port each (5331+), "commit often".
- Controller commits the shared contract BEFORE fan-out (all shared registries edited once, stubs in place); agents then touch only their owned files. Baseline files: agents ADD or re-record only named entries by hand, never `-u`; controller keeps both sides at merge and script-compares with the pre-merge commit.
- Sample agents: params / wires / circuits only. Piece insufficient → STOP and report.
- Old boards with "Vật lý thật" off stay byte-identical.
- No plan ids, wave or phase numbers in code comments, test names, commit messages.
- Each wave ends: merge → tsc → focused tests → controller reads the shots → one link http://localhost:5173.

## Decisions
| # | Topic | State |
|---|---|---|
| D1 | Route number | DECIDED b: number printed on the carton + piece "Đọc mã"; preview of card + carton shown before porting |
| D2 | Menu while building | DECIDED a: second entry "Xưởng phân loại kiện hàng (đang dựng: sàn lưới)"; station sample stays until wave 3 |
| D3 | Card of "Điều độ ô" | open (needs the traffic spike + a preview) |
| D4 | Cage content | DECIDED b: REAL cartons stay as bodies in a movable roll cage (planner had recommended the drawn pile) |
| D5 | Looks to preview | open: cage, lamp, hole cover, truck, dock door, deck look (grating / rail), warehouse density |

## Rollback
Each agent branch lands as one merge commit → `git revert -m 1 <merge>`. New kinds are used by no old board. The new sample is its own menu entry → remove one line in src/io/samples.ts. Agent P's physics rules are the only change to shipped behaviour: they land alone, with their named baseline entries in the same merge, so one revert restores both.
