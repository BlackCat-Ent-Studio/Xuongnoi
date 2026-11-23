# go-to "Đích 2", Level 5 rebuilt, Level 7 (2026-11-03)

Branch `feat/goto-l5-l7`, worktree `D:\workspace\GameBuilder-l5l7`, 3 commits on top of `ccf3f82`: `c08110d` (go-to + lesson + handbook), `51b5a83` (level 5), `9c330e8` (sample layout + node names). Not merged. Dev port 5227 stopped.

## 1. go-to "Đích 2"
- New inputs at the END of the port list: `target2` "Đích 2 (vật)" (object), `useTarget2` "Dùng đích 2" (bool, default off). Off or unwired = old code path, so all boards behave the same (editor stability: 0 existing hashes changed; added only `lesson:two-goals-bot` 2abb091d:900 + 19 added lines in the summary snapshot, none removed).
- "Dùng đích 2" on: the goal is Đích 2; arrival, stop distance, settle, pathfind unchanged. With "Dùng đích 2" on but no Đích 2 (nothing wired, or it vanished) the bot STANDS STILL (no fall back to the fixed point). Reason: the fallback made a wrong L5 answer (a slot wire missing) carry a crate diagonally to the fixed point and drop it into the robot (physics-invariants failed).
- Ports have no "advanced" flag in the engine, so they are plain extra ports on the card (3 extra rows). Handbook go-to page documents both (ports + a tip). English names added in `node-names.ts`.
- Sample `city-delivery-3d.json`: go-to cards got taller, two groups overlapped; moved 48 nodes (fm-/mn- rows from y>=600) down 24. Positions only.
- Lesson: NEW `two-goals-bot` "Bot có hai đích" (pack E, Bot chapter): green mark = Đích, yellow mark = Đích 2, Space key = "Dùng đích 2". Test plays it through the editor API: walks green, or yellow while Space held. Unit tests (brain-nodes): Đích 2 only while on; on-but-empty stands still.

## 2. Level 5 "Đủ ba thùng"
Board (only these are drawn): `Rô-bốt chân` (in Đi ngang, Đi dọc; out Nhân vật) + `Ô kho 1..3` (out). Hidden scenery: floor, store pad, 3 crates, camera, 3 slot zones + 2 `and` + win-lose (win = a crate resting in EACH slot; no count, no compare, no const). Anything the old board had on the left is gone.

Reference solution: 4 pieces, 15 wires.
```
 Rô-bốt.Nhân vật ─┬─> [Tìm vật gần nhất].Ai
                  ├─> [Đi tới].Bot
                  └─> [Khiêng đồ].Nhân vật
 Ô kho 1,2,3 ──> [Tìm vật gần nhất].Bỏ qua đồ trên ô 1,2,3     (3 wires)
 Ô kho 1,2,3 ──> [Ô trống kế tiếp].Ô 1,2,3                      (3 wires)
 [Tìm vật gần nhất].Vật gần nhất ──> [Đi tới].Đích (vật)
 [Ô trống kế tiếp].Ô trống ──────> [Đi tới].Đích 2 (vật)
 [Khiêng đồ].Đang khiêng ────────> [Đi tới].Dùng đích 2
 [Đi tới].Đã tới ─────────────────> [Khiêng đồ].Nhấc lên  (carry in 1-key mode: grab, then drop on the next arrival)
 [Đi tới].Đi ngang / Đi dọc ──────> Rô-bốt.Đi ngang / Đi dọc
```
15 wires, not ~8: the three slot cards must feed two pieces (6 wires) and the robot needs both walk axes. Tray (5): Tìm vật gần nhất, Đi tới (preset: stop 1.0, settle 0.3, no pathfind), Ô trống kế tiếp, Khiêng đồ (preset: 1-key mode), decoy Đảo ngược. par 4, freeHints 7 (floor of 15/2), timeLimit 90, stars rule unchanged. Mandatory first-visit full guide kept (steps come from the solution): 15 hand-written WIRE_LINES, win line, `nearest-item` purpose line. Task/hint rewritten (simple Vietnamese).

Old loophole (unwired compare B read 0, instant win): gone with the compare. Test: empty answer, and the 4 pieces unwired, both time out.

Win time of reference: **27.5 s** (limit 90).

Tests (all new/rewritten, `level-5-board-pieces.test.ts`, `level-5-decoy.test.ts`):
- anti-forced: only editor kinds, registry cleared, level builds and wins; no old puzzle-only brain kinds.
- board: hidden set = 12 scenery ids, visible = robot + 3 slots, no logic pieces locked, base wires are scenery-only, shown ports, cards apart.
- behaviour: 3 grabs, crate-2 first, robot step < 0.01 on each grab tick (no grab while moving), within reach and facing, each crate centred (<0.1) in a distinct slot (run without win rule; needs the Ô kho 3 ignore wire so the robot does not re-lift crate 3).
- each wire removed fails (except `sw4` "Ô kho 3 -> Bỏ qua": the level ends the moment the third crate is down; documented in the test), each piece removed fails, no "Ô trống kế tiếp" (all to slot 1) fails.
- decoy: for each solution piece removed (4) + the spare, every single extra wire `canConnect` accepts, plus every (wire into spare + wire out of spare) pair, 35 s each: none wins. ~40 s for the file with the board tests.
- physics-invariants L5: proof rewritten (one crate per slot, centred); all answers (solution, empty, each wire removed) have no body overlap/door/grab violations.

