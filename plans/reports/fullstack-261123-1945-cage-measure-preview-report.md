# Cage "Lồng chứa": measuring step + look preview

- Worktree `D:\workspace\GameBuilder-container`, branch `feat/container-piece`, base `78c6697`, head `9759863` (2 commits). Nothing under `app/src` touched, no baseline edits, not merged / pushed.
- Status: DONE_WITH_CONCERNS. Item 2 (moving cage) is a FINDING and was stopped as told: the engine cannot move a cage of blocks with cartons in it today.
- All runs headless vitest, 3D view, "Vật lý thật" on with the crate engine, 60 ticks/s. `npx tsc --noEmit -p .` clean.

## Short answer

| Question | Answer |
|---|---|
| 6 cartons in a 0.8 m cage | Only if the carton is the 0.26 m cube. The carton the stations really make (0.32 x 0.26 x 0.28) does NOT fit reliably: 7/8 runs, one carton on the ground, pile up to 1.13 m (rim is 1.0) |
| What works | inside 0.9 m or 1.0 m, wall 1.0 m, capacity 6: 8/8 runs all inside, pile at most 0.79 m, rest at most 2.9 s |
| Moving cage | Does not work today. The cage came apart in 40 of 48 runs. One rule is missing in `src/world/platforms.ts` (below) |
| Cost | Preliminary, noisy machine. Cages + deck only: 60 and 100 pass (p99 9.3-12.3 ms), 154 fails (p99 16.8-19.2 ms). With 12 heavy tray robots on the same board: 60 is on the line, 100 and 154 fail |
| Looks | Page ready: `plans/ui-mockups/cage-lamp-cover/index.html` (double-click) |

## 1. Pile (`app/tests/perf/cage-pile.test.ts`, 8 repeatable drops per row)

Cage: five plain blocks 50 mm thick, floor top 0.40 m (0.35 m free under it), rim 1.0 m above the floor. Cartons 1 / 2 / 5 kg in turn, start at deck height 2.6 m, one per second.
- "tipped" = carried over the end of a belt at deck height at 0.93 m/s from one of two opposite sides, passing the deck underside near the cage middle (the speed and place the spike measured for a carton tipped off a tray). This is the realistic way in.
- "straight" = let go above the middle (up to 0.15 m off). It builds towers; kept as the bad case.
- "factory" = 0.32 x 0.26 x 0.28 m (`sorting-factory-stations.ts:17`). "cube" = 0.26 m (the brief).

