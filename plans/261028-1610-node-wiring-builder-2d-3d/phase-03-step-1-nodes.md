---
phase: 3
title: Step-1 nodes
status: completed
priority: P1
dependencies:
  - 2
effort: M
---

# Phase 3: Step-1 nodes

## Overview
16 original nodes, one file each under `src/nodes/`, registered in `src/nodes/index.ts`. Labels from `ui-text-vi.ts`.

## Requirements
Pulse = bool true for exactly one tick. Edge inputs count rising edges.

| kind | Label (vi) | Inputs | Outputs | Params |
|---|---|---|---|---|
| key | Phím bấm | – | held:bool, pressed:pulse | key |
| stick | Cần điều khiển | – | x, y:number (−1..1) | scheme WASD / arrows |
| on-start | Khi bắt đầu | – | fired:pulse (tick 0) | – |
| and | Và | a, b:bool | out:bool | – |
| or | Hoặc | a, b:bool | out:bool | – |
| not | Không | in:bool | out:bool | – |
| const | Hằng số | – | value:number | value |
| math | Phép tính | a, b:number | out:number | op + − × ÷ (÷0 → 0) |
| compare | So sánh | a, b:number | out:bool | op < ≤ = ≠ ≥ > |
| counter | Bộ đếm | up, down, reset:bool (edges) | value:number, reached:bool | start, target |
| timer | Hẹn giờ | run:bool (default true), reset:bool | left:number, done:bool | seconds |
| character | Nhân vật | moveX, moveY:number, jump:bool | self:object, onGround:bool, x, y, z:number | position, speed, jumpPower, color |
| block | Khối | hide:bool (edge → removed for rest of run) | self:object | position, size, color, type solid / pickup |
| touch | Cảm biến chạm | a, b:object | touching:bool, began:pulse | – |
| win-lose | Thắng/Thua | win, lose:bool | – | messages |
| show-number | Hiện số | value:number | – | label, corner |

Object nodes spawn an entity via `ctx.world` in `create()` and push intents each tick; `touch` reads contacts from previous physics step.

## Related Code Files
- Create: `src/nodes/<kind>.ts` (and/or/not may share `bool-gates.ts`), `src/nodes/index.ts`
- Create: `tests/nodes/*.test.ts` (fake `WorldApi`)

## Implementation Steps
1. Input nodes read `ctx.input` (key snapshot; keyboard handler in phase 6).
2. Logic + math nodes (pure).
3. Counter / timer with edge detection in state.
4. Object + touch nodes against `WorldApi` (fake in tests).
5. Output nodes → `ctx.world.hud.set()` / `ctx.world.endGame(result)`.
6. Tests: held key counts once, timer done at seconds×60 ticks, compare ops, ÷0, touch `began` once per contact.
7. Commit `feat(nodes): step-1 node set`.

## Success Criteria
- [ ] 16 nodes registered with label, category, typed ports
- [ ] Node tests green
- [ ] Names/params reviewed: original, not mirrored from reference

## Risk Assessment
Pulse vs held confusion → two clearly labelled outputs; revisit after playtest.
