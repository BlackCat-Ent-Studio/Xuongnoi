# Audit: 🐢 "Từng bước" forgets WHO and WHAT in L6 / L7

Date 2026-11-05 · main b91878b · read-only (no app/ source edited; scratch tests run from `app/tests/puzzle/` then deleted).
Method: the reference `solution` of each level run through `createStepSession` with the board's rule
(shown output pin + at least one DRAWN wire), lit with `stepLight` fed exactly what the board feeds it
(drawn wires only, `isObject` = drawn card of an object kind). Scratch scripts:
`C:\Users\trong\AppData\Local\Temp\claude\a12094c0c35d488c\21dd1524-bf64-49b0-bdae-47a5b1b986a8\scratchpad\zz-audit-step.test.ts` (today) and `...\zz-audit-proto.test.ts` (prototype of the fixes).

## 1. How it works today (code)

| Piece | What it does | Where |
|---|---|---|
| Pause trigger | only a **bool** output that turns true this tick | `engine/runtime.ts:109` → `render/step-break.ts:10` |
| Pause filter (puzzle) | port must be drawn AND have a drawn wire out | `puzzle/ui/level-screen.ts:483-486`, `puzzle/ui/board-view.ts:1376` |
| Drawn wires | a wire is drawn only if BOTH its pins are shown | `puzzle/ui/board-view.ts:537-547` |
| What lights | fired card; wires from the fired pin + their target cards; other wires fired card → object; object → fired card | `puzzle/ui/step-light.ts:33-36` |
| Who is an object | drawn card of object kind (`isPickable`) | `puzzle/ui/board-view.ts:470-473, 678` |
| Editor twin | same rule + same `stepLight` (all graph wires) | `editor/step/step-run.ts:57, 66-70` |

Key limit: `stepLight` only looks **one hop from the FIRED card**. A card that is only the *target* (e.g. "Chạy theo tuyến" switched on by "So sánh") never brings its character along.

## 2. Pauses today

### L6 "Lẻn qua mắt lính gác" — only 3 pauses, 0 characters lit

Hidden wires (not drawn): `b1 guard.self→patrol.self`, `b2/b3 patrol.moveX/Y→guard.moveX/Y` (because `level-06.ts:142` guard `in: []`, `:143` patrol `in: ['on']`, out without moveX/moveY). So **on the board nothing links "Đi tuần" to "Lính gác"** — even in edit mode.

| # | Tick (s) | Fired pin | Lit cards | Lit wires | Stage glow |
|---|---|---|---|---|---|
| 1 | 0 (0.00) | Khi bắt đầu · Đã bắt đầu + So sánh · Đúng | start, s-cmp, patrol, s-route | b10, sw8, sw9 | **none** |
| 2 | 106 (1.77) | So sánh · Đúng | s-cmp, s-route | sw8 | **none** |
| 3 | 505 (8.42) | So sánh · Đúng | s-cmp, s-route | sw8 | **none** |
| end | 697 (11.63) | win | | | |

Things that happen but never pause (measured):

| Tick | Event | Why no pause |
|---|---|---|
| 0, 130, 316, 502, 688 | guard starts walking (patrol moveY ≠ 0) | number output; also wire hidden |
| 104, 290, 476, 662 | guard reaches lane end (`patrol.atEnd`) | shown but no wire |
| 12, 118, 517 | cat starts a dash (s-route moveX/Y ≠ 0) | number output |
| 105, 220, 681 | cat reaches a crate (`s-route.reached`) | not wired in solution |
| any | "Dự đoán tầm nhìn" (watches guard + cat) | its outputs are numbers / `safe` unwired → never lit |

### L7 "Phân loại thùng màu" — 38 pauses, robot lit in 31

Robot is mostly lit because its brain cards (route, eye, hands, go-to) have `robot.self` wired INTO them. Gaps:

