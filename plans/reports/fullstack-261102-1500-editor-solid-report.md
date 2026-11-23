# Xuong Noi editor: per-game switch "Va cham that" - report

Branch `feat/editor-solid` (worktree `D:\workspace\GameBuilder-editor`), 1 commit `c36f633` on top of main f52b133. Not merged.
tsc clean. Full vitest 123 files / 2015 tests pass (`npx vitest run --testTimeout 120000`). `npm run build` OK. Playwright 17/17, no console errors. Dev server :5211 stopped.
Line endings kept: `git diff main --stat` and `--stat -w` both 40 files / 2949 insertions.

## What the switch is
- Stored as `graph.settings.solidBodies` (only ever written as `true`; OFF = field absent). `Graph.settings?: GraphSettings` in `engine/types.ts`.
- Save/load: `parseBoard` reads it (anything but a literal `true` = OFF); `serializeBoard` writes the graph as is, so OFF files stay byte-identical. Autosave, Kho game (library save/load/duplicate), file export/import all go through those two functions.
- New board (`createEmptyBoard`: Tao game moi, first run, after deleting the open game) = ON. Samples, lesson boards, handbook try-boards, saved boards = OFF.
- UI: tick box "Va cham that" under "Cai dat game" in the Properties panel (shown when nothing is selected, with a "?" that opens the handbook topic and a one-line tip), and a ticked item in Tep > Cai dat game. Changing it is an undoable graph edit (autosave/dirty), ignored while playing (box disabled), takes effect on the next Choi.
- Runtime: `render/game-view.ts` `build()` now passes `stage.worldOptions(mode) ?? worldOptionsForGraph(graph)` to `createWorld`. The puzzle stage still wins when it has options; graphs without the field get `undefined` = exactly the old call.
- New file `world/graph-world-options.ts`: ON gives `{ solidBodies: true, frontCarryAll: true }` and nothing else (no collision box, no hold point, no 1.6x, no respawn).

## Engine changes (all behind options; puzzle behaviour unchanged)
- `WorldOptions.frontCarryAll`: every character carries in front, low, just clear of its body. Needed because the editor humanoid carries overhead: with solid bodies the "drop at the hands" rule dropped the crate onto its own head (found by test, crate rested at y 1.3 on the hero). Puzzle does not set it.
- `WorldOptions.respawnFallen`: the "fell off the tray goes back to its spawn" rule is now an option; the puzzle sets it to true (same behaviour as before), the editor does not. Reason: with it on, editor games that lose on "fall down" never lost (lesson platforms-shooting, dodge-shoot lost later or never) - found by the ON table.
- Files: `world/world-options.ts`, `world/solid-bodies.ts`, `world/world.ts` (1 line), `puzzle/world-options.ts` (`respawnFallen: true`).

## 2D vs 3D (what really applies when ON)
| Rule | 3D | 2D side / 2D top |
|---|---|---|
| Characters and loose items block each other (no pass-through, no shoving, may walk apart if spawned overlapping) | yes | yes (tested in 3 modes) |
| Carried item blocked by walls/doors/bodies and blocks its carrier | yes | yes |
| Zones ignore carried items | yes | yes |
| Smooth rise of a grabbed item, turn to face it, covered (stacked-under) crate cannot be picked | yes | yes (not 3D-gated in the engine) |
| Carry in front (low) | yes | no, 2D keeps the old above-head spot |
| Drop exactly at the hands + falls straight; refused when no room (keeps holding) | yes | no, 2D drops beside the carrier like before ("Khoang cach tha" still works) |
| Stacking (hands lifted over crates ahead) | yes | no |
| Puzzle 1.6x look and collider | not used | not used (editor box = figure size, tested equal) |
The 2D parts that are on were never used by the puzzle (its 2D levels are OFF), so they rest on my tests only (below).

## Verification
1. OFF unchanged: baseline recorded on main before any change (`tests/editor/solid-off-baseline.json`, 101 boards = 16 samples + 31 lesson boards + 54 handbook try-boards; entity state hashed every 2nd tick for 15 s with a fixed key pattern; deterministic, checked twice). `solid-off-unchanged.test.ts` compares: all 101 identical after the change. Also asserts no shipped board turns the switch on.
2. ON through the physics checker: `solid-on-invariants.test.ts` plays the same 101 boards OFF and ON with `checkBodies` + contact claims + collider-size check every 2nd tick; the table is a file snapshot `tests/editor/solid-on-summary.snap.json` (a later change shows up as a diff). Nothing flipped.
3. `solid-on-behaviour.test.ts` (7): 2d-side/2d-top/3d hero walks through a crate OFF and is stopped ON without shoving it; collider box = figure size; 3D grab lifts, drop falls straight; crate carried over another is lifted and set on top; OFF carry/drop still as before.
4. `solid-on-scripted-play.test.ts` (2): a scripted player wins key-door and pickaxe-rock both OFF and ON (must jump over the key/lock/tool lying on the path).
5. `io/solid-bodies-setting.test.ts` (8): new board ON in all modes; old JSON without the field loads OFF; junk values load OFF; serialize/parse round trip; OFF writes no `settings`; editor toggle + undo/redo + ignored while playing; other edits keep it; autosave, library save/load, duplicate keep it.
6. `handbook/solid-bodies-topic.test.ts`: topic text non-empty, carry page mentions it, puzzle options keep respawn + 1.6x box, editor options are exactly `{solidBodies, frontCarryAll}`.
7. Playwright `plans/browser-scripts/editor-solid-check.mjs`, shots in `plans/reports/shots-editor-solid/` (all read): new board shows ON (01), Tep menu ticked item (02), sample shows OFF and its autosave has no `settings` (04), toggle from panel and menu writes/removes the field in the autosave, board with hero + crate: 3D ON hero stops beside the crate (05-play-3d-on), 3D OFF hero walked through and the camera followed (05-play-3d-off), 2D side ON hero stops left of the crate (05-play-2d-side-on), handbook topic (06) and carry page (07).

