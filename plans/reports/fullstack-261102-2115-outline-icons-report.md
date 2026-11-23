# Outline highlight + card icons (fix/outline-icons)

## Done
1. Highlight = silhouette outline only (no yellow shell, no box frame). render/object-highlight.ts rewritten: chosen figures put on a mask layer, rendered white (override material) into a 0.75-scale target, then one full-screen edge shader blended over the finished frame: white-cream core line hugging the edge (outside + 1px inside) + golden soft halo; figure colours untouched; drawn over everything. Pulse (4 s then calm) moves only core/halo strength and halo spread. Cost: 2 extra passes only while something is chosen (mask = only chosen meshes; shadow update off during mask). Same API: GameView.setHighlight; SceneView.syncHighlight lost width/height args, gained renderHighlight(renderer, camera) called from game-view draw. LineMaterial deps gone.
2. Puzzle cards: thumbnails removed (board-view thumbnails option/putThumb/scheduleThumbs, level-screen wiring, puzzle.css rules). Category icon tile restored as other cards; object name stays as title. render/object-thumbnails.ts deleted.
- Tests: object-highlight test adjusted (signature). tsc clean, build OK, vitest 132 files / 2257 passed.

## Playwright (swiftshader :5216, stopped)
- Scripts plans/browser-scripts/outline-icons-{lib,puzzle,editor}.mjs. Puzzle L1, L2, L7 at 844x390 + 1280x720: 12/12 (every object card has icon + name, 0 img; glow shot per object). Editor platform-bot both sizes: 16/16. No console errors.
- Shots plans/reports/shots-outline-icons/ (read: desk-L2-glow-* crops robot/door, desk-L1-glow-2 flag, desk-L7-3-glow-full 3D robot, phone-L1-3-glow-full, *-1-board headers, desk-editor-1-card-selected-glow).
- Crate: L7 has no crate object card (only robot); crate glow not individually shot.

## Concerns
- Not tried on a real phone GPU. Full-screen 24-tap shader at 0.75 mask scale during highlight; if slow, lower MASK_SCALE or tap count (consts at top of file).
- Outline shows through walls/other objects (as before); on pale backgrounds the white core relies on the golden halo for contrast (fine on wood and 3D parquet).
- Editor glow on small preview is thin at low zoom (object small on screen).
- Card icon tile is the small 22px category glyph, same as logic cards.
