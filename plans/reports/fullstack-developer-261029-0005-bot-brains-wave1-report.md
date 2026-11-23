# Bot brains - wave 1 report

Date: 2026-10-29. Scope: 4 brain nodes (straight-line steering), character `role`, 2 samples, lesson 6. No pathfinding. Not committed.

## Verification
- `npx vitest run`: 347 passed (304 old + 43 new). `npx tsc --noEmit -p .` clean. `npm run build` ok.
- Engine runs (tests/io/samples.test.ts): guard catches a still player in its sight (lose); guard ignores a far player; player can win by sneaking along the wall (key, door, goal); cleaner bot delivers 3/3 crates unattended and wins (counter 0,1,2,3).
- Browser (Playwright, scratchpad `smoke/bots-*.mjs`, shots in `scratchpad/bots/`): palette shows "Bo nao" with 4 nodes; cleaner-bot wins unattended; guard-patrol catches a walking player; all 5 old samples open and play; lesson 6 completed end to end via real drags/wires (16 steps, lose message, finish); lessons 1-4 pass; lesson 5 completes to win. No console errors in any run.
- Two old script checks fail on timing only, not engine: `tut-run.mjs` "L2 HUD shows score 1" (fixed 1.5 s hold; lesson editor runs ~20 fps in headless, hero reached the star at 0.7-1.6 s; passes with a 3.5 s hold) and `tools-lesson5.mjs` "first play: tool reaches the hand" (polls a one-tick "Dung" badge; second play, which has a persistent badge, passes). Not verified against a pre-change baseline (no git); no code path they use was touched.

## Files
New: `src/nodes/steering.ts`, `patrol.ts`, `go-to.ts`, `chase.ts`, `sequence.ts`; `src/samples/guard-patrol.json`, `cleaner-bot.json`; `tests/nodes/brain-nodes.test.ts`.
Edited: `engine/types.ts`, `world/world.ts`, `world/entity.ts`, `nodes/character.ts`, `nodes/item.ts`, `nodes/index.ts`, `render/cameras.ts`, `editor/palette.ts`, `style.css`, `io/samples.ts`, `tutorial/lessons.ts`, `tutorial/text-vi.ts`, tests (`fake-world.ts`, `step-1-nodes.test.ts` count 20 to 24, `samples.test.ts`, `lessons.test.ts`).

## Contract changes (all append-only)
- `NodeCategory` + `'brain'` (label "Bo nao", palette order before Ket qua, `.cat-brain` color).
- `CharacterRole = 'player' | 'bot'`; `EntitySpec.role?`, `EntityView.role?`. Character node param `role` (default `player`; old boards have none = player).
- `WorldApi` + `solidAt(point: Vec3): boolean` (point inside a visible solid block, inclusive edges) and `cameraYaw(): number`. Read-only, deterministic. `FakeWorld` updated.
- Item node: new input `hide` (bool, rising edge, same as Block) - needed so a delivered crate can vanish.
- `pickFollowTarget(entities)` in cameras.ts: first visible non-bot character, else first visible character. Used by `CameraRig.update`.

## Nodes (category Bo nao)
- `patrol` Di tuan: in self, on (default true); out moveX, moveY, atEnd (pulse); params pointA, pointB, wait, turnAtEdge (no/yes). First heads to the farther end. turnAtEdge flips at a drop instead of walking off.
- `go-to` Di toi: in self, target (object, optional), go (default true); out moveX, moveY, jump, arrived, arrivedPulse; params targetPos, stopDistance (min 0.2). Wired target that is hidden/gone falls back to targetPos.
- `chase` Duoi theo / Tranh xa: in self, target; out moveX, moveY, jump, seeing; params mode chase/flee, sightRange, giveUpRange (clamped >= sight). Flee never jumps or walks off a ledge. Chase stops within 0.4 of target.
- `sequence` Chuoi viec: in next, reset (rising edges; a signal already on at tick 0 is ignored); out step1..step6, index (1-based, 0 when finished), finished; params stepCount (2-6), loop (no/yes).
- Move outputs use stick convention (top view: up = +moveY = -z). 3D: steering undoes the camera yaw using `world.cameraYaw()`, so bots move correctly whatever the camera angle.
- Side/3D hopping: jumps when a solid is at knee height ahead and clear at 1.6 above the feet (obstacle <= 1.5 high), or at a gap edge when the waypoint is not more than 1 below. Walks off when the goal is lower.
- Wiring: brain nodes form cycles with the character (self out, move in); the engine already resolves them with one-tick back-edges, no change needed. Two brains on one character: sum with Phep tinh (+); an idle brain outputs 0 (guard sample does exactly this with patrol + chase, patrol gated by `not seeing`).

