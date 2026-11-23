# Conveyor + rail style + riding on vehicles (agent 1)

Branch feat/conveyor (worktree D:\workspace\GameBuilder-conveyor). Status: DONE_WITH_CONCERNS.

## What was built
- Hộp node: params (advanced) "Tốc độ băng chuyền" (0 = off), "Hướng băng chuyền" (X, -X, Z, -Z), "Thành chắn hai bên" (Có/Không); inputs "Chạy băng" (default true), "Đảo chiều". Speed/dir/walls are create-only.
- Rule: style "Băng chuyền" + speed 0 => speed 2 along the longer horizontal side (direction option then only picks the sign). Documented in the node description. Any other style + speed 0 => no belt.
- world/conveyor.ts (new): belt state, scroll phase, wall sync, carry on belts, carry riders of vehicles. Reuses `standsOn` / `movable` from platforms.ts (now exported). Carry goes through physics `moveAxis`, so bodies are never pushed into solids.
- Belt: characters, items, vehicles on the top surface are carried (extra displacement, own movement untouched). 2d-side and 3d: top surface; 2d-top: footprint overlap (belt there is a floor strip, use type "Vật nhặt"). Hidden belt does nothing.
- Side walls: two thin solid block entities (0.1 wide x 0.3 high), 3D only; follow/hide/show/recolor with the belt, same ownerNodeId.
- Riding: solid vehicle carries characters/items on top with translation and yaw (rotation about vehicle centre; rider facing rotated). 2d-side and 3d; none in 2d-top. Seated drivers and held items untouched.
- Render: style "Băng chuyền" (frame, side beams, belt surface, 2 end rollers, stripes scrolling from view.belt.phase: still at speed 0, reverse when negative) and "Đường ray" (gravel bed, sleepers, two rails; decorative). New optional `figure.update(view)`.
- Additive API: EntitySpec.belt, EntityView.belt, WorldApi.setBeltSpeed, Entity.belt.

## Files
Edited: engine/block-styles.ts, engine/types.ts, nodes/block.ts, render/block-looks.ts, render/scene-view.ts (1 line), world/entity.ts, world/physics.ts, world/platforms.ts (2 exports), world/world.ts, tests/nodes/fake-world.ts (1 line). New: world/conveyor.ts, tests/world/conveyor.test.ts (19 tests), tests/render/belt-look.test.ts (3). CRLF files kept CRLF.

## Gates (app/)
- tsc --noEmit: clean. npm run build: ok.
- vitest: 1119 pass, 2 FAIL (see concern): tests/io/city-delivery-sample.test.ts and tests/io/city-delivery-3d-sample.test.ts, both "nodes do not overlap" layout checks.
- Browser (port 5203, stopped): 3D corner of two belts moving 6 crates + rail block, 0 console errors. Shots in plans/reports/shots-conveyor/ (belt-corner.gif, crates-on-belts.png, edit-view.png).

## Concern (needs decision)
The 2 new inputs make every Hộp node 52 px taller (estimateNodeSize counts ports). Sample boards city-delivery.json and the 3D one were laid out with exact gaps (ground y150 -> house-1 y366, gap 216 < new height 230), so nodes now overlap on the board. Not fixed because samples must not be edited. Options: (a) shift the lower node rows of those 2 samples down ~60 px (layout only), (b) make the two ports not count toward node height. Gameplay of old boards is unchanged (defaults: no belt, nothing carried).

## Other notes
- Quarter-turned belts swap travel axis; turn direction sign is not mirrored. Walls follow the swap.
- Riders of a vehicle that sits on a belt are not carried by the belt (only the vehicle is).
- Junction app/node_modules left in the worktree.
