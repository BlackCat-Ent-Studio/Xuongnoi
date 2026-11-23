# Chassis side push + scale weight: measure, gate, finish

- Worktree: `D:\workspace\GameBuilder-sidepush`, branch `fix/chassis-side-push-scale`, base main `568b442`
- Final commit: `78c6697` (on top of `801c1b9`). Not merged, not pushed, main untouched.
- Status: DONE. Both rules kept. 0 baseline entries moved, nothing re-recorded.

## 1. Result per rule

| Rule | Commit | Kept? | Baseline entries moved (off / on / solid-on summary) | Shipped sample tests |
|---|---|---|---|---|
| A: moving blocks (piston head, lift, platform) meet a chassis by its turned outline, so a side push costs force | `801c1b9` | KEPT | 0 / 0 / 0 | all green |
| B: a chassis weighs the mass on its card to scales and to what carries it | `78c6697` | KEPT | 0 / 0 / 0 | all green |

Each rule was measured alone (the other one taken out of the tree for the run), then both together:
`tests/editor/solid-off-unchanged`, `real-physics-on-hash`, `solid-on-behaviour`, `solid-on-invariants` (reads `solid-on-summary.snap.json`), `solid-on-scripted-play`: 361 / 361 in all three runs.

Moved baseline entries: none, so no table and no file edited among `solid-off-baseline.json`, `real-physics-on-baseline.json`, `solid-on-summary.snap.json`.

Why nothing shipped moves:
- Both rules apply only to a chassis on wheel traction (`robot.traction`, set only when "Vật lý thật" is on). Switch off = old code path, byte-identical.
- A: of shipped boards with a chassis, only `agv-board` has a moving block / pusher too, and those are bolted on that chassis (a pusher never pushes what it stands on).
- B: no shipped board has both a chassis and a scale ("Cân" `force-sensor`); no shipped robot rides on another robot.

## 2. Tests (each fails without its rule)

| Rule | File | With rule | Without rule |
|---|---|---|---|
| A | `tests/actuator/piston-chassis-side-push.test.ts` (8) + `tests/world/moving-block-chassis-outline.test.ts` (5) | 13 pass | 7 red (side push moved the chassis 1.5 - 1.7 m for free; platform met the square 0.1 m early; chassis squeezed toward a wall) |
| B | `tests/world/robot-scale-weight.test.ts` (6, new) | 6 pass | 5 red (scale read 2 instead of 5 / 20; 5 instead of 8; carrier payload 2 instead of 5, 6 instead of 24). The 6th is the switch-off case: still 2 kg, green both ways |

Rule B also needed one existing test updated: `tests/world/weighing-shortcuts.test.ts` holds its own long-hand copy of the weighing rule to compare against `massOn`. Its copy of "what a body weighs" still said 2 kg for a chassis (expected 180.19, got 195.19 = five 5 kg chassis counted 3 kg heavier each). I updated that one line to the new rule; the comparison itself is unchanged. This is in commit `78c6697`.

No rule checks a sample name, card id or board: A keys on `hasChassisOutline`, B on `robot.traction`.

## 3. Numbers

- `npx tsc --noEmit -p .`: clean.
- Full `npx vitest run --testTimeout 300000` on the exact committed tree `78c6697`: 320 files passed, 1 skipped; **4695 passed, 0 failed, 1 skipped**; 928 s. (Main: 4676; +19 = 13 for A + 6 for B.) The known flake did not show.
- An earlier full run (before the weighing-shortcuts fix) had 2 red: that reference test, and `tests/puzzle/level-7-decoy` timing out at its own 900 s limit. Level 7 alone: passes in 330 s on the branch, 268 s with main's three source files (the 330 s run overlapped another vitest run for a while, so not a clean comparison). In the final full run it passed.

## 4. Commits

1. `801c1b9` fix(world): moving blocks meet a robot chassis by its real outline, so a push from the side costs force (inherited, unchanged)
2. `78c6697` fix(world): a robot chassis weighs the mass on its card to scales and to what carries it (`src/world/material.ts`, new test, reference test line)

## 5. Not verified

- Browser: nothing played in the app; headless tests only. No screenshots taken (nothing drawn changed).
- Old user boards saved with "Vật lý thật" on: a piston pushing a long chassis from its side now needs grip x mass x 9.81 (was free), and a scale under a robot reads the card mass (was 2 kg). No shipped board does either; user boards cannot be measured.
- Level 7 search time: branch may be up to ~20 % slower than main (330 s vs 268 s, noisy single runs). It timed out once at 900 s under full-suite load; full-suite time on this machine varied 928 - 1213 s versus 630 s reported for main earlier, with another agent working at the same time. Not profiled.
- A chassis with a collision box of its own: rule A leaves it on the upright box (by design of `hasChassisOutline`); rule B does give it the card mass.

## 6. Questions

1. Level 7 decoy test sits close to its 900 s limit when the machine is busy: a) leave ⭐ (passes alone and in the final run) / b) have someone profile whether rule A slows board runs.
