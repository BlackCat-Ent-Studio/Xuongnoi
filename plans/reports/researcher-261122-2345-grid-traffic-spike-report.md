# Grid floor traffic spike: can 6 robots run layout A on the engine as it is?

Date 2026-11-23 · worktree `D:\workspace\GameBuilder-spike-grid` · branch `spike/grid` (base main 0d273e9) · MEASURING SPIKE, never to be merged.
All code is under `app/tests/spike-grid/`; nothing under `app/src/` was touched. Raw numbers of every run: `app/tests/spike-grid/spike-log.txt` (committed on the branch as evidence; some runs appear twice because files were re-run).

## Short answer

- **Existing pieces alone: no.** One robot can follow a route typed into a table, but nothing existing can decide the next cell on the one-way grid, and right of way from "Dò phía trước" alone locks up from 4 robots on.
- **With two new GENERAL pieces (prototyped here): yes, with margin.** "Tìm đường trên lưới" + "Giữ ô": 6 robots, 900 s, 12.5 deliveries/min, 0 standstills of the whole floor, smallest gap between two chassis 369 mm, never off the lane, same result on every seed tried (5 seeds). 8 robots also ran clean (5 seeds).
- **Head-on is impossible by construction** on this lane layout; a full lock needs 8 robots filling one ring of 8 cells, so with 6 (or 7) it cannot happen. Shown both by argument and by test.
- Smallest cell: 1.05 m still ran, 1.00 m locked. Keep 1.4 m (or not below 1.2 m).

## Set-up of every run (so the numbers can be read)

- Headless vitest, `settings.realPhysics: true`, 60 ticks/s, one flat floor, 7 x 7 cells, holes = plain no-go cells at (odd row, odd col) with nothing solid in them, a "Mốc sàn" (size = cell) on each of the 40 lane cells, number = row x 7 + col + 1. Stations at cells (1,0) and (5,0). Lane directions exactly as the mock-up (`tests/showcase/factory-mockup.ts:101-106`).
- Robot = EXISTING `robot-body` 0.9 x 0.7 x 0.3 m, 5 kg, friction 0.8 + 2 x `motor` (defaults) + `robot-goto`. Size 0.9 x 0.7 is the `agv` figure size of the mock-up and of `tests/showcase/factory-showcase-board.ts:38`. (The older "AGV" sample `src/samples/agv-board.ts:67` uses 1.2 x 1.0 m; not used here.)
- Cartons, arms, trays, tipping are NOT simulated. A test-only stand-in node `x-spike-jobs` plays them: calls a robot to the nearer station (2 robots per station at most, others drift to a random lane cell, as the mock-up does), holds it 1.85 s there, gives a seeded random hole 1-9, robot drives to the lane cell above or below the hole, stands 1.5 s ("tipping"), counts one delivery. This stand-in is NOT a proposed piece.
- "Drive" = settings of "Đi tới điểm": default (power 0.6, slow-down 1 m), tuned (power 0.8, slow-down 0.6 m), fast (power 1, slow-down 0.5 m).
- Machine: 16 logical CPUs, 8-11 GB free RAM; a sibling agent and up to two more of my own vitest runs were working at the same time for most rows. Only the row "A2 tuned" was run with nothing else of mine running. ms/tick is engine + node graph only, no drawing.

## 1. Existing pieces only: where they stop

Test `tests/spike-grid/pieces-only.test.ts`. Wiring tried (all existing): "Bộ đếm" stepped by "Khi tới nơi" -> "chia lấy dư" -> + 1 -> "Bảng giá trị" (marker numbers of the route) -> "Tìm mốc sàn" -> "Đích" of "Đi tới điểm". Route = the 8 cells round hole 1.

| Route typed in | Drive | s per cell | Average speed | Worst stop error | Worst angle at a stop | Off lane max |
|---|---|---|---|---|---|---|
| every cell | default | 3.20 | 0.44 m/s | 23 mm | 3.7 deg | 45 mm |
| every cell | tuned | 2.07 | 0.68 m/s | 23 mm | 6.9 deg | 52 mm |
| every cell | fast | 1.67 | 0.84 m/s | 23 mm | 11.2 deg | 54 mm |
| every cell | power 1, slow 0.3, tolerance 0.3 | 1.15 | 1.21 m/s | 61 mm | 12.9 deg | **184 mm** |
| corners only (4 rows) | default | 2.35 | 0.59 m/s | 23 mm | 1.5 deg | 48 mm |
| corners only | tuned | 1.58 | 0.89 m/s | 23 mm | 2.0 deg | 56 mm |

