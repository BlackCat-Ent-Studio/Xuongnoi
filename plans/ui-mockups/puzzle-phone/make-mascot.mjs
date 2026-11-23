// Crops the approved Mèo Mun Chibi render into a small portrait used by the tutorial guide.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const src = 'file:///D:/workspace/GameBuilder/plans/ui-mockups/black-cat/shots-chibi/expr-normal.png';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 828, height: 613 } });
await p.goto(src);
await p.waitForTimeout(300);
await p.screenshot({ path: 'D:/workspace/GameBuilder/plans/ui-mockups/puzzle-phone/mascot-cat.png', clip: { x: 268, y: 122, width: 290, height: 300 } });
await b.close();
