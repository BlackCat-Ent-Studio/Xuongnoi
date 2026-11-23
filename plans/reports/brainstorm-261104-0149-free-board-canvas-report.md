# Brainstorm 261104-0149 — free board canvas (Xưởng Bot)

## Problem
User: puzzle board "tụm tụm lại, xấu, không có không gian sửa dây". Wants wide board, zoom in/out, pan with no limit.
Cause (board-view.ts layout()): board squeezed into one screen (1000×560 stretched), cards shrink to 0.46 and get pushed together. Pan/zoom (board-pan-zoom.ts, minK 0.25 maxK 1.6) exists but only after "Sắp xếp gọn" (tidy) — those buttons are hidden, so unreachable.

## Decisions (user 1a 2a 3a 4b)
1a Xưởng Bot only (editor untouched).
2a Open level: fit all cards, but card scale never < 0.70; rest reachable by panning.
3a Locked level cards spread ~1.5× wider than today.
4b PREVIEW artifact first, then build in real game after approval.

## Design (option a "free board, always on")
- Cards always real size × view zoom; no shrink ladder, no squeeze into screen.
- Drag empty board = pan, no bounds. Wheel / pinch = zoom 0.25–1.6 around pointer.
- Double-tap empty board = fit all (clamped ≥0.70). No new buttons.
- Tray piece drops at centre of current view.
- Cards, wires, wire energy, pins inside cards, "?"/× look unchanged.

## Not in scope
Xưởng Nối editor board; new buttons; knot persistence; level logic.

## Validation
Preview: L5 + L7 solved boards (busiest), desktop + phone 844×390; then real game Playwright shots L5/L7; puzzle tests green.

## Open
Whether real-game pan conflicts with card drag / wire drag on phone (tap slop 6px) — check in preview.
