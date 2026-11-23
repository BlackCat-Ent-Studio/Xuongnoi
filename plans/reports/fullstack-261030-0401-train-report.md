# Train (agent 2) report

Branch `feat/train` (worktree D:\workspace\GameBuilder-train), commit d47b38b. Gates in app/: vitest 81 files + new file all green (1112/1113 on the run before a last model-size tweak, the 1 failure was the render bounds test, fixed and re-run green), `tsc --noEmit` clean, `npm run build` ok.

## What was built
- Chạy theo tuyến: new select "Cách chạy" (`follow`: `steer` default = old behaviour, `rail` = "Bám ray"). Vehicle is put exactly on the smoothed polyline each tick (heading = track tangent, quadratic-arc corners, param `railCorner` default 1.5, advanced). Loop / pingpong (`style`) still apply. Obeys Dừng + probe-ahead; "Tới điểm" pulses when a point is passed (no pulse at the start, unlike steer mode). Characters in rail mode chase a point running along the rail (not teleported).
- Max points 8 -> 32. Points 9..32 are `advanced` (folded). Old saved params load identically.
- Phương tiện: models `locomotive` (footprint 2.6) and `wagon` (2.4) in `VEHICLE_DIMS`/`vehicleSize`, procedural meshes in `render/vehicle-models.ts`.
- Phương tiện input "Kéo theo bởi" (`leader`) + advanced `towDistance` (center-to-center, 0 = auto = (len A + len B)/2 + 0.2). Follows leader's trail, heading from trail tangent, chains work, coupled vehicles skip each other in crash/collision lists, leader hidden/removed -> wagon stops.

## Files
- new: `src/nodes/route-rail.ts` (track geometry), `src/world/vehicle-train.ts` (trails, tow, pose -> velocity), `tests/world/vehicle-train.test.ts` (14 tests)
- edited: nodes/route-follow.ts, nodes/vehicle.ts, world/vehicles.ts, world/world.ts, engine/types.ts (additive: 2 model names, `setVehicleTrack`, `setVehicleTow`), render/vehicle-models.ts, tests/nodes/fake-world.ts (2 stubs), tests/render/vehicle-models.test.ts (+2 models)
- touched OUTSIDE strict scope, tiny: `world/physics.ts` (one filter line in `stepVehicle` rivals + 1 import) and `world/probe-ahead.ts` (skip own train). Owned by the other agent area (physics.ts): possible trivial merge conflict, both one-line.

## Browser check (port 5204, stopped)
3D board: locomotive + 2 wagons on a 12-point loop, rail mode. 0 console errors. Files in D:\workspace\GameBuilder\plans\reports\shots-train\: train-edit-view.png, train-start.png, train-playing.png, train-loop.gif.

## Notes / limits
- Rail start/stop is instant (no ease). A vehicle > 3 units from its target pose is snapped onto it (first placement).
- Wagons that start behind the engine are placed on the straight extension of the first track stretch until the trail is long enough; looks fine only if the engine starts on a straight.
- Ping-pong rail with wagons: wagons fold back on the trail at the turnaround; use loops for trains.
- Square collision footprint: locomotive/wagon colliders are 2.6 / 2.4 square though bodies are narrower.
- Dev note: bash hook blocks heredocs containing apostrophes in some cases; used files instead.

Status: DONE_WITH_CONCERNS