No chassis corner was over the hole opening (0.94 m) in any of them.

Gap list (each is a thing existing pieces cannot do, not a tuning problem):

| # | Need | What exists | Where it stops |
|---|---|---|---|
| G1 | **Routing decision** (next cell from "where am I" + "where to") | "Bảng giá trị" (12 rows max, `src/nodes/value-table.ts:4`), "Chọn theo số" | A next-cell table needs 40 lane cells x 14 goal cells = **560 typed numbers per robot** (test "routing with tables only"), in tables of 12 rows. A fixed typed route works for 1 robot only (above). No existing piece knows lane directions. |
| G2 | **Cell reservation / right of way** | "Dò phía trước" x 2 + Hoặc + Đảo ngược (the wiring of `tests/world/robot-right-of-way.test.ts`) | Works for 2 robots; locks at 4, 6, 8 (section 3, rows B). Cause measured in `eyes-diagnose.test.ts`: the eyes turn with the nose, so a robot turning on the spot sees a neighbour and freezes half-turned (headings -45, 37, 147 deg in the log); after ignoring the eyes while turning, robots still yield to each other in a ring (5 robots round hole 1). Sensing cannot tell "that robot wants my cell" from "that robot is just standing there". |
| G3 | **Waiting** | "Chạy" input of "Đi tới điểm" | Enough. Nothing missing. |
| G4 | **Turning on the spot** | "Đi tới điểm" turns on the spot from 45 deg heading error | Enough at 1.4 m cells (section 6). Nothing missing. Note it starts to drive at 45 deg, so the middle swings up to ~0.2 m while it finishes the turn. |
| G5 | **Stopping accuracy at cell middles** | "Đi tới điểm" | Enough: 21-23 mm at every stop in every run, every robot count. Angle at the stop is the approach angle: 3.5-4 deg default, up to 7.8 deg tuned, 11.4 deg fast. For tipping, use the existing "Hướng khi tới" or the slower drive. |
| G6 | **Not stopping at every cell** | none | "Đi tới điểm" slows to a stop at each target. With a target per cell that costs 25-35 % of the speed (table above: every cell vs corners only). Solved inside the "Giữ ô" prototype (setting "flow"), no change to "Đi tới điểm" needed. |
| G7 | **"Đã tới" is one tick old when the target changes** | "Đã tới" | Trap for learners, not a missing piece: my first stand-in used "Đã tới AND cell = goal" and robots "arrived" one cell early (first smoke run: stop error 1408 mm). The prototype pieces therefore check the robot's real place themselves. |

## 2. Prototype pieces (EXPERIMENTAL, `tests/spike-grid/experimental-nodes.ts`)

| Kind | Role | Status |
|---|---|---|
| `x-grid-route` "Tìm đường trên lưới" | in: Ô đang đứng, Ô đích, Tránh ô đang bị giữ, Robot · out: Ô kế tiếp, Còn phải đi, Số ô còn lại, Đi thẳng tiếp · settings: rows, cols, detour rule. Breadth-first on the one-way lanes. | prototype, candidate piece |
| `x-cell-hold` "Giữ ô" | in: Robot, Ô muốn tới, Xin ô · out: Ô được đi, Mốc được đi, Đang chờ ô · settings: "đứng giữa ô khi còn cách" 0.06 m, "flow". One table per run shared by all its cards. | prototype, candidate piece |
| `x-spike-jobs` | stations / routes / tipping stand-in | test only, not a candidate |

Right-of-way approaches compared:

- **A1 "Giữ ô", ask after stopping** (`approach: 'hold'`): the robot stops on every cell middle, then asks for the next cell.
- **A2 "Giữ ô", ask early when going straight** (`'hold-flow'`): same piece with "flow" on: a robot going straight on gets the next cell as soon as its middle is inside the cell it drives to, so it does not slow down; before a turn it still stops on the middle.
- **B sensing only** (`'eyes-turn'`): "Tìm đường trên lưới" + EXISTING pieces for right of way: "Nhớ số" holds the cell being driven to, a front eye (0.8 m) and a right-hand eye (the cell ahead-right) switch "Chạy" off, eyes ignored while the heading error is above 20 deg. (`'eyes'` = the same without that last rule: worse.)

