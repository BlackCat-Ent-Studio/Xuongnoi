---
phase: 6
title: Editor UI
status: completed
priority: P1
dependencies:
  - 3
  - 5
effort: L
---

# Phase 6: Editor UI

## Overview
Full editor: top bar, node palette, wiring canvas, properties panel, game view, new-game mode dialog. Non-coder friendly.

## Requirements
- Layout: top bar (Tạo mới · Chơi/Sửa · Lưu · Mở · Góc nhìn) | left palette by category | center wiring canvas | right: game view (top) + properties (bottom). Play = game view enlarges, canvas read-only.
- "Tạo game mới" dialog: 2D nhìn ngang / 2D nhìn từ trên / 3D. "Góc nhìn" switches mode of current board.
- Palette hides nodes whose `modes` excludes current mode.
- Canvas: drag node from palette; move nodes; pan (drag empty / middle mouse) + wheel zoom; drag from output port → input port to wire; invalid target shows red + reason tooltip (from `canConnect`); select + Delete removes node/wire.
- Ports colored by type: bool green, number blue, object orange. Big hit area (≥ 16 px).
- Play mode: each wire shows live value badge on hover/click (`runtime.getWireValue`).
- Properties panel: edit params of selected node (number, select, key-capture, color, vec3).
- Edit mode: drag entity in game view to set its `position` on mode plane (side: XY, top: XZ, 3d: XZ at current Y) — needed to build levels without typing numbers.
- Keyboard: input snapshot captured only while game view focused/playing; editor shortcuts disabled during play.

## Architecture
- `editor/editor-state.ts` — graph, selection, mode, play/edit; simple observer (`subscribe`, `emit`).
- `editor/palette.ts`, `wiring-canvas.ts` (HTML node boxes + SVG wires), `properties-panel.ts`, `top-bar.ts`, `new-game-dialog.ts`, `entity-drag.ts`
- `editor/keyboard-input.ts` — builds `InputSnapshot`.
- Styles: `src/style.css`, plain CSS.

## Related Code Files
- Create: files above. Modify: `src/main.ts` (mount editor, remove hard-coded graph).

## Implementation Steps
1. Editor state + layout shell.
2. Palette + add node.
3. Canvas: render nodes, drag, pan/zoom.
4. Wiring with `canConnect`, delete.
5. Properties panel.
6. Play/Edit toggle → game loop; wire value badges.
7. New-game dialog + mode switch.
8. Entity drag in game view.
9. Commit `feat(editor): wiring canvas, palette, properties, play mode`.

## Success Criteria
- [ ] Build side-view run/jump board from blank using only mouse + keyboard (no file edits)
- [ ] Wrong-type wire rejected with Vietnamese reason
- [ ] Live wire value visible in play
- [ ] No console errors

## Risk Assessment
Largest phase; wiring UX is make-or-break → keep visuals simple, prioritize hit areas and clear feedback; early user playtest after this phase.