| way in | carton | inside (m) | cartons | runs all inside | cartons inside | on the ground | runs pile below rim | highest pile (m) | longest rest (s) |
|---|---|---|---|---|---|---|---|---|---|
| tipped | cube | 0.8 | 6 | 8/8 | 48/48 | 0 | 8/8 | 0.78 | 2.1 |
| tipped | cube | 0.8 | 8 | 8/8 | 64/64 | 0 | 8/8 | 0.91 | 2.2 |
| tipped | cube | 0.8 | 12 | 7/8 | 95/96 | 0 | 2/8 | 1.30 | 2.2 |
| tipped | cube | 0.9 | 6 / 8 / 12 | 8/8 each | all | 0 | 8/8 each | 0.58 / 0.81 / 0.96 | 2.7 |
| tipped | cube | 1.0 | 6 / 8 / 12 | 8/8 each | all | 0 | 8/8 each | 0.88 / 0.88 / 0.81 | 2.7 |
| tipped | factory | 0.8 | 6 | 7/8 | 47/48 | 1 | 7/8 | 1.13 | 3.2 |
| tipped | factory | 0.8 | 8 | 4/8 | 59/64 | 1 | 2/8 | 1.37 | 2.1 |
| tipped | factory | 0.8 | 12 | 1/8 | 78/96 | 10 | 0/8 | 1.53 | 3.1 |
| tipped | factory | 0.9 | 6 | 8/8 | 48/48 | 0 | 8/8 | 0.79 | 2.2 |
| tipped | factory | 0.9 | 8 | 8/8 | 64/64 | 0 | 7/8 | 1.15 | 2.7 |
| tipped | factory | 0.9 | 12 | 5/8 | 93/96 | 1 | 0/8 | 1.28 | 2.9 |
| tipped | factory | 1.0 | 6 | 8/8 | 48/48 | 0 | 8/8 | 0.78 | 2.9 |
| tipped | factory | 1.0 | 8 | 8/8 | 64/64 | 0 | 8/8 | 0.85 | 2.8 |
| tipped | factory | 1.0 | 12 | 6/8 | 94/96 | 0 | 5/8 | 1.24 | 2.1 |
| straight | cube | 0.8 | 6 | 8/8 | 48/48 | 0 | 8/8 | 0.88 | 1.8 |
| straight | cube | 0.8 | 8 | 8/8 | 64/64 | 0 | 4/8 | 1.04 | 2.4 |
| straight | cube | 0.8 | 12 | 3/8 | 87/96 | 1 | 0/8 | 1.31 | 1.5 |
| straight | cube | 1.0 | 6 / 8 / 12 | 8/8 each | all | 0 | 8/8, 7/8, 8/8 | 0.78 / 1.04 / 0.98 | 2.3 |
| straight | factory | 0.8 | 6 | 6/8 | 46/48 | 0 | 5/8 | 1.28 | 1.3 |
| straight | factory | 0.9 | 6 | 7/8 | 47/48 | 0 | 7/8 | 1.27 | 1.6 |
| straight | factory | 1.0 | 6 | 7/8 | 47/48 | 0 | 7/8 | 1.24 | 1.6 |
| straight | factory | 1.0 | 8 | 7/8 | 63/64 | 0 | 7/8 | 1.24 | 2.0 |
| straight | factory | 1.0 | 12 | 5/8 | 91/96 | 0 | 3/8 | 1.28 | 1.8 |

- Cartons not "inside" and not on the ground lie on top of the pile above the rim (the full table printed by the test has that column).
- Through a wall or the floor: never. Deepest carton corner in the floor plate 10 mm (one tick, at impact), in a wall 5.6 mm, plates 50 mm thick. The "< 1 mm per tick" of the plan is NOT met at impact.
- Rest within 4 s after the last carton: yes in every row at one per second.
- Asserted in the test: no corner deeper than 20 mm in any run; rest within 4 s for 6 cartons; cube / 0.8 / 6 all inside and below the rim (both ways in); factory / 1.0 / 6 and 8 tipped all inside and below the rim.
- Rows "one every 0.3 s" are in the test output but are NOT a cage result for the factory carton: cartons from the two belts meet between the belt ends and jam there (my rig, 0.52 m between belt ends). Cube at 0.3 s: 47/48 inside for 0.8, 0.9 and 1.0. Two robots tipping into one hole at the same moment is therefore unverified.

### Recommendation (evidence above)

| Param | Value | Why |
|---|---|---|
| `inside` | 0.9 m (outer about 1.0 m, the mock-up cage is 0.98) or 1.0 m for margin | factory carton, tipped: 0.8 loses a carton in 1 of 8 runs and piles over the rim; 0.9 and 1.0 hold 6 in 8/8 |
| `wall` | 1.0 m | pile of 6 at most 0.79 m in 0.9 / 1.0 |
| `capacity` | 6 stays | 8 also holds in 1.0 (8/8, 0.85 m); 12 does not fit any size tried |
| floor and wall thickness | 50 mm held | no tunnelling at 2.2 m of fall |

Keeping 0.8 m needs smaller cartons (0.26 cube: 6 and 8 hold). That is a user decision (cage size or carton size).

## 2. Moving cage: FINDING, stopped (`app/tests/perf/cage-move.test.ts`)

Cage with 6 cartons (tipped in, 5 s to rest), moved 5 m along x: each tick every one of the five blocks is sent to its new place with `world.moveBlock`. Speeds 1.0 and 1.9 m/s (mock-up lane speed and tug cruise, `factory-mockup-outbound.ts:71`); "ramp" = 3.5 m/s2 up and down (mock-up braking), "at once" = full speed in one tick and dead stop. 6 runs per row, 48 in all.

