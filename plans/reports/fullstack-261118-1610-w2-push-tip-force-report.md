# Pushers read the real force a rigid crate needs (worktree GameBuilder-w2-push-tip-force, branch feat/w2-push-tip-force)

Not merged, not pushed. Labels: [M] measured, [D] by design, [N] not verified.

## What was built
- `world/crate-tipping.ts` (new, pure): `tipForceN(obb, dir, contactY, kg)` = m g a / h. Pivot = far bottom corner of the real (turned) box (corners within 1 cm of the lowest count as the base), a = how far the pivot is ahead of the centre of mass along the push, h = push height above the pivot. 0 when the centre is already past the pivot, Infinity when the push is level with or under the pivot.
- `world/linear-actuator.ts` (planPush): each directly pushed rigid crate needs min(mu m g, F_tip) with m = crate + everything standing on it; shares of a row/stack add. Contact height = pusher's mid-height clamped into the stretch where it really touches (piston head axis at 1.1 m gives h = 1.1). No tipping when lifting/lowering or in the top view. New `PushBody.real` / `skin`, `PushPlan.loadIds/loadKg/contactAt`, `shiftPushBody`, `loadLimitedAdvance`. Off-mode bodies carry neither field: same maths as before.
- `nodes/linear-actuator.ts`: `pushBodiesOf` (now exported, shared with the joint) hands rigid crates over with their real turned outline; the box of a turned crate is the bounds of that outline (was the unturned spawn box). Fast-rod limit (item 3).
- `world/arm-solid.ts` + `nodes/joint.ts`: same planner per cube (torque = force x lever); the joint's `load` output now adds the torque spent pushing rigid crates (only rigid ones, so off-mode read-outs are unchanged).
- Handbook: "Vật lý thật" (item 54 rewritten, example 7 tip vs slide, example 8 fast rod, "Chưa mô phỏng" line), piston page (force port, 2 tips), joint page (load port, 1 tip). Handbook/nodes tests green.
- Not touched: motor.ts, robot-traction.ts, crate-engine.ts, collider.ts, oriented-box.ts (existing exports untouched, nothing added), off-mode tests/baselines.

## Method for the force limit (item 2)
Computed from masses, friction, shape; NOT read from the engine. Reason: the pusher is a kinematic body, the contact impulse the engine reports for it is whatever it needs to enforce the head's motion (not a force the rod could give), and it arrives one step after the move. The plan runs before the engine step in every sub-step (<= 0.1 m) of every tick, on the crates the head touches directly or through a row (touching = within 5 mm: the engine's contact margin is about 2 mm, a head 5 mm away already nudged a crate 5 mm, [M]). So the limit holds each tick; a crate against a wall or another crate that is against a wall blocks the head (it stops short, rod reads its full limit). Not covered: a crate held by something the head does not touch (see Gaps).

## Item 3: fast rod
Measured before the fix (100 N, 10 kg, mu 0.5, rod 3 m): crate left at 2.0 / 6.1 / 12.4 m/s for rod speeds 2 / 6 / 12 (12.4 m/s = 770 J from a 100 N rod). Head never ended inside the crate (engine pushed it out), but the energy was invented. Fix: `loadLimitedAdvance`: the load can gain only a = (maxForce - needed) / m per second; the head runs free up to the crate's face, stops there, then moves no faster than crate speed + a dt (crate speed = head speed of the last tick while pushing). Off mode and crates without contact: unchanged. [M] after fix: crate max speed 2.00 / 3.99 / 3.99 m/s; kinetic energy <= (F - needed) x distance (tests assert it); head front within 2 cm of the crate rear at every tick. Rod force read-out is the force needed to move (49.05 N), not including m a while speeding up (kept so the earlier 49.05 N tests and the handbook formula stay true).

## Hand vs measured [M]
Crate 10 kg, 0.4 x 1.2 x 0.4, mu 0.5.

