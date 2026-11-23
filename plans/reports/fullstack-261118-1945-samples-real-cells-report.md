# Four samples ship with "Vật lý thật" on (worktree GameBuilder-samples-cells, branch feat/samples-real-cells, commit aaa26b1)

Not merged, not pushed. Labels: [M] measured, [D] by design, [N] not verified. No change under app/src/world, app/src/nodes, app/src/engine.

## What changed (all on the boards)
`cell-board-kit.ts`: `makeBoard` got an optional 6th argument `extraSettings` (old calls unchanged). All four boards now save `settings.realPhysics: true`, gravity left at the 9.81 default. New test helper `tests/helpers/cell-run-real.ts` (`loadEngine`, `playReal`): plays a board with the options the board itself asks for plus the loaded engine.

| Sample | Params | Wires | Cards | Notes |
|---|---|---|---|---|
| weight-sorter | none (80 N, 2.3 s, 1.5 m/s kept: sorted 5 seeds x 300 s, 0 wrong, 0 on floor) | unchanged | 27 -> 27 | yellow: says the switch is on. green: tipping vs sliding with numbers (h 0.75 m, a 0.4 m: 8 kg slides at 39 N, would tip at 42 N, rod reads 39 N, 80 N = room). pink: +"41 N = rod too slow" and "mu 0.8 -> reads 42 N" |
| auto-door | none | same | same | yellow: servo reads 4 x 9.81 x 1.8 = 70.6 N m holding the bar level (120 N m available) |
| auto-arm | none | same | same | green: crates are real, ride out on the belt to the pad and can tumble there |
| robot-arm | crate x: light -0.1 -> -0.24, heavy 0.7 -> 0.61, fragile 1.5 -> 1.37 (centred on the grasp point of the taught key poses 6/2, 6/4, 4/7) | same | same | note 1: switch on, 10 N slips as the fingers close |

## Physics shown, hand vs measured [M]
- Sorter piston: needs min(mu m g, m g a / h) with a 0.4, h 0.75: 8 kg slide 39.24 N, tip 41.86 N -> reads 39.24 (test). mu 0.8: slide 62.8, tip 41.86 -> reads 41.9 [M]. Piston 41 N (1.8 N spare, a = 0.22 m/s2) pushes too slowly: heavy crates ride on to the end bin, no overload [M]; 45 N overloaded, 50 N pushed 1 of 14, 60 and 80 N sorted [M] (spare force sets push speed).
- Sorter scale: reading climbs by lever share 0 -> ... -> 1 kg as the first crate rides on, never above its mass (test).
- Door: servo peak load 70.632 N m = 4 x 9.81 x 1.8 (test, 1 decimal).
- Arm: shoulder peak 81 N m (< 140), crates tumble/stack at the pad (one lies on its side, one on top of another) [M].
- Robot-arm: 2 kg needs 2 x 0.5 x F >= 19.62 N; 10 N now slips as the fingers close; 20 N holds; pick, lift, bend elbow, release: crate falls onto the table, tilt < 10 deg, moves < 5 mm in 2 s (test).

## Measured results
- Sorter, 120 s: >= 20 crates age >= 22 s all in the right bin, none on floor, none on belt (y < 1.3), piston never overloaded, peak 39.2 N. 5 seeds x 300 s: 75 crates each, 0 wrong. Heavy-only 50 s: >= 2 in side bin, 0 in end bin.
- Door, 120 s: >= 5 rises with their falls, passes >= rises, walker step < 0.08 m/tick, y stays 0.45..0.65 (never thrown), servo never overloaded.
- Auto-arm, 120 s: 6/6 placed, 0 slips, 0 crushes, no joint overloaded, 0 lost beyond the pad.
- Robot-arm: scripted keys pick and place (new test); 28 old tests kept, 2 adjusted (below).
- Anti-forced tests of sorter (12 wires + limit + forget), door (5 wires + servo->bar), arm (every listed wire + belt stop), robot-arm (every control wire): unchanged, green on the engine.

