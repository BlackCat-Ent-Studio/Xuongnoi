# Agent D "Groups": report

Branch `feat/city-groups`, worktree `D:\workspace\GameBuilder-groups`, commit `ec804f7`. Not merged. The `app/node_modules` junction is left for the controller to remove.

## What shipped
- **Data model:** optional `graph.groups?: NodeGroup[]` (`{id,name,color?,nodeIds[],x,y}`). `graph.nodes` and `graph.wires` stay flat, so the engine and runtime are untouched.
  - Save format stays at version 1; the field is additive. No groups: the key is not written and old files load byte-identical.
  - On load, bad group data is repaired instead of failing: dangling or repeated node ids dropped, empty or malformed groups dropped, bad colour dropped.
  - `removeNode` in `engine/wiring.ts` now spreads `...graph` so it keeps `groups`. Editor commits also run `pruneGroups`.
- **Nesting:** forbidden (documented in `groups/group-model.ts` and `types.ts`). Grouping a selection that contains a group, or grouping while inside a group, gives a Vietnamese message.
- **Gom nhóm:** Ctrl+G, menu Sửa, or the button in Thuộc tính when several loose pieces are selected.
  - Default name "Nhóm N", name field focused immediately in the inspector.
  - Rename also inline in the breadcrumb.
  - 7 colour swatches plus default.
- **Boundary ports** are derived from wires crossing the selection: label `<node label or instance name> · <port label>`, typed like the inner port. Several outside wires on one inner port share one group port. Duplicate labels get `(1)`, `(2)`.
- **Main board:** the group block shows those ports. Wiring to a block port wires to the inner node (port rows carry the inner ids, so `wire-drag` and `checkPortPair` are unchanged).
- **Enter/exit:** double-click enters. Breadcrumb "Bảng chính › name" plus "Quay ra"; Esc exits (Backspace exits when nothing is selected).
  - Inside: only the inner nodes and wires, plus port stubs left (inputs) and right (outputs).
  - Navigation is not an undo step and is not an autosave trigger.
- **Bung nhóm:** Ctrl+Shift+G or menu. With nothing selected inside a group it ungroups that group. Members keep their place, following the block if it was dragged.
- **Ctrl+D / copy-paste:** duplicates the whole group (fresh ids, internal wires, name "(bản sao)"). Outside wires are not copied. Pasting inside a group adds the nodes to that group.
- **Inspector:** name, colour, member list (click enters the group and selects the node), port list, Bung / Nhân đôi / Xóa.
- **Selecting a node hidden in a group** (scene tree, issue list "Xem khối", Properties jump buttons, game-view click) auto-enters its group. Selecting a loose node leaves the group.
- **Still working:** minimap and fit (group-aware), Sắp xếp gọn (works on blocks at the top level or on the inner nodes), missing-wire badges (inside nodes, plus a count on the block), tutorials and lessons (no groups, unchanged). In play mode the canvas is read-only, wire badges show on block ports, and groups can still be entered.

## Tests
- New: `tests/editor/groups-model.test.ts`, `groups-state.test.ts`, `groups-fixture.ts`, `tests/io/groups-save.test.ts`.
  - Covers create, ungroup, duplicate, rename, validation and prune, port derivation, stub layout, and scene graph.
  - Covers enter/exit, delete, add or paste inside a group, undo/redo, and save round-trip including old samples and repair of bad data.
- Gates in `app/`:
  - `npx tsc --noEmit -p .`: clean.
  - `npm run build`: green (only the existing chunk-size warning).
  - `npx vitest run`: all pass in isolation, 913 tests. Under heavy machine load (other agents running) 1 to 7 timeouts appeared at the 5 s default in `city-delivery-sample.test.ts` (sim-heavy, a different test each run). Rerunning that file plus `tests/editor` with `--testTimeout 60000`: 131/131 pass. Not related to groups.
- No snapshot tests needed updating.

## Browser check
Dev server port 5196 (stopped), sample "Thành phố giao hàng": 127 nodes, 152 wires.
- 20 farm-bot nodes selected, Ctrl+G, Nhóm 1 (108 items); inspector name focused; rename to "Bot nông dân".
- Double-click enters (20 nodes, 7 stubs, breadcrumb); Esc exits.
- Ctrl+D gives a "(bản sao)" block (109 items, wires 124 unchanged); Ctrl+Z reverts.
- Play (Ctrl+Enter) runs, and the group can be entered during play.
- Ctrl+S then reload keeps the group; Ctrl+Shift+G ungroups (127 nodes again), Ctrl+Z regroups.
- **0 console errors or warnings.**
- Shots: `D:\workspace\GameBuilder\plans\reports\shots-groups\` (1-board-before ... 10-ungrouped, plus 5b-inside-zoomed-out).

## Files
New:
- `app/src/editor/groups/` (model, inspector, inspector css, text)
- `app/src/editor/graph/group-view.ts`, `group-crumb.ts`, `group.css`

Modified:
- `editor-state.ts`, `clipboard.ts`, `wiring-canvas.ts`, `canvas-pointer.ts`, `node-actions.ts`, `properties-panel.ts`, `app.ts`
- `engine/types.ts` (additive: `NodeGroup`, `Graph.groups?`), `engine/wiring.ts` (1 line), `io/save-format.ts`

CRLF files kept CRLF.

Not touched: `nodes/*`, `world/*`, `render/*`.

## Concerns
- **New boundary connections:** ports exist only where a wire already crosses. To wire a block to a new inner port, enter the group and use Bung, or wire before grouping. A "pin a port" feature was not built (YAGNI), but it is the natural next step if the city board needs it.
- **Duplicate placement:** a duplicated group is offset by the usual paste offset (30 px), so it overlaps the original until dragged.
- **Fit zoom floor:** fit never goes below 60%, so a large group opens partly off-screen and the user pans. This is existing fit behaviour.
- **Merge:** `engine/types.ts` gets only an additive interface and field. A and B/C may also edit it; conflicts should be trivial.
- **Test load:** the sim-heavy `city-delivery-sample.test.ts` is flaky at the 5 s default when many agents share the machine.

Status: DONE_WITH_CONCERNS
Summary: Named groups are implemented and browser-verified, with gates green (the sim-heavy city-delivery tests time out intermittently only under load and pass with a longer timeout). Groups are flat, additive and backward compatible; one level only (no nesting).
Concerns/Blockers: no way to add new boundary ports from the main board; duplicated groups overlap the original; flaky timeouts under load.
