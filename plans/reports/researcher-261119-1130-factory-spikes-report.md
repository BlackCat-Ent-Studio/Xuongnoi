# Factory spikes W0 — four measurements for the parcel-sorting plan

Date 2026-11-19 · worktree `D:\workspace\GameBuilder-spike` · branch `spike/w0` · commits b08f7c6, b1c81bb (tests only, never pushed, never merged) · base c929622.
No file under `app/src` was edited. Spike code: `app/tests/spike-w0/`; raw tables and per-tick CSV series: `app/tests/spike-w0/out/`.
Run: `cd app && npx vitest run tests/spike-w0/<file> --testTimeout 600000`. Headless node v24.15, i7-11800H (16 logical CPUs), 60 ticks per second, "Vật lý thật" on, gravity 9.81, crate friction default 0.5.

## Summary

| Spike | Answer | One line |
|---|---|---|
| 1 Tilt tray | **GO-WITH-CHANGES** | Joint + solid link on a chassis carries a rigid crate (drift 0.0–0.1 mm in 3 s) and dumps it at 30° and 45°. Works only inside limits found below; three engine gaps make it awkward (no flat tray shape, false payload, tray load not weighable). |
| 2 Robot vs robot | **NO-GO as is** (collision) · **GO-WITH-CHANGES** (traffic by sensor) | Two chassis pass straight through each other, overlap up to the whole 1.19 m, speed unchanged. "Dò phía trước" does stop and restart a follower, but two robots meeting head-on or at a crossing deadlock, and at a crossing they are already 242–441 mm inside each other. |
| 3 Placement audit | **GO-WITH-CHANGES** (small) | 66 params hold a world position (17 of 71 node kinds), 4 a world direction. No param refers to another card by id. One optional flag on `ParamDef` covers it: 68 definitions, 22 places in the source. |
| 4 Cost of 8 machines | **NO-GO as is for 8 copies of the AGV board** · **GO for 8 small tray chassis** | 8 AGV boards: 21.2 ms per tick mean (127 % of a 16.7 ms frame), p95 33.5, max 54–59. Cost grows about with the square of the entity count. 8 tray chassis (105 entities): 4.1 ms mean, p95 5.3. 16 of either is far over budget. |

---

## Spike 1 — tilt tray: GO-WITH-CHANGES

**Build (existing pieces only):** `robot-body` 1.2 × 1 × 0.3 m, 5 kg → `joint` (pitch, `mount` at the rear edge, hub "Chắn vật" = Không) → `link` 1 m, "Chắn vật" = Có. Crate 0.4 m cube on the link. Four tray shapes tried:

| name | pieces | what it is |
|---|---|---|
| beam | 1 joint + 1 link, thickness 0.2 | a 0.2 m wide rail under a 0.4 m crate |
| slab | 1 joint + 1 link, thickness 0.6 | wide enough for the crate, but 0.6 m tall |
| fork | 2 joints + 2 links, thickness 0.1, 0.24 m apart | two rails |
| side-slab | yaw joint held at 90° → pitch joint → link 0.6 | tray points sideways, dumps over the chassis's right edge |

### Numbers

| Question | Result |
|---|---|
| (a) rests 3 s, chassis still | yes, all 4 shapes, 1 kg and 5 kg. Drift 0.0–0.1 mm. Overlap depth 0.1–0.3 mm (constant). Tilt ≤ 0.06°. |
| (b) drive at sample speed 0.99 m/s, then brake | stays on. Slide while speeding up 0.4–2.4 mm. **Slide while braking 27.0 mm** per stop (same for 1 and 5 kg), always forward, so it adds up stop after stop. |
| (b) default motor, 1.88 m/s | stays on. Slide 12–90 mm speeding up, **89.8 mm braking**. |
| (b) motor ramp 300 instead of 400 rpm/s | braking slide drops to 6.9 mm (0.99 m/s) and 13.6 mm (1.88 m/s). |
| (b2) spin on the spot 3 s | stays on, drift 0.1–2.1 mm. |
| (c) tilt to 30° at 30°/s, 1 kg | starts to slide at 28–30° (0.93–1.02 s), leaves the tray at 1.85–2.13 s, lands 0.93–1.13 m from the chassis centre **lying on its side (90°)**. Max speed 2.4–3.8 m/s = fall speed from the tray height. |
| (c) tilt to 45° at 30°/s, 1 kg | leaves at 1.73–1.77 s, lands 1.28–2.01 m away, on its side or upside down. Max speed 2.8–4.1 m/s. |
| (c) 5 kg, joint torque default 50 N·m | **joint never moves**: "Quá tải" on all 480 ticks, load read 56.4–60.1 N·m. |
| (c) 5 kg, torque 150 N·m | same as 1 kg: leaves at 1.73–2.08 s, lands 0.94–1.97 m away. 10 kg reads 107.9–115.3 N·m and also works at 150. |
| launch | none up to 60°/s (crate hops 6–19 mm when the joint stops). **90°/s: overlap up to 4.6 mm, speed up to 4.6 m/s. 360°/s: crate thrown 2.0–4.75 m, 5.0–6.9 m/s, overlap up to 7.7 mm.** |
| tunnelling | none. Lowest crate centre 0.20 m = lying on the floor. Chassis moved 0.0 mm in every tilt run. |

### Limits to design inside

