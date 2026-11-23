# Wire rule, phase 1 (engine + migration + minimal level wiring) - 2026-11-03

Worktree `D:\workspace\GameBuilder-wire`, branch `feat/wire-rule`, app in `app/`. Dev port 5230 used for the browser check and stopped afterwards.

## 1. Inputs and nodes changed

| Node | Change |
|---|---|
| go-to | `Cho đi` default OFF. New outputs `Tới Đích` (`arrivedAt1`) and `Tới Đích 2` (`arrivedAt2`) = arrived while heading for goal 1 / goal 2. |
| patrol | `Hoạt động` default OFF. New output `Tuyến đi tuần` (`route`, object = the walking bot). |
| route-follow | `Bật` default OFF. New outputs `Tuyến chạy` (`route`, object) and `Đã đứng yên` (`halted`, true once `Dừng` has held the walker for 9 ticks). `stopFor` and `faceAtStop` untouched (legacy). |
| chase, fight | New input `Cho đi` (`go`), default OFF. Both did nothing-to-start before. |
| timer | `Chạy` default OFF. |
| moving-platform, rotating-platform | `Chạy` default OFF (rotating: the `Xoay` pulse still turns it, only auto-turn / spin need `Chạy`). |
| block (belt) | `Chạy băng chuyền` default OFF. |
| portal, camera | `Bật` default OFF. |
| show-text, guide-arrow, ui-button, ui-meter | `Hiện` default OFF. |
| on-start | New held output `Đã bắt đầu` (`started`, true every tick). `Vừa bắt đầu` (`fired`) is still the one-tick pulse. **Decision:** the held output was added; a pulse cannot hold a `Cho đi` high. |
| enter-exit | New inputs `Lên xe` (`enter`) and `Xuống xe` (`exit`). `Bấm` kept, flagged `legacy`. |
| hand-tool | New inputs `Cầm` (`equip`) and `Cất` (`unequip`). `Cầm / Cất` kept, flagged `legacy`. |
| block door | `hide` and `show` pulse inputs already existed (`Ẩn đi` / `Hiện lại`), so no new port was needed. `Ẩn suốt lúc bật` flagged `legacy`. |
| carry | `toggle` mode kept for editor keyboard games; test proves no puzzle level uses it. |
| sight-forecast | New inputs `Đường đi tuần` (`patrol`) and `Tuyến của Mục tiêu` (`route`). It no longer reads the guard's patrol or the target's route from hidden notes; only what is wired. The `route` wire must come from the Mục tiêu's own route piece (as the note always did). |
| types | `PortDef.legacy`, `GraphSettings.wireRule`. |

The `legacy` flag is informational only (descriptions say "cổng cũ"); the editor does not hide those ports.

## 2. Migration design (single place: `app/src/editor/graph/wire-rule-migration.ts`)

- Marker: `graph.settings.wireRule === true`. `migrateWireRule(graph, mode)` runs when it is missing; always sets the marker (otherwise a new board that deliberately leaves `Cho đi` empty would be "fixed" on its next load).
- For each node of the 15 kinds in `FORMERLY_ON_BY_DEFAULT` whose switch-on input has no wire (belt only for blocks that really are belts): add ONE `on-start` card per scope (main board, or each group that has such a node) and wire its `started` output into every such input. Wire ids `wr-start-N`. Cards are placed left of the scope's bounding box, level with its top (no overlap, checked with `estimateNodeSize`; the editor's existing `spreadOverlaps` still runs after).
- The card gets an id that sorts before every other id (`-start`), so `compileGraph` (Kahn, ties by id) evaluates it first and the order of all other nodes is unchanged. The held `started` output makes consumers see `true` from tick 0, exactly the old default.
- sight-forecast: `patrol.route -> forecast.patrol` and `route-follow.route -> forecast.route` are added when the walker's `self` comes from the same source as the forecast's `viewer` / `target`.
- Applied on every way in: `parseBoard` (files, library games, localStorage autosave, samples via `listSamples`), `editor-state.loadBoard`, lesson starting boards (`arrangeCourse`), the three handbook `build` helpers (try boards). New boards (`createEmptyBoard`) carry the marker. `setSolidBodies` now keeps the marker.
- Dropping a wire on an input that already holds a migration wire replaces it (existing editor behaviour: `connect(..., {replace:true})`).

