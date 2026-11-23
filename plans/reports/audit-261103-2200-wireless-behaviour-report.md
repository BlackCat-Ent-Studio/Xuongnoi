# Audit: behaviour that happens without its own wire

Date: 2026-11-03. Scope: `app/src/nodes` (57 kinds), `app/src/world`, `app/src/engine/runtime.ts`, `app/src/puzzle` (levels 1–7, run-level, world-options, puzzle UI), editor samples `app/src/samples/*.json` (16), and a quick grep of tutorials, the handbook and the archived levels.

Rule audited: every ACTION (move, stop, turn/face, grab, drop, throw, open/hide/show, spawn, teleport, win/lose, timer start…) must happen only because a signal arrives on a wired input that belongs to THAT action alone. Parameters may only tune HOW.

Two engine facts drive most findings:
- `engine/runtime.ts:29,99`: an unwired input takes `port.default ?? PORT_DEFAULTS[type]` (false/0/null). Thirteen input ports declare `default: true`, so the action they gate runs with no wire at all.
- "Brain" nodes (go-to, patrol, route-follow, chase, fight) only output stick values (`moveX/moveY/jump`). The movement itself still needs the wire into the character. What can be wireless is the decision to START, STOP, TURN or GO BACK.

Verification: rows marked **verified** were checked by headless runs (scratch test `C:\Users\trong\AppData\Local\Temp\claude\a12094c0c35d488c\ebbc19fd-0e84-4963-b601-ddf24fc941b8\scratchpad\wireless.test.ts`, which uses the real `runLevel`). The sample usage column comes from a scan script (`...\scratchpad\scan-samples.mjs`). Everything else is **read only**.

## 1. Summary

| Severity | Count | Meaning |
|---|---|---|
| VIOLATION | 19 | An action happens with no wire into an input that belongs to it, or one input does two different actions |
| GREY | 17 | A param, default or engine rule shapes or adds to an action. It can be seen as hidden behaviour |
| OK | 13 | A physics or world rule, pure tuning, or display only |

Puzzle levels hit (VIOLATION only): L1, L2, L3, L4, L5, L6 and L7 all have at least one. The most common one is a "go/on" input that defaults to true (L1–L7). The most serious ones are carry toggle (L5), one door input that both hides and shows (L2–L4), and route-follow `stopFor` (L7). The L7 solution **depends** on `stopFor`: with it set to 0, the solution times out (verified).

## 2. Findings table

Rows are numbered: N = node, E = engine/world. File paths are relative to `app/src/`.

