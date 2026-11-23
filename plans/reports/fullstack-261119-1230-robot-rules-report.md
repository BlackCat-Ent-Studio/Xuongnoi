# Robot rules: solid chassis, link width, own parts are not cargo

Date 2026-11-19 · worktree `D:\workspace\GameBuilder-robot-rules` · branch `feat/robot-rules` · base c929622 · last commit f6acc66 (7 commits, not pushed, not merged).
Headless numbers: 60 ticks/s, "Vật lý thật" on, gravity 9.81, crate friction 0.5, chassis 1.2 × 1 × 0.3 m, 5 kg, friction 0.8. Normal = 2 × 6 N, 90 rpm, power 0.7 (0.99 m/s). Top = 2 × 30 N, 120 rpm, power 1 (1.885 m/s).

## Summary

| Fix | State | One line |
|---|---|---|
| 1 Robots solid against each other | done | Overlap 0.00 mm in all 14 measured runs (was 1169–1193 mm). Stop or shove is decided by wheel push against brake/grip. Switch off: unchanged. |
| 2 Link width "Bề rộng" | done | Default 0 = as wide as thick (old shape, no migration). 0.6 × 0.6 m tray carries 1 and 5 kg, dumps at 30° and 45° at 60°/s. |
| 3 Own parts are not cargo | done | Tray chassis reads 0 kg and reaches 0.99 m/s (was 70 kg, 0.34 m/s); a crate on the tray reads its own mass. No shipped board changed, no hash re-recorded. |
| Debug line | removed | `crate-engine.ts` `__dbg` print. |

No baseline file was touched. No new node kind (71). tsc clean.

## Fix 1 — rule as implemented

- Who: visible solid chassis on wheel traction (`physics.ts:459`). A chassis with "Chặn người đi bộ" = Không is passed through as before. Fewer than two such chassis: the old code path runs untouched (`physics.ts:323`).
- Shove test (`robot-push.ts:134`, `:84`): the other chassis join the push plan the chassis already uses for loose things. Push available = Σ min(motor force × power, grip) of the wheels turning that way (unchanged). What the other one holds with (`holdForceN`, `robot-push.ts:63`): along its wheels Σ min(brake force, grip) — brake force 0 means only grip limits it, as the traction step already defines; a wheel asked to run the same way at least as fast holds nothing — and sideways its whole grip μ·m·g; in between a straight mix by direction. Mass counts with payload. `PushBody.holdN` carries it (`linear-actuator.ts:60`, `:298`).
- **Equal forces = stop, not push** (`cannotPush`). Reasons: (1) with a tie, whichever robot is stepped first would push the other, so the result would depend on card order; (2) equal opposite forces give no net force; (3) no creep at rest. A robot needs strictly more push than the other holds with.
- Cannot shove: the other chassis are walls for that tick (`robot-push.ts:157`). The mover stops flush through the same clamp vehicles use (`physics.ts:346`) and may slide along the face. "Đang đẩy vật" is on, "Lực đang đẩy" = the push it has.
- Can shove: the pushed chassis is moved with the pusher (`finishShove`, `robot-push.ts:185`) and takes the pusher's speed along its own wheels, so "Tốc độ" and the wheel read-outs are true and it rolls on until its wheels stop it. A chassis already shoved this tick does not also travel that distance itself (`physics.ts:331-340`), so the result does not depend on step order (tested both orders).
- Stopped by a moving chassis it keeps the speed it really travelled at (`physics.ts:357`); a wall still takes all of it, as before.

### Before / after