## ON-mode table (nothing flipped; the user decides)
Columns: end result after 15 s with the test key pattern (OFF / ON), rule breaks found by the checker (OFF / ON), and a verdict. Spawn overlaps (two things authored inside each other) are not fixed by the switch and are listed as such.
| Sample | OFF | ON | Works with ON? |
|---|---|---|---|
| side-stars | lose 2.6 s, no breaks | identical | yes (identical run) |
| top-collect | running, character-in-block (player starts inside the middle wall) | identical | yes (identical run); spawn overlap is in the sample |
| 3d-hop | lose 7.8 s | identical | yes |
| key-door | running; char-in-item x2 | running, no breaks | yes: scripted player wins OFF and ON |
| pickaxe-rock | running; carried-in-block, carried-in-body, char-in-item x2 | running, no breaks | yes: scripted player wins OFF and ON |
| guard-patrol | lose 7.5 s; char-in-char | lose 7.5 s, no breaks | yes (caught at the same second) |
| cleaner-bot | win 12.8 s; carried-in-body, char-in-item x3, item-in-item x2 | running (no win), item-in-item x2 (spawn) | NO: the 3 items spawn overlapping at x 4.6/5.0/5.4 and the bot used to walk into the pile; now it stops 0.8 short of the first item and never grabs. Needs a re-layout before it can be flipped |
| maze-chase | lose 10.0 s | lose 10.0 s, path differs | yes (bot still catches) |
| platform-bot | win 4.7 s | identical | yes |
| arena | running; char-in-char, char-in-item x3 | running, no breaks | probably (fight is bot vs idle player; not hand-played) |
| race | running | identical | yes |
| dice-zones | running | identical | yes |
| portal-camera | running | identical | yes |
| dodge-shoot | lose 2.6 s | identical | yes |
| city-delivery | running; carried-in-body x4, char-in-item x4, item-in-item x4 | running; item-in-item x4 (spawn only) | runs, delivery itself not proven |
| city-delivery-3d | running; carried-in-body x1, char-in-item x13, item-in-item x43 | running; item-in-item x43 (spawn), carried-in-body x1 at 9.9 s (0.07 deep), char-in-item x1 at 7.6 s (a bot 0.26 into a crate) | runs, delivery not proven; two small residual overlaps |
Lessons and handbook boards (85): 72 run identically; the 13 that differ show no ON breaks (the OFF run had char-in-item or char-in-char at lessons carry-use, chores, chores-place, bot-pickaxe, combat, collider-gravity, health-color, ask-dialog, capstone-factory and handbook carry/interact/hand-tool/chase). Same end result OFF and ON for every lesson/handbook board that ends (chase-game win, platforms-shooting lose, counter win, timer/ui-meter lose, win-lose win). Remaining breaks are the same in both: below-floor (collect-stars, win-lose, conveyor, handbook const: things falling out of the world by design) and cargo-delivery char-in-item x1.

## Handbook
- New topic page "Va cham that" (`src/handbook/topic-solid-bodies.ts`), pinned at the top of the list under "Cai dat game" (also found by searching "va cham"): where to switch, what it does, Cam/Tha in 3D (in front, drop at hands, refused drop, stacking), in 2D (what stays as before), and that samples/lessons stay OFF.
- Carry page (Cam / Tha): the "Khoang cach tha" param text and one tip now describe the ON behaviour and point to the topic (tips merged to stay within the 2-4 rule).
- `handbook-dialog.ts` grew one `topicSection()` + `renderTopic()`; coverage tests unchanged and green.

## Concerns / not done
- cleaner-bot is the only sample that breaks when ON (see table). Not touched.
- ON "Cam" in the editor 3D now holds the item in front/low and not overhead; the humanoid's raised-arms carry pose may still show while the crate is in front (looked at in code, not in a screenshot of a carry).
- 2D ON: character/item blocking and walls-vs-carried are covered by my tests only; no 2D hand-play with grab/drop in the browser.
- Delivery/cargo samples run but their delivery result was not exercised.
- No real GPU/phone check. HANDOFF.md (main repo) not updated by me; add: branch `feat/editor-solid`, report path, option names `frontCarryAll` / `respawnFallen`.
- The scripted-player and key-pattern runs prove no regressions, not that every ON game is fun; samples stay OFF until each is hand-checked.

Status: DONE_WITH_CONCERNS
Summary: Per-game "Va cham that" switch saved with the board (new boards ON, everything shipped OFF and hash-identical to before), toggle in Properties panel and Tep menu, solid-body rules incl. carry/drop/stacking in 3D, handbook topic + carry page, 2015 tests, tsc, build and Playwright green.
Concerns: cleaner-bot would break if flipped; 2D ON rules and delivery samples only lightly verified; branch not merged; HANDOFF.md not updated.