Rule of "Giữ ô" as built: a robot holds every cell its body lies on, plus the one cell it was last cleared for. It gets the cell it asks for when no other robot holds it; who is evaluated first on a tick wins a tie. It may only leave for a new cell from the middle of its current one (or, with "flow", straight on from inside it).

## 3. Runs: 2 / 4 / 6 / 8 robots, 900 simulated seconds, cell 1.4 m, seed 20261122

Test `tests/spike-grid/traffic-900.test.ts` (log lines `RUN900 ...`). "Deadlock" = no robot at all moved 5 cm or turned 5 deg for 20 s. "Longest standstill" includes the 1.85 s / 1.5 s working stops. In every row below: chassis middle in a hole cell 0 ticks, chassis corner over a hole opening 0 ticks, stop error mean 21-22 mm / max 23 mm.

| Circuit, drive | Robots | Deliveries/min | Longest standstill | Deadlocks | Smallest gap | Off lane max | Stop angle max | ms/tick mean / p95 / max |
|---|---|---|---|---|---|---|---|---|
| **A2 hold-flow, tuned** | 2 | 5.00 | 2.2 s | 0 | 380 mm | 54 mm | 7.0 deg | 0.21 / 0.29 / 64 |
| | 4 | 9.53 | 6.8 s | 0 | 372 mm | 65 mm | 7.7 deg | 0.36 / 0.45 / 4.6 |
| | **6** | **12.53** | **10.7 s** | **0** | **369 mm** | 62 mm | 7.6 deg | 0.56 / 0.70 / 4.8 |
| | 8 | 13.53 | 11.1 s | 0 | 367 mm | 65 mm | 7.7 deg | 0.83 / 1.11 / 7.0 |
| A2 hold-flow, fast | 2 | 6.13 | 2.2 s | 0 | 363 mm | 59 mm | 8.5 deg | 0.39 / 0.54 / 78 |
| | 4 | 11.60 | 4.0 s | 0 | 353 mm | 59 mm | 8.7 deg | 0.72 / 1.29 / 8.0 |
| | 6 | 15.40 | 6.4 s | 0 | 350 mm | 60 mm | 11.4 deg | 1.19 / 2.03 / 9.3 |
| | 8 | 17.00 | 8.9 s | 0 | 329 mm | 61 mm | 11.6 deg | 1.53 / 2.63 / 18 |
| A2 hold-flow, default | 2 | 3.47 | 2.6 s | 0 | 402 mm | 41 mm | 3.5 deg | 0.22 / 0.31 / 71 |
| | 4 | 6.53 | 8.3 s | 0 | 401 mm | 41 mm | 3.5 deg | 0.39 / 0.51 / 4.1 |
| | 6 | 9.00 | 6.9 s | 0 | 382 mm | 49 mm | 4.0 deg | 0.62 / 0.80 / 4.6 |
| | 8 | 9.53 | 10.1 s | 0 | 376 mm | 57 mm | 4.1 deg | 1.44 / 2.17 / 15 |
| A1 hold, tuned | 2 | 4.20 | 2.3 s | 0 | 421 mm | 47 mm | 6.6 deg | 0.21 / 0.27 / 69 |
| | 4 | 7.93 | 3.9 s | 0 | 373 mm | 59 mm | 7.3 deg | 0.44 / 0.84 / 6.3 |
| | 6 | 10.80 | 8.2 s | 0 | 370 mm | 53 mm | 6.8 deg | 0.67 / 1.10 / 5.6 |
| | 8 | 11.47 | 7.9 s | 0 | 369 mm | 65 mm | 7.4 deg | 0.88 / 1.19 / 5.7 |
| B eyes-turn, default | 2 | 2.53 | 5.8 s | 0 | 1141 mm | 46 mm | 3.8 deg | 0.34 / 0.50 / 74 |
| | 4 | 1.40 | 616 s | **1, never resolved** (from 315 s) | 133 mm | 46 mm | 3.8 deg | 0.51 / 0.79 / 6.8 |
| | 6 | 0.60 | 815 s | **1, never resolved** (from 255 s) | 60 mm | 46 mm | 3.8 deg | 0.60 / 1.06 / 4.1 |
| | 8 | 0.93 | 736 s | **1, never resolved** (from 288 s) | **0 mm, touching on 6 ticks** | 46 mm | 3.8 deg | 0.75 / 1.25 / 9.4 |