| Run | Before (spike) deepest overlap mm | After deepest overlap mm | After: what happens |
|---|---|---|---|
| head-on equal, normal | 1185.7, pass through | 0.00 | both stop, gap 0.00, speeds 0.000, moved 0.00 mm in 3 s; both "pushing", 8.4 N |
| head-on equal, top | 1169.0, pass through | 0.00 | both stop, 39.2 N each, wheels slip (motor 30 N > grip 19.6 N per wheel) |
| head-on 40 kg vs 2 kg, top | — | 0.00 | heavy shoves light back at 1.885 m/s; light reads −1.754, its wheels slip; heavy "pushing" 15.7 N |
| head-on 40 kg vs 2 kg, normal | — | 0.00 | both stop: push 8.4 N < light's grip 15.7 N |
| rear-end, parked, brake 0, normal / top | 1192.8 / 1184.5 | 0.00 / 0.00 | driver stops, parked one moves 0.00 mm (holds 39.2 N) |
| rear-end, parked, brake 2 N | — | 0.00 | pushed along: 0.990 / 0.976 m/s, "Lực đang đẩy" 4.0 N |
| rear-end, parked, brake 10 N | — | 0.00 | holds (20 N > 8.4 N) |
| fast (1.885) behind slow (0.99) | — | −16.49 (gap) | follows at 0.990 m/s, steady gap 16.5 mm = one tick of the leader |
| crossing, normal / top | 241.9 / 441.2 (with sensors) | 0.00 / 0.00 | one waits at the other's side, then both drive on |
| glancing 30°, normal / top | — | 0.00 / 0.00 | held at the face, creeps along it at 0.009 / 0.044 m/s |
| 8 in a row, first parked, top | — | 0.00 | all at rest, 0.00 mm moved in 3 s |

Fastest ground speed after contact = fastest before in every run (0.990 / 1.885): no gain.

Crates riding through a head-on stop (1 kg, 0.4 m, on each chassis):

| Drive | Slide on its chassis mm | Still on | Creep in 3 s of pressing mm | Spike, normal stop mm |
|---|---|---|---|---|
| 0.99 m/s | 99.7 / 92.3 | yes | 0.00 | 27.0 |
| 1.885 m/s | 221.8 / 221.8 | yes | 0.00 | 89.8 |

**Not met:** a head-on stop is instant (like hitting a wall), so the crate slides about v²/(2μg), 2.5–3.7 × a normal stop. It stays on a 1.2 m chassis and does not move while the robots press on each other.

## Fix 2 — rule as implemented

- Param `width` "Bề rộng", advanced, default 0 = thickness (`link.ts:44`). Absent on a saved card = 0. Create-only like length and thickness.
- One place decides the width (`linkWidth`, `arm-solid.ts:30`). Used by: the drawn block size z (`link.ts:58`); the exact box the crate engine and the joint sweep meet (`linkOutline`, `arm-solid.ts:83`, `link.ts:90`, `:97`); the upright cover for everything else (`linkCubes` → `plateCover`, `arm-solid.ts:45`, 0.2 m cells, sizes follow the turn).
- Sensors, contacts, picking read the block size, so they follow (test: an item 25 cm off the centre line touches the plate, not the bar).
- Mass and torque: unchanged. Link mass is its own param at mid length; push torque uses the same slices along the length.
- Drawing: no change in `render/arm-part-models.ts`; it already draws 80 % of the block's depth, so the look is stretched (test checks the extents).
- One handbook line for the new setting (`content-robot-arm.ts:56`).

### Numbers (0.6 × 0.6 × 0.05 m tray, pivot at the chassis rear edge, hub "Chắn vật" = Không)

| | 1 kg | 5 kg | Spike |
|---|---|---|---|
| rest 3 s: drift / overlap mm | 0.02 / 0.27 | 0.02 / 0.27 | 0.0–0.1 / 0.1–0.3 |
| slide speeding up / braking mm (0.99 m/s) | −1.9 / 27.0 | −1.0 / 27.0 | 0.4–2.4 / 27.0 |
| tilt 30° at 60°/s: leaves s / lands m behind centre | 1.07 / 1.05 | 1.07 / 1.07 | 1.85–2.13 / 0.93–1.13 (30°/s) |
| tilt 45° at 60°/s: leaves s / lands m | 1.00 / 1.15 | 1.00 / 1.15 | 1.73–1.77 / 1.28–2.01 (30°/s) |
| deepest overlap with the tray while tipping mm | 0.28 (30°), 2.63 (45°) | 0.26, 1.02 | none up to 60°/s |
| fastest crate speed m/s | 2.30 | 2.35 | 2.4–4.1 |
| joint load read N·m | 10.7 | 41.6 | 15.2 / 56.4–60.1 (1 m tray) |

