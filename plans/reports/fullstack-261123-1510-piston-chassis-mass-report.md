# Piston vs chassis weight: measure, then fix

- Worktree: `D:\workspace\GameBuilder-piston`, branch `fix/piston-chassis-mass`, base main `65fae6d`
- Commit: `5a2d819` (one commit, 6 files, +176 / -6)
- Status: DONE_WITH_CONCERNS. Gate passed (0 shipped entries moved); two related gaps found and NOT fixed (side push, scale weight).

## 1. Where the 2 kg / 0.5 came from

| What | Where | Value |
|---|---|---|
| Default mass of a `robot` entity | `app/src/world/material.ts:15` (`DEFAULT_MASS_KG.robot`) | 2 kg |
| Default friction of any body | `app/src/world/material.ts:17` (`DEFAULT_MU`) | 0.5 |
| Read by the pushers | `app/src/nodes/linear-actuator.ts:59` (`world.materialOf`) -> `world.ts:587` -> `material.ts:51` | 2 x 0.5 x 9.81 = 9.81 N |
| The card's real numbers | `nodes/robot-body.ts:157` puts "Khối lượng" / "Độ bám" into `spec.robot`, never into the entity's `mass` / `mu` | card default 2 kg, grip 0.8 |
| Payload | `RobotBody.payload` (`world/robot-drive.ts:158`), weighed every step by `massOn` in `physics.ts:480`; on the view as `robot.payload` | kg on the chassis, trays included |

So the card's mass and grip drove the wheels (`robot-traction.ts`) and the robot-against-robot shove (`robot-push.ts:133`), but not pistons, joints or grippers.

## 2. Measurement (experimental patch, before committing)

| Suite | Result |
|---|---|
| `tests/editor/solid-off-unchanged` (switch off) | 0 entries moved, byte-identical |
| `tests/editor/real-physics-on-hash` (switch on) | 0 entries moved |
| `tests/editor/solid-on*`, `tests/io`, `tests/actuator`, `tests/arm`, `tests/traffic`, `tests/nodes/raised-deck-physics`, `tests/world` | 1444 / 1445; the one red was the corner test that pinned the old 9.81 N (expected, updated) |

Why nothing shipped moves: of all samples, lesson boards and handbook try-boards, only `sample:agv-shuttle` has both a chassis and a pusher (5 kg, grip 0.8, switch on). Its arm and piston are bolted on that chassis (a pusher never pushes what it stands on), so no pusher ever meets a chassis there.

No table of moved entries: there are none.

## 3. What was implemented (switch on only)

1. `world.ts` `materialOf`: a chassis on wheel traction reports the mass and grip of its card.
2. `nodes/linear-actuator.ts` `pushBodiesOf`: a loaded chassis needs grip x (mass + payload) x 9.81, payload = the world's own weighing.
3. `world/linear-actuator.ts` `contactSet`: a pushed chassis carries what stands on its top (rider) instead of shoving it as a second load. Without this a carton on the chassis was counted twice: 77.5 N measured instead of 62.8 N (5 kg + 3 kg, grip 0.8).

Numbers a user sees now (chassis 5 kg, grip 0.8, "Vật lý thật" on):

