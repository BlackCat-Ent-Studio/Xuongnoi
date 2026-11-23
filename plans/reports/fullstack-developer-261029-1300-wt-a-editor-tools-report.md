# WT-A editor tools report

Branch `feat/editor-tools` (worktree `D:\workspace\GameBuilder-editor-tools`), commit c06d571 on top of 01ed58e.

## Delivered
- Undo/redo: whole-Board snapshots (name, mode, graph, notes), cap 100, same-key edits within 800 ms coalesce (param typing, name, note text). Drags commit once on pointer-up. Buttons "Hoàn tác" / "Làm lại" in top bar, Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z. Disabled while playing; ignored when typing in inputs/textareas. `loadBoard` clears history (lessons start/exit therefore cannot undo across boards). Inside a lesson undo is allowed; tutorial checks re-run on the emitted `graph` event (verified in browser).
- Multi-select: Shift+click toggles, Shift+drag on empty canvas = marquee (adds to selection), group drag moves all selected in one undo step, Delete removes the whole selection (one step).
- Ctrl+C / Ctrl+V / Ctrl+D: pasted nodes get new ids, wires between copied nodes remapped with new ids, offset 30px per paste (duplicate: 30px, clipboard untouched). Clipboard kept in memory and in localStorage `xuong-noi:clipboard`, stored as a board JSON and re-validated with `parseBoard` on read (corrupt = ignored).
- Sticky notes: "Ghi chú" in palette top + top bar button; inline textarea, 4 colors, move (by header bar), resize (corner), delete (trash button or Delete key). Board JSON gets optional `notes` (omitted when empty, so old files and old tests are unchanged); `parseBoard` validates structure/ids/finite numbers, clamps size, truncates text to 2000, unknown color -> yellow, max 200. Autosave includes notes via `serializeBoard`. Undo covers notes. Notes render above wires, below nodes.

## Files
- New: `src/editor/history.ts`, `clipboard.ts`, `node-ids.ts`, `src/engine/notes.ts`, `tests/editor/editor-tools.test.ts` (16 tests).
- Edited: `engine/types.ts` (Note, NoteColor, Board.notes?), `io/save-format.ts`, `io/text-vi.ts`, `editor/editor-state.ts`, `wiring-canvas.ts`, `top-bar.ts`, `palette.ts`, `app.ts`, `text-vi.ts`, `style.css` (appended block), `tests/editor/editor-state.test.ts` (ignores new `history` event kind).

## Contract changes (merge notes)
- `ChangeKind` adds `notes`, `history`; `Selection.kind` adds `note`. `EditorState` adds getNotes/getMulti/toggleSelect/selectMany/moveItems/addNote/updateNote/undo/redo/canUndo/canRedo/copy/paste/duplicate. `setNodePos` kept (delegates to `moveItems`).
- `createPalette` and `createTopBar` deps gain required `onAddNote`.
- `nextNodeId` moved to `node-ids.ts`, re-exported from `editor-state.ts`.
- Other WT merge hot spots: `types.ts` (Board block only), `style.css` (append only), `editor-state.ts`, `wiring-canvas.ts`.

## Verification
- `npx tsc --noEmit -p .` clean; `npx vitest run` 529/529 (513 baseline + 16 new); `npm run build` ok.
- Browser (own vite on 5181, stopped afterwards), Playwright script `scratchpad/wt-a/check.mjs`, all PASS, no console errors: undo/redo after add/move (single step)/wire delete; Ctrl+Y, Ctrl+Shift+Z; 3-node wired group box-select -> copy/paste (6 nodes, 4 wires) -> duplicate (9, 6) -> Delete -> undo; note add/type/color/move/resize/delete/undo; reload keeps note text and clipboard in localStorage; undo button disabled during play; tutorial lesson loads, undo works inside it.

## Notes / limits
- Native textarea Ctrl+Z inside a note undoes text there (app undo is deliberately skipped while typing).
- After undo, selection is reduced to items that still exist (not restored to the pre-change selection).
- No dedicated buttons for copy/paste/duplicate (shortcuts only), per YAGNI.
- Notes cover wires beneath them (chosen so note text stays clickable).

Status: DONE
