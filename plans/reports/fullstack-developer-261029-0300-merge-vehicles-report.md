# Merge: feat/vehicles into main

Commits on main: `be31e6c merge: vehicles branch`, `df1ede5 fix: integrate combat with vehicles and hide key-door hint after opening`. Worktree `../GameBuilder-vehicles` removed, branch `feat/vehicles` deleted.

## Conflict resolution
All 9 files kept both sides (append-only), CRLF/LF preserved.
- `engine/types.ts`, `world/entity.ts`, `world/world.ts`, `nodes/index.ts`, `io/samples.ts`: both blocks kept.
- `render/scene-view.ts`: imports from both; `Entry` union = combat's item entry (pose/flat/bounds) plus `vehicle` entry; `LYING_POSE` kept.
- `tutorial/lessons.ts`: `LESSONS = [..., lesson6, lesson7, combatLesson, lessonVehicles]`.
- Tests: node count 29 (27 + 2 vehicle kinds); samples list = 11 ids (arena, race) with modes.

## Integration fixes
1. `combat.strike` now ignores non-character victims (vehicles) and seated characters; thrown hits and `useTarget` also skip seated drivers (not hittable while seated). Vehicles never get a `combat` state, a swing at a car only reports "used".
2. Hide/death: `hide()` already did `letGoOfAll` + `leaveSeat` for driver and vehicle; verified by tests (hiding driver empties seat and releases held tool; hiding vehicle ejects driver, who stays visible/free).
3. key-door sample: added `opened-1` (counter, target 1, `up` from `and-1.out`) and `not-1` (`reached` to NOT to `hint-1.show`). Hint hides once the door opens; sample still winnable (test and browser).
4. Health bar: `EntityView.carriedHeight` (item carried overhead in side/3D, set in `viewOf`), `health-bar.ts` lifts by it.
New tests: `tests/world/combat-vehicles.test.ts` (6), plus key-door hint assertion in `samples.test.ts`.

## Verification
- vitest 511/511 (32 files), `tsc --noEmit` clean, `npm run build` ok.
- Browser (port 5173): all 11 samples open, play with keys, no console errors; key-door: hint visible before, hidden after opening, then win. Lessons 7 (19 steps) and 8 (15 steps) pass; lessons 1-6 run (`tut-run`) no failures, no console errors; lesson 9 reaches 12/12, no console errors.
- Lesson 9 script reported one FAIL: its own "back to edit" check expects step 10 after stopping, but the app already advanced to 11 (that step completes the moment play stops). Script timing assumption, not an app defect.
- Not browser-checked: health bar lift with an overhead item (unit-tested only); 3D vehicle rendering (unit-tested only, as before).

Status: DONE_WITH_CONCERNS
Summary: feat/vehicles is merged with both feature sets intact, the four integration fixes are in with tests, and tests/tsc/build/browser checks are green; worktree and branch removed.
Concerns/Blockers: Lesson 9 browser script has a stale step-number expectation (step 10 vs 11); health bar lift and 3D vehicle visuals are only unit-tested.