### Proof the old boards behave identically
- `tests/editor/solid-off-unchanged.test.ts` (16 samples + all lesson start boards + all handbook try-boards, 15 s scripted play, hash of all entity state) passes with the baseline JSON unchanged (110 tests).
- The hash covers entity state, not graph structure, so the added card and wires do not enter it; nothing was re-recorded.
- The 3D city sample card sizes grew (go-to and others got more ports), so `scripts/gen-city-delivery-3d.mjs` SIZES were updated and the sample regenerated (positions only).

## 3. Audit findings

| Finding | Status |
|---|---|
| N1 carry toggle | FIXED for puzzle (L5 uses separate, test). Engine keeps `toggle` for editor games. |
| N2 go-to `go` | FIXED |
| N4 patrol `on` | FIXED |
| N6 route-follow `on` | FIXED |
| N8 stopFor | Puzzle no longer uses it (L7 redesigned, test). Param kept legacy; lesson `tidy-bot` still teaches it (editor lesson). |
| N9 faceAtStop | Kept legacy, not used by puzzle (test). |
| N13 chase, N14 fight | FIXED (`Cho đi`). Fight back-off / chase sight start are still automatic (decision 2a keeps "one action"). |
| N15 enter-exit, N16 hand-tool | FIXED in engine (split inputs, old kept legacy). Lessons and samples still use the legacy `Bấm` / `Cầm / Cất` (they still work). |
| N17 door `hiddenWhile` | Legacy-flagged; `hide`/`show` pulses already existed. L2-L4 still use `hiddenWhile` (phase 2, see below). |
| N18-N21 belt, moving, rotating platform, timer | FIXED (default off + migration). |
| N23 portal | `Bật` FIXED. Pairing by `pair` text param left. |
| N28 camera, N29 HUD widgets | FIXED (default off + migration). |
| N32 sight-forecast notes | FIXED for patrol and route. The eyes (vision-sensor note) is still read implicitly from the viewer. |
| N3, N5, N10, N11, N24, N25, E1-E14 | Left by decision (one action / consequence / physics). |
| N7 route-follow `lookAhead` auto-stop (default 2.5) | LEFT: not in the phase-1 list; it stops without a wire. Needs a decision. |
| N12 route-follow driving vehicles directly | LEFT. |
| N22 timer `repeat`, N20 `every`, N26 spawner `lifetime`, N27 death -> hide, N30, N31 | LEFT. |

## 4. Puzzle levels 1-7 (minimal)

All solutions still win; every wire removal still fails.

