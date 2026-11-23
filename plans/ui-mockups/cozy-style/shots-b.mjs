import { chromium } from 'file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 844, height: 390 } });
const errs = [];
p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', e => errs.push(String(e)));
await p.goto('file:///D:/workspace/GameBuilder/plans/ui-mockups/cozy-style/style-b-meadow.html');
await p.waitForTimeout(1200);
for (const s of ['title', 'map', 'level']) {
  await p.click(`.tabs [data-go=${s}]`); await p.waitForTimeout(700);
  await p.locator('#phone').screenshot({ path: `shot-b-${s}.png` });
}
await p.screenshot({ path: 'shot-b-full.png', fullPage: true });
console.log('errors', errs);
await b.close();
