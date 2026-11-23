# WT-D camera + teleport + portals — report

Branch `feat/camera-teleport` (worktree `D:\workspace\GameBuilder-camera-teleport`, from 01ed58e). One commit.

## New files
- `app/src/nodes/camera.ts` — node `camera` "Máy quay" (action). In: on (default true), target, zoom (0 = param), shake (edge). Params: mode follow/fixed, point (offset in follow / look-at in fixed), zoom, smoothness (0 = instant, 5 = default follow feel), shakeTime, shakeStrength. Out: active.
- `app/src/nodes/teleport.ts` — node `teleport` "Dịch chuyển". In: who, go (edge), dest (object). Params: position, keepVelocity yes/no. Out: done (pulse).
- `app/src/nodes/portal.ts` — node `portal` "Cổng dịch chuyển" (object). In: partner (object), on. Out: self, used (pulse), who. Params: position, size, color, pair (text code), cooldown.
- `app/src/world/teleport.ts` — free-spot search (lift up to 6 in 0.5 steps, then rings to 4), teleport, portal registry/step.
- `app/src/render/camera-director.ts`, `app/src/render/portal-model.ts` (ring + swirl; upright in side view, floor pad + light column in top/3d).
- `app/src/samples/portal-camera.json` — side view: gap too wide to jump, portal pair by wire, two camera nodes (main follow, close-up zoom 1.6 when x > 15; most recent wins), shake on portal use, R teleports back home.
- Tests: `tests/world/teleport.test.ts`, `tests/world/play-camera.test.ts`, `tests/io/portal-camera-sample.test.ts`.

## Shared-file edits (small, append-only; expect trivial merge conflicts)
- `engine/types.ts`: WorldApi += `setCamera`, `teleport`, `setPortal`, `portalUser`; types `PlayCameraCommand`, `PortalLink`; World += `cameraCommand()`.
- `world/world.ts`: camera request map + teleporter wiring + `teleporter.step(dt)` after computeContacts.
- `render/cameras.ts`: `update(..., playCamera = null)` 4th optional param, director zoom in `size`, shake in `place()`. Edit camera path never uses it.
- `render/game-view.ts`: passes `world.cameraCommand()` when following. `render/scene-view.ts`: `portal` entry type (block with `look: 'portal'`).
- `nodes/index.ts` (+3 nodes), `io/samples.ts` (+sample), `tests/nodes/fake-world.ts` (+4 stubs), `tests/io/samples.test.ts` (id/mode lists), `tests/nodes/step-1-nodes.test.ts` (29 -> 32 kinds). On merge, recount node kinds / sample lists across branches.

## Behaviour decisions
- Camera: request lives in world; most recently ACTIVATED node wins (re-enable = newest); none -> default follow unchanged. Zoom/centre ease at node smoothness; shake is a deterministic sine offset on screen axes decaying over shakeTime. Works in all 3 view modes (3d orbit/yaw still user-controlled).
- Teleport: dest = centre of entity; blocked -> nearest free spot, else null (done=false). Blocks refused. Held item cannot be teleported itself (move its holder; held/hand items travel with holder). Seated driver: the whole vehicle moves, driver stays seated (no forced exit). Vehicle teleport moves driver. Characters bump `solidRevision` so bots replan from the new place.
- Portal: any character/item/vehicle touching it (not held, not seated) goes to partner (arrives at its base). Entity locked out until cooldown elapsed AND it left all portals -> no ping-pong. Partner via `partner` wire (one-sided is enough) or same `pair` code. Disabled/hidden partner = no teleport. Keeps velocity.

## Verification
- `npx vitest run`: 540 pass (513 baseline + 27 new). `npx tsc --noEmit -p .` clean. `npm run build` ok.
- Browser (port 5184, stopped after): sample plays; portal rings render, player crosses, camera zooms on far island, win card; edit view unchanged, no console errors. Screenshots in `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\c6588d98-de8b-47ca-8a66-fd5282a3c2b1\scratchpad\wt-d\`.
- Not visually checked: portal pad in top/3d views and shake frames (shake covered by unit tests).

Status: DONE_WITH_CONCERNS
Summary: Camera, Teleport and Portal nodes plus `portal-camera` sample implemented, tested and committed.
Concerns: top/3d portal model and shake not eyeballed in browser; count-based tests (node kinds, sample list) will conflict with other branches on merge.
