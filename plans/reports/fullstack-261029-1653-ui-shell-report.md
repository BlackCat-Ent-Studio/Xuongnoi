# UI shell report (agent A, branch feat/ui-shell)

## Done
- Tokens in `style.css` (graphite + mint, `--c-*`, `--raise --line2 --accent-soft`, old aliases kept). Be Vietnam Pro via Google Fonts link in `index.html`, system fallback.
- `editor/icons.ts`: sprite + `mountIconSprite()` + `icon(name, filled?)`.
- `editor/menu-bar.ts`: keyboard menus (Enter/Space/Arrows/Home/End/Esc). Tệp (new/open/save/samples/Góc nhìn radios), Sửa, Xem (tabs, maximize, presets, left dock toggle), Trợ giúp (shortcuts dialog).
- `editor/top-bar.ts`: 40px one-row grid. Logo, menus, game name, centred Chơi/Tạm dừng/Từng bước/Dừng, undo/redo icons (keep `data-act`), layout select, save status, help. `data-tut="play"` and `#btn-play` kept. Pause/Step disabled with tooltip.
- `editor/dock-tabs.ts` (new, not on the owned list, no conflict): `createDock`, `createMount`.
- `layout-model.ts`, `layout-splitters.ts`: left/right/bottom splitters, 25px hit area, arrows (Shift = big step), dblclick reset, presets Mặc định / Chia đôi / Rộng bảng, localStorage persistence (old saved shape still read). Left dock auto-collapses to a 40px tab rail at width <= 1366 (not persisted until the user chooses).
- Playing ring + "Đang chơi" chip + `user-select:none` on chrome. `relayout()` calls `gameView.resize()` on every dock/tab/preset change; the canvas is re-fitted if a board loaded while it was hidden.
- Removed the `.wc*`, `.type-*`, `.wc-dot` and note rules from style.css (now in graph.css). Merged main (panels, graph, naming, engine) clean.

## Exports
- `editor/dock-tabs.ts` (re-exported from `editor/app.ts`): `DOCK_SCENE_ID='dock-scene'`, `DOCK_CONSOLE_ID='dock-console'`, `DOCK_LESSONS_ID='dock-lessons'`. Empty `div.dock-mount` with `data-placeholder` text, shown only while empty (`:empty::before`), so mounting a child hides it.
- Layout API: `installLayoutSplitters({work, onChange}) -> {left,right,bottom, preset(), setPreset, leftCollapsed(), setLeftCollapsed, ensureBottomOpen, onPrefsChange}`.
- Top bar: `createTopBar({state, menus, onPlay, onStop, onPause?, onStep?, onHelp, onPresetChange, initialPreset})`. Pass `onPause`/`onStep` and the buttons enable while playing. `noteDocumentChange`, `setPreset`, `closeMenus`, `addControl` (prepends to the right cluster; tutorial button lives there for now).
- Strings: `editor/shell-text-vi.ts` (`SHELL_TEXT`, `PRESET_LABELS`).

## Behaviour decisions
- Góc nhìn: kept as 3 live radios in Tệp (the old select changed the mode live), not a disabled "đổi khi tạo mới" item. Heading says it can also be chosen when creating. Flip if you want the literal mockup.
- Chơi switches the centre to "Màn chơi" if "Bảng nối" was open, and Dừng returns. In "Chia đôi" both are visible, no switch.
- Lesson start (board loaded while a tutorial is active) expands a collapsed left dock so palette highlights work.
- Tutorial panel moved to left:16px (was 216px, offset for the old palette).

## Verified
- `npx vitest run` 693 pass, `tsc --noEmit` clean, `npm run build` ok (after the final merge).
- Playwright (imported by absolute path from the smoke scratchpad) at 1440x900, 1280x720, 1024x700: no horizontal overflow, top bar 40px, docks all present, Chơi sets playing and renders the game (canvas sized), Dừng restores the tab, menu opens by keyboard, preset select to split works, no console errors. Screenshots looked right at 1440 and 1280 play.

## Not verified
- Real gameplay with a non-empty sample (checked on the empty autosave board only); keyboard input and entity drag not re-tested in browser, only unchanged code paths.
- Splitter drag with a real mouse (only code path and layout-model unit tests); dblclick/arrow behaviour untested in browser.
- Tutorial lessons end to end after the layout change; selectors `[data-act=undo|redo]`, `[data-tut=play]` exist, `.palette-item[data-kind]`/`.prop-row[data-param]` are mounted but lesson runs not exercised.
- Google Fonts needs network; offline uses the system fallback.
- 1024 width: top bar fits, but the lessons button plus selects are tight; checked by overflow only.