Default 50 N·m is enough here for 5 kg (41.6 N·m at this shorter lever); the tests use 150.

Which tilt dumps (1 and 5 kg, same result):

| Joint speed | 30° | 32° | 35° | 40° | 45° |
|---|---|---|---|---|---|
| 10°/s | stays | stays | leaves | leaves | leaves |
| 30°/s | stays | stays | leaves | leaves | leaves |
| 60°/s | leaves | leaves | leaves | leaves | leaves |

## Fix 3 — rule as implemented

- Every arm piece already asks `baseFrame` for its mount once a tick; that call now also tells the world what the piece is bolted to (`arm-parts.ts:168`, new `WorldApi.setMount`, `types.ts:907`, `world.ts:834`). No edit in joint, link, gripper or piston files.
- The world follows the chain to the body the machine stands on (`world.ts:118`, `:130`). `massOn(list, target, parts)` (`material.ts:118`): bolted pieces never weigh on the target, wherever they sit (`:141`); what rests on one of them counts for the target (`:201`); a crate gripped by a bolted hand counts whole (`:145`). Chassis payload gets it at `physics.ts:316`; "Cân" (`world.massOn`) gets it too.
- Only with "Vật lý thật": `setMount` is ignored otherwise (`world.ts:836`), so switch-off boards weigh exactly as before.
- A mount not declared again before the next step is dropped (unplugged or deleted piece).

Two more defects showed up in the tests and are fixed because the tray does not work without them:

| Defect | Evidence | Fix |
|---|---|---|
| A chassis was blocked and shoved by its own solid pieces. A default ("Tự động") hub on a chassis sits 4 cm into its top. | Chassis rose 0.56 m per 5 ticks; or jumped 0.15–1.0 m per tick. The spike avoided it with hub = Không. | Own pieces are not obstacles for their chassis (`physics.ts:315`) and do not push what they are bolted onto when they move (`world.ts:805`). |
| Lever shares added up to more than the weight. | 3 kg crate tipping off the tray read up to 4.61 kg; a unit case gave 4.25 for 3. | Supports dropped as collinear are reset (`weighing.ts:127`). |

### Before / after

| Chassis with the 0.6 m tray | Before (spike, 1 m beam) | After |
|---|---|---|
| payload, no crate | 70 kg | 0.000 kg |
| speed after 3 s at power 0.7 | 0.34 m/s | 0.990 m/s, tick for tick equal to a bare chassis |
| payload with 1 / 5 kg crate on the tray | unchanged by the crate | 1.000 / 5.000 kg |
| tray 10 cm above the chassis, 2 kg crate | not seen | 2.000 kg |
| while tilted 5–20° | — | 3.00 kg steady; after the dump 0 |
| "Quá tải", max 3 kg | — | 5 kg: on, chassis moves < 1 mm; 2 kg: off, drives |

### Shipped boards with a machine on a chassis

Checked the 138 boards the hash guards cover (samples, lessons, handbook try-boards) by following every `base` wire of joint, link, gripper and piston cards: **none ends on a `robot-body`**. AGV: arm on the block `tru`, piston unmounted at a fixed place. So no shipped board changes, switch on or off. `solid-off-unchanged` and `real-physics-on-hash` pass with the baselines untouched.

## Tests added

