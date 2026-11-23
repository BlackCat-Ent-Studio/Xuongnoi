# L5 "Đủ ba thùng" runs on board pieces only (2026-11-03)

Branch `feat/l5-general`, worktree `D:\workspace\GameBuilder-l5gen`, 2 commits on top of `22970cc`: `16f27b0` (node, go-to option, handbook, lesson), `a3663f9` (level 5 + removals). Not merged. Dev port 5225 stopped.

## Board (what the player sees)
Locked cards (left, 3 columns, 11 cards, 23 locked wires) + player side (right):
```
 col0 (x 6)        col1 (x 184)            col2 (x 362)          | right (player)
 [Nhân vật robot]  [Tìm vật gần nhất]      [Đi tới  "fetch"]     | [Số cố định]  [Thắng/Thua]
 [Ô kho 1]          Ai Tạm nghỉ Bỏ qua 1-3  stop 1.05, settle .3  |  tray: Vùng kích hoạt,
 [Ô kho 2]         [Ô trống kế tiếp]        [Đi tới  "store"]     |        So sánh, Bộ đếm(decoy)
 [Ô kho 3]         [Phép tính + (ngang)]    stop 1.0, settle .3   |  player wires: zone.count->so sánh.A,
 [Khiêng đồ]                                [Phép tính + (dọc)]   |  Số cố định->B, Đúng->Thắng
```
Locked wires: robot.self -> finder.who, fetch.self, store.self, hands.character; slot1-3 -> next.s1-3 and finder.i1-3; finder.item -> fetch.target, finder.found -> fetch.go; next.slot -> store.target; hands.holding -> finder.pause and store.go; fetch/store moveX -> sum-x -> robot.moveX (same for moveY); fetch.arrived -> hands.grab; store.arrived -> hands.drop (carry in default "2 phím riêng" mode).
Hidden scenery only: floor, store-pad, 3 crates, camera (no wires between hidden things any more). Hidden `brain`, `hands`-less old plumbing gone. Positions of `need`/`end`, tray, par 2, freeHints 2, timeLimit 90, solution (3 wires, same targets), stars: unchanged. L5 first-visit mandatory guide still works (steps come from solution; screenshot read).

Flow: finder picks nearest loose crate not on a slot -> "fetch" walks to 1.05 from its centre (robot box 0.65 + crate 0.3 = 0.95 blocks it, hand reach 1.2), stands still 0.3 s, arrived -> grab (world.grab turns the robot toward the crate) -> holding pauses finder and switches on "store" -> walks to next free slot, stops one hand-reach (1.0) short so the crate is centred, 0.3 s still, arrived -> drop -> repeats.

## Pieces added
| Piece | Detail | Files |
|---|---|---|
| NEW node `nearest-item` "Tìm vật gần nhất" / Nearest Item (logic) | in: `who` Ai, `pause` Tạm nghỉ, `i1..i4` Bỏ qua đồ trên ô 1..4 (markers; reuses next-free-slot "taken" rule, now exported). out: `item` (go-to target), `found` Có, `distance`. param `goods` (tag text filter, empty = all). Skips hidden, carried, in-hand, held items; ties -> lower id. | `src/nodes/nearest-item.ts`, `nodes/index.ts`, `node-names.ts` |
| go-to advanced param `settle` "Đứng yên bao lâu rồi mới báo Đã tới (giây)" | default 0 = exactly old behaviour (`arrived`/`arrivedPulse` unchanged). Used 0.3 on both trips so the grab/drop happens when the robot is standing still. | `src/nodes/go-to.ts` |
| Handbook | new page nearest-item + try board; go-to page documents `settle` | `src/handbook/*` |
| Lesson | NEW small lesson `nearest-bot` "Bot tìm thùng gần nhất" (end of Bot chapter, pack E): finder + go-to, bot walks to the nearer of two crates. (tidy-bot untouched so its hash stays) | `src/tutorial/lesson-nearest-bot.ts`, `course-pack-e.ts`, `course.ts` |
| Node count | 55 -> 56 (`step-1-nodes.test.ts`), handbook input/logic 21 -> 22 | tests |

Only filter chosen: goods tag + ignore-markers (no "inside a zone" input, kept simple).

## Removals / moves
- Deleted `src/puzzle/fetch-store.ts`, `src/puzzle/puzzle-nodes.ts` (registerPuzzleNodes would be empty: removed cleanly, call sites in `levels/index.ts` and `run-level.ts` removed).
- `parkingSpot` moved to `src/puzzle/store-slots.ts` (general place).
- `slot-patrol.ts` still needed ONLY by archived L8 -> **chose local copy**: moved (git mv) to `src/puzzle/levels/archive/slot-patrol.ts`, with `slotBrainParams` + its params reader moved in; the archived level registers it on import (`registerSlotPatrol()`), so `archive-xuong-tong-hop.test.ts` still wins/plays unchanged. No active level uses it; nothing in editor registry changed.
- `store-slots.ts` lost `slotBrainParams`/`readSlotParams`; `store-slots.test.ts` brain-readback case rewritten to check the next-free-slot wiring (base or solution).