| # | Where (file:line) | What happens without a wire | Severity | Used by (levels / samples / lessons) | Suggested fix, and the impact on old editor boards |
|---|---|---|---|---|---|
| N1 | Carry `mode: 'toggle'`: `nodes/carry.ts:30-38, 51, 54` | With toggle, a rising edge on "Nhấc lên" (grab) **drops** the held item. One input does grab and drop. **Verified on L5:** the solution has no wire into `drop`, yet the run makes 3 grabs and 3 drops and wins. With the same wires and `mode: 'separate'`, the run does 1 grab, 0 drops and times out | VIOLATION | **L5** (`level-05.ts:274, 335, 347`); sample `key-door.json`; lessons `lesson-capstone-factory.ts:76`, `lesson-collider-gravity.ts:26`; archive `level-xuong-tong-hop.ts:45` | Remove the toggle option from puzzle trays. L5 solution: wire `go-to.arrived` into both `grab` and `drop`, with something that tells which one (for example `holding` → a NOT/AND), or add a dedicated pulse. In the editor, keep `toggle` only as a legacy load path (hidden from the param list) so old boards still work. Otherwise, migrate old boards on load to `separate` and add an explicit wire (this changes behaviour unless the wire is added) |
| N2 | Go-to input `go` "Cho đi" `default: true`: `nodes/go-to.ts:96, 135` | The bot starts walking with nothing wired into "Cho đi". **Verified:** the L1 solution wins with no wire on `go`, and in L4 bot B moves 3.93 units in the first second with `go` unwired | VIOLATION | **L1, L2, L4 (bot B), L5**; samples `platform-bot`, `race` | Change the default to false, or add a "Bắt đầu" input. Old boards with `go` unwired would stop moving. Migrate on load by adding an On-Start → `go` wire (or Const true) |
| N3 | Go-to stops at the target (`go-to.ts:152-157`), plus `settle` delaying "Đã tới" (`:121-129, 153-155`) | It stops on arrival with no stop wire. `settle` only delays the "Đã tới" report | GREY (stopping is the end of the "go to" action itself; `settle` is tuning) | L1, L2, L4, L5 (`settle: 0.3` in L5) | Acceptable as "go to = walk then stand". If the client wants stop as its own wire, add a "Dừng" input. No impact on old boards |
| N4 | Patrol input `on` "Hoạt động" `default: true`: `nodes/patrol.ts:198, 226` | The guard patrols with nothing wired into "Hoạt động". **Verified:** on L6 with an empty answer (no player pieces), the guard moves (net displacement 1.21 in 5 s) | VIOLATION | **L6 guard** (locked card `level-06.ts:100`, locked wires b1-b3); sample `guard-patrol` wires `on` (OK) | Default false, plus a locked On-Start → `on` wire in L6. Old boards with `on` unwired would stand still: migrate by adding the wire |
| N5 | Patrol `turnAtEdge` (`patrol.ts:209-218, 250-257`) and the turn-around at A/B (`:240-248`) | It turns back at ledges and at the end points automatically | GREY (turning back is the patrol action itself; `turnAtEdge` adds a second trigger) | `turnAtEdge` is in no level. The A/B turn is used in L6 | Keep it. If needed, expose "Vừa tới đầu mút" and let a wire request the turn. No impact if left as is |
| N6 | Route-follow input `on` "Bật" `default: true`: `nodes/route-follow.ts:229, 321` | The walker or vehicle runs the route with nothing wired into "Bật". **Verified:** in L3 the cat moves 3.93 units in 1 s and the solution wins with `on` unwired | VIOLATION | **L3, L6, L7**; sample `city-delivery-3d` (16 route pieces) | Default false, or use the existing "Chạy" input as the start in every mode. Old boards: migrate with an On-Start → `on` wire |
| N7 | Route-follow `lookAhead` default 2.5 (`route-follow.ts:266-274, 200-201, 328-329, 366-368`) | It stops by itself when anything is ahead (it calls `world.probeAhead`). This is a stop with no wire. In legs mode, a blocked walker is also halted | VIOLATION | Set to 0 in L3/L6/L7 (no effect there). Sample `city-delivery-3d` uses 1.2–1.6 | Default 0. Move the probe to an "Ahead sensor" piece (it already exists: `ahead-sensor`) wired into "Dừng". Old boards that rely on the auto-stop: migrate on load by inserting an ahead-sensor → `stop` wire |
| N8 | Route-follow `stopFor` (`route-follow.ts:287, 351-356, 357-363`) | After each point the walker stands still for N seconds. This is a stop with no wire, and it also drives the `atPoint` output. **Verified on L7:** the robot stands still about 1 s in the first 12 s without holding anything, and the solution with `stopFor: 0` **times out** (the grab is gated by `atPoint`, which is only true during that stop) | VIOLATION | **L7** (`level-07.ts:203, 222`); lesson `lesson-tidy-bot.ts:32,108` | Turn it into a wired stop: the player wires "Tới điểm"/`reached` → a timer → "Dừng", or add a dedicated "Đứng chờ (giây)" input. L7 needs a solution redesign (and probably an extra tray piece). Old boards: keep the param working for legacy saves, hide it in the puzzle |
| N9 | Route-follow `faceAtStop: 'item'` (`route-follow.ts:301-311, 354, 360`, helper `:92-101`) | When a stop begins, the walker turns toward the nearest item (a turn/face with no wire) | VIOLATION | No level or sample. Documented in the handbook (`content-action-brain.ts:390`) | Remove it, or replace it with a "Quay về" input fed by `nearest-item`. Impact: none found in shipped content |
| N10 | Route-follow `style` loop/pingpong (`route-follow.ts:246-254, 345-350`) | After the last point it goes back to point 1 (loop) or reverses (pingpong) on its own | GREY (it shapes the route the action follows) | L3, L6, L7 use `loop`, but each game ends before the loop matters; `city-delivery-3d` | Acceptable as "route shape". If strict, add "Chạy lại từ đầu". No impact |
| N11 | Route-follow `legs: 'dash'` + `readyFor` (`route-follow.ts:288-299, 327-331`; `route-legs.ts:68-86`) | The param changes what "Chạy" means: it is ignored in normal mode and required in dash mode. `readyFor` adds a wait before each dash | GREY (in dash mode the action *does* need the "Chạy" wire, which is the right direction) | **L6** | Make "Chạy" always mean "go to the next leg" and drop the mode. Old boards in steer mode would need "Chạy" wired: migrate with Const true |
| N12 | Route-follow drives a vehicle directly: `route-follow.ts:183, 208, 372, 378` (`world.setVehicleInput` / `setVehicleTrack`) | When "Ai" is a vehicle, the car is driven and braked through a side effect, with **no wire** from `moveX/moveY` into the vehicle (read: the route piece runs after the vehicle in topo order and overrides it) | VIOLATION | Sample `city-delivery-3d` (10 cars: only `self`, and sometimes `stop`, wired); lessons `lesson-route-traffic.ts`, `lesson-train.ts` | Drive only through the outputs, and let the player wire `moveX/moveY` (and a brake output) into the vehicle. Rail mode needs a new "track pose" output plus a vehicle input. Old boards: migrate on load by adding the missing wires |
| N13 | Chase: no start input; it engages when the target is inside `sightRange` (`nodes/chase.ts:144-147, 182-187`). `mode` flee/chase (`:155-164, 189-194`) | It starts and stops chasing by itself. A param picks between two opposite actions | VIOLATION (start); GREY (`mode`) | Samples `guard-patrol`, `maze-chase` | Add an "on"/"Đuổi" input (default false), and let sightRange be a separate sensor's job. Old boards: auto-insert Const true |
| N14 | Fight: no start input. It closes in, attacks on a cooldown and backs off by itself (`nodes/fight.ts:34-37, 64-97`) | Approach and retreat movement start with no wire. The strike itself is OK: `attack` is an output that must be wired into hand-tool `use` | VIOLATION | Sample `arena` | Add an "on" input. Make back-off an explicit output or remove it. Old boards: Const true |
| N15 | Enter-exit: one input "Bấm" does enter **or** exit (`nodes/enter-exit.ts:100, 111-112`) | One input, two actions | VIOLATION | Samples `city-delivery`, `city-delivery-3d`, `race`; lessons vehicles/bot-driver | Split it into "Lên xe" and "Xuống xe" inputs. Old boards: migrate the "Bấm" wire to both inputs through a NOT on `inVehicle`, or keep "Bấm" as a hidden legacy port |
| N16 | Hand-tool: one input "Cầm / Cất" equips **or** unequips (`nodes/hand-tool.ts:246, 265-268`) | One input, two actions | VIOLATION | Samples `arena`, `city-delivery`, `city-delivery-3d`, `pickaxe-rock`; lesson `lesson-bot-tool` | Split it into "Cầm" and "Cất". Same migration idea as N15 |
| N17 | Block `hiddenWhile` "Ẩn suốt lúc bật" (`nodes/block.ts:244, 350-362`) | One input: true hides (opens the door), false shows (closes it). Two actions on one input | VIOLATION | **L2, L3, L4** doors (`level-02.ts:156,182`; `level-03.ts:93,118`; `level-04.ts:204,238`) | Use the existing `hide`/`show` pulse inputs, or add separate "Mở"/"Đóng" inputs. Levels 2–4 would need rewiring (the latch/counter/OR would feed "Mở", and L4 also needs a "Đóng" path). Old boards: keep `hiddenWhile` as a legacy input |
| N18 | Block belt `run` "Chạy băng chuyền" `default: true` (`block.ts:242, 363-365`); style "Băng chuyền" with speed 0 runs at 2 (`block.ts:196-217`) | The conveyor runs with no wire | VIOLATION | No level. No sample found with an unwired belt (read-only scan) | Default false. Old boards with belts and `run` unwired would stop: migrate with Const true |
| N19 | Moving platform `run` `default: true` (`nodes/moving-platform.ts:29, 211-213`) | The platform moves with no wire | VIOLATION | Sample `dodge-shoot` (unwired) | Default false plus migration (Const true) |
| N20 | Rotating platform `run` `default: true` (`nodes/rotating-platform.ts:259, 301`), `every` auto-turn (`:280, 317-323`), `spin` mode (`:305-310`) | It turns by itself every N s, or spins forever, with no wire | VIOLATION | Sample `dodge-shoot` (`every` > 0, `run` unwired) | Default false. Replace `every` with a Timer wired into "Xoay". Old boards: migrate `every` into an inserted timer |
| N21 | Timer `run` "Chạy" `default: true` (`nodes/timer.ts:18, 57-61`) | The countdown starts at game start with no wire | VIOLATION (timer start) | Samples `city-delivery`, `city-delivery-3d`, `dodge-shoot`, `top-collect` | Default false. Old boards: add On-Start → `run` |
| N22 | Timer `repeat` (`timer.ts:27-36, 52`) | It restarts itself every time it runs out | VIOLATION | Archive level `level-cau-nhap-nhay.ts:51,62` only | Remove it, and wire `done` → `reset` instead (that already works). Old boards: migrate by adding that wire |
| N23 | Portal: anyone who touches it is teleported (`nodes/portal.ts:340, 374-379`; `world/teleport.ts:154+`, called at `world/world.ts:739`); `on` `default: true` (`portal.ts:343`); pairing by the `pair` text param, with no wire (`:354`) | A teleport with no wire, and a wireless pairing | VIOLATION | Sample `portal-camera`; lessons `lessons-camera-portals` | Strict option: drop the auto portal and build it from Touch → Teleport (both exist). Softer option: default `on` false and remove `pair` in favour of the "Cổng đối diện" wire. Old boards: migrate `pair` into a wire |
| N24 | Vehicle `control: 'auto'` (`nodes/vehicle.ts:94-102, 171`) | It lets the vehicle obey its stick inputs with no driver. It does not move without input wires (except through N12) | GREY | Sample `city-delivery-3d`; lessons route-traffic, train; handbook | OK as tuning once N12 is fixed |
| N25 | Vehicle `leader` "Theo xe đầu" (`vehicle.ts:45, 170`) | Wiring an *object* makes the car follow the leader's trail and ignore its own drive inputs | GREY (it is a wire, but an object wire that starts movement) | Train lessons | Acceptable, or add a "Kéo theo" bool. No impact |
| N26 | Spawner `lifetime` (`nodes/spawner.ts:242, 247`; `world/spawner.ts:14-20`; `world/world.ts:303-310`) | A spawned thing disappears after N s with no wire | GREY (a strict reading makes it VIOLATION: hide without a wire) | Sample `dodge-shoot` | Default 0 (forever). Expose the expiry as a pulse output and let a wire hide it. Old boards that rely on the default 5 s would keep their items: migrate by setting `lifetime` explicitly |
| N27 | Health: with the node wired, hits cost HP, knock the character back, and at 0 HP it drops what it holds and vanishes (`nodes/health.ts:14, 48`; `world/combat.ts:120-150, 156-170, 198-205`) | Knockback, let-go and hide all happen with no wire | GREY (consequences of a wired attack; a strict reading makes death→hide a VIOLATION) | Samples `arena`, `dodge-shoot`; combat lessons | Option: stop hiding automatically and let the player wire "Hết máu" → hide. Old boards: auto-add that wire |
| N28 | Camera `on` `default: true` (`nodes/camera.ts:82, 123`) | The camera takes over the view with no wire | GREY (view, not a bot action) | L5, L6, L7 scenery cameras; samples `city-delivery*`, `portal-camera` | Leave as is, or default false with migration |
| N29 | HUD `show` `default: true`: `show-text.ts:15`, `guide-arrow.ts:17`, `ui-button.ts:13`, `ui-meter.ts:22` | The widget is shown with no wire | OK (display only) | Editor | None |
| N30 | Random `mode` tick/start (`nodes/random.ts:~70-78`, `create`) | It rolls a number with no "Tung" wire | GREY (a signal, not a world action) | None in levels or samples | Optional: keep only "press" |
| N31 | Sequence `loop` (`nodes/sequence.ts:44, 70`) | It goes back to step 1 by itself | GREY (a signal) | Samples `city-delivery`, `city-delivery-3d`, `cleaner-bot` | Optional: wire `finished` → `reset` |
| N32 | Sight-forecast reads patrol, vision and route "notes" with no wire (`nodes/sight-notes.ts:1-40`; written at `patrol.ts:234`, `route-legs.ts:105` and by vision-sensor; read at `sight-forecast.ts:157-170`) | Hidden data links between pieces. Not an action, but it is behaviour that flows without a wire | GREY | **L6** (the forecast reads the locked patrol, the hidden "eyes" and the player's route) | Add explicit object or number outputs and inputs (for example a route "next leg" output, and a patrol/eyes "plan" output), or accept it and document it. Changing it would break L6 and old forecast boards unless migrated |
| N33 | Latch "Đảo" (toggle input), counter, compare, math, bool gates, select-number, map-range, const, key, stick, on-start, ui-start, ui-dialog, ui-pick, touch, distance, speed/ahead/vision/color/zone sensors, next-free-slot, nearest-item, show-number | Pure signal or sensor pieces. Each input has its own meaning | OK | All | None |
| N34 | Zone hides its own editor marker on the first tick (`nodes/zone-sensor.ts:116-119`) | A hide with no wire, but of an edit-only helper box | OK | All levels with zones | None |
| N35 | Action pieces that are clean: character (`character.ts:274-276`), item and block `hide`/`show` pulses, interact, teleport, shooter, cargo (3 separate inputs), health `heal`, win-lose | Each action has its own input | OK | All | None |
| E1 | Facing follows velocity (`world/physics.ts:152-157`) | It turns to face where it walks | OK (physics; the movement itself is wired) | All | None |
| E2 | Grab turns the character toward the item, with solid bodies (`world/world.ts:224-231, 443`) | A turn/face as a hidden side effect of a wired grab. **Verified on L7:** on each grab the facing jumps from (1.00, 0.00) to (0.14, 0.99) | GREY (part of the wired grab) | L5, L7 (puzzle 3D); editor boards with "Va chạm thật" | Acceptable, or add a "Quay về" input. No impact |
| E3 | `hide()` lets go of carried and hand items and puts the driver out (`world/world.ts:392-405`) | A drop or exit with no wire | GREY | Any board that hides a carrier or a vehicle | Acceptable as a world rule; document it |
| E4 | Drop with solid bodies in 3D silently fails when there is no room, and the hands keep the item (`world/world.ts:446-451`) | The wired action does *not* happen (the opposite problem) | GREY | L5, L7 | Expose a "Thả không được" pulse. No impact |
| E5 | `respawnFallen`: anything that falls off the world teleports home and lets go (`world/world.ts:263-273, 733`; switched on for all puzzle levels at `puzzle/world-options.ts:93`) | A teleport and drop with no wire | GREY (a safety rule; it only fires below the floor) | All puzzle levels; not the editor | Keep it as a world rule, or show it as a visible scenery piece. No impact |
| E6 | Solid bodies: characters and items block each other, and a carried crate is part of its carrier (`world/physics.ts:73-118`; `world/solid-bodies.ts`) | They block. Nothing is pushed or moved | OK (physics) | Puzzle levels; editor "Va chạm thật" | None |
| E7 | Carry floors: the carried crate is lifted over stacked crates (`world/solid-bodies.ts:92-117`) | Changes the carry pose | OK (pose) | L5, L7 | None |
| E8 | `characterBox`, `frontCarryLooks`, `frontCarry`, `frontCarryAll` (`world/world-options.ts:8-24`; `puzzle/world-options.ts:89-98`; `world/graph-world-options.ts:34-36`) | Body size and where a held item rides | OK | Puzzle; editor | None |
| E9 | Belts and moving vehicles carry riders; drivers ride along (`world/physics.ts:345-349, 368-377`) | Riders move with their support | OK (physics; the belt start itself is N18) | Editor samples | None |
| E10 | A vehicle crash shoves the other body (`world/physics.ts:301-333`) | A push | OK (physics) | Vehicle samples | None |
| E11 | Thrown items and tool hits deal damage and knockback (`world/combat.ts:120-170`; `world/world.ts:527`) | Covered with N27 | GREY | Combat samples | See N27 |
| E12 | Bullets vanish on hit or timeout (`world/projectiles.ts`; `world/world.ts:735-738`) | A hide of a bullet | OK (physics of a wired shot) | `dodge-shoot` | None |
| E13 | Zones ignore carried and in-hand items (`nodes/zone-sensor.ts:142`) | A counting rule | OK | L5, L7 win zones | None |
| E14 | The puzzle runner and UI never act on the world directly: no `grab/drop/hide/show/teleport/endGame/setCharacterIntent` calls under `src/puzzle` (grep); `run-level.ts:37-56` only ticks the graph and steps the world | — | OK | All levels | None |

Note on the count: the portal teleporter (engine) is counted under N23, and death→hide under N27.

## 3. Per-level violations (L1–L7)

Hidden or locked pieces in every level: ground/floor, flag/goal blocks, touch→win-lose plumbing, zones and AND gates for win/lose, and a fixed camera (L5–L7). Apart from those noted below, they only decide win/lose or are scenery. Except for the L6 guard (patrol), no hidden or locked piece moves, grabs, drops, stops or turns a bot.

**L1 `bot-dau-tien`**
- N2: go-to "Cho đi" is unwired and defaults to true. The bot walks with no start wire (verified: the solution wins in 4.28 s).
- N3 (GREY): go-to stops at the flag by itself.

**L2 `cua-kho`**
- N2: go-to "Cho đi" defaults to true (read only; same code path as L1).
- N17: the door's "Ẩn suốt lúc bật" is one input for open and close. The latch keeps it on, so in the solution only the "open" half fires. The input's design is still two actions.

**L3 `nhat-sao`**
- N6: route-follow "Bật" defaults to true. The cat walks with no start wire (verified: it moves 3.93 units in 1 s and the solution wins in 4.53 s).
- N17: gate "Ẩn suốt lúc bật" (two actions on one input). The counter's "Đã đủ" stays on, so only "open" fires.
- Locked base wires: touch → star `hide` (`level-03.ts:78`). This is a hide action on scenery, but it IS wired and does not affect the bot. OK.
- N10 (GREY): `style: loop` would send the cat back to point 1, but the game ends at the flag first.

**L4 `hai-nut-mot-cua`**
- N2: bot B's go-to "Cho đi" is unwired and defaults to true. B starts walking at once (verified: 3.93 units in 1 s; the solution wins in 6.93 s). Bot A's `go` is wired (s7). OK.
- N17: door "Ẩn suốt lúc bật". The puzzle explicitly relies on the same input closing the door again ("the door shuts the moment A steps off").

**L5 `du-ba-thung`**
- N1: carry `mode: 'toggle'`. The "Nhấc lên" input both grabs and drops. Nothing is wired into "Thả" (verified: 3 grabs and 3 drops with `drop` unwired; with `separate` the run does 1 grab, 0 drops and times out).
- N2: go-to "Cho đi" defaults to true (read only).
- E2 (GREY): the robot auto-turns toward the crate on each grab (read only for L5; verified on L7).
- N3 (GREY): `settle: 0.3` delays "Đã tới". This is tuning.

**L6 `ne-linh-gac`**
- N4: the locked patrol's "Hoạt động" defaults to true. The guard walks with no wire into it (verified: it moves with an empty answer). Its movement wires (b2/b3) exist but are locked. **This is the only locked piece that drives a bot.**
- N6: the cat's route-follow "Bật" defaults to true. In dash mode the cat still needs "Chạy" (verified: the cat does not move with an empty answer, and the solution wins in 11.62 s).
- N11 (GREY): `legs: 'dash'` changes what "Chạy" does. `readyFor` adds a wait.
- N32 (GREY): the forecast reads the guard's patrol, its hidden "eyes" and the cat's route with no wires.

**L7 `phan-loai-mau`**
- N8: route-follow `stopFor: 0.5`. The robot stops at every pad with no stop wire, and the only time `atPoint` is true (which gates the grab) is during that param-made stop. Verified: with `stopFor: 0` the reference solution **times out**. Removing the wired stop (sw9, holding → stop) also times out, so the wired stop is needed too.
- N6: route-follow "Bật" defaults to true (verified indirectly: nothing is wired to `on` and the robot walks).
- E2 (GREY): the robot turns 90° toward the side crate on each grab (verified: facing (1.00, 0.00) → (0.14, 0.99) at ticks 90 and 416).
- N10 (GREY): `style: loop` would send the robot from pad 6 back to pad 1.
- The carry here uses `separate` with grab and drop wired to their own inputs. OK.

## Open questions for the controller / client
1. Is "go to X then stand" one action (so the stop is fine, N3)? Is "patrol between A and B" one action (so the turn-back is fine, N5)?
2. Should consequences of a wired action (death→hide, spawn lifetime, auto-face on grab, let-go on hide) count as violations? The table marks them GREY.
3. Are hidden data links (N32, sight-forecast notes) in scope, or only actions?
4. Default-true inputs: should the fix be "default false + migrate old boards with an On-Start/Const wire", or "keep the default for the editor, force wires in the puzzle"?
