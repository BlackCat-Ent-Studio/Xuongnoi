// Fresh browser (no saved choice): the puzzle page should open in theme A.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:5173/giai-do.html');
await p.waitForTimeout(1500);
console.log('body classes:', await p.evaluate(() => document.body.className), '| options:', await p.$$eval('.pz-theme-opt', (bs) => bs.map((x) => x.textContent).join(',')));
await p.screenshot({ path: 'D:/workspace/GameBuilder/plans/reports/shots-theme-trial/default-a-list.png' });
console.log(errs.join('\n') || 'no page errors');
await b.close();
