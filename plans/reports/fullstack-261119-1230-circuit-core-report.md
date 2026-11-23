# Circuit core (bảng mạch nhiều tầng) — implementation report

Worktree `D:\workspace\GameBuilder-circuit-core`, branch `feat/circuit-core`, commit `9b4ebfd` (on top of `c929622`). Core only: no editor UI, no CSS, nothing visible changes. Node registry untouched (still 71 kinds).

## Types as implemented (`app/src/engine/types.ts`, additive)

- `Circuit { id, name, color?, graph, pins: CircuitPin[], exposed: CircuitExposed[], benchIds: string[] }`
- `CircuitPin { id, label, dir: 'in' | 'out', type: PortType, inner: { node, port } }` — pin id is the port id on a copy; ids are unique per circuit across both directions.
- `CircuitExposed { id, label, inner: { node, param } }`
- `Board.circuits?: Circuit[]`, `CIRCUIT_KIND = 'circuit'`
- `ParamDef.place?: 'point' | 'heading'`, `ParamDef.placeAs?: (params, wiredInputs) => 'world' | 'offset' | 'local'`, `ParamDef.instanceScoped?: boolean`

**Deviation from the brief (one):** the instance keeps its data as FLAT params, not as a nested object, because `Params` is `Record<string, number | string | Vec3>` everywhere (editor `setParam`, undo, runtime, save format). Keys: `circuit` (id), `position` (vec3), `heading` (degrees), `value:<exposedId>` (own value). `readInstance(node)` gives the nested view `{ circuit, values, place: { position, heading } }`; `instanceParams(circuitId, { values, place })` builds the flat form. Widening `ParamValue` would have touched every piece.

## Module `app/src/circuits/`

| File | What |
|---|---|
| `instance.ts` | flat-param helpers, `MAX_CIRCUIT_DEPTH = 4`, `instancePorts(circuit, lookup)` (ports of a copy from pins, in pin order, `feedback` mark carried from the inner port), `portsOfNode`, `canConnectIn` (same answers as `canConnect`, pins as ports) |
| `expand.ts` | `expandBoard(board) → { graph, idMap }`, `expandCircuitAlone(board, circuitId)`, `CircuitError` (`unknown-circuit`, `cycle`, `too-deep`, `duplicate-id`, `duplicate-circuit`) |
| `validate.ts` | `validateCircuits(board) → CircuitIssue[]` for edit time and loading (`duplicate-circuit`, `unknown-circuit`, `cycle`, `too-deep`, `bad-pin`, `pin-input-wired`, `bad-exposed`, `bad-bench`, `bad-value`) |
| `runnable.ts` | the seam |
| `index.ts` | re-exports |

Expansion rules:
- ids `<copy>/<inner>` (nested `a/b/<inner>`); inner wire ids get the same prefix; main-board nodes and wires are passed through as the same objects.
- pin wire → the real inner port, through any number of levels; unknown pin / bench target → wire dropped; unwired pin → inner port unwired. `feedback` works because the wire lands on the real port (test compares `compileGraph` back-edges with the flat board).
- If an inner (non-bench) wire and an outer pin wire feed the same input, the outer one wins; `validateCircuits` reports it (`pin-input-wired`).
- exposed value → inner param when its shape fits; otherwise ignored (and reported by `validateCircuits` as `bad-value`). An exposed setting may target a setting of a nested copy (`value:<id>`, `position`, `heading`); `circuit` cannot be exposed.
- depth cap: 4 levels below the main board; cycle → `CircuitError('cycle')` with the chain.
- `idMap`: `origins` (flat id → `{ path, inner }`), `expandedId(path, inner)`, `pinPort(path, pinId)` (flat node + port a pin leads to, for live values of one copy).
- result graph = nodes, wires, main-board `settings`; groups and knots are left out (drawing only).

## The seam

`runnableGraph(board)` in `app/src/circuits/runnable.ts`: no circuits → returns `board.graph` itself (same object); circuits → `expandBoard(board).graph`.

