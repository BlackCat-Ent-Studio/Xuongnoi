# Brainstorm 261117-1348 — missing pieces, wave 1

## Problem
Sample agents (11-16) worked around palette gaps. User (11-17): do ALL, no temporary patches ("vá chắc ăn", education product).

## Decisions (user: "1a 2a")
- Two waves. Wave 1 now: A1–A6, step limit, B2, B3, B5. Wave 2 later: B1 item–item collision + B4 inertia / wheel slip via a real rigid-body engine, separate design to be approved first. No formula patch for B1/B4.
- Step limit of Chuỗi bước / Chọn theo số: 6 → 12.
- A1 gets wireable inputs (mass from Số ngẫu nhiên), not only number boxes.

## Wave 1 design
| # | Change |
|---|---|
| A1 | spawner: advanced params mass (kg), mu, crushLimit (N); optional inputs "Khối lượng", "Lực chịu nén", read at spawn time |
| A2 | new kind bool→number "Đổi thành số": params valueOn 1 / valueOff 0 |
| A3 | new kind lookup "Bảng giá trị": input index (1-based), 2–12 rows, output value |
| A4 | new kind "Chênh lệch góc" (A−B wrapped to −180..180) + Phép tính op "Chia lấy dư" |
| A5 | show-text: param lines (one per line) + optional input "Dòng số" |
| A6 | sequence: optional per-step inputs "Xong bước k", level-tested for the current step only; old `next` edge input unchanged |
| 13 | sequence + select-number max 12; card shows ports up to the chosen count |
| B2 | joint / link param "Chắn vật" (default off = old boards identical); blocked → overloaded |
| B3 | gripper grabs only what lies between the fingers; old boards keep old reach behaviour |
| B5 | piston on a moving base: force limit for base motion, test + fix |

Rules for all: default-off / additive, old boards hash-identical (solid-off baseline 0 changed), general pieces with open params, no hidden code, VI + EN names, handbook page per new kind.

## Split (file ownership)
- feat/p-logic (:5281): A2, A3, A4 — 3 new kinds, node count 68 → 71.
- feat/p-seq (:5282): A6 + limit 12 (sequence.ts, select-number.ts).
- feat/p-spawn (:5283): A1 + A5 (spawner.ts, show-text.ts).
- feat/p-arm (:5284): B2, B3, B5 (joint, link, gripper, linear-actuator, world arm files).
- After merge: one agent rebuilds samples (weight-sorter, auto-arm, auto-door, robot-square) with the new pieces; report card counts before / after.

## Success
tsc clean, full vitest green on a quiet machine, baselines unchanged except named entries, shots of new cards read by me, user tries on :5173.

## Open
- 12-port card height: show the user on the real app before closing.
- Wave 2 engine choice (Rapier vs own solver): research + proposal pending.
