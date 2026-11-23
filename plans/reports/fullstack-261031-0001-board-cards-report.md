# Board cards "Khối đồ chơi" restyle

Branch feat/board-cards, worktree D:\workspace\GameBuilder-board-cards.

## Changed
- app/src/editor/graph/node-cards.css (new, imported in wiring-canvas.ts after graph.css): rounded 18px card, header band in category colour (--cc) with round icon, bold title + small category (or instance name) line, dark body, 2px tinted border, solid toy shadow, two port columns (in left, out right), pins in flow inside card edge (circle = Đúng/Sai, diamond = Số, rounded square = Vật thể, existing type colours).
- Live contract styled: `.wc-port[data-live="on"] .wc-dot` pin glow ring, `.wc-node.is-hot` card glow (no transform), `.wc-port-val` pill reserved (mono, type-tinted).
- node-view.ts: category class on card, category line, `.wc-ports-body` two-column grid. group-view.ts: same body; group header band uses --gc.
- graph.css / group.css: superseded node rules removed (CRLF kept in graph.css); stub dot rules untouched.
- graph-geometry.ts estimateNodeSize: width from both columns' longest labels + header, 28px rows, ~54px header.
- Wire anchor unchanged: wiring-canvas still reads `.wc-dot` (now the in-flow pin). No wire/badge code touched.
- Layout: scripts/gen-city-delivery-3d.mjs SIZES table updated + regenerated city-delivery-3d.json; city-delivery.json re-spaced x1.5, y1.4 (positions and note boxes, CRLF kept). Tests not weakened.

## Gates (app/)
- tsc --noEmit: clean. npm run build: OK.
- vitest full run: 94 files, 1456 tests pass.
- Sample overlap tests (city-delivery, city-delivery-3d): pass.

## Browser (port 5231, server stopped)
Shots in D:\workspace\GameBuilder\plans\reports\shots-board-cards\ : 1 small board, 2 wired, 3 lesson step with highlight, 4 city 3D groups, 5 inside a group, 6 city 2D, 7 zoomed out (30%), 8 key-door.
- Pin-inside-card audit (pin rect within card rect): small 14/14, lesson 26/26, city3D 113/113, in-group 9/9, city2D 668/668, key-door 86/86. Outside = 0 everywhere; clipped labels = 0.
- Wire drag key.pressed -> win-lose.win: wires 0 -> 1.
- Console errors/warnings: 0.

## Notes
- Live-state hooks (data-live, is-hot, .wc-port-val) not exercised in browser: other agent adds them.
- 2D city spacing is looser than before (x1.5, y1.4).
