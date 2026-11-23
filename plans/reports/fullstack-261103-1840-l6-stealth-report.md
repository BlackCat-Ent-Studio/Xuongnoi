# Level 6 "Lẻn qua mắt lính gác" built from board pieces (2026-11-03)

Branch `feat/l6-stealth` in `D:\workspace\GameBuilder-l6new`, 2 commits on top of `22970cc`: `34fa00a` (nodes, fan, handbook, lesson) and `580df9a` (level). Not merged. Dev port 5226 stopped.

## What the player sees (after the coordinator's rule change)
Board shows only: **Nhân vật Mèo nhỏ** (in Đi ngang/Đi dọc, out Nhân vật), **Nhân vật Lính gác** (out Nhân vật), **Đi tuần** (locked enemy brain, one card, out "Vừa tới đầu mút"; easy to move into the solution later). Hidden scenery: floor, goal tile, 3 tall crates (1.7 x 2.2 x 1.7), guard eyes (vision-sensor), `touch` + win-lose plumbing, camera.
Player builds the cat's brain: 5 pieces, 10 wires, par 5, freeHints 6, mandatory first-visit guide (LEVEL_INTRO + 10 WIRE_LINES + win line).
Tray (7): Chạy theo tuyến (preset: 5 points, leg-by-leg, 3.2 speed), Dự đoán tầm nhìn (preset: watch next leg), So sánh, Phép tính (+), Số cố định (0.5), decoys Đo khoảng cách + Đảo ngược.
```
Mèo.self -> [Chạy theo tuyến].Ai ; route.Đi ngang/Đi dọc -> Mèo
Lính gác.self -> [Dự đoán].Người nhìn ; Mèo.self -> [Dự đoán].Mục tiêu
[Dự đoán].Còn -> [So sánh].A ; [Dự đoán].Cần -> [Phép tính].A ; [Số cố định 0.5] -> [Phép tính].B
[Phép tính] -> [So sánh].B ; [So sánh] -> [Chạy theo tuyến].Chạy
```
Locked tuning (safe band): patrol lane 3.2 (z -4.1..-0.9, x 0.5), guard speed 1.3, wait 0.4, range 10, angle 90, cat 3.2. Layout found by real-engine search (crates (-3.9,1.1) (-0.1,1.4) (6.2,1.2); cover spots (-5.2,2.9) (-0.35,3.1) (7.8,2.9); start x -9.8, goal x 9.8, z 2.5; guard starts z -2.9). Covers hidden from every lane point (also for +-0.25 cat position).

## New general pieces (also in Xưởng Nối, node count 55 -> 56)
- `sight-forecast` "Dự đoán tầm nhìn": in Người nhìn, Mục tiêu; out Còn (giây) (99 = never within 12 s), An toàn, Cần (giây). Param `watch` point | leg (default point), advanced `horizon` 12. Plays the viewer's patrol (straight A-B, easing, waits) and the real vision rules (range, cone, walls via shared `segmentClear`) forward at 1/30 s; pure, mutates nothing. Careful (0 s, not safe) on tick 0 / no viewer.
- `route-follow` advanced: `legs` (Chạy từng chặng, default off), `readyFor` (get-set seconds), `slowRadius` (ease-in distance). New input **Chạy**. Waits at each point until Chạy; dash is latched; arriving with Chạy still on = chain (no get-set pause).
- Coupling without extra card ports: vision-sensor, patrol and the leg-mode route publish small "notes" (WeakMap next to the world, `nodes/sight-notes.ts`, expire after 3 ticks); the forecast reads them. So "Cần" and the leg come out of the forecast card, not out of route-follow (brief put Cần/Đang chờ/target on route-follow; moved because each extra port makes every existing route card 26 px taller and the shipped city-delivery sample overlapped).
- Vision fan (`render/vision-fan.ts`, wired in scene-view/game-view): any character with a reporting "Tầm nhìn" sensor, 3D only, yellow, red while seen, cut by crates and the floor edge. Visual change to existing boards: only those that use vision-sensor in 3D (lessons/handbook use 2D side, so none visible today). Stage: new `cover` role draws tall square solid blocks as big crates.
- Handbook page (+ try board), handbook text for route-follow additions, lesson `sight-forecast` (chapter Bot), node-names, vision-sensor tip text updated.