## Tests
- `npx tsc --noEmit -p .` clean.
- Focused then FULL `npx vitest run --testTimeout 120000`: 143 files, 2355 pass, 1 fail = `city-delivery-3d-sample` traffic test (took 197 s under heavy machine load from other agents); rerun alone: 27/27 pass (unrelated to this change).
- New `tests/puzzle/level-5-board-pieces.test.ts` (19): anti-forced (kinds all in `registerAllNodes()` alone, registry cleared, level builds and WINS with only editor pieces, no pad-patrol/pad-carry/slot-patrol/fetch-store), hidden set = floor/store-pad/crates/cam, visible set, no locked wire touches hidden scenery, every locked wire end is a shown port, cards left part (right edge <= 560) non-overlapping, fetch stop distance between 0.95 and reach 1.2; behaviour: reference wins < limit, grabs 3 distinct crates nearest-first (crate-2 first), robot step < 0.01 on the grab tick (no grab while moving), distance <= reach and facing dot > 0.9, each crate ends in its own slot centred < 0.1, empty = timeout, removing sw1 or sw3 fails, removing locked grab wire or next-slot wires fails.
- Existing and kept green: `level-5-scatter` (3 crates >= 3 apart, each in own slot), `store-slots` (delivered crates centred, distinct, in order), `levels-5-8` (wins, empty, par, tray, shown ports, overlap), `physics-invariants` (all 7 levels), guide-script/hint-rules, archive L8.
- New `nearest-item.test.ts` (11), `lesson-nearest-bot.test.ts` (5).
- Editor stability: 0 of the existing baseline hashes changed (go-to default `settle` 0). Added only 2 baseline entries (`lesson:nearest-bot` 70c8b34f:900, `handbook:nearest-item` d23d21a4:900) and the matching summary-snapshot additions (40 lines added, none removed).
- **Reference solution win time: 27.4 s** (limit 90).
- CRLF: `level-05.ts` and `store-slots.test.ts` kept CRLF; `git diff --stat` and `-w` equal.

## Visual (Playwright `plans/browser-scripts/l5-general-shots.mjs`, shots in `plans/reports/shots-l5-general/`)
Read: `board-desktop` (clean, 11 locked cards all labelled, wires many but readable, player tray at bottom-left), `board-phone` 844x390 (all cards readable, tight but fits), `guide-mid-desktop` (guide starts at the 3D intro, UI places player's zone card beside locked cards), `run-004` (robot carrying toward crate field, tilted stage), `win-card-phone` (3 stars "Gọn nhất có thể", crates in two slots visible). Built solution 3/3 wires via real taps, won in browser, no page errors or physics-watch warnings. Some run-* frames are stale from an aborted first attempt (file names with different real-times); harmless.

## Not verified / concerns
- Clutter: 11 locked cards + 23 wires is heavy (no object "select" piece exists, so the two trips need two go-to + two math sums; adding a select-object piece would cut 3 cards and 8 wires; not done, you said one new node).
- Wire `sw2` (Số cố định -> So sánh B) removed: level is won at once (unwired B = 0 so "A >= B" is true). Pre-existing level design (not run on old code, by reading compare), so "each solution wire removed fails" holds for sw1/sw3 only; fix would need hiding or presetting the compare, left for your call.
- Robot is exactly "still" at grab because of `settle` 0.3 s; changing stop distances (1.05 / 1.0), crate size or `settle` needs `level-5-board-pieces` rerun. Tie of equal distance picks lower entity id (crate-1 before crate-3 for the last two).
- Crate-1/3 trips run diagonally and cross the field; no obstacles on L5 so no pathfinding.
- Handbook go-to page, lesson and handbook only tested headless; lesson `nearest-bot` not clicked through in the browser. Phone: only 844x390 checked. Human playtest, real touch not done.
- HANDOFF.md not edited (avoid merge conflicts): §4 should note L5 now board pieces, new node, fetch-store removed, slot-patrol archived.
- Merge conflicts expected (keep both): `nodes/index.ts`, `node-names.ts`, `step-1-nodes.test.ts` count (mine 56), handbook content index/test KIND lists, `course.ts`/`course-pack-e.ts`, baseline JSON + summary snapshot.

Status: DONE_WITH_CONCERNS
Summary: L5 now runs only on editor pieces (new "Tìm vật gần nhất" + go-to settle option, reused next-free-slot/carry/math) as 11 visible locked cards; fetch-store and puzzle-nodes deleted, slot-patrol copied into the L8 archive, parkingSpot moved to store-slots. tsc clean, full suite green (one load-timeout test passes alone), reference wins in 27.4 s, hashes unchanged, screenshots read.
Concerns/Blockers: board is busy (11 cards, 23 wires); removing the "Số cần" wire still wins instantly (pre-existing); HANDOFF.md not updated.
