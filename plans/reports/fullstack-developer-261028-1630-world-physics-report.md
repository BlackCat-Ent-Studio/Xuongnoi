# World + physics report

Files: app/src/world/{entity,physics,world}.ts, app/tests/world/world.test.ts
Exports: `createWorld(mode)` in world.ts (implements `World`).

- Tests: 13/13 pass (`npx vitest run tests/world`). `tsc --noEmit -p .`: no errors.
- Physics: per-axis (X,Y,Z) AABB resolve vs solid visible blocks, SKIN 1e-6 penetration threshold (no tile snagging), substeps so each moves <=0.4u (no tunneling), gravity -30, terminal 40, 2d-top no gravity/jump, 2d-side z forced 0, 3d yaw-rotated intent.
- Contacts: recomputed each step, gap <= 0.01, pairs with >=1 character, visible only; `hide` removes contacts immediately.
- Intent persists until replaced; moveX/moveY clamped to [-1,1], non-finite values -> 0.
- types.ts unchanged; no changes needed.
- Notes: before first step, contacts empty and onGround false. Characters overlapping a solid at spawn get pushed out on first move along an axis.

Unresolved: none.
