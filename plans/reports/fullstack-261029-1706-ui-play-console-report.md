# Agent F report: play state + Bảng tin

Branch `feat/ui-play-console` in `D:\workspace\GameBuilder-ui-play-console` (main merged in, including scene tree and lessons/launchpad). Gates in `app/`: vitest 707/707, `tsc --noEmit` clean, `npm run build` OK.

## Done
- Play cluster:
  - Tạm dừng and Tiếp tục toggle on the one button; Từng bước is enabled only while paused.
  - While playing, the first button reads "Chơi lại" and restarts; Dừng is red.
  - Root gets `.paused`: amber ring, "Tạm dừng" state label.
  - Ctrl+Enter toggles play/stop. It is ignored while typing in an input (same rule as the other shortcuts). No other key used Ctrl+Enter.
- Live edit (4a):
  - `setParam` during play accepts only number/colour/vec3 params and `look` (`isLiveParam` in editor-state). It stays in history and autosave and is kept after Dừng.
  - Structure stays blocked. Delete/Backspace/Ctrl+V/Ctrl+D and a pointerdown on a canvas port show "Bấm Dừng để thêm/xóa/nối".
  - The Inspector callback sends the running game only the keys that changed. The panel passes the full param set, and `runtime.applyNodeParams` returns false when any key in it is create-only, such as `position`. Without the diff every edit looked deferred.
  - A false result shows "Sẽ áp dụng khi chơi lại".
- Bảng tin (`editor/console-dock.ts`, `editor/console/{console.css,console-text-vi.ts,issues.ts}`):
  - Pinned "Việc cần sửa" list from `listMissingWires` plus a "no Nhân vật" issue. The no-Nhân vật check is skipped on an empty board or when the mode does not offer the node. "Xem" selects the node and centres it, switching to the Bảng nối tab if needed.
  - Timestamped log (info/ok/warn/error): play, stop, restart, pause, resume, step, win/lose, live applied or deferred, and every `topBar.notify` via the new `onNotify` dep (includes save).
  - Filters Tất cả/Cảnh báo/Lỗi, a Xóa button, and a badge with the issue count on the tab.
- Undo fixes:
  - `connect(from, to, {replace:true})` drops the old wire and adds the new one in one step. `wire-drag.ts` now uses it.
  - `moveItems(moves, {amend:true})` folds into the previous step. `node-actions.placeNewNode` uses it, so the placement nudge costs no extra step.
- Added `wiring-canvas.centerOn(nodeId)` (public, minimal).
- As requested by the controller, `mountSceneTree(host, state, onReveal?)` was extended. app.ts passes an `onReveal` that pans the canvas when it is visible.

## Edits outside my list (needed)
- `graph/wire-drag.ts` and `graph/node-actions.ts` (1-line call changes) for the two undo fixes.
- `scene-tree.ts` for the optional `onReveal`, as the controller asked.
- `wiring-canvas.ts`: only the new `centerOn`.

## Tests
`tests/editor/play-edit-console.test.ts` has 8 cases:
- live vs blocked setParam during play;
- one undo step for replace;
- a failed replace changes nothing;
- one undo step for add with the nudge;
- the issues computation (empty board, no Nhân vật, missing wire).

## Browser smoke (Playwright, port 5177, sample "Nhặt sao", split layout)
25/25 checks passed, 0 console errors. Script: `scratchpad/smoke-final.mjs`; results: `scratchpad/smoke-results.txt`. Screenshots are `f-1..f-7-*.png` in `C:\Users\trong\AppData\Local\Temp\claude\D--workspace-GameBuilder\28feef90-daae-4318-8ffa-6bf07e972cef\scratchpad\`.

| Step | Evidence |
|---|---|
| 1 Play | first button reads "Chơi lại", Dừng enabled, `.playing` set |
| 2 Pause | `.paused` set; the character position did not change in 800 ms with a key held |
| 3 Step | with Space held, the character height changes tick by tick over 18 steps (307→302→305→307 px) and is frozen again afterwards |
| 4 Resume | `.paused` cleared; Ctrl+Enter stops and starts |
| 5 Live speed | speed set to 0 mid-play: the log says "Đã đổi giá trị…" (not deferred) and the character no longer moves. Baseline at speed 5 moved ~30 px in 250 ms |
| 6 Stop | speed 0 is still in the Inspector after Dừng |
| 7 Issues | adding "Cầm/Thả" shows "chưa nối dây vào Nhân vật"; the tab badge equals the row count; "Xem" centres the node (dx=0, dy=0); one Ctrl+Z removes the added node |

## Not verified
- Movement and freeze are measured by pixel positions of the blue character, which is noisy (idle animation, camera lag). The checks use a ±2 px tolerance and a jump-arc trace, not engine state.
- Visually, the amber pause ring and colour tokens were not checked against the mockup, only `f-3-paused.png` skimmed. The ring selector is `.app.paused .game-box::after`.
- Replace-wire undo (a wire drag in the real canvas) is tested at state level only. Live edits of `look` and colour in the browser and the 3D/top-down modes were not run.
- Only the Nhặt sao sample was played. The sidebar-collapsed and 1024 px layouts were not checked.
- Line endings: top-bar.ts, editor-state.ts, wire-drag.ts and node-actions.ts keep their original CRLF. app.ts was merged on LF-normalised copies and saved as CRLF to match main.

## Unresolved
- Ctrl+Enter inside a text or number field does nothing, by design. Say so if it should work there too.