| Pause #s | Tick | Fired | Lit | Robot? |
|---|---|---|---|---|
| 1 | 0 | Khi bắt đầu · Đã bắt đầu | s-start, s-route, s-timer | **no** |
| 2,5,9,15,19,27,31 | 1, 50, 117, 384, 451, 816, 883 | So sánh · Đúng + Hoặc · Kết quả | s-cmp, s-or, s-route | **no** (route is only a target) |
| 37 | 1070 | So sánh · Đúng | s-cmp, s-or | **no** |
| 3,6,10,… | 9, 58, 125… | Chạy theo tuyến · Đã đứng yên | s-route, robot, s-and | yes |
| 4,8,14,… | 49, 116, 383… | Chạy theo tuyến · Tới điểm | s-route, robot, s-timer | yes |
| 7,13,17,24,25,29 | 111, 342… | Đọc màu · Đúng màu | s-eye, robot, s-and | yes |
| 11,21,33 | 126, 460, 892 | Và + Khiêng đồ · Đang khiêng | s-and, s-hands, robot, s-goto, s-or | yes |
| 12,23,38 | 243, 626, 1105 | Đi tới · Đã tới | s-goto, robot, s-hands | yes |
| 22,34,35 | 528, 958, 1030 | Đọc màu + Và (while already carrying) | s-eye, s-and, robot, s-hands | yes — **misleading**: "Nhấc lên" lights but nothing is grabbed |

Never paused: robot **leaving** each pad (ticks 30, 79, 413, 845 — timer runs out, `s-cmp` falls; falls never pause), robot starting to carry (127, 461, 893 — `s-goto.moveX` is a number), the crate being picked (crate cards are scenery, never glow).

## 3. Gaps vs the agreed expectation

