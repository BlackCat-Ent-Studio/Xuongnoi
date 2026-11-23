# Vehicle cargo + zone follow (branch feat/vehicle-cargo, worktree D:\workspace\GameBuilder-vehicle-cargo)

## Done
- Zone sensor: new optional object input "Bám theo vật" (`follow`). Wired: centre = entity position + centre param (offset). Unwired / null / unknown id: old behaviour. Description updated.
- New node `cargo` "Chất / Dỡ hàng" (Hành động): inputs Xe, Chất, Dỡ, Dỡ hết; outputs Số hàng, Vừa chất, Vừa dỡ, Hàng trên cùng; params Sức chứa (4), Tầm với (2, measured from vehicle edge). Edge-triggered; Dỡ hết wins over Dỡ over Chất in one tick.
- World: WorldApi additive `loadCargo(vehicle, reach, capacity)`, `unloadCargo(vehicle)`, `cargoOf(vehicle)`. Cargo = item with `heldBy = vehicle` + `cargoSeq` (so grab/equip/teleport/combat skip it; `isHeld` reports false for cargo). New `world/cargo.ts`: bed layout (2x2 cells on rear/mid bed, extra items stack up; top view stays on plane), nearest-loadable, unload spot (behind, sides, front, then 0.7 further; outside solid blocks; none free = no unload).
- physics.ts: item loop positions cargo from `cargoPositions`. world.ts: `release` clears cargoSeq; `hide(vehicle)` releases cargo in place; hiding a loaded item drops it from the list (list is derived, no stored array). Driver enter/exit does not touch cargo.
- Node count 46 -> 47 (step-1-nodes test). fake-world got 3 stub methods.

## Files
src/nodes/cargo.ts (new), src/world/cargo.ts (new), tests/nodes/cargo-and-zone-follow.test.ts (new, 25 tests: zone follow x3 modes, load/unload/capacity/full/empty/unload-all, follows while driving + driver exit in all 3 modes, stacking, wall-behind unload, no free spot, hide vehicle, hide item, not grabbable, no vehicle). Edited (small, additive): engine/types.ts, world/world.ts, world/entity.ts, world/physics.ts, nodes/index.ts, nodes/zone-sensor.ts, tests/nodes/fake-world.ts, tests/nodes/step-1-nodes.test.ts. CRLF kept. Did not touch block/item/counter nodes.

## Gates (app/)
vitest 60 files / 823 tests pass; `tsc --noEmit -p .` clean; `npm run build` ok (only the existing chunk-size warning). Committed on feat/vehicle-cargo, not merged.

## Browser smoke (port 5190, server stopped after)
Board via autosave key: player + 'Xe tải nhỏ', 3 crates, E enter, L load, U unload, zone following truck, 2 HUD numbers. 2D top and 3D: 3 loaded (HUD 3, zone 3), drove, unload one -> 2, then all -> 0; crates visibly stacked on the bed in both views and one lands behind the truck after unload. 0 console errors. Shots: D:\workspace\GameBuilder\plans\reports\shots-cargo\ (top-*.png, 3d-*.png). Script: C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\28feef90-daae-4318-8ffa-6bf07e972cef\scratchpad\cargo-smoke.mjs. 2D ngang covered by headless tests only (no screenshot).

## Notes for merge
- Conflicts likely only in WorldApi block of types.ts / world.ts near `exitVehicle`/`isHeld`, nodes/index.ts import+list, node-count test (other agent adds a node too: expect 48 after both).
- Zone counts cargo items inside it (as it counts any visible item); a zone following the truck with filter "item" therefore counts the load.
- Node junction `app/node_modules` in the worktree is untracked/ignored.

Status: DONE
Summary: Zone follow input and the Chất / Dỡ hàng node are in with world support, tests, gates green and browser smoke in 2D top and 3D; committed on feat/vehicle-cargo.
Concerns/Blockers: None blocking. Node-count test must become 48 after merging with the other branch; 2D side has no screenshot.
