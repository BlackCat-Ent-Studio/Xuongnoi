---
phase: 5
title: Renderer and view modes
status: completed
priority: P1
dependencies:
  - 4
effort: M
---

# Phase 5: Renderer and view modes

## Overview
Three.js view of world entities as colored boxes; camera per mode; game loop wiring runtime + physics + render.

## Requirements
- Cameras: 2d-side = orthographic looking −Z, follows character X/Y; 2d-top = orthographic looking down −Y, follows X/Z; 3d = perspective, orbit behind character (mouse drag rotates yaw/pitch).
- Grid helper in edit mode only.
- HUD overlay (HTML) for `show-number`; end-game overlay "Thắng!" / "Thua!" + "Chơi lại".
- Loop: fixed 60 Hz accumulator → `runtime.tick()` then `physics.step()`; render each animation frame.
- Renderer reads world only (never mutates).

## Architecture
- `render/scene-view.ts` — sync meshes with entity list (create/update/remove).
- `render/cameras.ts` — `createCamera(mode)`, `updateCamera(cam, target, dt)`, exposes yaw for 3d stick mapping.
- `render/hud.ts` — HUD + end overlay.
- `game-loop.ts` — start/stop, accumulator, owns `Runtime` + `World`.

## Related Code Files
- Create: `src/render/scene-view.ts`, `cameras.ts`, `hud.ts`, `src/game-loop.ts`

## Implementation Steps
1. Scene + lights + mesh sync.
2. Three cameras + follow logic; switch on mode change.
3. Fixed-step loop; stop on endGame.
4. HUD + overlay (strings from `ui-text-vi.ts`).
5. Manual check with a hard-coded graph in `main.ts` (removed in phase 6).
6. Commit `feat(render): three.js view, mode cameras, game loop`.

## Success Criteria
- [ ] Hard-coded test board: character moves + jumps on floor in all 3 modes
- [ ] 60 FPS with 100 blocks on laptop
- [ ] Switching mode keeps same entities visible

## Risk Assessment
Ortho camera sizing on window resize → recompute frustum on resize.
