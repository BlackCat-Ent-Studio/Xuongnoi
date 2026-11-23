# Zone sensor params report
Branch feat/zone-params (worktree D:\workspace\GameBuilder-zone).
Files: app/src/nodes/zone-sensor.ts, app/src/engine/types.ts (+facing? on EntityView), app/src/world/world.ts (viewOf adds facing for characters), app/tests/nodes/zone-sensor-params.test.ts (25 tests).
Params: rotate (no/yes), goods (text), rule (touch/center/inside), minCount (1..50). Defaults reproduce old behaviour.
Rotation: yaw from vehicle.heading or character facing; offset + box rotate; 2d-side ignores; entity extent projected onto zone axes.
Edit-mode marker rotation: skipped (marker is created once, createOnly; no follow target while editing).
Gates: tsc ok, vitest 76 files / 1042 tests pass, build ok. Junction app/node_modules left in place.
