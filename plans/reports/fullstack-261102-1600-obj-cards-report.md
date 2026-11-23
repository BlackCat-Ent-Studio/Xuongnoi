# Object cards + two-way highlight (feat/obj-cards, worktree GameBuilder-cards)

## Done
- Puzzle object cards (character/block/item...: kind category object with params.name): title = object name, small thumbnail (38px circle-square) from the real stage figure (offscreen SceneView with the cozy stage, cached per look+colour+size), generic kind subtitle removed, generic "Hộp/Đồ vật" word on the self pin hidden. Logic/zone cards unchanged. Editor cards unchanged. Header height 34px (was ~39): footprint not larger; width may grow slightly for long names.
- Highlight: GameView.setHighlight (yellow translucent shell + thick light outline on dark rim, drawn over everything, pulses 4 s then holds calm). Puzzle: tap object card (header or body; drag threshold 6px) -> glows on stage; tap again / tap elsewhere / tap logic card clears. Tap object on big stage (5px tap threshold, 18px reach for thin things, floors and card-less scenery see-through) -> its card is lit; pulse also visible in mini board (ring scaled by --hl). No swap forced. Editor: selection glows objects (also while playing); tapping an object selects + pans card into view only if off-screen + flashes it; second tap / empty tap clears; drag still orbits/pans.
- New: render/object-highlight.ts, render/object-thumbnails.ts, puzzle/ui/object-cards.ts, editor/graph/object-link.css. Touched: scene-view, game-view (CRLF kept), app-contracts, board-view, level-screen, stage-camera-input (optional onTap), puzzle.css, editor app/entity-drag/wiring-canvas. No node registry / node-view.ts touched. DEV-only hook window.__pzScreenOf (stripped from prod).
- Tests: +8 (object-highlight, object-cards). tsc clean, npm run build OK, full vitest 131 files / 2249 passed.

## Playwright (swiftshader, :5214, stopped), scripts plans/browser-scripts/obj-cards-{lib,puzzle,editor}.mjs
- Puzzle L2, 5, 7, 8 at 844x390 and 1280x720: 62/62 asserts, no console errors. Level 5 has NO object cards (all its objects are hidden scenery, only Hằng số/Thắng-Thua shown): nothing breaks. Cards exist in L1-4, 6-8 only.
- Editor sample platform-bot at 844x390 and 1280x720: 16/16.
- Shots: plans/reports/shots-obj-cards/ (read: desk/phone L2 board, card-picked, object-tapped; phone L8 board+tapped; desk L7 picked; editor desk+phone tapped/selected).

## Concerns
- Not tested on a real phone/GPU; swiftshader only. Thumbnails render synchronously (one throwaway WebGL context) in a rAF after first draw; no WebGL = cards keep category glyph.
- Pack-model (async-loaded) objects would thumbnail before load; puzzle levels use none.
- Mini-board pulse in layout B is small; readable but subtle on phones.
- Editor: empty-space tap now clears selection (new behaviour); editor glow stays on selected objects (calm after 4 s).
- Thumbnail of the floor ("Mặt đất", L3/L4 scenery-hidden mostly) not shown since floors have no card.
- feat/rename may conflict in node-view/node-cards only if it also edits board-view header code (I post-process DOM: removes every non-name child of .wc-title, so its English subtitle is dropped on puzzle object cards too).
