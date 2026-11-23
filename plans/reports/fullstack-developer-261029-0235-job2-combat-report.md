# Job 2 — Combat report

- Branch `feat/combat` (worktree `D:\workspace\GameBuilder-combat`), commit `252c48e` on top of `dff2719`.
- Checks: `npx vitest run` 451/451 (392 baseline + 59 new), `tsc --noEmit` clean, `npm run build` ok. Browser run on port 5174 (since stopped): no console errors.

## What was built
- `world/combat.ts` (new): health state, strike, i-frames 0.5 s, knockback (7 u/s, 0.25 s fade, small hop outside top view), death (fall 0.8 s, then hide), thrown-item hits, `lockMotion` hook.
- Damage: bare hand 1; tool uses item damage, else by shape (sword 3, hammer 2, pickaxe 2, rest 1). Item param `damage` (0 = by shape). Thrown item hurts the first character it touches while moving >= 1.5 u/s, once, never its thrower.
- A character without a `health` node cannot be hurt (no damage, no knockback).
- Death: held and hand items are released at once; a dying character cannot act or be hit; `dead` stays true after it is hidden.
- `nodes/health.ts` "Máu": inputs self, heal (edge); params maxHp 5, healAmount 1, showBar; outputs hp, hurtPulse "Vừa bị đánh", dead "Hết máu".
- `nodes/fight.ts` "Đánh nhau": inputs self, target; outputs moveX, moveY, jump, attack (one-tick pulse); params range 1.2, attackCooldown 0.8, sightRange 8. Uses `followPath` (A*), nudges toward the target when in range so it keeps facing it, backs off 0.25 s after each attack. Idle when the target or itself is dead.
- Render: `render/health-bar.ts` (camera-facing sprites, green to red), `render/hit-flash.ts` (red emissive), Humanoid tips over using `fallen` and flashes using `hurt`.
- Sample `arena` "Võ đài" (2D side, player vs robot bot, sword and hammer on the floor, HP shown on HUD).
- Lesson 8 `combat` (15 steps) in `tutorial/lessons-combat.ts`, self-contained: it does not import `lessons.ts`, so there is no import cycle.

## Shared-file edits, all small and appended
| File | Change |
|---|---|
| `engine/types.ts` | `EntitySpec.damage`; `EntityView.health/hurt/fallen`; WorldApi `setHealth`, `heal`, `healthOf`, `wasHurt`, in a block after `wasUsedOn` |
| `world/world.ts` | `combat` instance; `letGoOfAll` extracted from `hide`; `const api: World = {...}; return api`; `liveCharacter` skips the dead; strike inside `useTool`; `thrownBy` set in `throwHeld`; the 4 new methods; `combat.update` in `step` (also runs when the game has ended) |
| `world/entity.ts` | optional `combat/damage/thrownBy` fields; `...combatView(e)` in `toView` |
| `world/physics.ts` | 1 line: `if (lockMotion(c)) return;` in `applyIntent` |
| `nodes/item.ts` | `damage` param and spawn field |
| `nodes/index.ts` | 2 imports and 2 entries in the node array |
| `render/scene-view.ts`, `render/humanoid-model.ts` | 4 lines and about 18 lines (`applyHurt`, `applyFall`) |
| `render/game-view.ts` | after the game ends, keep stepping and drawing while a visible character is mid-fall; the end card shows once it has hidden (at most 0.8 s). Without this the `Thắng!` overlay froze a bot that was still standing |
| `io/samples.ts` | 2 lines (import, entry) |
| `tutorial/lessons.ts` | 1 import, `combatLesson` appended to `LESSONS` |
| tests | `fake-world.ts` +4 stubs; `step-1-nodes.test.ts` count 24 to 26; `samples.test.ts` id and mode lists plus an arena exemption from the "no end within 600 idle ticks" rule |

## Merge notes
- Expect trivial conflicts on: `LESSONS` array line, the `STEP_1_NODES` array, `samples.ts` and `samples.test.ts` lists, the node-count test (24 to 26 here; the final number is the sum of all three jobs), the `fake-world.ts` stub block, and the `WorldApi` section in `types.ts` (mine is a self-contained block).
- `entity.ts` and `fake-world.ts` use LF; `world.ts`, `lessons.ts`, `samples.ts` and `game-view.ts` use CRLF (kept as is).
- Job 3: a vehicle driver that is seated and hidden should not stay hittable; `liveCharacter` in world.ts already ignores hidden characters, so nothing extra is needed unless seated characters stay visible.

## Verification
- Engine scripted (3 view modes): punch -1; tools 3, 2, custom 4; the hurt pulse lasts one tick; knockback; i-frames; no-health ignored; thrown hits once and spares the thrower; slow items are harmless; death tip, hide and release; heal clamp; the fight bot beats an idle player in 25 s in side, top and 3d.
- Arena scripted: idle player loses; taking the sword and swinging wins; a punch costs 1.
- Lesson 8 scripted through the editor state, and the learner's finished board is then played for real.
- Browser: arena idle lose, sword win, lesson 8 walked via real drag and wire to step 15/15. Screenshots in `...\scratchpad\job2\` (`sheet.png` shows the hits, red flash, knockdown, then the end card).

## Notes / decisions
- Invulnerability does not stop the attack pulse (`wasUsedOn`); the swing still counts as "used".
- Characters do not collide with each other (pre-existing), so a bot can stand inside a player.
- The health bar sits 0.3 above the head, so it overlaps a head-carried item.

## Unresolved questions
- None blocking.