## 3. Level 7: NOT shortened
Left as is (7 pieces, 17 wires, par 7, freeHints 7, tray + `Đảo ngược`, decoy proof unchanged and still green). I looked for a way to drop `Phép tính` / the second mover with Đích 2 and found none that keeps the behaviours:
- The sum exists because two pieces drive the robot's one `Đi ngang`: the route walk along the pads and the walk to the store. Đích 2 only switches ONE go-to between two OBJECT goals. The pads are hidden scenery (cannot be wired) and the route has no object output, so go-to cannot replace the route.
- A go-to-only L7 (finder + go-to + next slot + carry) would walk to the nearest crate; a red crate would be nearest forever (no way to skip it except the finder's tag filter "xanh"), so colour reading, stop at every pad (red too) and "grab only at a pad" disappear and L7 becomes L5 with a filter.
Options for you: (a) keep L7 as is; (b) L7 = L5 circuit + finder filter `xanh` (4-5 pieces, loses colour sensor/route lesson); (c) add a general port to route-follow or a "select" piece so one mover can serve both walks (new engine work).

## Gates
- `npx tsc --noEmit -p .` clean.
- Full `npx vitest run --testTimeout 120000` (heavy machine load, 1222 s): 2369 pass, 5 fail: 4 are timeouts under load (L7 door check 143 s, 3 city-delivery traffic/rules tests 200+ s), 1 was node-names (fixed). Rerun alone after: city-delivery all but 1 pass (that 1 = the overlap fixed in commit 3, passes), physics-invariants (all 7 levels, incl. L7 doors) pass, node-names pass; editor + nodes + handbook + tutorial + io (minus the two slow city tests) pass; solid-on summary snapshot passes.
- CRLF kept: `level-05.ts`, `levels-5-8.test.ts`, `brain-nodes.test.ts`, samples JSON.

## Visual (Playwright `plans/browser-scripts/l5-l7-short-shots.mjs`, shots in `plans/reports/shots-l5-l7-short/`)
Read: `l5-empty-desktop`, `l5-built-desktop/phone`, `l5-guide-mid-phone`, `l5-run-004` (robot carrying, crate and stage), `l5-win-card-phone` (3 stars, crates in 2 slots visible), `l7-empty-desktop`, `l7-built-phone`. Built both levels through real tray taps + port taps: L5 15/15, L7 17/17 wires, both won in the browser, no page errors or physics-watch warnings. Empty L5 shows only robot + 3 slot cards. Built L5 on phone 844x390 is readable (auto-layout moved cards; the placed go-to sits at the left). Guide bubble covers the left cards on the intro step (as in the other guided levels). Not read: the remaining `*-run-*`, `*-guide-*` desktop frames (captured, same layout).

## Not verified / concerns
- L7 not shortened (see above), needs your decision.
- L5 has 15 wires; one of them (Ô kho 3 -> Bỏ qua) is not strictly needed to win (kept so the robot never re-lifts crate 3 if the win rule is off).
- Reference timings depend on stop distance 1.0 + settle 0.3; crate size or hand reach changes need `level-5-board-pieces` rerun.
- Decoy proof is a bounded search (single extra wires and spare-in/out pairs), not exhaustive.
- Handbook go-to page and the new lesson only tested headless; not clicked in the browser. Phone: only 844x390. No human playtest, no real touch.
- Other agents' merge conflicts expected (keep both): `guide-script.ts` (KIND_PURPOSE, WIRE_LINES, WIN_LINES), `levels-5-8.test.ts`, `physics-invariants.test.ts` (L5 proof), `course.ts`/`course-pack-e.ts`, baseline JSON + summary snapshot, `node-names.ts`.
- HANDOFF.md not edited; §4 items 10/16/19 should note: go-to Đích 2, L5 player-built (4 pieces), fetch-store already gone.

Status: DONE_WITH_CONCERNS
Summary: go-to has Đích 2 / Dùng đích 2 (hashes unchanged, new lesson + handbook), L5 is now a 4-piece, 15-wire player-built level (wins 27.5 s, decoy proof, all tests green), L7 was left unchanged because Đích 2 cannot replace the route walk without losing the colour/pad behaviour.
Concerns/Blockers: L7 shortening not done (needs your choice of option a/b/c); L5 wires 15 not ~8; full suite had load timeouts that pass when rerun alone.