| Case | Before | After |
|---|---|---|
| Empty chassis | 9.81 N | 39.24 N |
| 20 kg chassis | 9.81 N | 156.96 N |
| Grip 0.2 | 9.81 N | 9.81 N (0.2 x 5 x 9.81) |
| With a 3 kg carton on it | 24.5 N (9.81 + the carton's own 14.7; worked out from the code, not measured) | 62.78 N |
| Switch off | 9.81 N | 9.81 N |

Tests, written first and red without the source change (5 red in the two board files, 2 red in the plan file):
- `tests/actuator/piston-chassis-weight.test.ts` (new, 5): stalls with "Quá tải" at need - 0.5 N, pushes at need + 0.5 N; heavier and more slippery chassis; loaded chassis; push from the side; switch off keeps 9.81 N.
- `tests/actuator/push-plan.test.ts` (+5): rider on a pushed chassis, hold force, a carton ahead on the floor is still shoved.
- `tests/world/robot-outline-sensors.test.ts`: the 45 degree corner case still stalls at the corner with 5 N; its expected force is now 39.24 N.

No baseline was re-recorded.

## 4. Test numbers

- `npx tsc --noEmit -p .`: clean.
- One full `npx vitest run --testTimeout 300000`: 315 files passed, 1 skipped; 4641 tests passed, 1 skipped; 630 s. No timeouts, nothing rerun.

## 5. Brakes and wheels: does a parked robot resist differently?

- Pistons, joints, grippers (today and after this fix): no wheel model. The chassis resists grip x weight in every direction, and is moved by placing it; its own speed is not touched.
- Robot against robot (`holdForceN`, `robot-push.ts:130`) already has one: along the wheels each wheel holds with min("Lực phanh", its grip); a wheel driven the same way at least as fast gives way; sideways the whole grip; in between mixed by direction.
- With default motors ("Lực phanh" 0 = grip only) and the robot parked, both give the same number, so the fix is right for the common case.
- They differ when: "Lực phanh" is set below the grip (lengthwise it should be easier), or the robot drives away from the head (should cost nothing).
- Reasonable and still simple: let pushers use `holdForceN` too, one rule for what a chassis resists with. It needs a new world call in `engine/types.ts`, which is outside my files. See question 1.

## 6. Found on the way (not changed)

1. **Push from the side on a chassis that is longer than wide is free.** The head is a solid block; the world moves bodies out of a moving solid block by the chassis's collision SQUARE (`world/platforms.ts` `stepAxis`, `colliderBox`), which sticks out (length - width) / 2 past the real side. That happens before the push plan sees the outline. Measured: chassis 0.9 x 0.7, 5 kg, grip 0.8, piston limit 38.7 N from the side: chassis moved 1.85 m, "Lực đang đẩy" 0, never "Quá tải". The default card (1 x 0.7) is affected. Same code as main, independent of this fix. From behind / front and on a corner at 45 degrees the limit works. My side test uses a square chassis for that reason.
2. **A chassis weighs 2 kg to scales** (read from code, not measured): `material.ts:105` `massKgOf` uses the entity default, so a robot standing on a scale or on another robot counts 2 kg whatever its card says. What it carries is counted right.
3. With a carton on the chassis, a piston barely over the limit pushes slowly (0.5 N spare on 8 kg = 0.0625 m/s per second). That rule (`loadLimitedAdvance`) only applies when a rigid crate is in the load; an empty chassis is moved at rod speed at once.

## 7. Not verified

- Browser: nothing was played in the app. Headless tests only.
- Joints and grippers pushing a chassis: no new test of their own (they share `pushBodiesOf` and `planPush`; `tests/arm` green).
- Robot shoving a LOADED robot: the rider rule also applies there (the same double count existed). No hash, traffic or sample test moved, but I added no test for that pair.
- Extra try-boards outside the hash guards: covered only by their own tests in the full run.
- A chassis with a collision box of its own under real physics: gets the card's mass, but not the rider rule (it has no outline).
- Old user boards saved with "Vật lý thật" on where a piston pushes a robot: they now need more force (9.81 N -> grip x mass x 9.81). No shipped board does this; user boards cannot be measured.
- Finding 6.1 on main itself: measured on this branch only (the code involved is unchanged).

## 8. Questions

1. Wheels and brakes for pistons: a) leave as now (grip x weight every direction) ⭐ until someone needs a low "Lực phanh" / b) use the robot-against-robot rule (`holdForceN`) for pushers too: one new world call, then measure again.
2. Side push on a long chassis is free (6.1): a) fix next, as its own measured change (moving solid blocks meet a chassis by its outline; touches lifts and doors too) ⭐ / b) leave.
3. Scales read a chassis as 2 kg (6.2): a) measure and fix under "Vật lý thật" only ⭐ / b) leave.