## Pathfinding hook (for wave 2) - `src/nodes/steering.ts`
```ts
export type SteerMemo = Record<string, unknown>;          // per-node scratch, lives in node state (cache path, replan timer)
export interface WaypointRequest { world: WorldApi; self: EntityView; goal: Vec3; dt: number; memo: SteerMemo }
/** THE single place that picks where to head next. Wave 1 body: `return req.goal;` */
export function nextWaypoint(req: WaypointRequest): Vec3;
export function steerToward(world: WorldApi, self: EntityView, waypoint: Vec3, opts?: { avoidFall?: boolean }): { moveX: number; moveY: number; jump: boolean };
```
Every brain node does `steerToward(world, self, nextWaypoint({ world, self, goal, dt: ctx.dt, memo: s.memo }), opts)` (patrol, go-to, chase). Wave 2: replace the body of `nextWaypoint` with: replan when `memo` is stale (0.5 s or goal cell changed), return the next path point, fall back to `goal` when no path. `steerToward` already handles walking and hopping toward any point. Other exported helpers: `hasArrived`, `distanceFor`, `unitToward`, `edgeAhead`, `hoppableObstacleAhead`, `moveForDirection`, `liveCharacter`, `visiblePosition`, `MIN_STOP_DISTANCE`. Arrival uses planar distance (+ |dy| <= 1.5 outside top view), so path waypoints at intermediate heights are fine. Chase `flee` builds its goal as a point 4 units away from the target; a path-follower should skip pathing for flee or path to that point.
Nodes keep `memo: {}` in their state already. Patrol/go-to have no pathing-specific params yet.

## Samples (both 2d-top, in `io/samples.ts`)
- `guard-patrol` "Linh gac": WASD player, red robot guard (bot) patrols z=0 between x=-4..4 with sight 5/give-up 8, chases when it sees you, touch = lose. Key (pickup) hides itself and the wall/door; goal zone wins. Winnable by hugging the north wall (tested).
- `cleaner-bot` "Bot don dep": no player (camera falls back to the bot). Sequence (2 steps, loop) drives two go-to nodes: pile (grab on arrival pulse) and bin (drop on arrival pulse). 3 crates on the pile within grab reach; touch crate-bin hides crate, counter reaches 3 = win. Design note: instead of the 4-step sequence in the brainstorm, grab/drop fire on the go-to arrival pulses, so 2 steps suffice and no `or` chain per action is needed.

## Lesson 6 "Tao bot" (id `make-bot`, 16 steps, 2d-side)
Starts with stick/key/hero/floor. Learner: add 2nd Nhan vat, set Vai tro = Bot, add Di tuan, wire bot.self -> patrol.self and patrol.moveX -> bot.moveX, play, add Cam bien cham (hero.self -> A, bot.self -> B), add Thang/Thua, wire touching -> lose, play and get caught (step completes on `ended === 'lose'`). Verified by unit test (also plays the learner board: bot catches player) and by the browser script.

## Known limits / notes
- Straight-line only: a bot blocked by a wall taller than 1.5 or a pit it cannot clear just pushes/stops (wave 2 target). Vision has no occlusion (as scoped).
- Bot speed/jump power come from the Character node params. Hop-over of a 1.5-high obstacle needs jumpPower ~10 (default) - apex 1.67.
- `Sequence` has no per-step done inputs; instant actions (grab/drop) are wired to the go-to arrival pulses instead.
- Generator for the two sample JSON files is a throwaway in scratchpad (`bots/gen-samples.mjs`); JSONs are the source of truth.

## Unresolved questions
- Want the lesson-6 starter to include a chase brain (needs a Phep tinh sum node, +2-3 steps)? Left out to keep the lesson short.

Status: DONE_WITH_CONCERNS
Summary: Wave 1 complete: 4 brain nodes with a single `nextWaypoint`/`steerToward` hook, character role + camera choice, 2 samples, lesson 6; 347 tests, tsc and build green, browser checks pass.
Concerns/Blockers: two legacy browser-script checks (lesson 2 HUD hold time, lesson 5 first-play badge poll) fail on timing in this headless setup; analysis shows they are script timing, but no pre-change baseline exists to prove it.
