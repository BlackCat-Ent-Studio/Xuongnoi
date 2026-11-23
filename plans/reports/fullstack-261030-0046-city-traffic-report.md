# Agent B "Traffic" report

Worktree `D:\workspace\GameBuilder-traffic`, branch `feat/city-traffic`, commit `7f4d85c` (not merged).
Dependency junction left in `app/` for the controller to remove. A stray helper script `D:\workspace\jx.ps1` was created by mistake (a delete was blocked by the safety check); please delete it.

## Delivered
| # | Item | Where |
|---|---|---|
| 1 | Vehicle-vehicle collision (2d-top, 3d, 2d-side) | `world/physics.ts` (`Rivals`, `crashInto`), `world/vehicles.ts` |
| 2 | Vehicle node: output "Vừa va chạm" (pulse), "Va với" (object), input "Dừng", param "Va chạm xe khác" | `nodes/vehicle.ts` |
| 3 | Node "Chạy theo tuyến" (`route-follow`, brain) | `nodes/route-follow.ts`, registered in `nodes/index.ts` |
| 4 | Tests | `tests/world/vehicle-collision.test.ts` (15), `tests/nodes/route-follow.test.ts` (16) |
| 5 | Browser check | shots in `plans/reports/shots-traffic/` |

### Collision design
- A vehicle's move treats other collide-enabled vehicles as walls (same substeps as blocks, max 0.4 unit per substep, so no tunnelling; tested at 40 u/s).
- Already-overlapping vehicles (spawn/teleport) may drive apart instead of snapping through.
- The mover is stopped, the hit vehicle is shoved along the contact direction at 25% of closing speed (position only, clipped by walls and other cars).
- Crash event: closing speed > 1.5 u/s, once per contact (0.5 s cooldown while touching), reported to BOTH vehicles (`hitSeq`, `hitWith` on `EntityView.vehicle`). Gentle touches only nudge.
- Vehicles still do not hit characters or items (unchanged).

### Decision: old boards
- Param `collide` ("Va chạm xe khác") default `yes`, so new nodes collide.
- Checked all vehicle boards: `race` (2 cars, would now bump each other) -> set `"collide": "no"` in `src/samples/race.json`, behaviour identical. `city-delivery`, bot-driver lesson, vehicles lessons each have ONE vehicle -> unaffected. All existing tests pass unchanged except registration count (48 -> 49).
- Concern: a learner's own saved board with 2+ vehicles gets `yes` (missing param is filled with the default on load). Making it `no` for old saves needs a migration in `io/` (Agent D's area), not done. Impact is low (colliding cars is the expected behaviour).
- Spec absent `collide` stays absent in `VehicleSpec` (`collide:false` only when "no"), so existing spec-equality tests are untouched.

### New WorldApi surface (additive)
- `setVehicleInput(id, x, y, stop?)`: `stop` optional; omitted = leave unchanged (so a route node can drive without clobbering the vehicle node's own Dừng).
- `probeAhead(id, reach)` -> `{id, distance} | null`: nearest solid non-zone block, vehicle or character ahead along facing, lane width of the prober, vertical overlap only (floor ignored). Implemented in new `world/probe-ahead.ts`. `tests/nodes/fake-world.ts` got `probeAhead: () => null`.
- `EntityView.vehicle` gained optional `hitSeq`, `hitWith`, `steerMode`; `VehicleSpec.collide?`.

### Route node "Chạy theo tuyến"
- Inputs: Ai (object, required: vehicle or character), Bật (default true), Dừng.
- Params: Số điểm (2..8), Điểm 1..8 (vec3), Kiểu (Vòng lặp / Đi rồi quay lại), Tốc độ (units/s, default 5), "Dừng khi có vật phía trước (đơn vị)" default 2.5 (0 = off).
- Outputs: Đang bị chặn, Tới điểm (pulse), Điểm hiện tại (1-based, the point being headed to), plus Đi ngang / Đi dọc / Nhảy for characters (wire them into the character like go-to does).
- Vehicles: driven directly through `setVehicleInput`, no driver needed; works for direction and throttle steering, 2d-side, 2d-top, 3d. Starts at the nearest point. Reaches a point within 1.2 units and turns on without stopping.
- Blocked/Dừng: vehicle brakes to 0 via the stop flag; walker stands still.
- Red light: a light is just a bool the learner wires into Dừng (e.g. zone sensor or key/timer); documented in the node description. Points are reached in a straight line (no pathfinding), so lay them along roads.
- Crash stall for 5 s: wire "Vừa va chạm" -> a timer/latch -> vehicle "Dừng" (covered by test that holds stop through the vehicle input).

## Verification
- `npx vitest run`: 66 files, 918 tests pass (2 flaky timeouts seen once when a build ran concurrently, clean on rerun).
- `npx tsc --noEmit -p .` clean; `npm run build` green.
- Browser (dev server 5194, now stopped), boards written into `xuong-noi:autosave`, in 2D trên and 3D: 3 driverless route cars on a road loop + player truck parked on the road. Car stops behind the truck (HUD "đang bị chặn"), queue forms behind it; driving the truck into the car: collision visible, "Xe tải va chạm" and "Xe 2 va chạm" both go 0 -> 1 (Hiện số). 0 console errors across all runs.
- FPS (headless Chromium, software GL swiftshader, 1000x480 canvas): 0 cars 60.1 / 60.1 (2D trên / 3D); 10 route cars 51.7 / 53.9. Per-tick cost is two entity filters + one O(vehicles) probe per route car; no allocation of whole-world snapshots.
- Screenshots: `plans/reports/shots-traffic/{2d-top,3d}-{1-start,2-car-stopped-behind-truck,3-crash,4-after-crash,10cars,edit}.png`.

## Notes for the controller
- Merge-sensitive spots: `engine/types.ts` (3 small additive edits), `nodes/index.ts` (import + one list entry), `tests/nodes/step-1-nodes.test.ts` (kind count 48 -> 49; other agents' new nodes will also bump it, sum them), `tests/nodes/fake-world.ts` (one line).
- Known limits: probe uses axis-aligned boxes (a little generous on diagonal headings); two cars facing each other head-on in a deadlock both wait forever (no yield logic); `probeAhead` treats any solid block (including thin decor) as an obstacle for walkers using lookAhead > 0.

Status: DONE_WITH_CONCERNS
Summary: Vehicle collision, vehicle Dừng and crash outputs, probeAhead, and the Chạy theo tuyến node are implemented and tested; gates green, browser check clean (0 errors, 52-54 fps with 10 route cars under software GL).
Concerns: user-saved boards with 2+ vehicles will now collide (no migration, D's area); race sample was pinned to collide "no"; a stray `D:\workspace\jx.ps1` and the app junction remain to be deleted; `step-1-nodes` kind count will conflict across agents.
