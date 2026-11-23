# Brainstorm 261104-2341 — port Xưởng Bot features to Xưởng Nối (editor)

User: "bên xưởng bot cập nhật logic/engine gì mới thì cập nhật cho xưởng nối … với các tính năng mới" → "ngoại trừ cái E còn nhiêu cập nhật hết".

## Finding
- Engine/nodes/world/handbook are SHARED → editor already has all 57 kinds, pointsFrom, showHiddenOut, wire rule + migration, solidBodies toggle, vision fan. Nothing to port there.
- Gap = puzzle-only board/UI behaviour + no examples for 2 new advanced params.

## Scope (approved)
| Id | Feature | Notes |
|---|---|---|
| A | 🐢 Từng bước thông minh in editor | replaces old 1-tick step button (2a ⭐ default). Pause only when a SHOWN output pin WITH a wire rises (render/step-break.ts already in GameView). Light fired pin, "who" (object cards wired into fired card), "what" (out wires + targets); others fade .2 / wires .1 in step mode only; stage outline via GameView.setHighlight; pan board to lit cards. No text bubble |
| B | Routed wires avoiding cards + knots (double-tap wire → knot, drag, merge same source) | reuse puzzle/ui/wire-geometry.ts + wire-knots.ts (pure). Auto-route only when board ≤ ~150 cards (measure; city-3d 687 keeps curves). Knots SAVED with board as optional field; absent = old board byte-identical |
| C | Tap card = focus (card + its wires clear, others fade) | |
| D | Drop onto overlap → slide to nearest free spot (freeSpotNear logic) | |
| F | Fullscreen on touch devices when pressing Chơi | coarse pointer only |
| G | Handbook "Thử ngay" examples for route-follow pointsFrom and block showHiddenOut | |
| L | Lesson "Xem dây chạy từng bước" (3a ⭐ default) | |
| E | Cozy stage | OUT of scope (user excluded) |

## Constraints
- Editor stability: 16 samples / 31+ lessons / handbook try-boards hash-identical; old saved boards load identical.
- No new colours/card shape; reuse existing editor look. User tries branch on own port BEFORE merge.
- Puzzle behaviour unchanged (all puzzle tests green).

## Split
- feat/editor-step (../GameBuilder-edstep, port 5241): A, F, G, L.
- feat/editor-board (../GameBuilder-edboard, port 5242): B, C, D.
- Shared touch: wiring-canvas.ts — board agent owns; step agent may only append a light API (keep-both on merge).

## Unresolved
- Exact card threshold for auto-route (from measurement).
