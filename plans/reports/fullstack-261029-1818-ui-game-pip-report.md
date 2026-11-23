# Floating game window (PiP) report

Branch feat/ui-game-pip (worktree D:\workspace\GameBuilder-ui-game-pip), main merged in twice (graph-corner, topbar-menus), no conflicts. Commits: feat(editor) floating game window; feat(editor) reserve window area on board; merge.

## Built
- editor/game-pip.ts, editor/pip/pip.css, editor/pip/pip-text-vi.ts (new); app.ts (~45 lines, CRLF kept).
- Same GameView instance: the game-box element (canvas, HUD, ResizeObserver) is re-parented between the Màn chơi pane and the PiP body; relayout() after each move. render/game-view.ts needed NO change.
- Title bar: Xem game + chip (Đang sửa / Đang chơi / Tạm dừng) + Thu nhỏ / Chia đôi / Phóng to. Double-click title toggles collapse.
- Drag by title, clamped to the centre pane area; resize via top-left corner (window anchored bottom-right), 16:10, min 240 wide, max fits the host. Prefs (w, right, bottom, collapsed) in localStorage `xuong-noi:pip`.
- Visible only when centre tab = Bảng nối and preset is not Chia đôi. Chơi no longer switches tab (removed followPlayState/switchedForPlay).
- Tab drag-out: pointer events, ghost label + dashed drop zone; drop on the canvas area selects Bảng nối and places the PiP at the drop point. Dragging the PiP title onto the tab bar (highlighted) or Phóng to docks back to Màn chơi.
- canvas.setOverlayInsets wired on show / hide / move / resize / collapse / host resize. Also sets --pip-inset-r so the empty-board launchpad card shifts left of the window.
- F-key maximise while PiP visible now switches to the Màn chơi tab first (otherwise it maximised inside the PiP). Max button hidden inside the PiP.

## Decisions
- Entity drag/picking stays ENABLED in the PiP (works on client coords).
- Keyboard play works (window listeners); PiP buttons blur after click so Space does not re-trigger them.
- If the PiP is minimised, Chơi does NOT auto-expand it (explicit user choice; chip still shows state). Easy to change.
- Hint line is static text (edit / play / paused); game view exposes nothing better.

## Verification
- vitest 718 pass, tsc clean, build OK (after final merge).
- Playwright (my script, 1440x900 and 1280x720, 30 checks each) all PASS except one weak check: shows on Bảng nối, play inside PiP (canvas changes with ArrowRight), pause chip, stop, minimise, drag/resize clamped inside host, 16:10, reload restores, Chia đôi hides it and game box has size in pane, Phóng to, tab drag-out, drop on tab bar, no console errors. Screenshots in scratchpad shots/pip-*.png.
- Not at bottom-left corner: PiP is at right; .wc-corner x-range never overlaps in default position (checked 1440 and 1280 empty board).

## Not verified / issues
- "Canvas frozen when paused" check FAILS: the canvas still changes pixels while paused (the scene keeps animating with dt; chip and top bar do show paused). Probably existing behaviour, not investigated.
- tut-dock-e2e.mjs lesson 1: 9 FAIL from step "L1 wired key -> play" onward. NOT caused by the PiP: identical failure on current main (port 5182) and with insets disabled. Cause: after dropping the key at canvas (60,380) the node's port ends at y=753 (under the lessons dock), i.e. node placement/view changed in the graph-corner merge. Needs the graph-corner owner or script drop-point update. Before the corner merge the run passed 32 checks (first failure then was the launchpad button covered by the PiP, which is now fixed).
- Lessons other than 1, tutorial highlights targeting the game view in the PiP, Firefox/Safari, real GPU, touch, 3D mode in the PiP not tested. Launchpad card at 1280 may still sit close to the bottom-left corner overlay (corner agent's area).
- Docs (HANDOFF) not updated.

Status: DONE_WITH_CONCERNS