The single ms max of 60-80 in the first run of each file is the first tick after start-up (physics module warm-up), not traffic.

More seeds, A2 tuned, 900 s (log lines `SEED900 ...`):

| Robots | Seed | Deliveries/min | Longest standstill | Deadlocks | Smallest gap |
|---|---|---|---|---|---|
| 6 | 1 / 2 / 3 / 4 | 12.93 / 12.47 / 12.13 / 12.87 | 4.8 / 6.8 / 6.3 / 7.4 s | 0 / 0 / 0 / 0 | 369 / 371 / 371 / 369 mm |
| 8 | 1 / 2 / 3 / 4 | 13.93 / 14.47 / 13.80 / 14.00 | 7.4 / 10.6 / 6.0 / 10.5 s | 0 / 0 / 0 / 0 | 369 / 370 / 369 / 369 mm |

Reading: A2 beats A1 by about 16 % at the same drive and is as safe. 6 -> 8 robots adds only ~8 % (the floor saturates; 2 stations, 2 robots per station). The mock-up's 13.1/min is reached with the tuned drive (12.1-12.9) and passed with the fast drive (15.4), but the fast drive stops up to 11 deg askew.

## 4. Stress (6 robots, A2 tuned, 600 s; trouble starts at 200 s) — `tests/spike-grid/stress.test.ts`

Rate columns: deliveries/min before 200 s / from 200 s to 40 s after the trouble ends (300 s) / from then to 600 s.

| Case | Detour | Rates before / during / after | Longest standstill | Whole floor still >= 20 s | Stuck at the end | Smallest gap |
|---|---|---|---|---|---|---|
| no trouble | none | 12.0 / 13.5 / 13.0 | 10.7 s | 0 | no | 369 mm |
| robot 2 stays 30 s beside a hole | none | 12.0 / 12.0 / 13.4 | 30.2 s (itself) | 0 | no | 369 mm |
| robot 5 stays 30 s beside a hole | none | 12.0 / 10.2 / 12.6 | 30.2 s (itself) | 0 | no | 369 mm |
| station A silent 60 s | none | 12.0 / 7.8 / 13.0 | 62.1 s | **1 x 25 s**, ended by itself when the station fed again | no | 369 mm |
| station B silent 60 s | none | 12.0 / 5.4 / 12.8 | 61.0 s | 0 | no | 369 mm |
| station A silent + robot 2 stays | none | 12.0 / 7.8 / 12.8 | 62.1 s | 0 | no | 369 mm |
| station A silent 60 s | rule "whole way clear", after 1 s | 12.0 / 7.8 / 12.6 | 62.1 s | 1 x 25 s | no | 369 mm |
| station A silent 60 s | rule "next cell free", after 1 s | 10.8 / 6.6 / 12.2 | 56.0 s | 0 | no | 364 mm |
| station B silent 60 s | rule "next cell free", after 1 s | 10.8 / 8.4 / 12.4 | 48.5 s | 0 | no | 364 mm |
| station A silent + robot 2 stays | rule "next cell free", after 1 s | 10.8 / 6.0 / 12.0 | 56.0 s | 0 | no | 365 mm |
| no trouble | rule "next cell free", after 3 s | 12.0 / 13.5 / 13.0 | 10.7 s | 0 | no | 369 mm |
| robot 2 stays 30 s | rule "next cell free", after 3 s | 12.0 / 12.6 / 13.6 | 30.2 s (itself) | 0 | no | 369 mm |
| station A silent 60 s | rule "next cell free", after 3 s | 12.0 / 8.4 / 12.6 | 62.1 s | 0 | no | 369 mm |
| station B silent 60 s | rule "next cell free", after 3 s | 12.0 / 5.4 / 12.8 | 61.0 s | 0 | no | 369 mm |
| station A silent + robot 2 stays | rule "next cell free", after 3 s | 12.0 / 8.4 / 12.8 | 62.1 s | 0 | no | 369 mm |
| sensing only (B), any case | - | 2.4 / 0.6-1.5 / 0.0 | 515 s | 1-2 | **yes** | 60 mm |

