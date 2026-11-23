# Levels audit (1-8): physics and logic — report

Branch `fix/levels-audit` (worktree `D:\workspace\GameBuilder-audit`). Shots: `plans/reports/shots-levels-audit/` (`level-N-<id>.jpg` contact sheets, `level-4-detail.jpg`, raw frames in `frames/<id>/`). Scripts: `plans/browser-scripts/levels-audit-frames.mjs` (+ `levels-audit-sheet.py`).

## Method
- Headless: extended `tests/puzzle/physics-invariants.test.ts`. 2D levels now run with the full rule set (character/character, character/item, item/item, character/solid, carried-in-wall, below-floor, sensor-only-on-contact). New: doors (no crossing while shut for ANY answer; solution really crosses an open door), win proof per level (world state matches the win message), lose proof (guard really touching / red crate really resting in store), reference solution wins within 75% of the time limit (not stuck).
- Browser: Playwright 844x390 at :5220, reference solution injected into the board, frame bursts of every level, contact sheets read by eye.

## Per-level table

| Lvl | Issue found | Cause (file:line) | Fix | Proof |
|---|---|---|---|---|
| all 2D (1-4) | Characters and items were not solid in 2D puzzle levels (only 3D had real bodies) | `src/puzzle/world-options.ts` `puzzleWorldOptions` returned `undefined` for non-3D | Every puzzle level now gets solidBodies + 1.6x collision box (editor/samples untouched: they never call this) | `physics-invariants` runs 2D with `solidBodies: true` (was 3D only); `solid-bodies-topic.test.ts` updated |
| 4 | Two robots walked THROUGH each other: A had to pass B standing on button 2 | `src/puzzle/levels/level-04.ts` brains (old `go-a2` -> flag, B parked on button 2 for the whole run, win needed B on button 2) | Redesigned: A goes to button 1, B to button 2 (through the door), A walks to a point just past the door (`go-a2`, targetPos x=4), then B leaves button 2 and walks to the flag (`go-b2`), then A follows up behind B (`go-a3`, x=8.4). Win = B touches flag AND A arrived behind it. OR idea, tray, par 3, hints, solution wiring, guide steps unchanged; task text gets one added sentence. Nobody passes anybody; door closes only after A is past it. Win at 7.1 s (limit 40) | `levels-1-4.test.ts` level 4 (solution wins, each wire/piece removed fails, decoy Và 2 stars); invariants: no character-in-character, no crossing of shut door, win proof (both past door, B at flag, A behind); shots `level-4-hai-nut-mot-cua.jpg`, `level-4-detail.jpg` |
| 2, 3, 4, 8 | Door leaf swung open over 0.8 s but its collision box vanished instantly, so the robot walked into/through a still-closed-looking door (closing 0.5 s the same way) | `src/puzzle/stage/cozy-stage.ts` `doorFigure` (`approach(..., 0.5)` / `(..., 0.8)`) | One constant `DOOR_SWING_SECONDS = 0.25` for open and close | frame sheet before (robot drawn in the door, `l2-sheet.jpg`) vs after (`level-2-cua-kho.jpg`); `physics-invariants` door tests (collider side) |
| 7 | The red colour tiles were drawn as round push buttons while blue tiles were flat tiles (misleading: looks like a button to press) | `cozy-stage.ts` `stageRoleOf`: every flat red block in 3D became `button` | Only red blocks at least 0.1 thick are buttons; 0.04 pads stay flat tiles (L8 red button is 0.2 thick, unchanged) | new test `stage-theme.test.ts` "level 7: the red and the blue floor tiles are both plain flat tiles"; `level-7-phan-loai-mau.jpg` |
| 1 | none found | - | - | invariants all green; win proof: bot touching flag; `level-1-bot-dau-tien.jpg` |
| 2 | none besides door timing | - | - | win proof: bot touching flag and past door; shut-door test over all wrong answers |
| 3 | none besides door timing | - | - | win proof: 3 stars hidden, cat past gate and touching flag; wrong constants never cross the gate |
| 5 | none found (slots, no carried crate counted, no overlap) | - | - | invariants + win proof: exactly 3 crates resting in store zone, none carried; `level-5-du-ba-thung.jpg` |
| 6 | none found (hero waits, guard never overlaps) | - | - | win proof: hero on goal, guard not touching; lose proof: every lost answer ends with guard touching; `level-6-ne-linh-gac.jpg` |
| 7 | (besides the tile look) none | - | - | win proof: store holds exactly crate-2/4/6 (blue); lose proof: every lost answer ends with a red crate resting in the store |
| 8 | none besides door timing | - | - | win proof: cat on goal, guard not touching, >=2 crates resting in store; lose proof; `level-8-xuong-tong-hop.jpg` |

## Verification
- tsc clean; `npm run build` OK; full `npx vitest run --testTimeout 120000` green (see Status).
- CRLF: `git diff main --stat` equals `--stat -w` (no line-ending flips).
- Browser: all 8 levels played with the reference solution at 844x390, no page errors, no `physics-watch` warnings. Frame sampling is real time on SwiftShader (about 0.4 s per frame), so fast 2D runs have few frames; brief contacts between frames cannot be judged by eye, the headless per-tick invariants cover those.

## Questions / not done
- None that change a puzzle idea. Level 4 now ends with B at the flag and A one step behind it (both in the flag area); if you prefer A to reach the flag itself, the flag/ground would have to be wider (not done).
- Editor behaviour untouched. The `.claude`-free handbook text "y như trong các màn Xưởng Bot giải đố" is still true (2D now solid too).
- 3D looks checked only on SwiftShader, not on a real GPU/phone.