- Tilt angle ≥ 30° (friction 0.5 slides from 26.6°; measured start 28–30°). 45° is quicker and more certain.
- Joint speed ≤ 60°/s.
- Joint torque ≥ 10.3–11.0 N·m per kg of crate (crate in the middle of a 1 m tray), plus 4.9 N·m for the 1 kg link: 15.2 read for 1 kg, 56.4–60.1 for 5 kg, 107.9–115.3 for 10 kg. The model charges (1 + μ)·m·g at the lever of the farthest touching slice (`app/src/world/linear-actuator.ts:297-298`, `app/src/world/arm-solid.ts:164`), about 2.1× the physical m·g·lever.
- Brake gently: motor "Độ tăng tốc" ≤ 300 rpm/s (wheel ramp 4.71 m/s², just under the crate's μ·g = 4.9). The default 400 gives 6.28 m/s².
- The crate tumbles as it leaves the edge. A chute must be a catch area 0.9–2.0 m from the chassis centre, not a slot.

### Gaps found (cause with file:line)

| # | Finding | Evidence | Cause |
|---|---|---|---|
| 1 | **No flat tray shape.** A link is length × thickness × thickness; no width, no side lip. | "slab" needs thickness 0.6 → a 0.6 m tall block; "beam" is a 0.2 m rail. | `app/src/nodes/link.ts:25-27` (params), `:56` size `{ x: length, y: t, z: t }`. Missing param: a link width separate from its thickness. A `block` cannot be mounted on a joint (no `base` input). |
| 2 | **The tray is weighed as cargo of its own chassis**, 10 kg per piece. | Tray ≤ 4 cm above the chassis top: "payload" reads 70 kg (beam), 30 kg (slab), 220 kg (fork) with no crate; top speed after 3 s 0.34 / 0.72 / 0.11 m/s instead of 0.99. At ≥ 6 cm: 10 / 0 / 20 kg (the drawn joint hub still counts), speed 0.99 but acceleration 0.56 instead of 1.68 m/s². | `app/src/world/material.ts:133` counts every visible body (solid or not: cover cubes, drawn link, drawn hub); `:162` takes the block default 10 kg, not the link's "Khối lượng"; rest gap 5 cm (`:74`, used at `:98`). Fed to the drive at `app/src/world/physics.ts:313`. Same for a piston on a chassis (+10 kg, table g). |
| 3 | **A crate on the tray is invisible to "Khối lượng đang chở" and to a scale on the link.** | Tray 10 cm up: payload unchanged with a 1 kg crate; `force-sensor` wired to the link tip reads 0.00 kg (fork 0.09). | The crate rests on the cover cubes, which do not rest on the chassis; the link tip is the drawn, non-solid box. |
| 4 | Workaround for 3 that works today | `zone` with "Bám theo đối tượng" = chassis, filter Đồ vật: count 0 without crate, 1 with crate (table h). | — |
| 5 | Left-over debug line in the engine | `app/src/world/crate-engine.ts:394` `if ((globalThis as any).__dbg) console.log(...)`, also in main. | Not touched. |

### Smallest general changes (described, not built)

1. `link`: add "Chiều rộng (m)" (default = thickness, so old boards are unchanged) and use it for the drawn box, the cover cubes and the exact box. Optional second step: a "Thành chắn" (lip) choice.
2. Weighing rule: a piece mounted on a body (arm registry `baseId` chain) is not cargo of that body; or it counts with its own mass param. One rule in `massOn`, no sample knowledge.
3. Optional: let "Cân" read rigid crates resting on a solid link.

### Against the proven alternative

Piston on the chassis (table g): pushes 1 kg / 5 kg off with exactly μ·m·g = 4.91 / 24.53 N, crate leaves in 0.73 / 0.78 s, lands 1.33 m away at 2.3 m/s, and "Khối lượng đang chở" sees the crate; but the barrel is stroke + 0.2 m, so a 0.9 m stroke sticks out 1.15 m beyond a 1.2 m chassis. A fixed piston per chute (as agv-board.ts) avoids that and needs 6 pistons instead of 8 trays.

---

## Spike 2 — robot vs robot: NO-GO as is

Chassis 1.2 × 1 × 0.3 m, 5 kg. Normal = sample drive (2 × 6 N, 90 rpm, power 0.7 → 0.99 m/s). Max = default motor (2 × 30 N, 120 rpm, power 1 → 1.88 m/s). Overlap = how deep the two collision squares (1.2 m) are inside each other.

| Run | Normal 0.99 m/s | Max 1.88 m/s |
|---|---|---|
| (a) head-on | first overlap 2.73 s, deepest **1185.7 mm**, 72 ticks, passed through, both stay at 0.99 m/s | deepest **1169.0 mm**, 38 ticks, passed through, both stay at 1.88 |
| (b) one stopped, hit from behind | deepest **1192.8 mm**, 146 ticks, passed through; driver stays at 0.99, the stopped one stays at 0.00; "Đang đẩy vật" never on | deepest **1184.5 mm**, 76 ticks, passed through |

**(c) Follower with "Dò phía trước" → Đảo ngược → Đổi thành số → × power → both motors.** Leader 3.5 m ahead, stops for 6 s, drives on.

| Sensor reach m | Normal: gap at rest m | Normal: smallest gap m | Max: gap at rest m | Max: smallest gap m |
|---|---|---|---|---|
| 3 | 2.906 | 2.906 | 2.715 | 2.715 |
| 1 | 0.911 | 0.911 | 0.704 | 0.704 |
| 0.5 | 0.416 | 0.416 | 0.201 | 0.201 |
| 0.25 | 0.168 | 0.168 | **−0.050** | **−0.050** |
| 0.1 | 0.020 | 0.020 | **−0.207** | **−0.207** |

- Stopping distance after "Đang bị chặn": **0.062 m in 0.15 s at 0.99 m/s; 0.252 m in 0.28 s at 1.88 m/s** (wheel ramp 400 rpm/s = 6.28 m/s²).
- Safe reach: ≥ 0.1 m at normal speed, ≥ 0.3 m at max speed. Below that the follower ends inside the leader.
- Restart: yes in all 10 runs, 0.32–0.37 s after the leader moves on; it then trails at reach + 0.23–0.31 m.

**(d) Two robots with the sensor, head-on:** both stop (gap 0.32–2.83 m; at max speed with reach 0.5 they end 122 mm inside each other) and **never move again** (both blocked, 6 of 6 runs).
**(e) Crossing at a right angle:** the sensor sees the other robot too late: deepest overlap **241.9 mm** (normal) and **441.2 mm** (max), then both stay blocked (4 of 4 runs).

### Code path that decides it

- `app/src/world/physics.ts:383` — `solids` = visible solid **blocks** only.
- `app/src/world/physics.ts:412` → `stepRobot` → `:321` `integrate(r, dt, mode, solids)`: a chassis is moved against blocks only; no `rivals` argument. Vehicles do get one (`:290-291`, `:300`, `:303`).
- `app/src/world/physics.ts:386-387` — robots are added only to `walkSolids`, which stops characters.
- `app/src/world/crate-engine.ts:130` and `:156` — in the rigid-body engine a chassis is a position-driven kinematic box; two kinematic boxes do not collide.
- Sensor: `app/src/world/probe-ahead.ts:22` (robots are obstacles), `:136-137` (beam = 90 % of the body width, straight ahead), which is why a robot from the side is seen late.

### Smallest general change (described, not built)

Give `stepRobot` the list of other solid chassis (and vehicles) as obstacles in `integrate`, the way `stepVehicle` passes `rivals`, behind the "Vật lý thật" switch so every old board keeps its hash. That gives "stop at each other", not momentum exchange. Head-on and crossing deadlocks are board logic (lanes one way, a zone per crossing with a priority rule), not a physics fix.

---

## Spike 3 — placement audit: GO-WITH-CHANGES (small)

Script `s3-placement-audit.test.ts` reads the registry: **71 node kinds, 423 params** (189 number, 95 select, 85 vec3, 29 color, 24 text, 1 key). Every vec3 is classified (the script prints UNCLASSIFIED otherwise: 0). Each class was written after reading the node's code.

| Class | Params | Of which vec3 |
|---|---|---|
| world position | **66** | 66 |
| world direction / heading | **4** | 0 |
| size or offset relative to something | 31 | 19 |
| other (text keys, cone width, camera preset) | 8 | 0 |

17 of 71 node kinds hold a place or direction; 54 hold none.

### Params that must move with a copy (world position, 66)

| Node kind | Param(s) | Note |
|---|---|---|
| block, character, item, vehicle, robot-body, portal, rotating-platform | position | where the body is created (7) |
| moving-platform | position, to | both ends absolute (2) |
| patrol | pointA, pointB | (2) |
| route-follow | p1 .. p32 | absolute; fallback when "Lấy điểm từ vật" is on and the port is unwired (32) |
| line-track | center | x, z = middle of the preset shapes; y = floor height (1) |
| line-track | p1 .. p16 | absolute x, z; **not** relative to "Tâm" (16) |
| zone | center | absolute; **becomes an offset** when input "follow" is wired (`zone-sensor.ts:146-156`) |
| spawner | position | absolute; **becomes an offset** when input "at" is wired (`spawner.ts:110-114`) |
| camera | point | absolute in mode "fixed"; **offset** from the target in mode "follow" (`render/camera-director.ts:49-52`) |
| linear-actuator | position | ignored when "base" is wired (`linear-actuator.ts:226`) |
| teleport | position | ignored when "dest" is wired (`teleport.ts:42`) |
| go-to | targetPos | ignored when "target" is wired (`go-to.ts:92`) |

### World direction (4) — only matter if a copy is also turned

| Node kind | Param | Note |
|---|---|---|
| robot-body | heading | degrees, 0 = +x, 90 = +z |
| linear-actuator | direction | degrees on the ground; relative to the mount frame when "base" is wired |
| linear-actuator | orient | select ground / up / down |
| block | beltDir | select x / −x / z / −z |

A turned copy also swaps x and z of every `size` / `colliderSize` / `colliderOffset` and of line-track `length` / `breadth`; only quarter turns are possible because blocks are axis-aligned.

### Relative (no change needed, 31)

`size`, `colliderSize`, `colliderOffset` (block, character, item, vehicle, robot-body, portal, platforms, spawner, zone); `mount` (joint, linear-actuator); motor `side` / `forward`; line-sensor `side` / `forward`; ahead-sensor `mountSide` / `mountForward` / `lookAngle`; joint `start` / `min` / `max`; line-track `length` / `breadth`.

### References to another card inside a param value

**None by card id.** All 24 text params were read. Two kinds of shared text key exist:

| Param | What it does | Risk for copies |
|---|---|---|
| portal `pair` | two portals with the same code are linked (`app/src/world/teleport.ts:125`) | copies of a group would share the code and cross-link |
| item `tag`, cargo `loadType` / `unloadType`, zone `goods`, nearest-item `goods` | goods type matched by text | shared between copies, usually wanted |

### Proposed mechanism (smallest general)

Optional field on `ParamDef` (`app/src/engine/types.ts:60`): `place?: 'point' | 'heading'`, plus `offsetWhenWired?: string` (an input port id) for the three params that change meaning.

| Count | |
|---|---|
| param definitions needing `place: 'point'` | 66 |
| needing `place: 'heading'` | 2 (robot-body heading, linear-actuator direction) |
| **total definitions** | **68** |
| places to edit in the source | 22 (line-track p1..p16 and route-follow p1..p32 are one generator each: `line-track.ts:24`, `route-follow.ts:71`) |
| needing `offsetWhenWired` | 3 (zone center / "follow", spawner position / "at", camera point in mode "follow") |

Check that the list is enough for a moved copy: spike 4 shifted exactly these params for the AGV board (7 kinds) and every one of 1, 4, 8 and 16 copies delivered the same 2 crates and 2 laps in 60 s.

---

## Spike 4 — cost of 8 machines

**Machine load while measuring:** 5 `node.exe` alive at the start and at the end (vitest and its worker among them; 414 → 666 MB together); 2–3 `node.exe` when no test of mine ran. CPU use of other processes was not recorded. Numbers below are one run each (8× twice).

### 4a. AGV sample cloned N times (flat graph, ids prefixed, world points shifted 14 m apart), 60 simulated seconds

| Copies | Cards | Wires | Entities / crates | Compile ms | Compile + create ms | Mean ms/tick | p50 | p95 | p99 | Max | Cards part | World step part | Share of 16.7 ms frame (mean / p95) | 60 s simulated in |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 81 | 116 | 37 / 3 | 0.47 | 1.13 | **0.94** | 0.90 | 1.32 | 1.46 | 2.84 | 0.54 | 0.39 | 5.6 % / 7.9 % | 3.4 s |
| 4 | 324 | 464 | 148 / 12 | 6.55 | 7.96 | **6.30** | 6.10 | 10.10 | 12.14 | 15.18 | 3.45 | 2.85 | 37.8 % / 60.6 % | 22.7 s |
| 8 | 648 | 928 | 296 / 24 | 27.80 | 30.05 | **21.19** | 21.17 | 33.52 | 41.42 | 53.98 | 10.79 | 10.39 | 127.1 % / 201.1 % | 76.3 s |
| 8 (again) | 648 | 928 | 296 / 24 | 27.73 | 29.51 | **21.37** | 21.15 | 34.59 | 43.33 | 58.72 | 10.91 | 10.45 | 128.2 % / 207.5 % | 76.9 s |
| 16 | 1296 | 1856 | 592 / 48 | 110.67 | 118.83 | **103.53** | 91.95 | 213.09 | 268.33 | 325.70 | 48.32 | 55.21 | 621 % / 1279 % | 372.7 s |
| 8, switch off (cost reference only) | 648 | 928 | 208 / 24 | 24.56 | 26.11 | 8.15 | 7.88 | 10.45 | 13.21 | 18.50 | 6.37 | 1.79 | 48.9 % / 62.7 % | 29.4 s |

Scaling: 1 → 4 copies costs 6.7×, 4 → 8 costs 3.4×, 8 → 16 costs 4.9×: about the square of the size. 8× without the first 10 s: mean 21.9, p95 35.8, max 54.0 ms. Every copy delivered 2 crates and ran 2 laps.

### 4b. Closer to the plan: N small tray chassis (2 motors, "Dò phía trước" stop, tilt tray, load zone, 3 line sensors on its own line, 1 crate), drive 20 s, dump, drive on

| Chassis | Cards | Wires | Entities | Mean ms/tick | p50 | p95 | p99 | Max | Share of frame (mean / p95) |
|---|---|---|---|---|---|---|---|---|---|
| 1 | 19 | 20 | 14 | 0.36 | 0.29 | 0.62 | 0.99 | 67.33 (first tick) | 2.1 % / 3.7 % |
| 2 | 34 | 40 | 27 | 0.56 | 0.51 | 0.76 | 1.46 | 4.02 | 3.3 % / 4.5 % |
| 4 | 64 | 80 | 53 | 1.35 | 1.26 | 1.77 | 3.74 | 5.87 | 8.1 % / 10.6 % |
| **8** | 124 | 160 | 105 | **4.12** | 3.85 | 5.35 | 11.83 | 15.39 | **24.7 % / 32.1 %** |
| 8 (again) | 124 | 160 | 105 | 4.05 | 3.81 | 5.07 | 11.63 | 16.04 | 24.3 % / 30.4 % |
| 16 | 244 | 320 | 209 | **34.70** | 33.57 | 60.30 | 116.36 | 203.60 | 208 % / 362 % |

All crates were still on their trays after 20 m of driving (8 of 8, 16 of 16) and all were dumped by the end. This fleet has no chutes, no router and no spawners, so the real factory board will cost more than the 8-chassis row.

### Where the time goes (8 AGV copies, CPU profile + a timer around each card kind)

| Share of all time | What | Where |
|---|---|---|
| 22.2 % | a fresh view object of **every** entity on each `listEntities()` / `entities()` call | `app/src/world/world.ts:881-886`; callers once or more per card per tick: `nodes/gripper.ts:378`, `nodes/zone-sensor.ts:167`, `nodes/linear-actuator.ts:56` (joints, pistons, grippers), `nodes/line-sensor.ts:47` |
| 18.1 % | weight on each chassis, recomputed per robot per tick over all entities | `app/src/world/physics.ts:313` → `app/src/world/material.ts:123-186` |
| 13.8 % | contact list: every pair of entities every tick | `app/src/world/world.ts:127-140` |
| 9.2 % | each moved arm cube scans the whole entity list three times | `app/src/world/world.ts:760-765` → `app/src/world/platforms.ts:136-143` |
| 8.8 % | line sensors (not quadratic: 180 → 200 µs per sensor per tick, but 24 of them) | `app/src/nodes/line-sensor.ts`, `app/src/world/line-track.ts` |
| ≤ 2.6 % | everything else in the physics step, the rigid-body engine included | `stepPhysics` 25.3 % minus `stepRobot` 22.7 % |

Per card kind at 8×: gripper 34.7 % of the card time (248 → 1212 µs per card from 1× to 8×), zone 27.0 % (60 → 471 µs), line-sensor 17.2 %, joint 15.9 % (84 → 277 µs). The logic cards (math, and, or, map-range, compare…) together are under 2 %.
Compile: `app/src/engine/compile.ts:69-71` sorts all remaining ids once per emitted card (n² log n): 0.5 ms at 81 cards, 28 ms at 648, 111 ms at 1296. One-off, not a per-tick cost.

### Smallest general changes (described, not built)

1. Build the entity views once per tick (or hand cards the live list read-only) instead of on every call.
2. Compute what rests on a chassis from the bodies near it, once per tick, and reuse it for every robot.
3. Contacts: skip pairs that are far apart (a coarse grid) before the exact test.
4. `moveBlockTo`: filter the solid / movable / crate lists once per tick, not per moved cube.

None of these touch a sample. With them the cost should grow about linearly; that is an expectation, not a measurement.

---

## Not verified

- Browser: nothing was run in Chromium. No rendering cost, no real GPU, no phone. All numbers are node, one machine, one run each.
- Chromium-vs-node determinism of these boards.
- Tilt tray: only a 0.4 m cube crate, friction 0.5, tray 1 m, chassis 1.2 × 1 m; no ball, no tall crate, no two crates, no tilt while driving, no dump into a real chute or onto a belt, no crate landing on another robot.
- Driving turns with a loaded tray (only a spin on the spot and a straight run).
- Whether a wider link (change 1) keeps the 0.1–0.3 mm rest overlap.
- Robot vs robot: no run with trays or crates on the robots; no wider sensor beam (`beam` param) at crossings; no three-robot queue.
- Placement: a turned (not only moved) copy was not tried; the 2D views were not tried.
- Cost: the four fixes are not built, so the "linear" expectation is unproven. The 16-chassis jump (8.5× for 2×) was not profiled. The refactored `s4-eight-machines-cost.test.ts` (clone helper moved to its own file, same code) was type-checked but not re-run after the move.
- `npx tsc --noEmit -p .` is clean with the spike files. No other test of the repo was run.

## Unresolved questions

1. Tray shape: add a link width (change 1), or accept a 0.2 m rail / a 0.6 m slab for the first factory board?
2. Should a tray mounted on a chassis stop counting as its payload (change 2)? It changes "Khối lượng đang chở" on any existing board that has an arm or piston on a robot; which boards do is not checked.
3. Robots stopping at each other (spike 2 change): wanted under "Vật lý thật", or keep pass-through and solve traffic only with sensors and zones?
4. Crossing rule for the grid: who has priority, and is one-way lanes acceptable to the lesson design?
5. Is a crate that lands on its side in a 1–2 m catch area acceptable as "sorted into a chute"?
6. Performance work (4 changes) before or after the first factory board? At 8 tray chassis the board fits today (25 % of a frame headless); with chutes, spawners and routing cards it is unknown.
7. Copies: translation only, or quarter turns too (then `size` axes and `beltDir` must be handled)?

---

## Appendix — raw output

Copied unchanged from `D:/workspace/GameBuilder-spike/app/tests/spike-w0/out/`. Per-tick series (CSV) stay in that folder: `s1-series-*.csv`, `s2ab-series.csv`.

Reading note: s1a, s1b, s1b2 and s1c ran with the tray 1 cm above the chassis, so in s1b and s1b2 the chassis is slowed by the false payload (gap 2 above); s1e and s1f repeat the drive and the tilt with the tray 10 cm up and are the ones quoted in the text for driving.

### s1a-rest.md

| tray | crate kg | on tray at 3 s | drift along mm | drift sideways mm | gap under crate mm (last) | overlap depth mm max / last | tilt to tray deg max | crate speed max m/s (after 0.5 s) |
|---|---|---|---|---|---|---|---|---|
| beam | 1 | yes | -0.0 | -0.1 | -0.2 | 0.2 / 0.2 | 0.06 | 0.0001 |
| beam | 5 | yes | -0.0 | -0.1 | -0.2 | 0.2 / 0.2 | 0.06 | 0.0001 |
| slab | 1 | yes | -0.0 | -0.0 | -0.3 | 0.3 / 0.3 | 0.00 | 0.0000 |
| slab | 5 | yes | -0.0 | -0.0 | -0.3 | 0.3 / 0.3 | 0.00 | 0.0000 |
| fork | 1 | yes | 0.0 | 0.0 | -0.1 | 0.1 / 0.1 | 0.00 | 0.0000 |
| fork | 5 | yes | 0.0 | 0.0 | -0.1 | 0.1 / 0.1 | 0.00 | 0.0000 |
| side-slab | 1 | yes | -0.0 | -0.0 | -0.3 | 0.3 / 0.3 | 0.00 | 0.0000 |
| side-slab | 5 | yes | -0.0 | -0.0 | -0.3 | 0.3 / 0.3 | 0.00 | 0.0000 |


### s1b-drive.md

| tray | crate kg | drive | top speed m/s | peak accel / decel m/s2 | slide while speeding up mm | slide while braking mm | total slide mm | on tray at end | overlap depth mm max | tilt to tray deg max |
|---|---|---|---|---|---|---|---|---|---|---|
| beam | 1 | sample (2 x 6 N, 90 rpm, power 0.7) | 0.33 | 0.11 / -6.28 | 0.0 | 3.4 | 3.4 | yes | 0.2 | 0.01 |
| beam | 1 | sample motors, power 1 | 0.47 | 0.16 / -6.28 | 0.0 | 7.1 | 7.1 | yes | 0.3 | 0.02 |
| beam | 1 | default motor (2 x 30 N, 120 rpm), power 1 | 1.88 | 0.79 / -6.28 | -1.7 | 89.9 | 88.2 | yes | 0.3 | 0.03 |
| beam | 5 | sample (2 x 6 N, 90 rpm, power 0.7) | 0.31 | 0.11 / -6.28 | 0.0 | 2.9 | 2.9 | yes | 0.2 | 0.01 |
| beam | 5 | sample motors, power 1 | 0.45 | 0.15 / -6.28 | -0.0 | 6.1 | 6.1 | yes | 0.3 | 0.02 |
| beam | 5 | default motor (2 x 30 N, 120 rpm), power 1 | 1.88 | 0.75 / -6.28 | -1.6 | 89.9 | 88.3 | yes | 0.3 | 0.03 |
| slab | 1 | sample (2 x 6 N, 90 rpm, power 0.7) | 0.70 | 0.23 / -6.28 | -0.0 | 13.8 | 13.8 | yes | 0.4 | 0.02 |
| slab | 1 | sample motors, power 1 | 1.00 | 0.33 / -6.28 | -0.0 | 27.3 | 27.3 | yes | 0.4 | 0.03 |
| slab | 1 | default motor (2 x 30 N, 120 rpm), power 1 | 1.88 | 1.67 / -6.28 | -4.6 | 89.8 | 85.2 | yes | 0.4 | 0.04 |
| slab | 5 | sample (2 x 6 N, 90 rpm, power 0.7) | 0.63 | 0.21 / -6.28 | -0.0 | 10.5 | 10.5 | yes | 0.4 | 0.02 |
| slab | 5 | sample motors, power 1 | 0.90 | 0.30 / -6.28 | 0.0 | 22.3 | 22.3 | yes | 0.4 | 0.03 |
| slab | 5 | default motor (2 x 30 N, 120 rpm), power 1 | 1.88 | 1.50 / -6.28 | -4.1 | 89.9 | 85.8 | yes | 0.4 | 0.04 |
| fork | 1 | sample (2 x 6 N, 90 rpm, power 0.7) | 0.11 | 0.04 / -3.35 | -0.0 | 0.4 | 0.4 | yes | 0.1 | 0.00 |
| fork | 1 | sample motors, power 1 | 0.16 | 0.05 / -4.71 | -0.0 | 0.9 | 0.9 | yes | 0.1 | 0.00 |
| fork | 1 | default motor (2 x 30 N, 120 rpm), power 1 | 0.80 | 0.27 / -6.28 | -0.1 | 16.8 | 16.7 | yes | 0.1 | 0.01 |
| fork | 5 | sample (2 x 6 N, 90 rpm, power 0.7) | 0.11 | 0.04 / -3.29 | -0.0 | 0.4 | 0.4 | yes | 0.1 | 0.00 |
| fork | 5 | sample motors, power 1 | 0.16 | 0.05 / -4.70 | -0.0 | 0.9 | 0.9 | yes | 0.1 | 0.00 |
| fork | 5 | default motor (2 x 30 N, 120 rpm), power 1 | 0.78 | 0.26 / -6.28 | -0.0 | 16.1 | 16.1 | yes | 0.1 | 0.01 |
| side-slab | 1 | sample (2 x 6 N, 90 rpm, power 0.7) | 0.70 | 0.23 / -6.28 | -0.0 | 13.8 | 13.8 | yes | 0.4 | 0.02 |
| side-slab | 1 | sample motors, power 1 | 1.00 | 0.33 / -6.28 | -0.0 | 27.3 | 27.3 | yes | 0.4 | 0.03 |
| side-slab | 1 | default motor (2 x 30 N, 120 rpm), power 1 | 1.88 | 1.67 / -6.28 | -4.5 | 89.8 | 85.3 | yes | 0.4 | 0.04 |
| side-slab | 5 | sample (2 x 6 N, 90 rpm, power 0.7) | 0.63 | 0.21 / -6.28 | -0.0 | 10.5 | 10.5 | yes | 0.4 | 0.02 |
| side-slab | 5 | sample motors, power 1 | 0.90 | 0.30 / -6.28 | -0.0 | 22.3 | 22.3 | yes | 0.4 | 0.03 |
| side-slab | 5 | default motor (2 x 30 N, 120 rpm), power 1 | 1.88 | 1.50 / -6.28 | -4.0 | 89.9 | 85.9 | yes | 0.4 | 0.04 |


### s1b2-spin.md

| tray | crate kg | turned deg in 3 s | crate drift along mm | sideways mm | on tray at end | overlap depth mm max |
|---|---|---|---|---|---|---|
| beam | 1 | 44.99 | -0.1 | -0.1 | yes | 0.2 |
| beam | 5 | 42.64 | -0.1 | -0.1 | yes | 0.2 |
| slab | 1 | 95.10 | -0.1 | -0.2 | yes | 0.3 |
| slab | 5 | 85.59 | -0.1 | -0.2 | yes | 0.3 |
| fork | 1 | 15.15 | 0.3 | 2.0 | yes | 0.1 |
| fork | 5 | 14.89 | 0.3 | 2.1 | yes | 0.1 |
| side-slab | 1 | 95.10 | -0.1 | 0.1 | yes | 0.3 |
| side-slab | 5 | 85.59 | -0.1 | 0.1 | yes | 0.3 |


### s1c-tilt.md

| tray | crate kg | target deg | joint deg/s | joint reached (s) / overloaded ticks / peak load N.m | crate starts to slide (s, at deg) | leaves tray (s) | rests at x, y, z (m) / tilt deg | from chassis centre m | crate speed max m/s | overlap depth mm max while on tray | lowest crate centre y | chassis moved mm |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| beam | 1 | 30 | 30 | 1.00 / 0 / 15.21 | 0.97, 29.00 | 2.08 | -1.13, 0.20, -0.01 / 90.00 | 1.13 | 2.80 | 0.3 | 0.20 | 0.0 |
| beam | 1 | 45 | 30 | 1.50 / 0 / 15.21 | 0.97, 29.00 | 1.77 | -1.40, 0.20, 0.01 / 90.00 | 1.40 | 2.96 | 0.2 | 0.20 | 0.0 |
| beam | 1 | 45 | 90 | 0.50 / 0 / 15.21 | 0.05, 4.13 | 0.53 | -1.41, 0.20, 0.03 / 90.00 | 1.41 | 3.57 | 1.2 | 0.20 | 0.0 |
| beam | 1 | 45 | 360 | 0.17 / 0 / 17.26 | 0.03, 3.39 | 0.18 | -2.00, 0.20, 0.37 / 90.00 | 2.03 | 5.03 | 5.0 | 0.20 | 0.0 |
| beam | 5 | 30 | 30 | never (ends at 0.00) / 480 / 56.41 | never | never | -0.10, 0.71, -0.00 / 0.00 | 0.10 | 0.00 | 0.2 | 0.71 | 0.0 |
| beam | 5 | 45 | 30 | never (ends at 0.00) / 480 / 56.41 | never | never | -0.10, 0.71, -0.00 / 0.00 | 0.10 | 0.00 | 0.2 | 0.71 | 0.0 |
| beam | 5 | 45 | 90 | never (ends at 0.00) / 480 / 56.41 | never | never | -0.10, 0.71, -0.00 / 0.00 | 0.10 | 0.00 | 0.2 | 0.71 | 0.0 |
| beam | 5 | 45 | 360 | never (ends at 0.00) / 480 / 56.41 | never | never | -0.10, 0.71, -0.00 / 0.00 | 0.10 | 0.00 | 0.2 | 0.71 | 0.0 |
| slab | 1 | 30 | 30 | 1.00 / 0 / 15.94 | 0.93, 28.00 | 1.87 | -1.05, 0.20, 0.00 / 90.00 | 1.05 | 3.79 | 0.3 | 0.20 | 0.0 |
| slab | 1 | 45 | 30 | 1.50 / 0 / 15.94 | 0.93, 28.00 | 1.73 | -1.76, 0.20, 0.02 / 90.00 | 1.76 | 4.01 | 0.1 | 0.20 | 0.0 |
| slab | 1 | 45 | 90 | 0.52 / 0 / 15.94 | 0.03, 2.46 | 0.53 | -2.02, 0.20, -0.07 / 180.00 | 2.03 | 4.35 | 4.5 | 0.20 | 0.0 |
| slab | 1 | 45 | 360 | 0.18 / 0 / 15.94 | 0.03, 2.89 | 0.18 | -4.71, 0.20, 0.09 / 0.00 | 4.71 | 6.87 | 7.6 | 0.20 | 0.0 |
| slab | 5 | 30 | 30 | never (ends at 0.00) / 480 / 60.09 | never | never | -0.10, 1.11, -0.00 / 0.00 | 0.10 | 0.00 | 0.3 | 1.11 | 0.0 |
| slab | 5 | 45 | 30 | never (ends at 0.00) / 480 / 60.09 | never | never | -0.10, 1.11, -0.00 / 0.00 | 0.10 | 0.00 | 0.3 | 1.11 | 0.0 |
| slab | 5 | 45 | 90 | never (ends at 0.00) / 480 / 60.09 | never | never | -0.10, 1.11, -0.00 / 0.00 | 0.10 | 0.00 | 0.3 | 1.11 | 0.0 |
| slab | 5 | 45 | 360 | never (ends at 0.00) / 480 / 60.09 | never | never | -0.10, 1.11, -0.00 / 0.00 | 0.10 | 0.00 | 0.3 | 1.11 | 0.0 |
| fork | 1 | 30 | 30 | 1.00 / 0 / 13.49 | 1.02, 30.00 | 2.13 | -1.12, 0.20, 0.02 / 90.00 | 1.12 | 2.40 | 0.1 | 0.20 | 0.0 |
| fork | 1 | 45 | 30 | 1.50 / 0 / 13.49 | 1.07, 32.00 | 1.77 | -1.28, 0.20, 0.07 / 90.00 | 1.28 | 2.79 | 0.1 | 0.20 | 0.0 |
| fork | 1 | 45 | 90 | 0.50 / 0 / 13.49 | 0.45, 40.03 | 0.53 | -1.30, 0.20, -0.04 / 90.00 | 1.30 | 3.26 | 0.0 | 0.20 | 0.0 |
| fork | 1 | 45 | 360 | 0.17 / 0 / 14.40 | 0.07, 10.34 | 0.18 | -2.52, 0.20, 0.02 / 0.00 | 2.52 | 5.05 | 4.7 | 0.20 | 0.0 |
| fork | 5 | 30 | 30 | never (ends at 0.00) / 480 / 57.63 | never | never | -0.10, 0.61, 0.00 / 0.00 | 0.10 | 0.00 | 0.1 | 0.61 | 0.0 |
| fork | 5 | 45 | 30 | never (ends at 0.00) / 480 / 57.63 | never | never | -0.10, 0.61, 0.00 / 0.00 | 0.10 | 0.00 | 0.1 | 0.61 | 0.0 |
| fork | 5 | 45 | 90 | never (ends at 0.00) / 480 / 57.63 | never | never | -0.10, 0.61, 0.00 / 0.00 | 0.10 | 0.00 | 0.1 | 0.61 | 0.0 |
| fork | 5 | 45 | 360 | never (ends at 0.00) / 480 / 57.63 | never | never | -0.10, 0.61, 0.00 / 0.00 | 0.10 | 0.00 | 0.1 | 0.61 | 0.0 |
| side-slab | 1 | 30 | 30 | 1.00 / 0 / 15.94 | 0.93, 28.00 | 1.85 | -0.05, 0.20, 0.93 / 90.00 | 0.93 | 3.78 | 0.3 | 0.20 | 0.0 |
| side-slab | 1 | 45 | 30 | 1.50 / 0 / 15.94 | 0.93, 28.00 | 1.73 | -0.07, 0.20, 2.01 / 180.00 | 2.01 | 4.06 | 0.3 | 0.20 | 0.0 |
| side-slab | 1 | 45 | 90 | 0.52 / 0 / 15.94 | 0.03, 2.46 | 0.53 | 0.04, 0.20, 1.63 / 90.00 | 1.63 | 4.50 | 4.6 | 0.20 | 0.0 |
| side-slab | 1 | 45 | 360 | 0.18 / 0 / 15.94 | 0.03, 2.89 | 0.18 | 0.08, 0.20, 4.75 / 90.00 | 4.75 | 6.87 | 7.7 | 0.20 | 0.0 |
| side-slab | 5 | 30 | 30 | never (ends at 0.00) / 480 / 60.09 | never | never | -0.00, 1.11, 0.00 / 0.00 | 0.00 | 0.00 | 0.3 | 1.11 | 0.0 |
| side-slab | 5 | 45 | 30 | never (ends at 0.00) / 480 / 60.09 | never | never | -0.00, 1.11, 0.00 / 0.00 | 0.00 | 0.00 | 0.3 | 1.11 | 0.0 |
| side-slab | 5 | 45 | 90 | never (ends at 0.00) / 480 / 60.09 | never | never | -0.00, 1.11, 0.00 / 0.00 | 0.00 | 0.00 | 0.3 | 1.11 | 0.0 |
| side-slab | 5 | 45 | 360 | never (ends at 0.00) / 480 / 60.09 | never | never | -0.00, 1.11, 0.00 / 0.00 | 0.00 | 0.00 | 0.3 | 1.11 | 0.0 |


### s1d-payload.md

| tray | clearance above chassis m | crate | chassis "payload" kg | scale on tray link kg | speed after 3 s at sample drive m/s |
|---|---|---|---|---|---|
| beam | 0.01 | none | 70.00 | 0.00 | 0.34 |
| beam | 0.01 | 1 kg on tray | 71.00 | 0.00 | 0.33 |
| beam | 0.04 | none | 70.00 | 0.00 | 0.34 |
| beam | 0.04 | 1 kg on tray | 71.00 | 0.00 | 0.33 |
| beam | 0.06 | none | 10.00 | 0.00 | 0.99 |
| beam | 0.06 | 1 kg on tray | 10.00 | 0.00 | 0.99 |
| beam | 0.1 | none | 10.00 | 0.00 | 0.99 |
| beam | 0.1 | 1 kg on tray | 10.00 | 0.00 | 0.99 |
| slab | 0.01 | none | 30.00 | 0.00 | 0.72 |
| slab | 0.01 | 1 kg on tray | 31.00 | 0.00 | 0.70 |
| slab | 0.04 | none | 30.00 | 0.00 | 0.72 |
| slab | 0.04 | 1 kg on tray | 31.00 | 0.00 | 0.70 |
| slab | 0.06 | none | 0.00 | 0.00 | 0.99 |
| slab | 0.06 | 1 kg on tray | 0.00 | 0.00 | 0.99 |
| slab | 0.1 | none | 0.00 | 0.00 | 0.99 |
| slab | 0.1 | 1 kg on tray | 0.00 | 0.00 | 0.99 |
| fork | 0.01 | none | 220.00 | 0.00 | 0.11 |
| fork | 0.01 | 1 kg on tray | 221.00 | 0.09 | 0.11 |
| fork | 0.04 | none | 220.00 | 0.00 | 0.11 |
| fork | 0.04 | 1 kg on tray | 221.00 | 0.09 | 0.11 |
| fork | 0.06 | none | 20.00 | 0.00 | 0.99 |
| fork | 0.06 | 1 kg on tray | 20.00 | 0.09 | 0.99 |
| fork | 0.1 | none | 20.00 | 0.00 | 0.99 |
| fork | 0.1 | 1 kg on tray | 20.00 | 0.09 | 0.99 |
| side-slab | 0.01 | none | 30.00 | 0.00 | 0.72 |
| side-slab | 0.01 | 1 kg on tray | 31.00 | 0.00 | 0.70 |
| side-slab | 0.04 | none | 30.00 | 0.00 | 0.72 |
| side-slab | 0.04 | 1 kg on tray | 31.00 | 0.00 | 0.70 |
| side-slab | 0.06 | none | 0.00 | 0.00 | 0.99 |
| side-slab | 0.06 | 1 kg on tray | 0.00 | 0.00 | 0.99 |
| side-slab | 0.1 | none | 0.00 | 0.00 | 0.99 |
| side-slab | 0.1 | 1 kg on tray | 0.00 | 0.00 | 0.99 |
| (no tray) | - | none | 0.00 | - | 0.99 |


### s1e-drive-clear.md

| tray | crate kg | drive | motor ramp rpm/s | top speed m/s | peak accel / decel m/s2 | slide speeding up mm | slide braking mm | on tray at end | overlap mm max |
|---|---|---|---|---|---|---|---|---|---|
| beam | 1 | sample (2 x 6 N, 90 rpm, power 0.7) | 400 | 0.99 | 0.56 / -6.28 | -0.4 | 27.0 | yes | 0.3 |
| beam | 1 | sample (2 x 6 N, 90 rpm, power 0.7) | 300 | 0.99 | 0.56 / -4.71 | -0.4 | 6.9 | yes | 0.3 |
| beam | 1 | default motor (2 x 30 N, 120 rpm), power 1 | 400 | 1.88 | 4.00 / -6.28 | -12.1 | 89.8 | yes | 0.3 |
| beam | 1 | default motor (2 x 30 N, 120 rpm), power 1 | 300 | 1.88 | 4.00 / -4.71 | -12.1 | 13.6 | yes | 0.3 |
| beam | 5 | sample (2 x 6 N, 90 rpm, power 0.7) | 400 | 0.99 | 0.56 / -6.28 | -0.4 | 27.0 | yes | 0.3 |
| beam | 5 | sample (2 x 6 N, 90 rpm, power 0.7) | 300 | 0.99 | 0.56 / -4.71 | -0.4 | 6.9 | yes | 0.3 |
| beam | 5 | default motor (2 x 30 N, 120 rpm), power 1 | 400 | 1.88 | 4.00 / -6.28 | -12.1 | 89.8 | yes | 0.3 |
| beam | 5 | default motor (2 x 30 N, 120 rpm), power 1 | 300 | 1.88 | 4.00 / -4.71 | -12.1 | 13.6 | yes | 0.3 |
| side-slab | 1 | sample (2 x 6 N, 90 rpm, power 0.7) | 400 | 0.99 | 1.68 / -6.28 | -2.4 | 27.0 | yes | 0.4 |
| side-slab | 1 | sample (2 x 6 N, 90 rpm, power 0.7) | 300 | 0.99 | 1.68 / -4.71 | -2.4 | 6.9 | yes | 0.4 |
| side-slab | 1 | default motor (2 x 30 N, 120 rpm), power 1 | 400 | 1.88 | 6.28 / -6.28 | -89.7 | 89.9 | yes | 0.4 |
| side-slab | 1 | default motor (2 x 30 N, 120 rpm), power 1 | 300 | 1.88 | 4.71 / -4.71 | -13.5 | 13.6 | yes | 0.4 |
| side-slab | 5 | sample (2 x 6 N, 90 rpm, power 0.7) | 400 | 0.99 | 1.68 / -6.28 | -2.4 | 27.0 | yes | 0.4 |
| side-slab | 5 | sample (2 x 6 N, 90 rpm, power 0.7) | 300 | 0.99 | 1.68 / -4.71 | -2.4 | 6.9 | yes | 0.4 |
| side-slab | 5 | default motor (2 x 30 N, 120 rpm), power 1 | 400 | 1.88 | 6.28 / -6.28 | -89.7 | 89.9 | yes | 0.4 |
| side-slab | 5 | default motor (2 x 30 N, 120 rpm), power 1 | 300 | 1.88 | 4.71 / -4.71 | -13.5 | 13.6 | yes | 0.4 |


### s1f-tilt-torque-speed.md

| tray | crate kg | joint torque N.m | joint deg/s | target deg | peak load read N.m | overloaded ticks | reached (s) | leaves tray (s) | rests from chassis centre m / tilt deg | crate speed max m/s | overlap mm max on tray | gap max mm before leaving (hop) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| beam | 1 | 50 | 45 | 45 | 15.21 | 0 | 1.00 | 1.05 | 1.45 / 90.00 | 3.28 | 0.1 | 19.1 |
| beam | 1 | 50 | 60 | 45 | 15.21 | 0 | 0.75 | 0.78 | 1.48 / 90.00 | 3.39 | 0.4 | 13.8 |
| beam | 5 | 50 | 30 | 45 | 56.41 | 480 | never (0.00) | never | 0.10 / 0.00 | 0.00 | 0.2 | -0.2 |
| beam | 5 | 60 | 30 | 45 | 56.41 | 0 | 1.68 | 1.93 | 1.38 / 90.00 | 3.26 | 0.2 | 7.0 |
| beam | 5 | 150 | 30 | 30 | 56.41 | 0 | 1.00 | 2.08 | 1.06 / 90.00 | 3.12 | 0.3 | 6.0 |
| beam | 5 | 150 | 30 | 45 | 56.41 | 0 | 1.50 | 1.77 | 1.42 / 90.00 | 3.26 | 0.2 | 7.0 |
| beam | 5 | 150 | 60 | 45 | 56.41 | 0 | 0.75 | 0.80 | 1.46 / 90.00 | 3.32 | 0.1 | 17.5 |
| beam | 5 | 150 | 90 | 45 | 56.41 | 0 | 0.52 | 0.55 | 1.48 / 90.00 | 3.78 | 0.1 | 15.8 |
| beam | 10 | 150 | 30 | 45 | 107.91 | 0 | 1.52 | 1.78 | 1.39 / 90.00 | 3.22 | 0.2 | 7.1 |
| side-slab | 1 | 50 | 45 | 45 | 15.94 | 0 | 1.00 | 1.03 | 1.67 / 90.00 | 4.28 | 0.6 | 16.8 |
| side-slab | 1 | 50 | 60 | 45 | 15.94 | 0 | 0.75 | 0.78 | 1.70 / 90.00 | 4.31 | 1.5 | 15.3 |
| side-slab | 5 | 50 | 30 | 45 | 60.09 | 480 | never (0.00) | never | 0.00 / 0.00 | 0.00 | 0.3 | -0.3 |
| side-slab | 5 | 60 | 30 | 45 | 60.09 | 480 | never (0.00) | never | 0.00 / 0.00 | 0.00 | 0.3 | -0.3 |
| side-slab | 5 | 150 | 30 | 30 | 60.09 | 0 | 1.00 | 1.83 | 0.94 / 90.00 | 4.02 | 0.3 | 6.0 |
| side-slab | 5 | 150 | 30 | 45 | 60.09 | 0 | 1.50 | 1.73 | 1.97 / 180.00 | 4.16 | 0.1 | 6.7 |
| side-slab | 5 | 150 | 60 | 45 | 60.09 | 0 | 0.75 | 0.80 | 1.69 / 90.00 | 4.29 | 1.0 | 19.3 |
| side-slab | 5 | 150 | 90 | 45 | 60.09 | 0 | 0.52 | 0.55 | 1.68 / 90.00 | 4.61 | 2.1 | 18.2 |
| side-slab | 10 | 150 | 30 | 45 | 115.27 | 0 | 1.53 | 1.77 | 1.73 / 90.00 | 4.15 | 0.3 | 7.2 |


### s1g-piston.md

| crate kg | payload read before kg | piston force read N max | overloaded | crate leaves chassis top (s) | rests from chassis centre m / tilt deg | crate speed max m/s | chassis moved mm |
|---|---|---|---|---|---|---|---|
| 1 | 11.00 | 4.91 | no | 0.73 | 1.33 / 90.00 | 2.26 | 0.0 |
<!-- crate -0.00,0.50,-0.00 -> -0.00,0.20,1.33; head 0.00,0.51,-0.45 -> 0.00,0.51,0.36; positionNow 0.8100000000000003 -->
| 5 | 15.00 | 24.53 | no | 0.78 | 1.34 / 90.00 | 2.30 | 0.0 |
<!-- crate -0.00,0.50,-0.00 -> -0.00,0.20,1.34; head 0.00,0.51,-0.45 -> 0.00,0.51,0.36; positionNow 0.8100000000000003 -->


### s1h-loaded-zone.md

| tray | crate | zone count | zone inside |
|---|---|---|---|
| beam | none | 0 | false |
| beam | 1 kg on tray | 1 | true |


### s2ab-pass-through.md

| run | drive | first overlap (s) | deepest overlap mm (s) | ticks overlapping | passed through each other | A speed before / during / after m/s | B speed before / during / after m/s | A "pushing" ever |
|---|---|---|---|---|---|---|---|---|
| head-on | normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 2.73 | 1185.7 (3.33) | 72 | YES | 0.99 / 0.99 / 0.99 | 0.99 / 0.99 / 0.99 | no |
| rear-end | normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 2.12 | 1192.8 (3.33) | 146 | YES | 0.99 / 0.99 / 0.99 | 0.00 / 0.00 / 0.00 | no |
| head-on | max (default motor: 2 x 30 N, 120 rpm, power 1) | 1.43 | 1169.0 (1.73) | 38 | YES | 1.88 / 1.88 / 1.88 | 1.88 / 1.88 / 1.88 | no |
| rear-end | max (default motor: 2 x 30 N, 120 rpm, power 1) | 1.12 | 1184.5 (1.73) | 76 | YES | 1.88 / 1.88 / 1.88 | 0.00 / 0.00 / 0.00 | no |


### s2c-follower.md

| drive | sensor reach m | speed when the leader stops m/s | gap when the follower first reads blocked m | gap at rest m | smallest gap ever m (negative = inside the leader) | stops in (s after blocked) | restarts when leader moves on | restart delay s | gap while both drive again m (min / max) | starts after the leader moves on (7 s) |
|---|---|---|---|---|---|---|---|---|---|---|
| normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 3 | 0.99 | 2.969 | 2.906 | 2.906 | 0.15 | yes | 0.37 | 3.253 / 3.253 | 1 |
| normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 1 | 0.99 | 0.973 | 0.911 | 0.911 | 0.15 | yes | 0.35 | 1.240 / 1.240 | 1 |
| normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 0.5 | 0.99 | 0.478 | 0.416 | 0.416 | 0.15 | yes | 0.35 | 0.746 / 0.746 | 1 |
| normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 0.25 | 0.99 | 0.231 | 0.168 | 0.168 | 0.15 | yes | 0.33 | 0.482 / 0.482 | 1 |
| normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 0.1 | 0.99 | 0.082 | 0.020 | 0.020 | 0.15 | yes | 0.33 | 0.333 / 0.333 | 1 |
| max (default motor: 2 x 30 N, 120 rpm, power 1) | 3 | 1.88 | 2.967 | 2.715 | 2.715 | 0.28 | yes | 0.32 | 3.312 / 3.312 | 1 |
| max (default motor: 2 x 30 N, 120 rpm, power 1) | 1 | 1.88 | 0.956 | 0.704 | 0.704 | 0.28 | yes | 0.32 | 1.301 / 1.301 | 1 |
| max (default motor: 2 x 30 N, 120 rpm, power 1) | 0.5 | 1.88 | 0.454 | 0.201 | 0.201 | 0.28 | yes | 0.32 | 0.798 / 0.798 | 1 |
| max (default motor: 2 x 30 N, 120 rpm, power 1) | 0.25 | 1.88 | 0.202 | -0.050 | -0.050 | 0.28 | yes | 0.32 | 0.547 / 0.547 | 1 |
| max (default motor: 2 x 30 N, 120 rpm, power 1) | 0.1 | 1.88 | 0.045 | -0.207 | -0.207 | 0.28 | yes | 0.32 | 0.390 / 0.390 | 1 |


### s2d-head-on-sensors.md

| drive | sensor reach m | gap at rest m | smallest gap ever m | both blocked at the end | either moves in the last 5 s |
|---|---|---|---|---|---|
| normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 3 | 2.827 | 2.827 | yes (deadlock) | no |
| normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 1 | 0.815 | 0.815 | yes (deadlock) | no |
| normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 0.5 | 0.320 | 0.320 | yes (deadlock) | no |
| max (default motor: 2 x 30 N, 120 rpm, power 1) | 3 | 2.391 | 2.391 | yes (deadlock) | no |
| max (default motor: 2 x 30 N, 120 rpm, power 1) | 1 | 0.381 | 0.381 | yes (deadlock) | no |
| max (default motor: 2 x 30 N, 120 rpm, power 1) | 0.5 | -0.122 | -0.122 | yes (deadlock) | no |


### s2e-crossing.md

| drive | sensor reach m | deepest overlap of the two squares mm | A blocked ticks | B blocked ticks | both end blocked |
|---|---|---|---|---|---|
| normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 1 | 241.9 | 462 | 462 | yes (deadlock) |
| normal (sample: 2 x 6 N, 90 rpm, power 0.7) | 0.5 | 241.9 | 462 | 462 | yes (deadlock) |
| max (default motor: 2 x 30 N, 120 rpm, power 1) | 1 | 441.2 | 585 | 585 | yes (deadlock) |
| max (default motor: 2 x 30 N, 120 rpm, power 1) | 0.5 | 441.2 | 585 | 585 | yes (deadlock) |


### s3-placement-table.md

| node kind | param | param kind | class | note |
|---|---|---|---|---|
| ahead-sensor | mountSide .. lookAngle (3) | number | relative | sensor place / turn on the body |
| block | position | vec3 | world-position | where the body is created |
| block | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| block | beltDir | select | world-direction | select x / -x / z / -z: a world axis |
| block | colliderSize, colliderOffset | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| camera | point | vec3 | world-position | absolute in mode "fixed"; an OFFSET from the target in mode "follow" |
| camera | view | select | other | camera pitch preset |
| cargo | loadType, unloadType | text | other | TEXT KEY: goods type name matched by text; shared between copies (usually wanted) |
| character | position | vec3 | world-position | where the body is created |
| character | colliderSize, colliderOffset | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| go-to | targetPos | vec3 | world-position | absolute; ignored when input "target" is wired (go-to.ts:92) |
| item | position | vec3 | world-position | where the body is created |
| item | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| item | tag | text | other | TEXT KEY: goods type name matched by text; shared between copies (usually wanted) |
| item | colliderSize, colliderOffset | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| joint | start .. max (3) | number | relative | joint angle against what it is mounted on |
| joint | mount | vec3 | relative | offset in the frame of what it is mounted on (along / up / sideways) |
| line-sensor | side, forward | number | relative | sensor place on the chassis |
| line-track | center | vec3 | world-position | x, z = middle of the preset shapes; y = floor height for every shape |
| line-track | length, breadth | number | relative | preset shape: length along world x, breadth along world z |
| line-track | p1 .. p16 (16) | vec3 | world-position | absolute x, z of a hand-drawn point (NOT relative to "Tâm") |
| linear-actuator | position | vec3 | world-position | absolute; ignored when input "base" is wired (linear-actuator.ts:226) |
| linear-actuator | direction | number | world-direction | degrees on the ground plane; relative to the mount frame when "base" is wired |
| linear-actuator | orient | select | world-direction | select ground / up / down (world vertical; unchanged by a move or a turn about the vertical) |
| linear-actuator | mount | vec3 | relative | offset in the frame of what it is mounted on (along / up / sideways) |
| motor | side, forward | number | relative | wheel place on the chassis |
| moving-platform | position, to | vec3 | world-position | end points A and B of the travel, both absolute |
| moving-platform | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| nearest-item | goods | text | other | TEXT KEY: goods type name matched by text; shared between copies (usually wanted) |
| patrol | pointA, pointB | vec3 | world-position | absolute patrol ends |
| portal | position | vec3 | world-position | where the body is created |
| portal | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| portal | pair | text | other | TEXT KEY: two portals with the same code are linked (world/teleport.ts:125); copies of a group would share the code |
| robot-body | position | vec3 | world-position | where the body is created |
| robot-body | heading | number | world-direction | degrees, 0 = +x, 90 = +z |
| robot-body | colliderSize, colliderOffset | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| rotating-platform | position | vec3 | world-position | where the body is created |
| rotating-platform | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| route-follow | p1 .. p32 (32) | vec3 | world-position | absolute route point (fallback when "Lấy điểm từ vật" is on and the port is unwired) |
| spawner | position | vec3 | world-position | absolute; becomes an OFFSET from the object when input "at" is wired (spawner.ts:110-114) |
| spawner | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| teleport | position | vec3 | world-position | absolute; ignored when input "dest" is wired (teleport.ts:42) |
| vehicle | position | vec3 | world-position | where the body is created |
| vehicle | colliderSize, colliderOffset | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| vision-sensor | angle | number | other | width of the view cone |
| zone | center | vec3 | world-position | absolute; becomes an OFFSET from the object when input "follow" is wired (zone-sensor.ts:146-156) |
| zone | size | vec3 | relative | extent / offset along the world axes from the body itself (a move leaves it alone; a quarter turn swaps x and z) |
| zone | goods | text | other | TEXT KEY: goods type name matched by text; shared between copies (usually wanted) |

node kinds 71, params 423, by kind {"number":189,"vec3":85,"color":29,"select":95,"text":24,"key":1}, vec3 85, kinds without params 7: and angle-diff next-free-slot not on-start or ui-pick
classified params: {"relative":31,"world-position":66,"world-direction":4,"other":8}; of the 85 vec3 params: {"world-position":66,"relative":19}
node kinds with at least one world-position / world-direction param: 17 of 71: block, camera, character, go-to, item, line-track, linear-actuator, moving-platform, patrol, portal, robot-body, rotating-platform, route-follow, spawner, teleport, vehicle, zone
node kinds with no param that holds a place or direction: 54

### s4-cost.md

machine: 16 logical CPUs, 11th Gen Intel(R) Core(TM) i7-11800H @ 2.30GHz; node v24.15.0; before: 5 node.exe alive (414 MB together)

| copies | switch | cards | wires | entities / crates at 60 s | compile ms (best of 5) | compile + create ms | per tick ms: mean | p50 | p95 | p99 | max | of which cards (mean) | world step (mean) | share of a 16.7 ms frame (mean / p95) | 60 s simulated in (s) | crates delivered per copy | laps per copy |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Vật lý thật on | 81 | 116 | 37 / 3 | 0.466 | 1.13 | 0.936 | 0.898 | 1.319 | 1.463 | 2.84 | 0.543 | 0.394 | 5.6 % / 7.9 % | 3.37 | 2 | 2 |
| 4 | Vật lý thật on | 324 | 464 | 148 / 12 | 6.548 | 7.96 | 6.296 | 6.096 | 10.101 | 12.144 | 15.18 | 3.451 | 2.845 | 37.8 % / 60.6 % | 22.67 | 2 2 2 2 | 2 2 2 2 |
| 8 | Vật lý thật on | 648 | 928 | 296 / 24 | 27.803 | 30.05 | 21.186 | 21.169 | 33.519 | 41.418 | 53.98 | 10.794 | 10.392 | 127.1 % / 201.1 % | 76.27 | 2 2 2 2 2 2 2 2 | 2 2 2 2 2 2 2 2 |
| 8 | Vật lý thật on | 648 | 928 | 296 / 24 | 27.725 | 29.51 | 21.365 | 21.146 | 34.591 | 43.325 | 58.72 | 10.911 | 10.453 | 128.2 % / 207.5 % | 76.92 | 2 2 2 2 2 2 2 2 | 2 2 2 2 2 2 2 2 |
| 16 | Vật lý thật on | 1296 | 1856 | 592 / 48 | 110.668 | 118.83 | 103.531 | 91.953 | 213.090 | 268.326 | 325.70 | 48.318 | 55.213 | 621.2 % / 1278.5 % | 372.72 | 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 | 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 2 |
| 8 | off (crates by the old rules: not the same machine, cost reference only) | 648 | 928 | 208 / 24 | 24.559 | 26.11 | 8.154 | 7.882 | 10.447 | 13.214 | 18.50 | 6.366 | 1.788 | 48.9 % / 62.7 % | 29.36 | 2 2 2 2 2 2 2 2 | 2 2 2 2 2 2 2 2 |

after: 5 node.exe alive (666 MB together)
slowest ticks of the first 8x run: tick 3593 (59.88 s): 53.98 ms; tick 2050 (34.17 s): 50.51 ms; tick 3571 (59.52 s): 49.40 ms; tick 2048 (34.13 s): 49.02 ms; tick 2113 (35.22 s): 48.68 ms
8x without the first 10 s: mean 21.900 / p95 35.779 / max 53.98 ms


### s4-tray-fleet.md

| chassis | cards | wires | entities | per tick ms: mean | p50 | p95 | p99 | max | cards (mean) | world step (mean) | share of a 16.7 ms frame (mean / p95) | loaded at 19 s | loaded at 60 s | distance driven m (first chassis) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 19 | 20 | 14 | 0.357 | 0.288 | 0.617 | 0.993 | 67.33 | 0.127 | 0.230 | 2.1 % / 3.7 % | 1 of 1 | 0 of 1 | 45.86 |
| 2 | 34 | 40 | 27 | 0.555 | 0.511 | 0.756 | 1.460 | 4.02 | 0.240 | 0.315 | 3.3 % / 4.5 % | 2 of 2 | 0 of 2 | 45.86 |
| 4 | 64 | 80 | 53 | 1.347 | 1.256 | 1.770 | 3.744 | 5.87 | 0.607 | 0.740 | 8.1 % / 10.6 % | 4 of 4 | 0 of 4 | 45.86 |
| 8 | 124 | 160 | 105 | 4.116 | 3.847 | 5.354 | 11.825 | 15.39 | 1.790 | 2.326 | 24.7 % / 32.1 % | 8 of 8 | 0 of 8 | 45.86 |
| 8 | 124 | 160 | 105 | 4.048 | 3.808 | 5.069 | 11.629 | 16.04 | 1.763 | 2.285 | 24.3 % / 30.4 % | 8 of 8 | 0 of 8 | 45.86 |
| 16 | 244 | 320 | 209 | 34.698 | 33.569 | 60.301 | 116.361 | 203.60 | 14.594 | 20.104 | 208.2 % / 361.8 % | 16 of 16 | 0 of 16 | 45.86 |


### s4-profile.md

### 1x, 20 s: cards 1.395 ms per tick, world step 1.011 ms per tick

| card kind | cards of it | ms per tick (all of them) | microseconds per card per tick | share of the card time |
|---|---|---|---|---|
| line-sensor | 3 | 0.541 | 180.3 | 43.7 % |
| gripper | 1 | 0.248 | 247.7 | 20.0 % |
| joint | 2 | 0.169 | 84.4 | 13.7 % |
| zone | 2 | 0.120 | 60.2 | 9.7 % |
| linear-actuator | 1 | 0.029 | 28.9 | 2.3 % |
| robot-body | 1 | 0.023 | 22.9 | 1.9 % |
| sequence | 1 | 0.011 | 10.6 | 0.9 % |
| motor | 2 | 0.011 | 5.3 | 0.8 % |
| pid | 1 | 0.010 | 9.6 | 0.8 % |
| block | 6 | 0.009 | 1.5 | 0.7 % |
| show-text | 4 | 0.009 | 2.2 | 0.7 % |
| spawner | 1 | 0.009 | 8.9 | 0.7 % |

### 8x, 20 s: cards 29.925 ms per tick, world step 25.386 ms per tick

| card kind | cards of it | ms per tick (all of them) | microseconds per card per tick | share of the card time |
|---|---|---|---|---|
| gripper | 8 | 9.698 | 1212.3 | 34.7 % |
| zone | 16 | 7.542 | 471.4 | 27.0 % |
| line-sensor | 24 | 4.809 | 200.4 | 17.2 % |
| joint | 16 | 4.433 | 277.1 | 15.9 % |
| linear-actuator | 8 | 0.443 | 55.4 | 1.6 % |
| robot-body | 8 | 0.113 | 14.2 | 0.4 % |
| spawner | 8 | 0.100 | 12.6 | 0.4 % |
| link | 16 | 0.090 | 5.6 | 0.3 % |
| block | 48 | 0.089 | 1.8 | 0.3 % |
| map-range | 72 | 0.082 | 1.1 | 0.3 % |
| motor | 16 | 0.080 | 5.0 | 0.3 % |
| show-text | 32 | 0.063 | 2.0 | 0.2 % |

### CPU profile, 8x, 20 s simulated: wall 51.98 s, sampled 52.24 s (line numbers are those of the code vitest ran, check them against the source)

| self time ms | share | function @ file:line |
|---|---|---|
| 7740 | 14.8 % | toView @ src/world/entity.ts:17 |
| 3565 | 6.8 % | viewOf @ src/world/world.ts:214 |
| 2594 | 5.0 % | hull @ src/world/footprint-2d.ts:15 |
| 2374 | 4.5 % | test @ src/world/oriented-box.ts:171 |
| 2315 | 4.4 % | segmentDistance @ src/world/line-track.ts:100 |
| 1958 | 3.7 % | tick @ src/engine/runtime.ts:72 |
| 1750 | 3.3 % | obbSeparation @ src/world/oriented-box.ts:168 |
| 1554 | 3.0 % | distanceToTrack @ src/world/line-track.ts:121 |
| 1201 | 2.3 % | orientedBox @ src/world/collider.ts:81 |
| 1163 | 2.2 % | isTurnedBody @ src/world/collider.ts:13 |
| 1137 | 2.2 % | (garbage collector) @ (native):0 |
| 1113 | 2.1 % | axesOf @ src/world/oriented-box.ts:49 |
| 1095 | 2.1 % | touching @ src/world/physics.ts:68 |
| 1008 | 1.9 % | moveBlock @ src/world/world.ts:893 |
| 980 | 1.9 % | obbOf @ src/world/oriented-box.ts:101 |
| 951 | 1.8 % | (anonymous) @ tests/spike-w0/s4-where-the-time-goes.test.ts:40 |
| 842 | 1.6 % | halfAlong @ src/world/oriented-box.ts:126 |
| 816 | 1.6 % | obbCorners @ src/world/oriented-box.ts:146 |
| 790 | 1.5 % | boxOverlap @ src/world/collider.ts:114 |
| 775 | 1.5 % | restsTurned @ src/world/material.ts:82 |
| 734 | 1.4 % | supportPoint @ src/world/weighing.ts:67 |
| 695 | 1.3 % | overlapOn @ src/world/physics.ts:50 |
| 682 | 1.3 % | step @ src/world/world.ts:1010 |
| 676 | 1.3 % | shapeOf @ src/world/weighing.ts:55 |
| 642 | 1.2 % | moveBlockTo @ src/world/platforms.ts:128 |

| inclusive time ms | share | function @ file:line (only functions in src/) |
|---|---|---|
| 28408 | 54.4 % | tick @ src/engine/runtime.ts:72 |
| 21151 | 40.5 % | step @ src/world/world.ts:1010 |
| 13222 | 25.3 % | stepPhysics @ src/world/physics.ts:358 |
| 11849 | 22.7 % | stepRobot @ src/world/physics.ts:296 |
| 11611 | 22.2 % | listEntities @ src/world/world.ts:1047 |
| 11577 | 22.2 % | viewOf @ src/world/world.ts:214 |
| 9430 | 18.1 % | massOn @ src/world/material.ts:108 |
| 9422 | 18.0 % | evaluate @ src/nodes/gripper.ts:438 |
| 9178 | 17.6 % | massOnShared @ src/world/material.ts:118 |
| 8812 | 16.9 % | holds @ src/world/material.ts:130 |
| 8002 | 15.3 % | toView @ src/world/entity.ts:17 |
| 7188 | 13.8 % | computeContacts @ src/world/world.ts:136 |
| 7071 | 13.5 % | touching @ src/world/physics.ts:68 |
| 6962 | 13.3 % | evaluate @ src/nodes/zone-sensor.ts:244 |
| 5152 | 9.9 % | moveFingers @ src/nodes/gripper.ts:141 |
| 4944 | 9.5 % | obbSeparation @ src/world/oriented-box.ts:168 |
| 4812 | 9.2 % | moveBlock @ src/world/world.ts:893 |
| 4599 | 8.8 % | evaluate @ src/nodes/line-sensor.ts:146 |
| 4581 | 8.8 % | (anonymous) @ src/nodes/arm-parts.ts:127 |
| 4496 | 8.6 % | evaluate @ src/nodes/joint.ts:214 |
| 4422 | 8.5 % | trackCoverage @ src/world/line-track.ts:176 |
| 4181 | 8.0 % | supportPoint @ src/world/weighing.ts:67 |
| 3940 | 7.5 % | (anonymous) @ src/world/line-track.ts:193 |
| 3926 | 7.5 % | onTrack @ src/world/line-track.ts:163 |
| 3870 | 7.4 % | distanceToTrack @ src/world/line-track.ts:121 |
| 3839 | 7.3 % | orientedBox @ src/world/collider.ts:81 |
| 3804 | 7.3 % | moveBlockTo @ src/world/platforms.ts:128 |
| 3349 | 6.4 % | boxOverlap @ src/world/collider.ts:114 |
| 3197 | 6.1 % | test @ src/world/oriented-box.ts:171 |
| 3154 | 6.0 % | boundsBox @ src/world/collider.ts:100 |
| 2966 | 5.7 % | stepAxis @ src/world/platforms.ts:88 |
| 2726 | 5.2 % | hull @ src/world/footprint-2d.ts:15 |
| 2678 | 5.1 % | rests @ src/world/material.ts:93 |
| 2662 | 5.1 % | (anonymous) @ src/world/platforms.ts:121 |
| 2596 | 5.0 % | resolveTurn @ src/world/arm-solid.ts:239 |
| 2412 | 4.6 % | sweepCubes @ src/world/arm-solid.ts:136 |
| 2403 | 4.6 % | planPush @ src/world/linear-actuator.ts:278 |
| 2392 | 4.6 % | overlap @ src/world/platforms.ts:25 |
| 2317 | 4.4 % | distanceToPath @ src/world/line-track.ts:108 |
| 2315 | 4.4 % | segmentDistance @ src/world/line-track.ts:100 |