Reading: the floor always recovers to its usual rate with "Giữ ô". A robot standing 30 s costs almost nothing (others take another lane cell by their normal route, or wait). A silent station holds its two called robots and, behind them, whoever's shortest route passes that station cell: for 25 s every robot was waiting. That is a queue, not a lock: it ended the moment the station fed. The mock-up's detour rule ("a whole way with no held cell") changed nothing measurable; the simpler rule "if the next cell is held, take the other exit" removed the whole-floor standstill. With a 1 s wait it costs ~10 % of the rate in normal running (10.8 against 12.0/min before the trouble: robots leave their shortest way too eagerly); with a 3 s wait it costs nothing in normal running and still removed the standstill. Not needed for 6 robots to recover; cheap insurance with the 3 s wait.

## 5. Determinism — `traffic-900.test.ts`, "determinism"

Hash = `stateHash` of `tests/helpers/nav-rig.ts` (position, heading, rotation of every robot, every tick), the helper of the robot-nav determinism tests (`tests/nodes/robot-goto.test.ts`, `tests/world/robot-right-of-way.test.ts`).

| Run (900 s) | Hash run 1 / run 2 | Other seed |
|---|---|---|
| A2 tuned, 6 robots | ec17f243 / ec17f243 (and the table run above: ec17f243) | a974051d |
| A2 tuned, 8 robots | 670e03fc / 670e03fc (and the table run above: 670e03fc) | f1ea08ac |
| B eyes-turn, tuned drive, 4 robots | 11a0d95 / 11a0d95 | 608f1081 |

Identical on every tick in all three. Side note from the last row: sensing only is seed-sensitive, 4 deliveries in 900 s on one seed (locked early), 88 on the next.

## 6. Turning room and smallest cell — `tests/spike-grid/turning.test.ts`

Chassis 0.9 x 0.7 m: half diagonal 0.570 m. A turns 90 deg on the spot (EXISTING pieces only), B one cell away. Smallest gap between the two outlines during the turn:

| Cell | B ahead or behind, nose to tail, standing | B beside, side on | B across | B ahead, turning at the same moment |
|---|---|---|---|---|
| 0.95 m | 0 (touch) | 0 (touch) | 30 mm | 0 (touch) |
| 1.00 m | 0 (touch) | 0 (touch) | 80 mm | 0 (touch) |
| 1.05 m | 30 mm | 30 mm | 130 mm | 0 (touch) |
| 1.10 m | 80 mm | 80 mm | 180 mm | 0 (touch) |
| 1.15 m | 130 mm | 130 mm | 230 mm | 17 mm |
| 1.20 m | 180 mm | 180 mm | 280 mm | 57 mm |
| 1.30 m | 280 mm | 280 mm | 380 mm | 136 mm |
| 1.40 m | 380 mm | 380 mm | 480 mm | 214 mm |

Matches plain geometry: cell > half length + half diagonal = 0.45 + 0.57 = **1.02 m** beside a standing neighbour, cell > 2 x 0.57 = **1.14 m** when both turn at once. In lane-width terms: a turn sweeps a circle 1.14 m across, so the lane must be at least 1.14 m wide where a robot turns.

Whole floor, 6 robots, A2 tuned, 300 s, by cell size (log lines `PITCH ...`):

| Cell | Deliveries/min | Smallest gap | Deadlocks | Corner over a 0.94 m hole |
|---|---|---|---|---|
| 1.00 m | 2.2 | **0 mm, touching 6 ticks** | 1, never resolved | 0 ticks |
| 1.05 m | 13.8 | 17 mm | 0 | 0 |
| 1.10 m | 13.4 | 65 mm | 0 | 0 |
| 1.15 m | 13.4 | 118 mm | 0 | 0 |
| 1.20 m | 13.6 | 168 mm | 0 | 0 |
| 1.30 m | 13.2 | 269 mm | 0 | 0 |
| 1.40 m | 12.4 | 369 mm | 0 | 0 |
| 1.60 m | 11.2 | 572 mm | 0 | 0 |

**Minimum cell for layout A with the 0.9 x 0.7 chassis: 1.05 m ran, but with 17 mm to spare; 1.15 m is the smallest where two neighbours may turn at once; I would not go under 1.2 m (168 mm measured, 57 mm in the worst two-turn case). The mock-up's 1.4 m leaves 369 mm.** The holes do not set the limit: the swinging corner stays 0.40 m from the lane middle on each axis, the hole edge is at 0.53 m or more. A smaller cell is slightly faster (shorter trips), not slower.

## Head-on and full lock: impossible, or only unlikely?

Facts about the lane graph, checked in `tests/spike-grid/grid-graph.test.ts` (no physics):

