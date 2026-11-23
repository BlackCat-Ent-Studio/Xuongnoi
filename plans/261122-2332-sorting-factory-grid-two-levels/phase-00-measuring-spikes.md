# Wave 0: measuring spikes (running, never merged)

## Context
- Worktrees: `../GameBuilder-spike-deck` (branch spike/deck), `../GameBuilder-spike-grid` (branch spike/grid), both at 0d273e9.
- Reports expected: `../reports/researcher-261122-2345-deck-two-levels-spike-report.md`, `../reports/researcher-261122-2345-grid-traffic-spike-report.md`.
- Rule: numbers only. No code of a spike moves into main; a spike's prototype rule is re-built as a general piece in wave 1.

## Questions each spike must answer (if the report lacks one, ask the same agent, do not guess)
### Spike A: raised deck / two levels
| # | Question | Feeds |
|---|---|---|
| A1 | Does a traction chassis ("Vật lý thật" on) stand and drive on a raised solid `block` slab (top at 2-3 m): sink, slip, speed vs ground? | `raised-deck` = plain blocks or needs world work |
| A2 | Smallest slab gap a chassis crosses without tipping; widest hole a 0.32 m carton falls through cleanly | cell pitch, hole size |
| A3 | Carton tipped from a side-dump tray at a hole edge: falls through, how far it scatters below, bounces out? | hole size, cage mouth, funnel needed or not |
| A4 | Carton landing on a body below (open box): rests, counted, moves with the body when the body moves? | `container`: drawn pile (D4) vs real pile |
| A5 | Chassis driving UNDER a slab or under a raised body (headroom): any contact / weighing error? | tug under the deck, under-ride cage clearance |
| A6 | Arm base + belt of "Trạm nạp" standing on a slab: works unchanged? | stations on the deck edge |
| A7 | ms per tick: deck of N slabs + 6 chassis + 20 cartons | perf budget |
| A8 | Engine work needed, in days, by file | gate G1 |

### Spike B: 6 robots on the 3x3-hole one-way grid
| # | Question | Feeds |
|---|---|---|
| B1 | Prototype routing rule that worked: inputs, outputs, state (per robot or central?) | ports of `grid-route`, `grid-traffic` |
| B2 | Lane rule (which rows / columns go which way), grid size (cells), cell pitch vs chassis 1.2 x 1 m | params `cols`, `rows`, `lanes` |
| B3 | 900 s run: jams, longest standstill, nearest gap (mm), touches | acceptance numbers |
| B4 | Throughput cartons / min with 2 stations; with and without "2nd robot queued" (mock-up: 13.1 / min) | station hand-over design |
| B5 | Does give-way-to-the-right lock with 4 robots at one crossing? | need of reservation |
| B6 | ms per tick, 6 robots, max and average | perf budget |
| B7 | Marker reading at speed: is the 1 m tile crossed too fast for "Đọc mốc sàn" (nav report limit)? | tile size, speed cap |

## Decision gates
| Gate | Rule | If it fails |
|---|---|---|
| G1 two levels | A8 ≤ 2 agent-days of world work AND A1 passes or has a named fix | STOP, show the number to the user (brainstorm report, risks); fallback offer: one level, cages beside the deck edge |
| G2 traffic | B3: 0 jams in 900 s, standstill ≤ 30 s, 0 touches | fallback "painted loop" (old plan), told to the user plainly |
| G3 perf | A7 + B6 leave ≥ 5 ms of the 16.7 ms for tugs + cages | perf agent moves from wave 4 to the end of wave 1 |
| G4 pile (moved to wave 2: the user chose REAL cartons, the spike did not measure piles) | 6 cartons in a cage stay inside, at rest and carried; 154 alive: p99 ≤ 16.7 ms | show the numbers to the user with options (phase 02); never switch to a drawn pile silently |

## Spike A result (11-23, `../reports/researcher-261122-2345-deck-two-levels-spike-report.md`; robot 0.9 x 0.7 x 0.24 m, carton 0.3 x 0.22 x 0.26 m, deck top 2.6 m, slabs 0.2 m)
| # | Answer | Plan consequence |
|---|---|---|
| A1 | Drives on a raised block exactly as on the ground (path difference 1e-16; error 3 mm) | `raised-deck` = node that spawns plain blocks, 16 blocks for 3 x 3 holes; engine size S. Gate G1 PASSED |
| A1b | No wheel-contact check: a chassis with nothing under it still drives 0.73 m in the air | wheel-support rule, agent P (user: a robot on a hole must fall) |
| A2 | Holes 0.6 / 0.7 / 0.8 m: cartons through 144 / 144, robot centre line 0.55-1.0 m from the hole centre; stop ± 0.3 m along the lane still through. Chassis crosses any hole ≤ its own square (0.9 m) without sinking | hole 0.7 m; pitch still needs B2; "never falls" is what agent P changes |
| A3 | Bare ground: carton slides to 1.24-1.46 m from the hole centre, 0 / 24 under the hole. Walled cage (walls 1 m, 0.8 m inside): 24 / 24, rest within 0.28 m | catcher MUST have walls; cage inside ≥ 0.8 m, walls ≥ 1 m; no funnel needed |
| A4 | One carton per run only; piles, a movable cage and a carried cage NOT tried | first task of the cage agent in wave 2 (measure before building) |
| A5 | Robot under the deck: path difference 0, 0 ticks touching. One wrong rule: anything in the column above a chassis "rides" on it (world/robot-push.ts:54-59) | ceiling for that rule, agent P (spike patch: 2 lines, 1 m ceiling, 165 tests green) |
| A6 | Not tried (station on a slab) | still open: first check of the sample agent in wave 1 |
| A7 | ms per tick mean / p99: 6 robots ground 1.7-1.8 / 8.9-9.2; + deck 2.0 / 9.2-9.9; deck + 9 block cages + 12 robots 2.84-2.98 / 11.6-11.8, worst tick 21.7 | acceptance moved to p99 ≤ 16.7 ms; gate G3 passes on the mean, thin on p99; real piles not in these numbers |
| A8 | Deck S; marker height S; ceiling S; wheel support M | all inside wave 1 |
Also found: markers read from the wrong level (deck robot read ground markers, floor-marker.ts:49-54) → rule "nearest in height first" (a plain tolerance is NOT safe: the marker card's default y is 0.5); marker numbers are one list for both levels; paint lines read by x, z only (line-sensor.ts:94-95; not needed by this sample, left alone).
Not verified by the spike: anything on screen (camera at height, shadows, editor placement at 2.6 m), deck outer edge, long runs.

## Plan items still to revise
All A items are resolved in the phase files. B items stay marked `REVISE AFTER SPIKE` until the traffic report lands; the controller then edits the numbers in place before the wave 1 contract for agent G.