| Level | Change |
|---|---|
| L1 | Tray + solution: `Khi bắt đầu -> Cho đi`. Par 1 -> 2. Spare `not` -> `and` (an unwired `Đảo ngược` is a steady "bật" and could stand in for the start card). |
| L2 | + `Khi bắt đầu -> Cho đi`. Par 3 -> 4. Door still `hiddenWhile`. |
| L3 | + `Khi bắt đầu -> Bật` of the route. Par 2 -> 3. |
| L4 | `Or.out -> Cho đi` of bot B (A stands on button 1 from the start, so the same signal that holds the door sends B off). No new piece: a start piece here would let the door open from the start. Par 4 unchanged. |
| L5 | Tray + solution: `Khi bắt đầu -> Cho đi`, `Tới Đích -> Nhấc lên`, `Tới Đích 2 -> Thả`, carry mode `separate`. Locked scenery `start -> cam.Bật`. Par 4 -> 5, freeHints 7 -> 8. Spare `not` -> `or`. |
| L6 | Locked visible `Khi bắt đầu` card (+ locked wire to the guard's `Hoạt động` and to the camera). Player wires: `start -> route.Bật`, `patrol.Tuyến đi tuần -> forecast.Đường đi tuần`, `route.Tuyến chạy -> forecast.Tuyến của Mục tiêu`. 3 pieces, 11 wires. |
| L7 | `stopFor` removed. New circuit: `Khi bắt đầu -> route.Bật`, route `Tới điểm` restarts a `Hẹn giờ 0.5`, `Còn` > 0 (So sánh) `or` `Đang khiêng` -> route `Dừng`, grab = colour match AND route `Đã đứng yên`. Locked scenery `start -> cam.Bật`. Par 7 -> 11. Spare `not` -> `speed-sensor`. |
| Archive levels | Kept green: start wires added (`cau-nhap-nhay`, `xuong-tong-hop`); two archive tests now state that nothing moves unwired. |

Puzzle engine rule added: in a puzzle board `Khi bắt đầu` may only be wired to a switch-on input (`startMayJoin` in `puzzle/ui/board-state.ts`). As a free "true" it would let L2/L3 open the door from the start and skip the puzzle (the cheaper-win search found exactly that).

## 5. Tests

New: `tests/nodes/no-action-without-wire.test.ts` (all 57 kinds, three object-wiring variants, 5 s of play, spy on every world action + state diff + HUD; allow-lists: `zone` hides its own marker, `show-number`/`ui-start` are display pages; `vehicle.leader` is left empty because wiring it is the order), `tests/nodes/wire-rule-nodes.test.ts`, `tests/editor/wire-rule-migration.test.ts`, `tests/puzzle/wire-rule-levels.test.ts` (no toggle, no stopFor/faceAtStop, every switch-on input wired, removing it fails, start only enables).
Updated: node tests that relied on the old defaults now go through `tests/helpers/wire-starts.ts` (does what loading an old board does) or pass the input explicitly; lesson tests wire the new steps; handbook tests accept the extra card; level tests follow the new pieces.

Gates: `npx tsc --noEmit -p .` clean. Full `npx vitest run --testTimeout 120000` (alone): 155 files, 2610 tests, 2609 passed on the run; the one failure (city 3D sample group layout, card sizes) was fixed by updating the generator SIZES and regenerating, then `tests/io` + `tests/editor` (31 files, 539 tests, includes the hash test and the slow city sample) rerun green. No timeout-only failures. Commits on `feat/wire-rule`: 03226e0, 7bf2c98, 8b2afeb, cb470f3. CRLF files checked with `git diff --stat` vs `--stat -w`: no flips.

## 6. Lessons and handbook

- 14 lessons get an extra "Bật ... lên" step (generated from `src/tutorial/start-wire-steps.ts`, a "Khi bắt đầu" card is put on the starting board): make-bot, chase-game, tidy-bot (route + go-to), two-goals-bot, combat, route-traffic, train (route + timer), platforms-shooting (platform + timer), camera-portals (portals), ui-chest (timer + meter), health-color (meter), start-screen (button), conveyor (belt). sight-forecast lesson wires `Tuyến đi tuần` in its existing wiring step. Lessons whose starter board already holds the pieces (chores, bot-pickaxe, groups, capstone...) just show the migration card.
- Handbook: every port text for the new / changed ports updated, plus the "not wired = ..." sentences.

## 7. Browser check (port 5230, shots in `plans/reports/shots-wire-rule/`)
Guard patrol, platform bot and arena samples, lessons `chores` and `make-bot`: each shows exactly one `Khi bắt đầu` card, 0 overlapping cards, plays without console errors. Puzzle levels 1, 5, 6, 7 load without console errors. Shots were read.

## 8. Phase 2 todo
- **All levels:** guide text, `WIRE_LINES`, `hint`, `task`, par/freeHints review; the tray `Khi bắt đầu` card shows both `Vừa bắt đầu` (useless pulse) and `Đã bắt đầu`: consider showing only `started` for tray pieces.
- **L1:** intro line for the new piece, three-star count (par 2).
- **L2, L3:** move the door/gate from `hiddenWhile` to `Ẩn đi` (pulse; the latch / counter stay on so only "open" fires); hint texts still say "Ẩn suốt lúc bật".
- **L4:** the door needs an open AND a close path (`hide` from the OR, `show` from a `Đảo ngược` of it) or a redesign, because hide-only would let one touch open it for good. Hint text for B's `Cho đi`.
- **L5:** hint still says "Khiêng xong thì bật Dùng đích 2. Tới nơi thì nhấc hoặc thả"; rewrite for `Tới Đích` / `Tới Đích 2`. freeHints 8 was set only to satisfy the existing `floor(wires/2)` test.
- **L6:** the locked start card sits at the bottom of the left column (y 430); check it is visible on phone. Hint for the three new wires.
- **L7:** all texts (task, hint, guide) for the timer / stand-still circuit; consider whether 11 pieces is too many for the last level; freeHints test still expects 7.
- **Decisions needed:** route-follow `lookAhead` auto-stop (N7), vehicle driving by route-follow (N12), lessons still teach `Bấm` / `Cầm / Cất` / `stopFor`.

Status: DONE_WITH_CONCERNS
Summary: engine now has every switch-on input off until wired; old samples, lessons, handbook boards and saves migrate with one visible Khi bat dau card and stay hash-identical; levels 1-7 and their tests are green; full suite green.
Concerns: (1) L7 became an 11-piece circuit and the route piece got a new output Da dung yen; (2) a puzzle board now restricts the start card to switch-on inputs; (3) L2-L4 doors still use the legacy Ẩn suốt lúc bật; (4) N7 lookAhead auto-stop, N12 vehicle driving, lesson use of legacy inputs left; (5) worktree and branch not merged, no junction removed.
