# Engine pause + live params (agent B)

Branch `feat/engine-pause` (worktree D:\workspace\GameBuilder-engine-pause), 1 commit. vitest 666 pass, tsc clean, build OK.

## API (app-contracts.ts, GameView)
```ts
pause(): void;            // no-op unless playing
resume(): void;           // paused time is not replayed (accumulator reset)
stepFrame(): void;        // paused only: exactly 1 fixed tick on the next rAF frame, then render + HUD
isPaused(): boolean;      // true only during a paused play session
onPauseChange(cb: (paused: boolean) => void): void; // also fires false when stop()/play() ends a paused session
applyNodeParams(nodeId: string, params: Record<string, unknown>): boolean; // play mode only; false if not playing
```
Runtime (engine/types.ts): `applyNodeParams(nodeId: string, params: Params): boolean`.
WorldApi: new `setEntityStyle(id, { color?, look? })` (look: characters only). Fake world in tests updated.
NodeDef: optional `createOnly?: string[]` and `liveApply?: Record<string, (ctx, params, state, prev) => void>`.

## Behaviour
- Paused: rAF loop keeps drawing (camera live), sim does not tick. Input is polled per tick only, so nothing accumulates. stop() works while paused (pause cleared, callback fired false).
- Pacing logic is `createSimPacer` in render/game-loop.ts (pure, tested).
- applyNodeParams semantics: unknown node/param, wrong value type (NaN, string for number, bad vec3) -> false, nothing applied for that key. Params not in `createOnly` are re-read every tick by evaluate() so they apply live automatically (shared mutable params object per node). Create-only params apply only with a `liveApply` handler, else rejected (false = UI shows "áp dụng khi chơi lại"). Mixed patch: applies what it can, returns false.

## Live support by kind
| Kind | Live | Needs restart (false) |
|---|---|---|
| character | speed, jumpPower, color, look | position, role |
| block | color | position, size, type |
| item | color | position, size, shape, carryable, holdStyle, damage |
| vehicle | color, control (read per tick) | model, position, solid, steerMode, maxSpeed, accel |
| portal | color, pair, cooldown | position, size |
| zone | filter (per tick); color (marker is hidden in play) | center, size |
| moving-platform | color, speed, wait, loop | position, size, to |
| rotating-platform | color, speed, every | position, size, mode |
| timer | seconds (total changes, elapsed kept) | - |
| counter | target | start |
| latch | - | start |
| random | min, max, whole, mode | seed |
| all others (camera, health, shooter, spawner, patrol, chase, go-to, fight, compare, math, map-range, const, show-*, win-lose, key, stick, ...) | every param (read in evaluate) | - |

Spawner/shooter changes affect future spawned copies/shots only.

## Not verified
- Real browser: pause/resume/step in game-view.ts (WebGL, rAF) has no automated test; only pacer + runtime + world are tested. Colour/look repaint relies on scene-view's existing per-frame colour/look diff (read, not run).
- Per-kind spot checks beyond character/timer/counter are by code reading (e.g. spawner/shooter/camera "live" is inferred from evaluate() reading params each tick).
- A hidden/ended game: applyNodeParams still returns true on a finished-but-not-stopped session (harmless).
- Line endings: repo has mixed LF/CRLF; edits preserved per-file endings.

Unresolved: none.
