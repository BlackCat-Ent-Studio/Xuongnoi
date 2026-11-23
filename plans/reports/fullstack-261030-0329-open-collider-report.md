# Open collider report (agent A)

Branch feat/open-collider, commit 6886db1. Worktree D:\workspace\GameBuilder-collider.

- New helper world/collider.ts: colliderBox(entity) (returns the entity itself when no custom collider, no alloc), colliderOffset, boxOverlap, normalizeCollider. world/body-tuning.ts maps EntitySpec -> Entity fields.
- Additive fields: EntitySpec colliderSize/colliderOffset/gravityScale/friction/bounce; Entity collider/gravityScale/friction/bounce; EntityView.collider (only when custom).
- Used by: physics (blocking, touching/contacts, pushOut), platforms (ride, push, turn), probe-ahead, projectile hits, world.solidAt/solidBoxes (so pathfinding grid), overlapsSolid (cargo/drop/teleport/seat spots), touch.ts geometric path.
- Params (advanced, createOnly) via nodes/body-params.ts (BODY_PARAMS spread at END of params in block/item/character/vehicle; BODY_PARAM_IDS added to createOnly). Item also friction (default 10) and bounce (default 0).
- Gravity scale applies to characters, items, vehicles (terminal speed unchanged).
- Bounce: vertical only, below 1.5 u/s fall speed no bounce so it settles. Top-down friction = friction*0.3 (default 3, as before).
- Edit overlay: render/collider-frames.ts; GameView.setSelection(ownerIds) (app-contracts), called from editor/app.ts on 'selection'. Hidden while playing; frame never raycast-picked.
- Tests: tests/world/collider.test.ts (23). Full suite 1052 pass, tsc clean, build OK.
- Screenshots: D:\workspace\GameBuilder\plans\reports\shots-collider\ (2-selected-green-frame.png shows the narrower offset green box inside an orange block). Server on 5201 stopped. node_modules junction left in worktree.

Status: DONE_WITH_CONCERNS
Summary: Collider box, gravity scale, item friction/bounce, touch.ts and green edit frame implemented; all gates green.
Concerns:
- Pathfinding nav body size (path-follower uses self.size, agent D's file) still uses visual size; obstacles use collider.
- Item bounce is vertical only; no horizontal wall bounce.
- Not touched: useTarget (tool swing reach), vehicle seat/cargo-bed placement, which stay visual-size by design.
- Merge: character.ts/vehicle.ts/block.ts/item.ts edits are the import, `...BODY_PARAMS` at array end, createOnly line, and `...bodySpec(params)` in spawn. If PATHFIND_PARAM must be last in a node (vehicle after merge), move `...BODY_PARAMS` before it. block/character/item had mostly-LF files with a few CRLF lines; kept LF.
- Turning blocks with a collider: collider axes swap on quarter turn, but turnSolidTo checks overlap before the quarter updates (edge case only).