Used by:
- `app/src/editor/app.ts` — play and preview (the two calls into the game view). The step debugger starts its run through the same `startPlay`, so it steps the expanded graph.
- `app/tests/editor/solid-helpers.ts` `runBoard` — the headless runner of the guard tests.

Not changed: `app/src/render/**` (off limits; it takes a `Graph`), puzzle levels (`buildPlayGraph`, not Boards).

## Placement rule

Each copy has a frame: turn about the vertical axis by `heading` (90 takes +x onto +z, same sense as a robot heading), then shift by `position`. Frames compose down the nesting; quarter turns are exact; the identity frame touches nothing (inner param objects are passed through unchanged).

- `place: 'point'` → `turn(value) + shift`; `place: 'heading'` → `value + heading`.
- A missing param is written out from its default, so a card that never stored its position still moves.
- An exposed position given by a copy is in the circuit's own frame (written first, placed after).
- `placeAs(params, wiredInputs)` decides per card, on the FINAL flat wires (a wire arriving through a pin counts):

| Param | Rule |
|---|---|
| zone `center` | `follow` unwired → world point. Wired → `offset` (turned, not shifted). Wired and "Xoay theo vật" = yes → `local` (untouched: it is already in the followed body's frame) |
| spawner `position` | `at` unwired → world point; wired → `offset` |
| camera `point` | mode `fixed` → world point; mode `follow` → `offset` |
| linear-actuator `direction` (4th case found while reading the code) | `base` unwired → world direction; wired → `local` (it is relative to the mount) |

## Tagged params (22 source places = 66 points + 2 headings)

block, character, item, vehicle, robot-body, portal, rotating-platform `position`; moving-platform `position`, `to`; patrol `pointA`, `pointB`; route-follow `p1..p32` (one generator); line-track `center` and `p1..p16` (one generator); zone `center`; spawner `position`; camera `point`; linear-actuator `position`; teleport `position`; go-to `targetPos`; headings: robot-body `heading`, linear-actuator `direction`. A test pins this exact list. `spawner.ts`: only that one param line changed. `link.ts`, `joint.ts`, `motor.ts`: not touched.

## Text keys (portal `pair`)

`pair` is marked `instanceScoped`. Inside a copy a non-empty code becomes `<path of the copy>/<code>`, so copies never cross-link. A code that comes in through an exposed setting belongs to the board that wrote it (main board → unchanged; a circuit → that circuit's copy path). Goods tags (`tag`, `goods`, `loadType`…) are left shared on purpose.

## Save format

- `format_version` stays 1, no migration: `circuits` is an optional top-level key written after `notes`, only when non-empty. An older app refuses such a file with its existing "unknown kind" message.
- `app/src/io/circuits-format.ts` + `save-format.ts`: pins/exposed/bench are read first, then the graphs (main board and every circuit share one node + wire reader; wires onto copies are checked against pins by `canConnectIn`), then `validateCircuits`; the first problem becomes a Vietnamese message in `IO_TEXT` (12 new entries, e.g. `Mảnh ghép "a" dùng bảng mạch "ghost" mà tệp không có.`, `Bảng mạch chứa chính nó (A › B › A).`).
- Circuit graphs keep nodes, wires, knots; groups/settings inside a circuit are not stored.
- Stale `value:<id>` for a setting no longer exposed is kept in the file and ignored at run time.

## Tests (`app/tests/circuits/`, 52 tests)

| File | Covers | Result |
|---|---|---|
| `expand-structure.test.ts` (18) | ids, pin re-pointing, unwired pin, bench dropped / kept alone, exposed value per copy, wrong-shape value, purity + determinism, idMap both ways + `pinPort`, no-circuit board returns its own graph object, nesting 3 deep with pass-through pins and exposed value through 3 levels, `instancePorts` / `canConnectIn`, self-containing circuit (direct and indirect), depth 4 ok / 5 rejected, unknown circuit, duplicate id, every `validateCircuits` code, feedback cut identical to the flat board | pass |
| `expand-placement.test.ts` (16) | identity untouched, shift, quarter turn, any angle, default written out, nested frames, exposed position, the 4 `placeAs` params (incl. wire through a pin), exact list of tagged params, pair codes | pass |
| `expand-run.test.ts` (7) | robot-square and robot-line-follow, real physics on (crate engine loaded): 1 copy at identity = hand-built flat board, same guard hash over 600 ticks, and same entity state as the shipped sample; 2 copies and 8 copies (robot-square), 2 copies (line-follow), 1 copy turned 90° = hand-shifted flat copies (same hash) and each robot's path = the single robot's path moved to its place (< 2 cm); two counters in two copies keep their own count and own goal | pass |
| `circuits-save.test.ts` (11) | round trip (text identical), version stays 1, all shipped samples + lessons + handbook boards: no `circuits` key, load → save stable, samples byte-identical; every validation message; editor state keeps `circuits` through edit + undo | pass |

Existing guards, files untouched: `tests/editor/solid-off-unchanged`, `real-physics-on-hash`, all `tests/io`, `registry`, `editor-state`, `step-run`: 27 files, 464 tests pass (1047 s under heavy machine load, 15 node processes).

## Full suite on `9b4ebfd`

One run of `npx vitest run --testTimeout 300000` (machine under load from the other agents, 1339 s):

| | Files | Tests |
|---|---|---|
| passed | 254 | 3861 |
| failed | 1 | 1 |
| total | 255 | 3862 |

- The one failure: `tests/puzzle/level-7-decoy.test.ts` "the spare cannot even replace a piece…" — timed out at its own 900 s limit (ran 1076 s). Rerun alone: 3 of 3 pass, 535 s. A puzzle test; it does not go through any code changed here.
- `city-delivery-3d` red-light / on-hash entries: passed inside the full run, so not rerun.
- Baseline files: 0 changed.

`npx tsc --noEmit -p .`: clean.

## Not covered / known limits

- **Editor cannot show a board with copies yet.** There is no NodeDef for `circuit`; canvas, properties panel, scene tree, palette counts etc. were not made aware of it (no UI in this part). `parseBoard` accepts such a file and the editor state keeps and runs it (tested headless), but drawing it is the editor phase. Nothing can create a copy from the UI today, so no user reaches this.
- **Live values inside a copy**: the runtime runs flat ids; `idMap.pinPort` / `expandedId` are the lookup for the editor, not wired into any view. An entity inside a copy is owned by the flat id (`a/bot`), which the editor does not know yet (read from the code, not tried in a browser).
- **Turned copies**: only points and headings turn. Sizes (`size`, `colliderSize`, line-track `length` / `breadth`), block `beltDir`, piston `orient` and the preset line shapes are not turned, so a turned copy is right for robots, custom lines, points; a copy holding long blocks or belts needs a shift only (or the extra tags, not built).
- One pin = one inner port. Feeding several inner inputs from one pin needs a pass-on card inside.
- An exposed position is in the circuit's frame, not the parent's.
- Pair code scoping is by copy path; a portal in an outer board cannot pair by code with one inside a copy unless the code is exposed (or use the "Cổng đối diện" wire through an object pin).
- Puzzle levels do not go through the seam (they are not Boards).
- Step debugger: expected to stop only on cards of the main board (the canvas has no pins for inner cards). Read from the code, not run.
- `save-format.ts` shows one extra changed line in the diff (`import { migrateWireRule }`): that line had a different line ending from the rest of the file and was normalised when the file was rewritten. No content change.
- Engine cost of many copies is unchanged from the spike numbers; nothing was optimised here.
- Not run in a browser.

## Unresolved questions

1. Flat instance params (`value:<id>`) instead of a nested object: fine for the editor phase, or should `ParamValue` be widened?
2. Should a turned copy also swap sizes on quarter turns (needs one more tag on ~20 params), or is "shift only for boxes" enough for the factory sample?
