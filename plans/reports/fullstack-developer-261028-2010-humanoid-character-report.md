# Humanoid character visual - report

## Files
- NEW `app/src/render/humanoid-model.ts`: pure pose math (targetPose, blendPose, facingTarget, yawToward, defaultYaw, shortestAngle/smoothAngle, footDrop) + `Humanoid` class (box figure, animate from per-frame position delta, dispose).
- `app/src/render/scene-view.ts`: Entry union (block mesh | humanoid); `setMode`, `sync(entities, dt)`, recursive pick, dispose on removal.
- `app/src/render/game-view.ts`: passes dt to sync, `sceneView.setMode` in ensureRig, `sceneView.clear()` on session reset (fresh figures per run/preview).
- NEW `app/tests/render/humanoid-model.test.ts` (13 tests).
- engine/types.ts untouched; no contract/physics change.

## Design notes
- Figure 1 unit tall, built facing +X; horizontal scale = min(size.x,size.z), vertical = size.y -> fits inside collision box under any yaw; feet at box bottom. Small lift compensates for rotated shoe corners dipping below floor.
- Colors: skin #f1c27d, shirt = entity.color, pants #3b4a6b, shoes #2b2b33, eyes dark.
- Velocity = smoothed delta/dt; airborne if |vy|>0.8; walk if horizontal speed>0.3; teleports (>4 units/frame) ignored. Idle = breathing + arm sway. Preview (dt=0) = static idle, faces +X (side) / +Z (top, 3d).
- Pick: every part mesh carries ownerNodeId; raycast is recursive.

## Verify
- vitest: 153 pass (13 files). tsc --noEmit clean. npm run build ok (only the existing chunk-size warning).
- Playwright (script `scratchpad/smoke/humanoid-shots.mjs`, shots in `scratchpad/humanoid/`): side-stars idle preview, walk right (limbs swung, faces right), walk left (faces left), idle after, jump (arms up, legs tucked, in air); 3d-hop idle/walk/jump. Feet rest on floor in all; zero console errors/warnings.
- Pick/drag verified by unit test (raycast through nested parts returns owner; null after removal), not by a live browser drag.
- 3d walk facing direction (away from camera when moving -Z) verified by math test only; the screenshot was too short/small to confirm visually.

## Unresolved
- Eyes are small (0.045 box); barely visible at default zoom.
