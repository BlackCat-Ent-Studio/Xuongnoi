# L7 player builds the whole circuit, L8 archived (2026-11-03)

Branch `feat/l7-self-build` in `D:\workspace\GameBuilder-l7self`, 1 commit `22970cc` on top of `d4f408e` (feat/l7-board). Not merged. Dev port 5223 stopped; main's 5173 untouched.

## Board (what the player sees)
Visible cards: only `Nhân vật Rô-bốt chân` (ports: out `Nhân vật`, in `Đi ngang`) and `Vật thể Ô kho 1..3` (out only). Everything else is hidden scenery: floor, store mark, 6 pads, 6 crates, red store zone, 3 slot zones, 2 `and` (win plumbing), camera, win-lose. Hidden wires: slot zones -> and -> and -> win, red zone -> lose. Only editor-registered kinds (anti-forced test kept: registry cleared, level still builds and runs).

Win rule changed (hidden plumbing): "blue crate resting in EACH of the 3 slots" (3 slot-sized zones) instead of "3 blue in the store". Reason: with the old count a shortcut `slot-1 -> Đi tới.Đích` (no "Ô trống kế tiếp") won by piling crates in slot 1. Crate lane moved z 1.02 -> 1.12: a crate is then out of hand reach (1.2) when the robot first steps on a tile, so "colour -> Nhấc lên" with no "Và/Đang ở điểm" never lifts mid-walk (the one grab pulse fails and is spent). Pads/crates look the same, crates sit 0.1 further from the pad.

## Reference solution (7 pieces, 17 wires; shorter than planned 8/14)
```
 Rô-bốt.Nhân vật ──┬─> [Chạy theo tuyến].Ai          route: 6 pads, stopFor 0.5, lookAhead 0 (preset in tray)
                   ├─> [Đọc màu].Vật  (feet, want 2) ─ Đúng màu ──> [Và].A
                   ├─> [Khiêng đồ].Nhân vật          (default "2 phím riêng" mode)
                   └─> [Đi tới].Bot                  stopDistance = hand reach, no pathfind (preset)
 [Chạy theo tuyến].Đang ở điểm ──> [Và].B ; [Và].Kết quả ──> [Khiêng đồ].Nhấc lên
 [Khiêng đồ].Đang khiêng ──┬─> [Chạy theo tuyến].Dừng
                           └─> [Đi tới].Cho đi
 Ô kho 1,2,3 ──> [Ô trống kế tiếp].Ô 1,2,3 ; .Ô trống ──> [Đi tới].Đích (vật)
 [Chạy theo tuyến].Đi ngang ──> [Phép tính +].A ; [Đi tới].Đi ngang ──> .B ; .Kết quả ──> Rô-bốt.Đi ngang
 [Đi tới].Đã tới ──> [Khiêng đồ].Thả
```
Shorter than the brief because: carry in "separate" mode ignores a grab while holding, so no `Đảo ngược` and no 2nd `Và`; route `moveY` is not needed (robot stays on z=0), so no `Đi dọc` wire and robot only shows `Đi ngang`; faceAtStop preset dropped (it needs moveY; the grab itself turns the robot to the crate). Behaviour kept: stops 0.5 s at every pad (red too), grabs only on arrival at a pad (robot already stopped, step 0), straight to first free slot, crate centred (<0.1), drop, continues skipping emptied pads, red crate in store loses.

Win time of reference: **17.6 s** (limit 60). Also won through the real UI in Playwright: 3 stars, goes to the ending.

## Tray / par / hints
Tray (8 pieces): Chạy theo tuyến x1 (preset), Đọc màu x1 (feet, want starts 1=red, editable), Và x1, Khiêng đồ x1, Đi tới x1 (preset), Ô trống kế tiếp x1, Phép tính x1 (+), decoy **Đảo ngược x1**. par = 7, freeHints = 7 (was 3), timeLimit 60, star rule unchanged. Task + hint rewritten (simple Vietnamese, say the player builds the whole circuit).

## Guide
`phan-loai-mau` added to LEVEL_INTRO (mandatory first-visit full guide, marked seen on first win, replay button after), WIN_LINES, KIND_PURPOSE for route-follow / carry / next-free-slot / math, 17 hand-written WIRE_LINES (3-16 words each). Steps come from `level.solution`: 7 pieces + 1 param (Màu cần tìm = 2) + 17 wires.