1. No two cells point at each other. A robot only ever asks for an exit of its own cell, so two robots can never want each other's cells. **Head-on is impossible by construction**, with either right-of-way approach, as long as robots only move along exits.
2. The shortest closed loop has **8 cells**; there are 5 such loops (round holes 1, 3, 5, 7, 9; both station cells lie on one).
3. Every lane cell reaches every other.

With "Giữ ô": a robot that stands waiting holds exactly one cell (its own; measured stop error 23 mm, chassis reach 0.57 m < half a 1.4 m cell). If nobody can move, each waits for a cell held by another waiting robot; following that chain gives a closed loop of lane cells, each holding a different standing robot. So a lock needs **at least 8 robots standing on one 8-cell loop. With 6 or 7 robots it is impossible by construction**, provided every working stop (loading, tipping, a locked hole) ends at some time. Test `tests/spike-grid/ring-fill.test.ts`: 7 robots on one loop, each sent 7 cells round it: all 7 arrive; 8 robots: 0 ever move (180 s); 8 robots with the "next cell free" detour: all 8 move. With 8 robots on the real job mix the lock never happened in 5 seeds x 900 s: for 8 it is "unlikely", not "impossible".

What this argument does NOT cover: a robot that stops for ever (broken, or a station that never feeds again). Then everything whose shortest route passes that cell queues behind it for ever unless routes go round held cells. That is a blocked road, not a traffic lock, and the "next cell free" detour handles the cases tried.

With sensing only (B) none of this holds: robots stop anywhere, not on cell middles, and wait for robots that do not want their cell. It locked with 4.

## Proposed GENERAL pieces

| Piece | Ports | Settings | Size |
|---|---|---|---|
| **"Tìm đường trên lưới"** (Grid Route, Logic) | in: "Ô đang đứng" (number), "Ô đích" (number), optional "Tránh ô bị giữ" (bool) · out: "Ô kế tiếp" (number), "Còn phải đi" (bool), "Số ô còn lại" (number) | as prototyped: rows, cols (lanes on even rows / columns, alternating, holes on odd-odd). More general and easier to teach: read the lanes from the floor itself, by giving "Mốc sàn" a setting "Chiều đi" (arrow east / south / west / north, two arrows at a crossing); then the piece has no grid settings and works for any marker layout. | **M** (+ **S** for the arrow on "Mốc sàn" and drawing it) |
| **"Giữ ô"** (Cell Lock, Logic) | in: "Robot" (object), "Ô muốn tới" (number), "Xin ô" (bool) · out: "Ô được đi" (number), "Mốc được đi" (object), "Đang chờ ô" (bool) | "Đi thẳng thì xin sớm" (yes/no), "Coi như đứng giữa ô khi còn cách" 0.06 m | **M** logic; **+S/M** to show it: a held tile should change colour, otherwise the rule is invisible. It is the first piece whose cards share one hidden table per run: needs a decision on how that is explained and how it behaves in copies of a circuit (in the spike all cards of a run share one table, which is what xN copies need). |

No change to "Đi tới điểm", "Mốc sàn" (apart from the optional arrow), "Thân robot" or the physics was needed.

What the learner wires, per robot (this is one circuit, copied x6):

```
 [Thân robot]--Đối tượng--+--> Robot  [Đi tới điểm]  Trái --> Công suất [Động cơ trái]
                          |                          Phải --> Công suất [Động cơ phải]
                          +--> Robot  [Giữ ô]
 [Khi bắt đầu]--Đã bắt đầu-+--> Chạy   [Đi tới điểm]
                           +--> Xin ô  [Giữ ô]

 (ô đích: from the station / "Nhớ số") --> Ô đích       [Tìm đường trên lưới]
 [Giữ ô]  Ô được đi   -------------------> Ô đang đứng  [Tìm đường trên lưới]
 [Tìm đường trên lưới]  Ô kế tiếp -------> Ô muốn tới   [Giữ ô]
 [Giữ ô]  Mốc được đi -------------------> Đích         [Đi tới điểm]
```

2 new cards + 5 existing per robot, 7 wires beyond chassis and motors. The loop "Giữ ô -> Tìm đường -> Giữ ô" is a feedback loop; the engine accepted it as is.