| carton / inside | speed | start, stop | cage stayed whole | whole: 6/6 inside every tick | whole: floor / wall depth (mm) | whole: rest after stop (s) | cage came apart | wall left behind (m) | apart: runs that lost a carton |
|---|---|---|---|---|---|---|---|---|---|
| cube / 0.8 | 1.0 | ramp | 1 | 1/1 | 0.8 / 0.9 | 0.03 | 5 | 0.53 | 1 |
| cube / 0.8 | 1.0 | at once | 0 | - | - | - | 6 | 0.58 | 1 |
| cube / 0.8 | 1.9 | ramp | 1 | 1/1 | 0.8 / 0.9 | 0.03 | 5 | 0.70 | 1 |
| cube / 0.8 | 1.9 | at once | 0 | - | - | - | 6 | 0.57 | 0 |
| factory / 1.0 | 1.0 | ramp | 2 | 2/2 | 8.2 / 0.0 | 1.1 | 4 | 0.50 | 0 |
| factory / 1.0 | 1.0 | at once | 2 | 2/2 | 7.3 / 1.9 | 1.6 | 4 | 0.50 | 0 |
| factory / 1.0 | 1.9 | ramp | 2 | 2/2 | 8.7 / 2.2 | 0.65 | 4 | 0.60 | 0 |
| factory / 1.0 | 1.9 | at once | 0 | - | - | - | 6 | 0.58 | 0 |

What happens, exactly:
- Refusals of `moveBlock` over all 48 runs: floor plate 0, wall behind 0, wall ahead 0; the two SIDE walls (those that run along the way) thousands of ticks (per row in the test output, e.g. 965 and 698 ticks). A side wall simply stays where it was while the rest drives on; the cage opens and cartons can leave.
- First refusal is at tick 0 of the move. Measured at that tick: a carton leaning on the side wall sits 0.06 mm inside it (overlap x 0.279 m, y 0.365 m, z 0.00006 m).
- Cause, `src/world/platforms.ts`: `stepAxis` (lines 193-203) takes every rigid crate whose upright bounds reach into the moving block by more than 1e-6 m on all three axes as a crate pushed AHEAD of the block. `crushesCrate` (132-145) then places it flush against the block's face on the axis of the move, here beyond the END of the 0.8 m long side wall, i.e. inside the wall ahead, finds it squeezed there (> 20 mm into a solid) and the block refuses the step. Right for a piston head that meets a crate head-on, wrong for a wall that slides along a crate touching its side.
- Second gap: nothing tells the engine that five blocks are one body. `apart` of `moveBlockIn` only holds what a piece is bolted onto (`world.ts:865`, `boltedOnto`), so sibling walls stay crush obstacles for each other (read in code, not measured).
- What already works: carrying and pushing rigid cartons by contact (the crate engine shows a moved block as a kinematic body, `crate-engine.ts:141-144, 573-577`). In the 8 runs where no carton leaned on a side wall the cage kept its shape to 0.000 mm, 6/6 stayed inside on every tick, rest 0.03-1.6 s after the stop (target 2 s met). Floor depth up to 8.7 mm in those runs, so "< 1 mm per tick" is not met there either.
- Missing general rule for a world owner: (a) a block moving parallel to a face that a crate only touches does not push that crate (push only when the overlap is along the axis of the move, or the crate is in the swept face); (b) blocks moved as one body do not count as crush obstacles for each other.
- In the test: one test asserts what holds today (floor plate, wall behind, wall ahead never refuse; a whole cage keeps 6/6, rest within 2 s); `it.fails('the five blocks stay together in every run')` records the gap and will flip when the rule exists.
- Not done, as told: no engine patch, no workaround. Not tried: a carrier under the cage, a turn, moving along z, a cage of 0.9 m.

## 3. Cost per tick (`app/tests/perf/cage-cost.test.ts`, runs only when asked) : PRELIMINARY, NOISY MACHINE

