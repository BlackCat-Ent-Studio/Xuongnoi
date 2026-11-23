---
phase: 4
title: World and physics
status: completed
priority: P1
dependencies:
  - 2
effort: M
---

# Phase 4: World and physics

## Overview
Entity store + minimal AABB physics implementing `WorldApi`. Same code for all 3 modes; mode only changes axis locks + gravity. Pure TS, tested.

## Requirements
- Y up. Units = 1 block.
- Mode rules:
  | mode | movement axes | gravity | stick mapping |
  |---|---|---|---|
  | 2d-side | X (+ jump Y), Z locked 0 | on | x → X |
  | 2d-top | X, Z; Y fixed | off, jump ignored | x → X, y → −Z |
  | 3d | X, Z (+ jump Y) | on | camera-relative (yaw from renderer) |
- Character vs solid block: resolve per axis (move X, resolve; Y; Z). Pickups = non-solid, contact only.
- Fixed dt 1/60; clamp speed so max step < half smallest block size (no tunneling).
- Contacts list per step for `touch` node. HUD values + end-game state live in world.

## Architecture
- `world/entity.ts` — `{ id, kind: 'character'|'block', pos, size, vel, solid, visible, color, onGround }`
- `world/physics.ts` — `step(world, dt, mode)`
- `world/world.ts` — `createWorld(mode)` implements `WorldApi`: `spawn`, `setMoveIntent`, `jump`, `hide`, `isTouching(a,b)`, `hud`, `endGame`, `reset()`; exposes read-only entity list for renderer.

## Related Code Files
- Create: `src/world/entity.ts`, `physics.ts`, `world.ts`
- Create: `tests/world/physics.test.ts`

## Implementation Steps
1. Entity + world store.
2. Axis-separated AABB resolution, gravity, onGround.
3. Mode locks.
4. Contact detection (incl. non-solid).
5. Tests: lands on floor & stays, cannot pass wall at max speed, top mode ignores gravity, Z stays 0 in side mode, contact begin/end.
6. Commit `feat(world): entities and box physics with mode locks`.

## Success Criteria
- [ ] Physics tests green
- [ ] Same board state steps identically across runs

## Risk Assessment
Corner snagging on adjacent blocks → small skin epsilon; test case on tile floor.