## Existing tests adjusted (reason)
- weight-sorter: weak-piston test "works again" now uses 1.5 x need (59 N), not need + 1 N: with 1.8 N spare the rod is too slow on real crates (added as its own assertion). Test now runs 120 s on the engine.
- robot-arm-sample: crate pops 0.5 m up when grabbed (gap 1), so `picked` also requires the crate to rise > 5 cm after the grip, and the 10 N case now checks the slip at closing (not "holding, then slips on lift").
- solid-off-unchanged.test.ts: "no shipped board turns a switch on" became "exactly these four turn Vật lý thật on", and their plain-rules hash is taken with the switch removed (same machine, old rules).

## Baselines (only keys I can name)
- solid-off-baseline.json: `sample:robot-arm` f96030ac -> 3a494028 (crate x moved). The other three are unchanged (hash of the same boards with the switch taken out).
- real-physics-on-baseline.json: `sample:robot-arm` 3802e7d4 -> ce0e5bea (same reason). auto-arm and weight-sorter unchanged (b117a029, 4a79df4f); auto-door has no loose items so it was never there.
- solid-on-summary.snap.json: `sample:robot-arm` off and on hash -> 3a494028 (2 lines).
- Proof: `git diff` of the 3 files = those 4 lines only. Two fresh processes of the three guard files: 319 passed each time, identical.

## Browser [M, looked at]
Own server :5298 (stopped), `plans/browser-scripts/samples-real-cells-shots.mjs`, shots in `plans/reports/shots-samples-real-cells/`. The Properties panel shows "Vật lý thật" ticked, gravity 9.81. Door: bar up, walker on path. Arm: crate carried, placed counter, step text. Sorter: crates in both bins, piston at the belt. Robot-arm is an archived sample (not in the menu): opened through Mở file with its saved board, keys played by the script: crate gripped, lifted, released onto the table. Headless SwiftShader, the first Chạy waited for the physics chunk.

## Gaps (reported, not faked)
1. **Grabbing a crate that rests on a solid block pops it 0.5 m up.** `gripper.ts` teleports the held crate to grasp + offset every tick; `teleport.ts findFreeSpot` sees the crate's resting contact as overlapping the support block and lifts it by LIFT_STEP 0.5. [M] robot-arm: crate y 0.90 -> 1.40 on the first closing tick and held there until the shoulder lifts; auto-arm: y 1.40 for ~0.2 s at step 3, then it sags into the hand (1.06). With 10 N the crate is no longer "supported" so it slips at once (before: only on lift). Needs a world/node fix (gripper should not use portal-teleport, or findFreeSpot should accept touching). Samples work but show this jump.
2. The auto-arm has 6 pre-placed crates (not a spawner), so it is not "indefinite": after about 36 s it has placed all six and idles (it did before). A spawner would need a way to make the fragile pattern from pieces; not done.
3. robot-arm is archived (not in the menus); the menu cannot open it.
4. Tipping into a bin is not shown: a piston at any height up to the crate top needs a / h >= 0.5 = mu, so mu 0.5 crates always slide; with mu 0.8 the force reads the tip force but the crate still slides into the bin with tilt < 8 deg.

## Not verified
Real browser/phones; the arm's crate pop is visible in the browser only for ~0.2 s and I did not shoot that exact frame; handbook pages and lessons do not embed these four boards (lesson robot-arm and arm-steps have their own boards, untouched).

## Tests
`npx tsc --noEmit` clean. Focused: tests/io, tests/arm, crate-pusher-samples, lesson-robot-arm, lesson-arm-steps, course-order: 31 files, 336 passed. Guard files x2: 319 passed. Full `npx vitest run --testTimeout 300000` (waited to the end, 574 s): 233 files, 3515 tests, all passed. Working tree clean after commit aaa26b1.

## Follow-up (commit 3887644, after merging main d0a1995)

