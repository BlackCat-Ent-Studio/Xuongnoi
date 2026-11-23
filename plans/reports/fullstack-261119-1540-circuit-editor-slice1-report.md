# Bảng mạch – editor, slice 1 – implementation report

Worktree `D:\workspace\GameBuilder-circuit-editor`, branch `feat/circuit-editor`. Main `8ee9d8b` merged in (merge commit `6f91609`); head `f6e26db`. Not merged to main, nothing in `D:\workspace\GameBuilder` touched except this report and `plans/reports/shots-circuit-editor/`.

Status: **DONE_WITH_CONCERNS** (all of a–g built and verified; three points need the owner's eye, see "Concerns").

## What works (each line was run in a real browser, script below)

| | Item | State |
|---|---|---|
| a | Enter / leave by a path | Double-click a block or its "Mở" button. Path bar "Bảng chính › Trạm › [tên]" + "Quay ra" + "Tầng n"; Esc / Backspace / any crumb leaves. Nested circuits go deeper on the same path. Editing inside changes every copy (checked: a pin added inside shows on all 8 blocks). A note under the bar says "Sửa bảng mạch X sẽ đổi cả 8 bản sao". |
| b | Block on the board (look B) | Tinted header, rounded-square icon, name, status light + word (Đang dừng / Đang chạy), "Mở" button, pins left/right on the same row, 3 port shapes. Wires to/from pins by normal drag, wrong type refused with the usual message. Stack "×8": one block with two card edges behind, count chip spreads it; drag moves all copies; saved with the board. |
| c | Pins + Thông số mở | Pin cards at the edges (in left, out right): add, rename inline, up/down, delete. Type chip follows the inner port the pin is wired to; "Chưa nối" until wired. "Mở ra ngoài" switch per setting on an inner card → a "Thông số mở" card + a field on every copy with its own value. |
| d | Palette group "Bảng mạch" | Inside the existing piece palette, above the categories. Lists circuits with "×N", pins / settings count. Drag (or press) to place a copy; open, rename, duplicate, delete. Delete with copies asks in the row ("Còn 9 bản sao… Xóa hết / Thôi"); 0 browser dialogs. "Mạch trống" and "Từ thẻ đang chọn" buttons. The search box also filters circuits (written, not browser-checked; "Mạch trống" likewise only read in code). |
| e | Tạo bảng mạch từ các thẻ đang chọn | From the palette button, the Sửa menu, or the multi-select panel. Crossing wires become pins, copy stands in place. Run proof: see "Concerns 1". |
| f | Copy inspector | Tên riêng, exposed values, Vị trí đặt (x/y/z) + Hướng quay, pin list, "Mở bảng mạch", Nhân đôi, Xếp chồng N máy, Xóa. Stack has its own panel (members, Bung chồng). Inside a circuit with nothing selected: circuit name, "Nhìn từ bên ngoài" preview, pins, exposed settings. |
| g | Undo/redo, copy/paste, save/load, issues | Every circuit edit is one undo step (delete circuit + 9 copies comes back with one Ctrl+Z). Copy/paste of copies on the board and of cards inside a circuit. Reload gives byte-identical autosave. "Việc cần sửa" lists circuit problems in plain Vietnamese with a "Mở" button that goes into the circuit. |
| – | Học sinh / Giáo viên | Giáo viên: circuit opens ready to edit. Học sinh: opens view-only (amber note + "Sửa mạch"), cards cannot be dragged, inspector greyed with a line saying why; "Sửa mạch" unlocks. |
| – | Running | Blocks show "Đang chạy"; wires on pins of copies on the main board carry live values (through `idMap.pinPort`). |

## Differences from the picked preview (all of them)

1. Path bar is the app's floating crumb (same as "Nhóm"), not a full-width bar; the level ladder icon is a plain "Tầng n" (main board = 1, counting down into circuits; the mock counted the other way).
2. No per-copy colour dot on the icon: a copy has no colour of its own in the core. The circuit's colour would show there, but there is no picker for it yet.
3. Status word is only Đang dừng / Đang chạy (the mock's "Đang chở", "Chờ lệnh" were illustration).
4. "Thông số mở" cards have no wire to the inner card (in the data it is a setting, not a port). The card names the inner card and setting instead; pressing that line selects the card.
5. Pin type chip is a label, not a button: the type follows the wired inner port (as the brief says).
6. Number value pills are hidden on the pins of a copy while running (two pins share a row, no room); the value shows on the wire badge.
7. A stacked block's ports cannot be wired; tooltip says to spread the stack first (one wire for 8 machines would be a hidden rule).
8. Instance values use the app's own editors (stepper, colour box…), not the mock's swatch row / "Mốc sàn" drop-down.
9. Not in this slice by the brief: "Chạy thử máy này", live wires inside an entered copy, Xuất / Nhập.

## Concerns

1. **"Unchanged behaviour" proof for (e) needed an order-free hash.** The engine runs cards that do not wait for each other in the order of their ids, and a card inside a copy runs as `<copy>/<id>`. So after wrapping, independent cards may run in another order: the robot's wheels and the entity serial numbers (`e1, e2`) come out listed differently, while every position and number of every entity is identical. The test hashes the full entity state every tick for 600 ticks with entities sorted by owner and wheels by side: equal before/after for 2 samples × 3 selections, also after save + load. The raw listing hash is equal too whenever the run order is kept (asserted; at least one selection per sample). The editor picks the copy's id so the run order is kept when any id can do it; when none can it still makes the circuit and says "Thứ tự chạy của vài mảnh ghép có đổi… không ưng thì Hoàn tác". A board with a wire loop that has no "feedback" port could really behave differently in that case; none of the samples tried did. A real cure is in `engine/compile.ts` (off limits for me).
2. **Core changes I had to make** (`app/src/circuits`, `app/src/io`, one additive type): a pin may be unwired (`inner: {node:'', port:''}`, new issue code `pin-unwired`, not a load error, wires on it are dropped at expand); a copy may carry `name`; `Graph.stacks?: string[]` (which circuits are drawn stacked; written only when used). Covered by `tests/editor/circuit-editing.test.ts`.
3. **Two bugs that are also on main today**, found while testing: (i) after reopening a saved board the wires are drawn as dots until something redraws them – fixed here in `wiring-canvas.ts` (one redraw when the board first has a size); (ii) shipped boards have notes named `n1`, the same id a new card gets, and the canvas then treats that card as a note – I only kept new copies clear of it; a plain piece added from the palette on such a board still collides on main.

## Limits

- Scene tree, game-view selection/drag and the step debugger do not know cards inside copies (they see the main board). Inside a circuit the step button never stops; live param edits inside a circuit apply on the next run.
- While running, wires inside an entered circuit show no values (next slice).
- Groups ("Nhóm") do not exist inside a circuit (the format stores none there); Ctrl+G there says so. Notes are main-board only.
- Clipboard with copies of circuits works within the open board; after a page reload the stored clip with a copy is ignored.
- A circuit cannot be given a colour yet; pins cannot be re-typed by hand; exposed settings cannot be reordered.
- Adding a pin makes every block of that circuit taller/wider, which can overlap neighbours on a tight board (same as a piece that grows ports).
- "Vừa màn hình" keeps the app's minimum zoom (85% / 92%), so a big circuit does not fit whole; pin cards can sit under the first-run hint until it is closed.
- Turned copies: still the core limit (sizes are not turned).

## Files

New `app/src/editor/circuits/` (2 587 lines): `circuit-model.ts` (pure edits), `circuit-wiring.ts` (ports, pin cards as wire ends), `circuit-issues.ts`, `circuit-actions.ts`, `circuit-views.ts`, `circuit-canvas.ts`, `circuit-crumb.ts`, `circuit-palette.ts`, `circuit-inspector.ts`, `circuit-text-vi.ts`, `circuits.css`.
Hooks: `editor-state.ts` (path scope, `edit()`, lock, stacks), `wiring-canvas.ts`, `graph/canvas-pointer.ts`, `graph/wire-drag.ts`, `graph/node-actions.ts`, `palette.ts`, `properties-panel.ts`, `console-dock.ts`, `app.ts`, `groups/group-inspector.ts`, `groups/group-text-vi.ts`.
Core: `circuits/{instance,expand,validate,index}.ts`, `io/{circuits-format,save-format,text-vi}.ts`, `engine/types.ts` (+2 lines).
Not touched: `world/**`, `nodes/**`, `render/**`.
Tests: `tests/editor/circuit-editing.test.ts` (20), `tests/editor/circuit-from-selection-run.test.ts` (2).

## Verification

- `npx tsc --noEmit -p .`: clean (merged state).
- Full suite, merged state, one run: **278 files passed, 1 skipped (279); 4155 tests passed, 1 skipped (4156)**, 530 s, 0 failed. The skipped one is not mine (no skip added). No timeouts this run.
- `tests/editor/solid-off-unchanged`, `real-physics-on-hash`: pass, baselines not re-recorded (0 baseline files changed).
- Browser: `plans/reports/shots-circuit-editor/circuit-editor-flows.mjs` on port 5182 (stopped): **55/55 checks**, 0 page errors, 0 dialogs; results in `flow-results.json`. 43 PNG there: `01`–`06` in Học sinh/Giáo viên × Xám dịu/Tối, `flow-*` per step. I read them: nothing clipped in the new parts; the first set had three faults (wires missing after reload, path bar over the pin cards, value pill over pin names) – fixed and re-shot.
- Run it: `cd app; npx vite --port 5182 --strictPort`, then `PW_DIR=<folder where playwright-core 1.49.1 is installed> node ../../GameBuilder/plans/reports/shots-circuit-editor/circuit-editor-flows.mjs`.

## Next slice notes

- Bench: `Circuit.benchIds` is kept whole by every edit, `expandCircuitAlone` exists; pins as hand-driven inputs can reuse the pin cards.
- Live values inside a copy: `CircuitStep.via` already records the copy each level was entered through; `circuit-canvas.ts` `liveWire()` is the one place to map with `idMap.expandedId`.
- Export / import one circuit: `circuitsForFile` + `readCircuitHeaders` already split a circuit from the board.
- "Chuyển nhóm thành bảng mạch": `createCircuitFromSelection` with the group's members (it refuses grouped cards today on purpose).

## Questions for the owner

1. Khi gói thẻ thành bảng mạch mà thứ tự chạy đổi: 1a) cứ tạo và báo như hiện nay (đề xuất), 1b) không cho tạo, 1c) nhờ nhóm engine sửa để thứ tự không phụ thuộc tên thẻ.
2. Khối đang xếp chồng "×8": 2a) không nối dây được, phải bung ra (hiện nay, đề xuất), 2b) nối một dây là nối cả 8 máy.
3. Màu riêng cho từng bảng mạch (chấm màu trên biểu tượng như bản xem trước): 3a) thêm ở đợt sau (đề xuất), 3b) không cần.
4. Lỗi ghi chú trùng mã `n1` với thẻ mới trên main: có muốn tôi sửa luôn ở `editor-state` không?
