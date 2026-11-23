# Wave 1 integration report

- Worktree: `D:\workspace\GameBuilder-wave1`, branch `feat/wave1-integration`
- **Final commit: `65fae6d`** (main `0d273e9` + 4 merges + 3 commits). Tree clean, not pushed. Fast-forward from main is possible.
- Dev server LEFT RUNNING on http://localhost:5340/ (answers 200).
- Status: DONE_WITH_CONCERNS (nothing red; concerns = the observations in "Found on the way" and "Not verified").

## Merge log

| # | Merge commit | Branch | Conflicts | Resolution |
|---|---|---|---|---|
| 1 | `a00431b` | feat/raised-deck (b3fa5a7) | none | - |
| 2 | `3fa4292` | feat/parcel-code (785ef48) | handbook/index.ts, nodes/index.ts, expand-placement.test.ts, solid-off-baseline.json, solid-on-summary.snap.json | keep both. Lists: both lines. `HANDBOOK`: one line with `...RAISED_DECK, ...PARCEL_CODE`. expand-placement: one list with `raised-deck.position` and `code-reader.displayAt`. Baselines: three-way union by entry name (script, no `-u`). step-1-nodes merged silently to 78 (both sides wrote 78): set to 79 by hand |
| 3 | `e6459a1` | feat/chassis-outline-support (0b04b71) | none (real-physics-on-baseline.json merged by git: its `sample:robot-avoid` line + the two new entries) | - |
| 4 | `037d6ca` | feat/grid-route (56a724f) | handbook/index.ts, nodes/index.ts, nodes/node-names.ts, tutorial/lessons.ts, solid-off-baseline.json, solid-on-summary.snap.json | keep both. node-names: `raised-deck` entry closed, then `grid-route` + `cell-hold`. lessons.ts: packs M and N side by side. Baselines: union by name. step-1-nodes: 81 |

Every conflict was additive; none needed a design choice. After each merge: `tsc --noEmit` clean, focused tests + both hash guards + snapshot guard green (merge 3: only the 3 known robot-avoid reds, as announced).
scene-view.ts: `git diff --stat` = `git diff --stat -w` = 12 + / 3 - against main (CRLF kept, no whole-file flip).

Course pack O (`course-pack-o.ts`, parcel branch) is NOT wired into lessons.ts: its own branch left it unwired on purpose (its comment says it is added once a lesson exists; it returns `[]`). M and N are wired. Left as built.

## Changes beyond the merges

| Commit | What | Why |
|---|---|---|
| `d92afe2` | applied `fullstack-261123-0010-robot-avoid-sample-test-recalibration.patch` (test file only) | user decision 1. tests/io/robot-avoid-sample.test.ts 7 / 7 |
| `023926b` | 4 new tests + a `code` option on the test's tray carton, in tests/nodes/raised-deck-physics.test.ts | cross-effect checks (below). Tests only |
| `65fae6d` | app/src/nodes/linear-actuator.ts: `pushBodiesOf` gives a chassis its turned outline (`chassisOutlineOfView`, `obbBounds` was already imported) + 1 new test in tests/world/robot-outline-sensors.test.ts | user decision 2. The new test FAILS without the line (a 5 N piston pushes the chassis freely, never "Quá tải") and passes with it. **0 shipped-board hashes moved** |

No fix between contradicting branches was needed: none contradicted.

## Final kind count

81 (test `registers 81 kinds`; app palette header reads "81 mảnh ghép, 7 nhóm"; 82 palette buttons = 81 + "Ghi chú").

## Tests on the final commit `65fae6d`

- `npx tsc --noEmit -p .`: clean.
- ONE full `npx vitest run --testTimeout 300000`: **314 files passed, 1 skipped; 4631 tests passed, 1 skipped; 0 failed.** vitest duration 689 s, wall 11 min 30 s. The two known load-only timeouts (level-7-decoy, city-delivery-3d) did NOT happen, so no rerun was needed. Machine: only light read commands of mine ran beside it.
- One flake seen ONCE in a focused run after merge 2, not in the full run: tests/handbook/spawn-text-boards "random crate mass" (needs 3 distinct masses, the world seed is `Math.random`). Measured over 300 runs: main 1 / 300 below 3, merged tree 0 / 300. Exists on main, not caused by the merges.

## Baseline entries that differ from main

| File | Entry | Old → new | Reason |
|---|---|---|---|
| real-physics-on-baseline.json | `sample:robot-avoid` | d6a7f032:900 → 600cdf09:900 | re-recorded on the physics branch (ahead beam starts at the chassis outline) |
| real-physics-on-baseline.json | + `handbook:raised-deck` 80da227:900, + `handbook:code-reader` 22490b95:900 | new | new boards |
| solid-off-baseline.json | + `handbook:code-reader` 667b373d:900, + `handbook:raised-deck` 796a39b6:900, + `handbook:grid-route` f53dff5b:900, + `handbook:cell-hold` 767b4546:900 | new | new boards |
| solid-on-summary.snap.json | + the same 4 ids | new | new boards |

Checked entry by entry against main: solid-off 147 → 151, 0 changed, 0 removed, old order kept; real-physics-on 43 → 45, 1 changed (above); snapshot 147 → 151, 0 changed. The new entries recorded on each branch alone are still valid with all four merged (the wheel-support rule did not move `handbook:raised-deck` or `handbook:code-reader`).