**Recommendation: "Giữ ô" with early asking (A2).** Why: only approach with 0 locks and gaps > 360 mm at 2-8 robots; robots always stand on cell middles (needed for tipping beside a hole and for the arm at the station); the no-lock argument is short; fewer cards than sensing (2 new cards and no gates per robot, against 1 new + 11 existing cards per robot: 2 eyes, "Nhớ số", "Tìm mốc sàn" and 7 logic / maths cards). A1 is the same piece with one setting off and 16 % slower: a good first lesson step.

**Can it be taught?** Yes, the rule is one sentence a pupil knows from board games and from railway blocks: "Mỗi ô chỉ một xe. Xe giữ ô mình đang đứng; muốn sang ô khác thì xin, ô trống mới được đi." It needs the held tile to light up to be seen. The routing piece is "bản đồ chỉ đường: đang ở ô này, muốn tới ô kia, bước kế tiếp là ô nào". The sensing-only rule ("nhường xe bên phải") is easier to say but fails on this floor, which is itself a good lesson page.

## Prototype code vs existing pieces (plainly)

- Existing, unchanged: `robot-body`, `motor`, `robot-goto`, `floor-marker`, `floor-marker-find`, `sample-hold`, `ahead-sensor`, `and` / `or` / `not`, `compare`, `math`, `const`, `counter`, `value-table`, `timer`, `on-start`; world, physics.
- Prototype (spike only): `x-grid-route`, `x-cell-hold` (candidates), `x-spike-jobs` (stand-in), all in `tests/spike-grid/experimental-nodes.ts`, registered by the tests only. The route piece reads the hold table directly for detours (a shortcut; a real piece would get it through a port or the world).
- Section 1 and the two-robot turning cases use existing pieces only. Section 3 rows A1 / A2 use both prototypes; rows B use the route prototype + existing pieces for right of way.

## Risks and what was NOT verified

- No carton, tray, arm, tipping or hole physics: a carton on the tray changes mass and may slide at the fast drive (the robot-nav report measured 125 mm slide at power 1.0). Deliveries/min here are traffic numbers with fixed 1.85 s / 1.5 s stops, not a promise for the sample.
- One flat floor; the mezzanine, real holes and anything below are the sibling spike's.
- "Vật lý thật" off was not run. Side view / top view not run (3D mode only, headless).
- Not run in a browser: no frame times, no drawing cost, no screenshots taken (optional item skipped). 0.56 ms/tick for 6 robots is engine + graph only, on a machine that was busy with other test runs.
- Circuits (bảng mạch) copied x6 were not used: robots were generated as flat node lists. Whether a shared table keyed by run behaves well inside copied circuits was not tried.
- Tie-break of "Giữ ô" is evaluation order (lower card first): deterministic, but one robot could in theory be passed over repeatedly. Longest standstill seen was 11.1 s in all A runs; no starvation seen, none ruled out.
- Robots of different sizes or speeds were not mixed. Only the 7 x 7 layout A with 2 stations on the west edge.
- The 20 s "deadlock" definition counts a queue behind a silent station as a deadlock (the 25 s case).
- Stop angle up to 7.8 deg (tuned) was not tested against tipping a tray sideways into a hole. Unmeasured; "Hướng khi tới" (existing) squares the robot up if it matters.
- A permission hook blocked nothing during this spike; no command was routed around a hook.

**Honest fallback if 6 robots prove unstable in the real sample:** (1) the default drive: A2 9.0/min (900 s), A1 6.0/min (300 s run `tune hold [default ...]`), stops within 4 deg, gaps 380-400 mm; (2) 4 robots: 9.5/min tuned, 6.5/min default, longest standstill under 9 s; (3) widen the cell to 1.6 m (11.2/min, 572 mm gap). Dropping "Giữ ô" for sensing is not a fallback: it fails from 4 robots.

## Unresolved questions

1. Lanes from settings (rows, cols) or from arrows on "Mốc sàn"? The second is more general and visible; it adds a setting to an existing piece.
2. May one piece's cards share a hidden table per run ("Giữ ô")? If not, the alternative is a single "Bảng giữ ô" card on the main board with every robot wired to it (like "Bộ điều phối"), which costs 2 wires per robot across circuit borders.
3. Which drive for the sample: tuned (12.5/min, stops up to 7.8 deg askew) or default (9.0/min, 4 deg)? Depends on the tray test with a carton.
4. Is the detour rule wanted for 6 robots? Measured: not needed to recover; with a 3 s wait it is free and removes the 25 s whole-floor queue behind a silent station.
