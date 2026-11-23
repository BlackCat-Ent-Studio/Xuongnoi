# Motor force: one number (maxForce) for driving and pushing

## Changed
- `app/src/nodes/motor.ts`: `driveForce` removed. `maxForce` (id kept) relabelled "Lực kéo động cơ (N, nhân với công suất)", default 30. Wheel `driveN = maxForce * min(1, |target rpm| / maxRpm)`; `pushN` unchanged (scaled by current wheel rpm).
- `robot-traction.ts`, push cap (`robot-push.ts`): untouched. `brakeForce` and "power 0 = locked wheels" unchanged. World default `driveN` (6 N when a caller gives none) kept for direct world API users.
- Handbook: `content-robot-drive.ts` (motor maxForce text, driveForce entry removed, tip), `topic-real-physics.ts` (examples with 30 N, 40 kg), label in `robot-body.ts`.
- Tests: `tests/world/robot-traction.test.ts` (new block "one motor force drives and pushes"; firm-ground card test now sets maxForce 6 because 30 N makes that robot grip-limited and slipping).
- Off-switch: `solid-off-unchanged` and baselines untouched.

## Measured (2 motors, mu 0.8, wheel 0.15 m, 120 rpm = 1.885 m/s)
| case | accel | slip |
|---|---|---|
| 2 kg, accel param 10000 | 7.85 m/s2 = mu g (0.1308 m/s per tick) | on ticks 2-15 during launch, off from tick 16 at top speed, no flicker |
| 2 kg, default accel 400 rpm/s | 6.28 m/s2 (wheel ramp limits, grip not reached) | never |
| 40 kg | 60 N / 40 kg = 1.5 m/s2 (motor-limited) | never |
| 40 kg, 20 N motors | 1.0 m/s2 | - |
| 40 kg, power 0.5 | 0.75 m/s2 | - |
| power 0 at speed | stops on friction, rpm 0 | - |
Push cap test (min(pushN, grip), 3.92 N at mu 0.2) unchanged and green.

## Tests
- tsc --noEmit: clean.
- Focused (world, actuator, arm, handbook, real-physics-setting): all pass except 3 5-second timeouts in puzzle/physics-invariants under load (default timeout).
- Full suite: 3341 passed, 1 failed (handbook example text I had shortened; restored, then tests/io/real-physics-setting + handbook re-run green, 301 tests). No re-run of the full suite after that one-line text fix.

## Not verified
- UI rendering of the new label (no visual check).
