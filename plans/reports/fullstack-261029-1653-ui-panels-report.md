# Agent D (Panels) report

Branch `feat/ui-panels` in `D:\workspace\GameBuilder-ui-panels`, one commit (`ba42b13`). Gates green: vitest 661/661, `tsc --noEmit`, `npm run build`.

## New options and APIs
- `createPropertiesPanel(state, options?)` with `options.onLiveParamChange?: (nodeId, params) => void`.
  - While playing, number, vec3, colour and character-look fields stay editable.
  - Each edit calls `state.setParam` (which refuses edits during play) and then the callback with the node's full param set, change applied.
  - Select, key, text and switch fields are disabled during play. Nhân đôi and Xóa are disabled, with the note "Bấm Dừng để thêm/xóa".
- `createPalette({state, onAdd, onAddNote})` is unchanged. The panel title is read from `TEXT_VI.paletteTitle`.
- New files in `app/src/editor/panels/`:
  - `palette-search.ts`: `normalizeText`, `searchItems`, `PALETTE_SYNONYMS`.
  - `panel-icons.ts`
  - `panels-text-vi.ts`
  - `panels.css`
- New test: `app/tests/editor/palette-search.test.ts`.
- DOM hooks the tutorial uses are kept: `.palette-item[data-kind]` (including `note`), `.prop-row[data-param]`, and the `.palette` / `.props` ancestors.
- `look-picker.ts` is not modified. It already was a radiogroup and is restyled from CSS only.

## Behaviour
- **Search**
  - Matches title, description and synonyms, ignoring diacritics (NFD, đ to d).
  - While searching, results show as one flat list with title matches first.
  - Enter adds the top result. Esc clears. An empty-result hint is shown.
- **Categories**
  - Sticky headers with counts. They collapse, and the state is kept for the session.
- **Drag**
  - Pointer-based, same as before, so the `onAdd(kind, x, y)` contract with app.ts is kept.
- **Inspector**
  - Header with category tile, name and category.
  - Steppers (− / input / +), `role=switch` for yes/no and on/off selects, look radiogroup.
  - Ports section with type shape and click-to-jump via `state.select`.
  - Nhân đôi uses `state.duplicate`. Xóa uses `state.deleteSelection` and sits apart from Nhân đôi.
  - Empty state with shortcuts.

## Not done / not verified
- **HTML5 dataTransfer drag**
  - Not exposed. The canvas has no drop handler, and mixing it with the pointer drag would conflict.
- **"Tên riêng"**
  - Skipped. `GraphNode` has no name field, and the save format must not change.
- **Port one-sentence help**
  - Skipped. `PortDef` has no help data.
- **Required ports**
  - Not shown. `PortDef.required` is not merged yet (agent C).
- **Param units**
  - Not shown. `ParamDef` has no unit.
- **Live edits do not persist**
  - `state.setParam` is a no-op while playing, so the callback is the only effect. Wave 2 must apply it to the runtime and decide whether to write back to the graph.
  - Look thumbnails read the colour from the graph, so they do not refresh from a live colour change.
- **Dark theme not seen with the real tokens**
  - style.css on this branch still has light tokens, and agent A's dark tokens are not merged.
  - I screenshotted at 1280x720 with the mockup tokens injected. There was no clipping or horizontal overflow in the palette or inspector (scripted check), and no console errors.
  - Looks with the real A tokens are unverified. Several fallbacks (`--raise`, `--line2`, `--accent-soft`, `--c-*`) are mockup-only names and should be defined by A.
- **Tutorial**
  - Not run end to end in the browser. Selectors are unchanged, and the tutorial tests pass.
  - If a category is collapsed, or a search is active, `.palette-item[data-kind]` targets will not exist.
  - Possible follow-up for wave 2 or agent H: the tutorial could clear the search and expand all categories.
- **Other**
  - Not checked: 1024 width and keyboard-only flow.
  - The emoji in the "Ghi chú" button come from existing text-vi, and agent E may change them.

## Unresolved questions
- Should live edits persist to the graph (undo history)? Decide in wave 2.