| # | Gap | Effect the user sees | Cause (file:line) |
|---|---|---|---|
| G1 | Target card's character not lit | L6: 0 of 3 pauses glow any character; L7: 9 pauses without robot | `step-light.ts:33-36` only adds objects around FIRED cards |
| G2 | Guard ↔ "Đi tuần" link hidden | "who patrols" invisible on board and in every pause | `level-06.ts:142-143` shownPorts hide b1/b2/b3 (`level-06.ts:106-108`) |
| G3 | Movement never pauses | guard walking, cat dashing, robot leaving pad / carrying never explained | `runtime.ts:109` only bool rises; `step-break.ts:10` |
| G4 | Locked visible card OK | `start → patrol.on` (b10) DOES pause+light — locked is not filtered. Problem is G1/G2, not locking | — |
| G5 | "Dự đoán tầm nhìn" never shown | the reason the cat waits (guard's sight) never appears | numbers only; not one hop from s-cmp's fire (`step-light.ts:33-36`) |
| G6 | Noise pause | L7 #22/34/35: grab fires while holding | rule pauses on any wired rise |

## 4. Minimal fixes (simulation untouched — all read-only of `rt`)

| Fix | Change | Files |
|---|---|---|
| **A** (level data) | L6 shownPorts: `guard: { in: ['moveX','moveY'], out: ['self'] }`, `patrol: { in: ['self','on'], out: ['moveX','moveY','atEnd','route'] }` → b1/b2/b3 drawn as locked wires | `puzzle/levels/level-06.ts:142-143` |
| **B** (light) | after the current pass, every lit **non-object** card also lights the object cards wired straight into it or from it (+ those wires) | `puzzle/ui/step-light.ts` (shared by puzzle + editor) |
| **C** (pause) | also pause when a card's drawn+wired `moveX`/`moveY` output goes from 0 to non-zero ("brain starts moving its character"). Key = `card|moveX` (or moveY). Needs a per-session "was moving" memo next to `stepBreakKeys` | `render/step-break.ts`, callers `puzzle/step-run.ts:53`, `render/game-view.ts:255` |
| D (optional "why") | also light cards one hop upstream of a fired card (s-fore feeding s-cmp → guard + cat glow at the "dash" pause). Noisier; ask user | `step-light.ts` |

### Expected L6 with A+B+C (prototype run, result still win 11.63 s, same as runLevel)

| # | Tick (s) | Fired | Lit cards | Stage glow |
|---|---|---|---|---|
| 1 | 0 (0.00) | start · Đã bắt đầu; So sánh · Đúng; Đi tuần starts moving | start, s-cmp, patrol, **guard**, s-route, **hero** | **guard, hero** |
| 2 | 12 (0.20) | Chạy theo tuyến starts moving | s-route, hero | hero |
| 3 | 106 (1.77) | So sánh · Đúng | s-cmp, s-route, hero | hero |
| 4 | 118 (1.97) | Chạy theo tuyến starts moving | s-route, hero | hero |
| 5 | 130 (2.17) | Đi tuần starts moving | patrol, guard | guard |
| 6 | 316 (5.27) | Đi tuần starts moving | patrol, guard | guard |
| 7 | 502 (8.37) | Đi tuần starts moving | patrol, guard | guard |
| 8 | 505 (8.42) | So sánh · Đúng | s-cmp, s-route, hero | hero |
| 9 | 517 (8.62) | Chạy theo tuyến starts moving | s-route, hero | hero |
| 10 | 688 (11.47) | Đi tuần starts moving | patrol, guard | guard |

(Optional: also pausing on `patrol.atEnd` would add 104/290/476/662 "guard reached the end" — it is shown but unwired, so needs a rule change; not recommended by default.)

### Expected L7 with B+C (45 pauses, win 18.45 s unchanged)

Changes vs today: robot now glows at pauses #1 and every "So sánh + Hoặc → Dừng" pause; 7 new "starts moving" pauses:

| New pause tick | Fired | Lit |
|---|---|---|
| 0 (merged into #1) | route starts moving | s-start, s-route, robot, s-sum, s-timer |
| 30, 79, 413, 845 | route starts moving (robot leaves pad) | s-route, robot, s-sum |
| 127, 461, 893 | "Đi tới" starts moving (carry to store) | s-goto, robot, s-sum |
| 243, 626, 1105 (merged with "Đã tới") | route starts again after drop | s-goto, s-route, robot, s-sum, s-hands |

Still without robot: one pause (tick 1070, s-cmp only → s-or, not adjacent to robot). L7 pause count grows 38 → 45; G6 noise pauses remain (separate small rule, e.g. skip a rise whose only targets are inputs already true — ask user).

## 5. Tests that would pin it

| Test | File |
|---|---|
| `stepLight`: target non-object card brings its wired-in object and its object target (route ← cat.self, route → cat.moveX) | `tests/puzzle/step-light.test.ts` |
| L6 solution: every pause has ≥1 object in `objects`; first pause lights both `guard` and `hero` | `tests/puzzle/step-run.test.ts` |
| L6: a pause exists at each tick the patrol starts moving (0,130,316,502,688) and the cat (12,118,517) | `tests/puzzle/step-run.test.ts` |
| L6 board: wires b1/b2/b3 are drawn (both pins shown) | `tests/puzzle/step-run.test.ts` or a level test |
| Existing "same state at every pause, same final state/result as runLevel" for all levels stays green with the move rule | `tests/puzzle/step-run.test.ts:84` (already exists) |
| Editor twin uses the same helper → one case in `tests/editor/step-run.test.ts` with a patrol → character | `tests/editor/step-run.test.ts` |

## Unresolved questions

1. Fix D ("why" upstream cards, e.g. sight forecast at the dash pause) — wanted, or too much light?
2. L7 grows to 45 pauses — acceptable, or merge "Tới điểm / So sánh / Đã đứng yên" that fall 1–8 ticks apart into one pause?
3. Pause on shown-but-unwired bools like `patrol.atEnd` (guard turns)?
4. A (shownPorts) adds two locked wires to the L6 board — needs the user to see it on the real game first (no-unpreviewed-UI rule).

Status: DONE
Summary: L6 step run shows no character at any of its 3 pauses and never pauses for the patrol; L7 mostly lights the robot but not at "Dừng" pauses and never at movement starts. Fixes A+B+C prototyped headless with unchanged win/time.