| File | Tests | Covers |
|---|---|---|
| `tests/world/robot-vs-robot.test.ts` | 20 | head-on equal (normal, top), 40 vs 2 kg (strong, weak motors), rear-end brake 0 / 2 N (both step orders) / 10 N, fast behind slow, crossing ×2, glancing ×2, 8 in a row parked and pushed, crates riding, non-solid chassis, side and top view, switch off = each robot ends where it ends alone |
| `tests/arm/link-plate-tray.test.ts` | 16 | shape maths, param default and absent, rest 3 s, drive and brake, tip 30° / 45° for 1 and 5 kg, width carries the crate, weak joint, switch off, contact, drawn extents |
| `tests/world/robot-own-parts-payload.test.ts` | 21 | tray, bar, fork, piston weigh 0 and drive like a bare chassis; crate on each counts; overload; acceleration halves; gripped crate; stale mount; chain of pieces; shares add up; switch off unchanged |
| `tests/helpers/chassis-metrics.ts`, `tray-metrics.ts` | — | measure from entity views and the joint frame only |

Every geometry check is per tick. No assertion depends on machine load.

## Full suite on f6acc66

`npx vitest run --testTimeout 300000`, once, on f6acc66 with a clean tree: **254 files passed (254), 3867 tests passed (3867)**, 706 s. Base was 251 files / 3810 tests: +3 files, +57 tests. No timeout in this run (level-7-decoy and city-delivery-3d passed). `npx tsc --noEmit -p .` clean. An earlier partial run under load timed out once in `city-delivery-3d` "cars stop at a red light" (180 s); it passed in the full run.

## Shots

`plans/reports/shots-robot-rules/` (dev server 5313, one board built by `take-shots.mjs`). I read three:

| Shot | Shows |
|---|---|
| `play-01-t0.6s.png` | two robots apart, crate on the tray of the third |
| `play-04-t3.0s.png` | the two robots nose to nose, not inside each other; tray tilted, crate sliding to its back edge |
| `play-08-t6.0s.png` | robots still nose to nose; crate on the floor behind the tray robot |

One console line: a 404 for a resource (not looked into). Other shots in the folder were not read.

## Remaining limits

- Head-on or wall stop is instant: carried crates slide 100–220 mm (table above).
- A pusher does not slow under the load, and the shoved chassis takes its speed in one tick; no momentum sharing. A shoved chassis is not turned.
- Collision shape is still the upright square (side = longer chassis side).
- Glancing contact: the mover creeps along the face at 0.009–0.044 m/s (same share rule as along a wall).
- A follower stepped before its leader trails by 16.5 mm and reads 1.048 for a real 0.990 m/s.
- Robots and vehicles still pass through each other.
- Two robots that both stop for each other stay stopped: that is board logic.
- Tray: 30–32° dumps only at 60°/s; use ≥ 35°. The hub at the dump end must be "Chắn vật" = Không (a solid hub stands 12.5 cm above a 5 cm tray).
- Drawn plate is 80 % of the real width (6 cm short each side on a 0.6 m tray): today's look, stretched.
- The plate's upright cover (for people, vehicles, non-rigid items) has corners up to 15 cm off a turned plate, and lags while a rigid crate lies on a tilted tray. Rigid crates use the exact box.
- "Cân" wired to a link tip was not checked.
- Own parts add nothing to the chassis's moving mass (link "Khối lượng" loads the joint only).
- With the switch off, a solid hub on a chassis still shoves the chassis, and parts still read as load (old behaviour kept).

## Merge notes

- `src/engine/types.ts`: one new `WorldApi` method (`setMount`), 7 lines after `setExactBodies`. `tests/nodes/fake-world.ts`: one stub line.
- `src/nodes/link.ts`: one new param line after `color`, plus the width passed through `create` / `evaluate`.
- `src/handbook/content-robot-arm.ts`: one line.

## Unresolved questions

1. Is an instant stop on robot-vs-robot contact acceptable, or should carried crates be protected (that needs a stopping distance, which a solid contact does not have)?
2. Should own parts add their "Khối lượng" to the mass the motors move?
3. Should the drawn plate be as wide as the solid one (one number in `buildLink`), before the looks are replaced?