Board: ground floor, deck at 2.6 m with 3 x 3 holes (16 blocks), 21 cages of 5 blocks (9 under the holes + 12 in three groups of four), inside 1.0 m, N factory cartons dropped in in equal shares, 12 s to rest, then 20 s timed (1200 ticks). Processor load before the run 25-28 % (other agent's suites running), an earlier attempt at 100 % load gave about double. Budget 16.7 ms.

Cages + deck only (ms per tick):

| cartons | run | mean | p50 | p99 | worst | p99 within 16.7 |
|---|---|---|---|---|---|---|
| 0 | 1 / 2 / 3 | 0.82 / 0.80 / 0.68 | 0.84 / 0.80 / 0.71 | 1.48 / 1.42 / 1.36 | 2.8 / 2.9 / 2.9 | yes |
| 60 | 1 / 2 / 3 | 5.90 / 5.32 / 6.24 | 5.65 / 5.39 / 6.27 | 10.30 / 9.34 / 10.13 | 16.1 / 18.8 / 11.5 | yes |
| 100 | 1 / 2 / 3 | 7.01 / 6.92 / 6.29 | 6.51 / 6.31 / 5.80 | 12.27 / 12.25 / 11.28 | 14.7 / 23.1 / 12.9 | yes |
| 154 | 1 / 2 / 3 | 9.53 / 11.14 / 12.66 | 9.08 / 9.27 / 14.12 | 16.83 / 19.18 / 17.79 | 22.0 / 22.5 / 22.4 | NO (3 of 3) |

Same board + 12 tray robots of `tests/perf/many-machines.ts` driving (each: tilt tray, 3 line sensors, ahead sensor, zone, own carton):

| cartons | run | mean | p50 | p99 | worst | p99 within 16.7 |
|---|---|---|---|---|---|---|
| 0 | 1 / 2 / 3 | 7.80 / 8.42 / 8.30 | 8.42 / 8.71 / 8.74 | 11.19 / 12.31 / 11.32 | 12.8 / 15.5 / 15.0 | yes |
| 60 | 1 / 2 / 3 | 11.08 / 11.04 / 10.81 | 11.99 / 12.33 / 12.13 | 17.71 / 16.08 / 16.34 | 23.9 / 18.1 / 26.7 | on the line (2 of 3 yes) |
| 100 | 1 / 2 / 3 | 16.16 / 13.82 / 10.31 | 17.02 / 14.88 / 9.76 | 22.74 / 20.03 / 18.12 | 35.7 / 31.3 / 23.0 | NO |
| 154 | 1 / 2 / 3 | 14.17 / 26.27 / 25.57 | 13.76 / 15.82 / 24.07 | 22.11 / 52.43 / 48.64 | 25.7 / 61.1 / 56.2 | NO |

Read with care:
- 154 fails even without any robot; 100 passes without robots. With the 12 tray robots 100 fails, but those robots alone cost 8 ms mean here, far above the plan's start point (2.84-2.98 mean for deck + 9 cages + 12 robots). They are not the grid sample's robots; the real gate needs the wave 1 sample, which is not in this worktree.
- Cartons in cages at 154: 150/154 (4 missed their cage while falling in). 2-6 cartons per board were still creeping (> 1 cm in the 20 s; one slid 0.46 m off a pile), so "at rest" is nearly, not fully, true.
- Where the time goes at 154 (sampling profile, `VITE_CAGE_COST_PROFILE=154`): about 55 % inside the rigid-body engine (wasm), about 25 % in the game's own contact pairs (`obbSeparation` oriented-box.ts:171-174 15 %, `touchingPairs` contact-pairs.ts:113 3 %, `obbOf`, `orientedBox`). Crates never sleep (`crate-engine.ts:193-195`).
- The decision at "154 fails, 100 passes" is the user's (plan options a / b / c). Numbers must be re-taken on a quiet machine before deciding.

## 4. Look preview

- Page: `D:\workspace\GameBuilder\plans\ui-mockups\cage-lamp-cover\index.html` + `img/` (19 pictures). Static, opens by double-click, no script. Answer format on the page: `L-b D-a N-a`.
- Pictures are real three.js renders with the game's own toon kit, lights and carton figure, from `app/tests/showcase/cage-look-preview.ts` + `.html` (dev-only, committed on the branch; nothing moved into src, no existing figure changed).
- Shots (all looked at): `D:\workspace\GameBuilder\plans\reports\shots-cage-lamp-cover\` : `page-full.png`, `page-top.png`, and the 19 single pictures.

| Option | What I saw | Rough spots |
|---|---|---|
| Lồng A (solid blue bin, yellow rim, 4 feet) | Clean, reads well | Cartons cannot be seen: 3 cartons invisible, 6 show only a sliver. No wheels, so it does not look movable |
| Lồng B (mesh roll cage, small castors) | Cartons and tape colours visible from the side, countable | Wire is thin; from far away the cage may look faint |
| Lồng C (low front 0.35 m, yellow frame, big wheels) | Most "cart-like", contents very visible | The sloped side rail cuts visually through the top cartons at 6. A low front means cartons can fall out in front: not measured; if picked, the low side must be real in physics too |
| Đèn A (3-lens stack) | Lit lens clear, the two dark lenses still readable | Small on screen from far |
| Đèn B (one dome) | Bigger colour area | Nothing rough |
| Nắp A (sliding red-white plate on rails) | Open and closed read at once | When open it lies on the deck beside the hole: that is lane floor in the grid layout |
| Nắp B (yellow-black hinged bar frame) | Open stands upright at the hole edge, closed lies over the hole | Gaps between bars are about 0.25-0.3 m: drawn as is, a small carton would pass; needs closer bars or a real solid plate under it |

- Carton piles in the pictures are placed by hand (noted on the page). Pictures are stills: no animation, not on the real game screen.

## Deviations / things to know

1. Scout hook blocked two commands: one that listed `node_modules/three/build`, and `npx vite build` (pattern "build"). Not worked around. Consequence: the page is pictures rendered through the dev server instead of a packed live 3D script.
2. Dev server ran on 5343 for the renders and was stopped (only the process on that port). Vite re-optimised dependencies on start; `node_modules` is the junction shared with the main repo, so its `.vite` cache was rewritten. If :5173 acts up, restart it.
3. Screenshots used `npx playwright@1.65.1` (downloaded to the npx cache, nothing added to the repo) with the installed Chrome.
4. The pile test takes about 6 minutes, the move test about 1.5, the cost tool about 12; all are in `tests/perf`, so the normal suite now runs the first two (about 8 minutes more). Say if they should be gated behind an env switch like `tick-cost`.

## Unverified

- Perf on a quiet machine; perf on the real wave 1 sample; drawing cost in the browser.
- Two cartons entering one cage at the same moment; cartons bigger than the factory carton; holes not centred over the cage; a real robot tray instead of the belt stand-in.
- Moving: everything beyond "five blocks sent with moveBlock" (carrier, turns, 0.9 m cage).
- Low-front cage (Lồng C) holding cartons.
- Sibling walls as crush obstacles under the bolt rule: read in code only.
- The full vitest suite was not run (no source change); only the new files and tsc.

## Unresolved questions

1. Cage inside 0.9 or 1.0 m (the stations' carton does not fit 0.8), or keep 0.8 and make the cartons 0.26 m?
2. Who adds the world rule for moved blocks and crates (side-sliding wall must not count as pushing; blocks of one body exempt from each other)? Wave 2's cage cannot move without it; a fixed cage under the hole works today.
3. At 154 cartons the tick budget fails even without robots (preliminary): option a, b or c of the plan? Re-measure on a quiet machine first?
4. Should the two long recorded runs stay in the default suite or be gated?
5. Looks: `L-? D-? N-?`.

Status: DONE_WITH_CONCERNS
Summary: Preview page and shots are ready; pile, move and cost are recorded as tests on `feat/container-piece` (head 9759863). 0.8 m does not hold six of the stations' cartons (0.9 / 1.0 does); a cage of blocks cannot be moved with cartons in it today (side walls refuse, `platforms.ts:132-145, 193-203`); 154 cartons miss the tick budget, 100 passes without robots (preliminary, noisy).
Concerns/Blockers: moving cage needs a world-owner rule before the piece can move; perf numbers need a quiet machine and the real sample; `vite build` is blocked by the scout hook, so the page is still pictures.
