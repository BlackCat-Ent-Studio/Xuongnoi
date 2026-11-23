# Brainstorm — L7 pilot: bot script made of real board pieces (2026-11-03 14:30)

## Problem
User rule: bot behaviour must come from board + engine, never hidden code ("code ép là sai từ bước đầu"). L7 uses puzzle-only hidden brains `pad-patrol` (walk pads, stop, return) + `pad-carry` (grab only when still). Same issue in L5 (fetch-store), L8 (slot-patrol) — later.

## Decision (user, final scaled-back version)
- Keep scripted levels: same task, reference solution, tray, stars, "?" costs stars. No decoy/tray changes.
- Replace hidden brains with small GENERAL pieces (also in Xưởng Nối, handbook pages) placed as LOCKED VISIBLE cards ("mảnh có sẵn") on the board; 1a: all shown, packed in the left part of the board.
- Pilot = L7 only. Delete pad-patrol + pad-carry. L5/L8/L6 later.

## Pieces (general)
- Route-follow upgrade (advanced, default off = old boards identical): stop N s at each point; output "Đang ở điểm"; pause/resume via existing on/go input if present.
- NEW "Ô trống kế tiếp": inputs = slot marker objects, outputs next free slot (object) + "Đầy".
- Existing: go-to, carry, speed-sensor "Đứng yên", and/not.

## Acceptance
- L7 base contains NO puzzle-only kinds; all logic cards visible (locked), no overlaps on 1000x560 + phone.
- Same behaviour as last night: stop ≥0.4 s at each loose crate (red too), grab only when still, straight back to next empty slot, crate centred, skip emptied pads; reference solution wins ≤60 s; each solution wire removed fails; want=1 loses; physics invariants green.
- Xưởng Nối: 16 samples/31 lessons/54 handbook boards hash-identical; new kind has handbook page + used by a lesson (coverage tests).
- Anti-forced test: L7 uses only kinds registered by the editor.