## Cross-effects

| Check | Result | Evidence |
|---|---|---|
| Marker "nearest in height" on the real `raised-deck` | OK | new test "a robot on the deck reads the tile on the deck, a robot under it reads the tile on the ground" (3 x 3 deck, tiles shifted so nearest-middle alone picks the wrong level). Fails on the tree before the grid merge (reads 99), passes after |
| Wheel support × grid traffic | no change at all | tests/traffic 30 / 30 on the pure grid branch 56a724f and after all merges. All 30 result lines identical except the ms/tick timings. 6 robots 900 s: **12.53 deliveries/min, hash f42282a3 before and after**; other seed f429bd61; 2 / 4 / 8 robots 5.07 / 9.73 / 13.80 per min, hashes c758fbc1 / c165343b / f8e806c5 both times. The traffic boards run with "Vật lý thật" on, so the rule was really active |
| Wheel support × raised-deck tests | pass for the right reason | the old deck tests drive lane z = 1 (chassis side 0.30 m from each hole edge: every wheel on a plate). New test: 0.9 × 0.7 m robot driven onto the 0.7 m hole of the real piece ends STUCK ASTRIDE (middle within 0.35 m of the hole centre, level with the deck, at rest 2 s, never "arrived"); same drive on the ground arrives. On the tree before the physics merge this test fails (robot crosses and arrives at 7.1 s), so it is the support rule reading the piece's real holes |
| Lane beside the hole | unaffected | new test: lane 0.75 m from the hole centre = tick for tick the ground run (worst gap < 1e-9, same arrival time) |
| Parcel code × deck | OK | new test: carton `parcel-carton#37` tipped from a tray into the hole lands on the ground with look and tag 37 kept; "Đọc mã" fed by a zone on the ground reads 37, "Có mã" on; nothing read while it is still on the tray. The carton comes to rest ~1.4 m past the hole (it slides off with speed and falls 2.6 m), so the zone is 4 × 4 m |
| Hash guards | OK | table above |
| Old boards look | render / looks tests only | tests/render/** and handbook tests green in the full run; no pixel compare against main (its server is down) |
| Piston edit × shipped boards | 0 entries moved | both hash guards + snapshot green after `65fae6d` |

## Perf (`VITE_TICK_COST="agv:1,8 tray:8"`, once, final commit)

| Board | mean ms/tick | p95 | max |
|---|---|---|---|
| agv x1 | 0.683 | 0.987 | 6.568 |
| agv x8 | 6.066 | 12.026 | 41.497 |
| tray x8 | 1.955 | 4.085 | 31.070 |

(agv x8 p99 19.2 ms; the physics agent's earlier figure was 8.3 ms mean on a loaded machine.)

## Browser (:5340, playwright-core from an earlier session scratchpad, headless chromium with swiftshader)

Shots in `plans/reports/shots-wave1-integration/`, all read by me, **no page errors**:
- `00-app-start-palette.png`: 81 pieces.
- `01-raised-deck-try-playing.png`: deck with 2 holes, robot on it, carton on the ground below.
- `02-code-reader-try-playing.png`: belt with numbered cartons, HUD "Mã đang đọc: 1, Số thùng đã đọc: 5".
- `03-cell-hold-4-robots-20s.png`: 7 × 7 floor, 4 robots, arrows and numbers 1–49, "Số ô đang bị giữ: 5".
- `04-agv-shuttle-sample-15s.png`: old sample playing ("Đang chạy theo line").

## Found on the way (not changed: outside an integration)

1. Handbook search "Đọc mã" lists "Đọc màu" first (my first shot opened the wrong page). The page itself opens fine from the card.
2. "Thử: Đọc mã" shows 1 item in "Việc cần sửa": "Chưa có mảnh ghép Nhân vật nên chưa có gì để chạy", although the board runs.
3. To a piston a robot chassis always weighs 2 kg on friction 0.5 (9.81 N to slide), whatever "Khối lượng" on the chassis card says: `world.materialOf` of a chassis does not use that setting. Same on main. So the new force limit on the corner is real but small.
4. The hook on the dependency folder blocked one listing command of mine (looking for playwright-core). Not worked around; playwright-core was taken from the earlier scratchpad recipe written in HANDOFF.md.

## Not verified

- Pixel compare of old boards against main.
- Extra try-boards (e.g. the 4-robot floor, which ships with "Vật lý thật" on) are not in the hash guards; only their own tests and one 20 s browser run cover them.
- Joints and grippers with the outline line: only the piston has a new test (they share `pushBodiesOf`; tests/actuator and tests/arm are green).
- Browser: one play of each board, default camera, no clicking inside the boards, no 2D views, no frame rate.
- The 60 / 100 / 154 carton perf gate (wave 2).

## Questions

1. Handbook search order for "Đọc mã": a) leave ⭐ for now and fix with the next handbook pass / b) fix now (exact name first).
2. "Việc cần sửa" warning on the "Đọc mã" try-board: a) hide that warning for boards without a character ⭐ (small, general) / b) leave.
3. Chassis weight seen by pistons: a) use the chassis card's "Khối lượng" and friction ⭐ (moves hashes of boards where a piston or arm pushes a robot: must be measured first) / b) leave 2 kg.
4. Course pack O: a) leave unwired until a lesson exists ⭐ / b) wire it now (returns no lesson, changes nothing).
