# Open vehicle / cargo / route params (agent C)
Branch feat/open-vehp (worktree D:\workspace\GameBuilder-vehp). All new params `advanced: true`, defaults = old constants.

| Node | Param id | Default | Wired to |
|---|---|---|---|
| Phương tiện | brake | 2 | VehicleSpec.brakeFactor (vehicles.ts speedRate) |
| | reverseShare | 0.4 | spec.reverseShare |
| | crashSpeed | 1.5 | spec.crashSpeed (physics.ts crashInto, mover's spec) |
| | shove | 0.25 | spec.shoveShare |
| Chất / Dỡ hàng | unloadGap | 0.1 | CargoLayout.unloadGap -> unloadSpot |
| | cellsPerLayer (select 1/2/4/6) | 4 | CargoLayout.cellsPerLayer -> VehicleBody.cargoCells |
| Chạy theo tuyến | arriveRadius | 0 = auto (vehicle 1.2, walker 0.5) | arrival check |
| | steerGain | 2 | throttle-steer gain (SHARP_TURN left fixed, KISS) |

Cargo layout rule: 1 = one spot centred; 2 = 1 row x 2 cols; 4 = 2x2 (old); 6 = 3 rows x 2 cols. Other values snap to 4. Layout is stored on the vehicle when the cargo node loads/unloads (optional extra arg on World.loadCargo/unloadCargo, new type CargoLayout).
Vehicle node only adds spec fields when they differ from defaults, so existing spawn-spec test unchanged.

Files: engine/types.ts, nodes/{vehicle,cargo,route-follow}.ts, world/{vehicles,physics,world,cargo}.ts, new tests/world/vehicle-tuning.test.ts (11 tests). Preserved CRLF.
Gates: vitest 77 files/1040 tests pass (full run, before final test-only type fix; new file rerun 11 pass), tsc clean, build OK.

Status: DONE
Summary: 8 advanced params exposed, behaviour identical at defaults, committed on feat/open-vehp.
Concerns: vehicle.ts params inserted after `collide` and createOnly list rewritten to multi-line -> likely merge conflict with agent A (append at end / createOnly). Crash/shove use the moving vehicle's spec only. cellsPerLayer applies only after the cargo node first acts. node_modules junction left in worktree.