### 1. Gap 1 fixed at the root (general rule, no sample ids)
- Cause [M]: `findFreeSpot` (teleport.ts) tested the held crate's box against solids with a strict overlap; a rigid crate at rest sinks a hair into its support, so the box was "inside" the table/belt and the search lifted it by LIFT_STEP 0.5.
- Fix: only `app/src/world/teleport.ts`. For a rigid crate (`e.rigid`, so only with Vật lý thật on) the box is tested with 1 cm taken off every face (`REST_SKIN`): a resting contact is not an overlap. `gripper.ts` and `crate-engine.ts` needed no change: a parked crate's `onGround` is already computed by `restsOnSomething` (3 cm), so a held crate that rests on the table counts as supported and the grip rule decides slipping once it is lifted. Switch off: `e.rigid` is never set, same code path; off baselines untouched.
- Grip rule (documented in the card): holds a lifted crate when fingers x min(finger mu, crate mu) x force >= mass x 9.81; 2 x 0.5 x F >= 19.62 N for the 2 kg crate.
- Tests `tests/arm/gripper-resting-crate.test.ts`: crate within 1 cm (x and y) on the closing tick and 30 ticks on; 18.62 N holds at rest, slips on lift, crate back at y < 0.95; 20.62 N lifts above 1.3 m and holds. Robot-arm test restored to the physical expectation (10 N holds on the table, slips when lifted) and the "must rise 5 cm" workaround removed; auto-arm and robot-arm long runs pass.
- Other teleport-every-tick holders: piston carry (`linear-actuator.ts`) and portals go through the same `findFreeSpot`, so rigid crates are fixed there too (no new test, existing crate-pusher tests green); joint carry skips rigid crates; character carry, hand tools and vehicle cargo set positions directly (no `findFreeSpot`): not affected. [N] no dedicated resting-crate test for the piston carry and the portal.

### 2. auto-arm runs for ever (pieces only)
- Board: the 6 pre-placed crates are gone; `make-timer` (8 s, repeat) -> `maker` (Tạo đối tượng, item box 0.6, life 40 s, max 8, wireMaterial) at the far end of a shortened feed belt (x 1..13); `crate-mass` (Số cố định 2 kg) -> maker.mass; `dice` (Số ngẫu nhiên 1..3, whole, seed 1) -> `tbl-fragile` (Bảng giá trị 0, 0, 60 N) -> maker.crushLimit: a throw of 3 makes a fragile crate. Placed crates ride the out-belt to the pad and vanish when their life ends, so nothing needs a remover piece. Cards 42 - 6 crates + 5 new = 41 net 40 (timer, dice, table, const, spawner minus 6 items); wires +6. Teaching content (sequence, 3 angle tables, grip force, fragile crate) unchanged. Crates are one colour now (the spawner has one colour), notes say "thùng dễ vỡ", label unchanged, lesson arm-steps has its own board (untouched).
- Found on the way: a spawner with `wireMaterial` and an unwired mass port makes a 1 kg crate (0 = "by kind"), so the mass is wired from a Số cố định.
- 300 s on the engine [M]: 37 crates made, 35 placed (2 in flight), 8 fragile, 0 slips, 0 crushes, no overload, shoulder peak 40 N m, max 6 alive, none lost beyond the pad, none strayed, longest gap between placements < 22 s. The anti-forced list was extended (timer->spawn chain: nothing made, nothing placed; table wire: no crate has a limit); the card-id/order variant tests still place the same crates.
- Test changes with reasons: "lowering" test now reads step 2 (step 1 ends in the tick the crate arrives); the belt-stop-cut test was dropped (without the stop the gripper still catches the moving crates; the wire is listed as not essential now); short runs are 60 s (first crate arrives after about 10 s).

### Baselines changed (named)
- solid-off-baseline.json: `sample:auto-arm` d97d3862 -> a4d85f49 (board rebuilt).
- real-physics-on-baseline.json: `sample:auto-arm` 4a79df4f -> 7ec55ddb (board rebuilt); `handbook:gripper` 809af53 -> f2fc6b4e (its crate is no longer lifted 0.5 m when grabbed).
- solid-on-summary.snap.json: `sample:auto-arm` off/on hash -> a4d85f49 and its "sensor-without-contact x3" note is gone (crates arrive later than 3.6 s). Nothing else moved (git diff of the 3 files). Two fresh runs of the 3 guard files: 323 passed each.

### Browser [M, looked at]
Port 5298, stopped. Shots in `shots-samples-real-cells/`: arm-3/arm-5 (crates keep arriving, "Đã đặt" counter climbs, step text) and robot-arm-2-gripped (crate stays on the table between the closed fingers, no jump).

### Tests
tsc clean. Focused tests/world, arm, nodes, handbook, io: 115 files, 1824 passed. Full `npx vitest run --testTimeout 300000` (waited, 818 s): 234 files, 3528 tests, all passed. Card count line: the board went from 42 cards to 41 (6 items out, timer, dice, table, const, spawner in).