## Tests / gates
- `npx tsc --noEmit -p .` clean. Full `npx vitest run --testTimeout 120000`: **145 files, 2373 tests, all pass** (600 s).
- Reference solution wins in about 11.7 s (limit 60); waits at >= 1 cover and chains through >= 1; stationary in the open = 0; never in sight at a cover spot; wins for 5 other guard starts.
- Loses/never wins: empty (timeout), Đo khoảng cách at all 28 thresholds 0.5..14, "go when guard not looking right now", An toàn alone, patrol.atEnd -> Chạy, huge margin (timeout), every single wire/piece removed except the 0.5 margin (see concern 1). Loss reason checked geometrically (range, cone, no crate between). Anti-forced test: registry cleared, only editor kinds, runs.
- Forecast vs brute force (real sensor, 8 spots x 7 moments): within 0.2 s, "never" matches; node does not change the run; route-leg tests; fan tests; physics-invariants green (win/loss proofs rewritten for L6).
- Editor stability: all 104 old board hashes unchanged; 2 new entries (lesson + handbook) added to `solid-off-baseline.json` and `solid-on-summary.snap.json` (additions only).
- CRLF files kept CRLF (levels-5-8 test, game-view, scene-view).

## Visual (Playwright `plans/browser-scripts/l6-stealth-shots.mjs`, shots in `plans/reports/shots-l6-stealth/`, all read)
board-desktop/phone, guide-start/mid, built-desktop/phone (10/10 wires through real taps), win-desktop/phone run frames (guard fan yellow, cat hidden behind crate, fan sweeping the path), win-card (3 stars), decoy frames + decoy-lose. No page errors. Run frames are taken after zooming out (the shared stage camera follows the cat during a run). Red fan frame not captured (the board resets 1.7 s after a loss; red is covered by the unit test `seen` flag). SwiftShader is slow, so smoothness not watched live.

## Concerns / decisions needed
1. **The +0.5 margin is not binding.** Removing the number piece / wire (margin 0) still wins, and so does a 1-piece-less circuit `Còn >= Cần`. Evidence: about 600k random layouts + guard-start scans with real engine runs, 0 layouts where margin 0 loses (only margin-0 failed the search every time). Reason: the forecast treats any exposed point of the leg as "seen at once", and the cat only needs the far end later, so there is always more room than the cat's lost time (get-ready 0.2 s + easing); a decision only differs between 0 and 0.5 when slack is in [0, 0.5), and then the 0.5 answer stalls as well. Test documents it (the other 9 wires/4 pieces are essential). Options: (a) accept (margin is a safety habit), (b) make margin binding with a multiplier ("Cần x 1,2") which removal turns into 0, (c) bake 0.5 into the route piece and drop Phép tính/Số cố định (par 3). This reverses the brief's "each wire removed fails" for that wire only; I did not change the approved +0.5.
2. Guard turns instantly (physics facing snaps to velocity); the body turns smoothly on screen but the fan flips at once. Forecast matches the instant turn.
3. Extra ports on route-follow cards: only **Chạy** (+1). City-delivery sample pedestrian cards moved down (y step 326 -> 340) so they do not overlap; layout only, no behaviour change.
4. Forecast assumes straight A-B patrol (Tìm đường off) and static solids (movers ignored).
5. Phone board is tight but all cards/ports usable. HANDOFF.md not edited (conflicts at merge). New nodes/handbook/lesson will conflict with other agents in nodes/index.ts, node-names.ts, handbook, course files, step-1-nodes count (keep both, count 56 -> add yours).
6. Main moved on (nearest-item, go-to settle, fetch-store deleted, tray/guide layout): this branch is not rebased.

Status: DONE_WITH_CONCERNS
Summary: Level 6 runs on editor pieces only; the player builds a 5-piece, 10-wire brain (par 5, mandatory guide); new Dự đoán tầm nhìn node, leg-by-leg route and 3D vision fan; tsc clean, full suite 2373 tests pass, screenshots read.
Concerns/Blockers: the +0.5 margin can be removed and the level still wins (not binding, evidence above, needs your choice); guard turn is instant; shared sample layout nudged; branch not rebased.