## Level 8 archived
`levels/level-08.ts` -> `levels/archive/level-xuong-tong-hop.ts` (git rename, imports fixed), removed from index. L8 tests moved to `tests/puzzle/archive-xuong-tong-hop.test.ts` (wins, empty not win, 5 behaviour tests kept). Old saves with `xuong-tong-hop` stars: loaded, ignored by the map, 7 stops, totals 21 max; `#/level/xuong-tong-hop` falls back to the map (existing route code); winning L7 leads to ending (`allSolved` over 7 levels; verified in browser, URL `#/end`, "9/21 sao" with earlier 1-star saves). `PUZZLE_LOOKS` unchanged (those are character looks, still used by archived L8 and the editor).

slot-patrol: now used ONLY by the archived L8 (`slotBrainParams` + kind `slot-patrol`). Left in place. L5 still uses `fetch-store` (which imports `parkingSpot` from `slot-patrol.ts`) and `slotBrainParams` from `store-slots.ts`, so the file cannot be deleted without moving `parkingSpot`.

## Tests (all in app/)
- `npx tsc --noEmit -p .` clean.
- Full `npx vitest run --testTimeout 120000`: **140 files, 2315 tests, all pass** (physics-invariants green for all 7 levels).
- level-7: wins <36 s; empty = timeout; each wire removed fails (17); each piece removed fails (7); want=1 loses (message mentions red); want=3 timeout; tray = solution + 1 `not`, par 7, hints 7; stars 3/3/2/1; crates piled in one slot do not win; saved-progress/ending tests.
- stop-grab: 3 grabs, robot stopped (step < 0.01) within 0.3 of a pad, crate within hand reach, no crate jump; colour-only wiring never lifts mid-walk and never wins; never farther from store after grab; stops at all 6 pads with only the walk wired; faces crate at the grab; ~0.5 s stop.
- decoy (`level-7-decoy.test.ts`, ~85 s): for each solution piece removed (7) + the spare `Đảo ngược`, every single extra wire the real `canConnect` accepts on a free input, plus every (wire into spare, wire out of spare) pair: ~440 runs of 25 s, none wins. Also "single extra wire without the spare" is covered (candidates include all non-spare wires).
- board-pieces: hidden set = scenery list, visible = robot + 3 slots, no robot logic in base, shown ports = player's wires, cards left and non-overlapping, kinds all editor-registered.
- guide-script: steps cover every solution piece/wire, guided = levels 1, 5, 7, level 7 follows step by step to a real win; hint-rules updated (7 forced guide, freeHints 7).
- CRLF kept (`git diff --stat` vs `-w` differ by 1 line, pre-existing).

## Visual (Playwright `plans/browser-scripts/l7-self-build-shots.mjs`, shots in `plans/reports/shots-l7-self/`)
Read: `empty-desktop/phone`, `guide-start/mid-desktop/phone`, `built-desktop/phone` (solution built through real tray taps + port taps, 17/17 wires, colour set to 2 via the popover), `run-*.jpg` (stage in focus only), `win-card-phone`, `ending-phone`, `map-7-levels`. Desktop clean. Phone 844x390: empty board puts slot 2/3 in a second column (auto-layout), built board is crowded (cards shrink, wires cross text) but every card/port is visible and tappable; no page errors, no physics-watch warnings. Guide bubble covers the left cards on the intro step (same as levels 1/5).

## Not verified / concerns
- **Shortcut I could not close:** nothing found with <=2 extra wires, but a human may find other cheaper circuits; search was bounded (see decoy test), not exhaustive.
- Grab lands in the same tick the robot arrives (within 0.2 of pad centre); it relies on crate lane 1.12 vs reach 1.2 (margin ~0.03 at rest). Changing crate lane, GRAB_REACH or arriveRadius needs the stop-grab test rerun.
- Route loops after the last pad; a wrong circuit simply runs to the 60 s timeout.
- `Màu cần tìm` is a number 1/2/3 the player must set to 2 (guide step says so; hint text names it).
- Phone layout crowded (see above); other sizes not checked. Real touch, GPU speed, human playtest not done. Mascot lines only read, not heard.
- HANDOFF.md not edited here (avoid merge conflict with main); §4 item 10 text "8 levels" and §00 should be updated at merge: 7 levels, L7 self-built, L8 archived.
- Running the decoy test adds ~85 s to the full suite (total 287 s).

Status: DONE_WITH_CONCERNS
Summary: L7 now shows only the robot and 3 slot marks; the player builds a 7-piece, 17-wire circuit (wins in 17.6 s, par 7, freeHints 7, tray + `Đảo ngược` decoy) with a mandatory full guide; L8 is archived and L7 leads to the ending. tsc clean, full suite 2315 tests pass, screenshots read.
Concerns/Blockers: win rule now needs a blue crate in each slot and crate lane moved to z 1.12 (to close two cheaper shortcuts) - please confirm; phone layout crowded when built; decoy proof is a bounded search; HANDOFF.md not updated.
