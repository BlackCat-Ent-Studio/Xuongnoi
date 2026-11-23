import { chromium } from 'file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs';
const OUT = 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/';
const b = await chromium.launch(); const errs = [];
for (const [w, h, tag] of [[900, 700, 'd'], [844, 390, 'p']]) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('console', m => m.type() === 'error' && errs.push(m.text())); p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file:///D:/workspace/GameBuilder/plans/ui-mockups/cozy-style/style-c-night.html'); await p.waitForTimeout(800);
  for (const v of ['title', 'map', 'level']) { await p.click(`[data-view=${v}]`); await p.waitForTimeout(500); await p.locator('.phone').screenshot({ path: `${OUT}c-${tag}-${v}.png` }); }
  if (tag === 'd') await p.screenshot({ path: OUT + 'c-full.png', fullPage: true });
}
console.log('errors', errs); await b.close();
