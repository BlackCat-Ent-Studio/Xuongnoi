# Brainstorm — Level 6 redo "Lẻn qua mắt lính gác" (2026-11-02 23:40)

## Problem
Current L6 "Né lính gác": guard patrols straight line, lose = touch, solution distance + Không. User: too simple/odd; wants a real "avoid the guard" challenge using the new sensors.

## Scout
- level-06.ts: 3D top view, hero cat-chibi go-to goal, guard cat-quad patrol, lose = touch.
- vision-sensor exists (viewer, target; seen/gained/lost; range, angle, walls block) but no level uses it and NO vision cone is drawn anywhere (new render work, puzzle-only).
- speed-sensor exists (still/fast).

## Decision (user 1a 2b 3a 4a)
- 1a: lose = guard SEES hero WHILE hero moving (hidden locked check: vision + speed-sensor). Standing still = safe ("đèn xanh đèn đỏ"). Crates as cover (walls block sight).
- 2b: guard PATROLS back and forth while looking (facing = walking direction; turns at ends).
- 3a: keep 3D top view; vision fan drawn yellow, red when it sees the hero.
- 4a: artifact PREVIEW first (guard, fan, crates, hero) → user approves → build into game.
- Player solution: Tầm nhìn(viewer guard, target hero).Đang thấy → Không → hero go. Decoy: Đo khoảng cách (old answer must fail).

## Acceptance (game phase, later)
- Headless: solution wins in timeLimit; distance-based answer fails; empty fails; each wire removed fails; hero hidden behind crate keeps walking; physics invariants green.
- Visual: fan visible and colours change; matches preview.

## Open (for preview)
- patrol route, fan range/angle, crate count/positions, stop grace (ticks to brake before "moving while seen").

## Update 2026-11-03 00:0x — user rejected v1 preview, new design
- v1 problems (user): cat only runs in the open, freezes in front of guard, jitters at fan edge; guard does nothing.
- New: cover-to-cover stealth WITH timing. Cat watches the guard; when guard turns away, cat estimates window = time until guard looks at the next gap again; dash time = gap length / cat speed; RUN only if dash + 0.5 s margin <= window (1a player wires it with So sánh; 2a margin 0.5 s; 3a at a cover, if window still enough for next gap, keep running without stopping). User: "phải tính toán rủi ro có nên chạy không" = cat only commits when safe, otherwise hides.
- 4b: guard sees cat = LOSE immediately (no chase/search).
- Guard look = robot legs (PUZZLE_LOOKS.robotLegs), not cat.
- Player solution (target): Compare(guard "Còn bao lâu nhìn tới đoạn kế" > cat "Cần bao lâu chạy qua" + 0.5) → cat "Chạy tới chỗ nấp kế". Decoys: Đo khoảng cách (must lose), no wire (cat never leaves cover → time out lose).
