# Brainstorm — "every action needs its own wire" (2026-11-03 22:20)
Source: client rule; audit plans/reports/audit-261103-2200-wireless-behaviour-report.md (19 violations, 17 grey, 13 OK).
## Decisions (user a,1a,2a,3a,4a,5a; earlier recommended defaults applied: go-to "Tới Đích"/"Tới Đích 2" outputs, toggle carry banned in puzzle)
- L7 shortening: a = keep.
- 1a: fix in ENGINE for both workshops. All default-true action inputs (go-to Cho đi, patrol Hoạt động, route-follow Bật, timer Chạy, moving/rotating platform & conveyor Chạy, portal Bật, camera Bật, show-text/guide-arrow/ui-button/ui-meter) default OFF. Load-time migration for OLD boards (samples, lessons, handbook boards, user saves/Kho game, try-boards): auto-insert a visible "Khi bắt đầu" (on-start) node + wires into each such unwired input so behaviour stays identical (hash/trajectory). Bump a graph format/version flag so migration runs once.
- Split one-input-two-actions into dedicated inputs (old input kept for old boards, not used by puzzle): door/block "Ẩn suốt lúc bật" → add "Mở"/"Đóng" (or Hiện/Ẩn) pulses; enter-exit "Bấm" → "Lên xe"/"Xuống xe"; hand-tool "Cầm/Cất" → "Cầm"/"Cất"; carry toggle mode banned in puzzle (test).
- chase/fight get a "Cho đi" input default off (+ migration).
- 2a: "go to X then stand still", "patrol turns at ends" = one action, OK.
- 3a: consequences of a wired action (death vanish, lifetime, turn toward grabbed crate, respawnFallen, drop when carrier hidden) = physics rules, OK.
- 4a: remove route-follow stopFor reliance in L7; player wires "Tới điểm" → Hẹn giờ 0.5 s → "Dừng" (or equivalent general wiring). faceAtStop: not used by puzzle (turn on grab counts as consequence).
- 5a: sight-forecast must get the guard's route through a wire (e.g. patrol outputs route/self object → forecast input), no hidden reads.
- L5: go-to gets outputs "Tới Đích" and "Tới Đích 2"; L5 wires Tới Đích → Nhấc lên, Tới Đích 2 → Thả, carry mode separate.
## Phases
P1 engine + editor content + migration + minimal level wiring to stay green (agent A).
P2 puzzle levels polish: guides/WIRE_LINES/trays/par/freeHints per level, L5/L6/L7 specifics, anti-wireless tests (agent B after P1).
## Acceptance
- New test "no action without its wire": for every node kind, with ALL inputs unwired and default params, the node performs no world action (move/grab/drop/teleport/hide/spawn/win…) over N ticks — except whitelisted pure sensors/consts.
- Old boards: all sample/lesson/handbook hashes identical after migration (migration adds visible on-start wires).
- Puzzle: each solution action traced to a wire; removing it stops that action.
