# Route-follow: points from objects (report)

Branch `feat/route-from-objects` (worktree `D:\workspace\GameBuilder-routeobj`), from main 09aca5d. Commit 266ffc1 (+ nothing else). No puzzle level, guide script or level test touched.

## Design

| Item | Decision |
|---|---|
| Option | param `pointsFrom` (select, advanced, default `preset`): "Lấy điểm từ vật" -> `objects` |
| New ports (only when ON) | object inputs `obj1..objN` labelled "Điểm k (vật)" / "Point k (object)"; N = min(Số điểm, 8) |
| Cap 8 | = the 8 "classic" points; 32 object rows would make a card taller than the screen; points 9..32 stay preset |
| Read timing | every tick (so a moved crate moves the point; leg mode also retargets a dash in progress; no stale position) |
| Unwired point | falls back to its preset coordinate |
| Hidden / removed object | keeps the LAST SEEN place (so a collected star does not send the bot to a stale preset like 0,0); never seen -> preset |
| Modes | steer (drive to points), leg by leg (`legs: dash`), rail: all work. Rail rebuilds the track whenever a point moves, so it is best with objects that stand still (if they move, arc-length position shifts) |
| Vehicles | same code path, works too |

Engine change (small, general): `NodeDef.optionalInputs = { all, active(params) }` plus `activeInputs()` / `knownInputs()` in `engine/registry.ts`.
- Show/read (`active`): runtime input reading, card (`node-view`), size estimate (`estimateNodeSize`), properties panel port list.
- Validate (`all`): `canConnect` (so a board saved ON still loads after the option is switched OFF; the wire just goes dormant and is not drawn, comes back when ON again), port-compat, group ports, properties-panel port label.
- With the option off `activeInputs === def.inputs` (same array): card, ports, size identical.

## Files changed
`engine/types.ts`, `engine/registry.ts`, `engine/runtime.ts`, `engine/wiring.ts`, `editor/graph/{node-view,graph-geometry,port-compat}.ts`, `editor/groups/group-model.ts`, `editor/properties-panel.ts`, `nodes/route-follow.ts`, `nodes/node-names.ts` (obj1..obj8 names + apply to optional inputs), `handbook/content-action-brain.ts` (param text, tip, example), new `tests/nodes/route-follow-objects.test.ts` (12 tests). Line endings preserved (`git diff --stat` == `-w`).
Handbook ports table lists only fixed ports (generated from `def.inputs`; the coverage test forbids extras), so the new ports are described in the `pointsFrom` text, a tip and the example. No lesson added: no test requires one (course coverage green).

## Stability proof
- `tests/editor/solid-off-unchanged` (every sample, lesson and handbook board, 15 s trajectory hash vs recorded baseline): green, baseline NOT re-recorded. Handbook try-board untouched.
- Test "option off ignores wires on object inputs": identical 300-tick path with/without wired objects, and `pointsFrom: preset` explicit.
- `estimateNodeSize` default card height = 40 + 13*26 + 8, unchanged; ON adds 4 rows.
- `no-action-without-wire` green (no fixed input added).

## Tests
- New headless: walks to objects not presets; follows moved objects; unwired point uses preset; hidden object keeps last place; hidden-never-seen uses preset; off == old; leg mode; rail; port list/cap/labels; save+load with wires on and off; canConnect valid/invalid ports.
- Type check clean. Focused run (nodes, handbook, editor, tutorial, io, engine): 91 files, 1495 tests green. Full suite: 159 files, 2666 tests green (main was 2654 + 12 new).

## How levels 3 / 6 / 7 can use it (separate task)
Set `pointsFrom: 'objects'` on the tray route piece and drop the object coordinates from `p1..pN` (keep count). Extra wires = number of object inputs wired.

| Level | Route now | Wiring | Extra wires |
|---|---|---|---|
| L3 | 3 stars then flag, count 4, presets | star-1/2/3 `self` -> Điểm 1..3 (vật); flag `self` -> Điểm 4 (vật) | 4 (3 if flag stays preset) |
| L7 | one point per pad (6) | pad-1..6 `self` -> Điểm 1..6 (vật) (6 <= 8) | 6; pads must be exposed on the board as objects (like the slot marks) |
| L6 | start, 3 cover spots BEHIND crates, goal | goal tile `self` -> last point; start/crate-spots need marker objects, because the crate centre is solid and the cat stops BEHIND it | 1 to 5 depending on markers added |

Caveats for the level task: the objects must be visible on the board (puzzle rule 3) and must expose a `self` output; L3 stars hide when touched -> point keeps its last place (no jump). L6 spots need small marker objects (or accept preset spots for those).

## Unresolved
- L6 behind-crate spots have no object to wire; decision for the level task.
- Real-editor UI of the new rows not eyeballed in a browser (only headless + size estimate). Option text in the advanced select is long; check wrapping.
- Stray empty file `tmp_sub.py` may exist in the Git Bash root (`/tmp_sub.py`) from a mistyped command; outside the repo, deletion was blocked by the safety check; harmless.