| Case | Hand | Measured |
|---|---|---|
| Piston 30 N at h 1.1 m | F_tip 17.84 N < 30 N: tips | tilt over 60 deg, rod reads 17.84 N, no overload |
| Piston 15 N at h 1.1 m | stalls | x = 3.00, tilt < 1 deg, overloaded, reads 15 N |
| Piston at h 0.15 m (F_tip 130.8 N), 45 N | stalls | x = 3.00, overloaded, reads 45 N |
| Same, 55 N | slides, needs 49.05 N | moved > 0.6 m, tilt < 3 deg, reads 49.05 N |
| Two touching 10 kg cubes, low | 98.1 N: 80 N stalls, 110 N moves | stall at 80 N (both crates unmoved); 110 N moves both, reads 98.1 N |
| Crate on a wall, 1000 N | head stops short | crate within 2 cm of wall, head front <= 3.22, reads 1000 N |
| Crate on a wall, 30 N | stalls | overloaded, reads 30 N |
| Tilted 10 deg, push 1.0 m above pivot | a = 0.2 cos10 - 0.6 sin10 = 0.0928 m, F = 9.10 N | equal (unit test) |
| Tilted 25 deg | past balance (18.4 deg): 0 | 0 |
| Joint, link 1.0 m high, cubes 1.3 to 1.9 m from axis | 19.62 N x 1.3..1.9 = 25.5 .. 37.3 N m | 20 N m stalls, load read 37.1 N m; 40 N m tips (> 45 deg) |
| Joint, link 0.15 m high | 49.05 N x 1.3..1.9 = 63.8 .. 93.2 N m | 40 N m stalls, load inside that range; 100 N m slides (tilt < 5 deg) |
| Rod 2 / 6 / 12 m/s | v^2 = 2 a d, a = 5.095 m/s2 | 2.00 / 3.99 / 3.99 m/s (above) |

## Existing tests changed (physics changed, numbers named)
- `crate-pushers.test.ts`: "piston weaker than mu m g stalls" now pushes LOW (h 0.15 m) with 40 N: at h 1.1 m a 40 N piston is above F_tip 17.8 N and now correctly tips the crate. "Servo with too little torque (40 N m against about 74 N m)" now uses the low link (0.15 m); the high link needs only about 37 N m. The other six and `crate-pusher-samples.test.ts` unchanged and green (weight-sorter, auto-arm).

## Re-recorded hashes (tests/editor/real-physics-on-baseline.json)
Only `handbook:linear-actuator`: 69406f3:900 to f5a7dba5:900. Reason: its piston now stops 5 mm short of the crate and the crate is accelerated by the spare force (not driven at rod speed). Crate still leaves the platform and falls to the lower floor (checked at 15 s: x 7.01, y -2.70). Two fresh processes gave the identical f5a7dba5; the other 39 entries unchanged; off-mode `solid-off-unchanged` and its baselines untouched and green.

## Tests
`npx tsc --noEmit` clean. New: `tests/world/crate-push-tip-force.test.ts` (16). Full `npx vitest run --testTimeout 300000`: 230 files, 3488 tests, all passed (989 s), waited to the end. Focused: crate-pushers (8), crate-pusher-samples (2), real-physics-on-hash + solid-off-unchanged (180, twice in fresh processes), handbook + nodes (943).

## Browser [M, looked at]
Own server 5295, stopped. `plans/browser-scripts/w2-push-tip-force-check.mjs`, shots in `plans/reports/shots-w2-push-tip-force/`: five pistons on the same crate. High 30 N: crate lies on its side. High 15 N and low 45 N: crate untouched at the head, standing. Low 55 N: crate pushed upright. Low 100 N at 12 m/s: crate is pushed, then slides on and falls over once the head reaches the end of the stroke (friction on a tall sliding crate, mu 0.5 > b / centre height 0.33, as the handbook already says). Headless SwiftShader; mid-tip frame not captured.

## NOT verified
Other browsers/phones; cost per tick of the extra probe plan (one more planPush with 14 bisection steps only when a rigid crate is touched); piston on a robot chassis (follow path got the tip rule through the shared body list but no new test); non-box shapes (a ball keeps sliding-only); joint at high angular speed (40 deg/s still jerks a crate, only the piston has the speed limit).

## Gaps
1. Force is computed, not read from the engine: a crate held by something the pusher does not touch (stuck on a ledge, jammed under another crate, wedged by a robot) is not counted.
2. Row sum uses each crate's own min(slide, tip) at its own contact height; it ignores that a crate tipping forward also pushes against the one ahead (counted as its sliding need). Close for equal heights, not an exact moment balance.
3. The rod's `force` read-out excludes m a while speeding up; the limit on speed-up is enforced, not displayed.
4. Joint: no acceleration/speed limit on contact yet (item 3 was for the piston).
5. A crate sliding then tips by friction when the head stops: real, but a pupil may expect "low = never tips".

Status: DONE_WITH_CONCERNS (gaps above are design limits, not failures).
