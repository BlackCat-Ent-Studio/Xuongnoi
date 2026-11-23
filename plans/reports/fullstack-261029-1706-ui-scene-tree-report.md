# Scene tree report (agent G, branch feat/ui-scene-tree)

## Done
- `editor/scene-tree.ts`: `mountSceneTree(host, state)`. ARIA tree (tree/treeitem/group, roving tabindex). Arrows, Home/End, Right/Left expand-collapse, Enter/Space select or toggle. Click selects node via `state.select`. Hover highlight. Selection synced from canvas (`selection` event). Rebuilt on graph/board/params. Collapsed groups kept across rebuilds.
- `editor/scene/scene-model.ts`: pure `buildSceneModel(graph, lookup)`. Màn chơi > Nhân vật (character) / Vật thể (block, item, vehicle, 2 platforms, portal, spawner) / Vùng (zone) / Camera. Giao diện > HUD (show-number, show-text, win-lose). Same-kind gets "#n". Hints: character Người chơi/Bot, item shape, show-text snippet.
- `editor/scene/scene-text-vi.ts`, `scene/scene-tree.css` (uses `--c-*`, `--accent-soft`, `--raise`).
- `app.ts`: +4/-1 lines (import, `sceneMount` const, `mountSceneTree(sceneMount, state)`, panel uses `sceneMount`). File is CRLF; preserved.
- Test: `tests/editor/scene-model.test.ts` (4 cases).

## Verified
- vitest 697 pass, tsc clean, build ok.
- Playwright on port 5178: empty state text shown; loaded "Né và bắn" and "Cổng dịch chuyển" samples: groups/items correct, click selects and inspector shows node, ArrowDown+Enter works, no console errors/warnings.

## Notes
- No public pan API on wiring-canvas (only fitToContent/viewCenter), so select only, no pan.
- Empty text says "tab Kho mảnh ghép" (palette tab is in same left dock), not "bên dưới".
- Spawner counted as Vật thể; shooter/enemies are Character role bot (no separate kind).
- Not verified: hover visuals, screen reader behaviour, keyboard focus ring by eye, playing-mode updates.

Status: DONE
