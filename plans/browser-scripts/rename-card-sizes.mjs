// Adds every node kind to a blank board and prints each card's footprint (CSS px) for the app on PORT.
// Usage: PORT=5213 node rename-card-sizes.mjs > sizes-new.json
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const port = process.env.PORT ?? '5213';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`http://localhost:${port}/`);
await p.waitForTimeout(1500);
// blank game
await p.evaluate(() => localStorage.clear());
await p.goto(`http://localhost:${port}/`);
await p.waitForTimeout(1500);
const kinds = await p.evaluate(() => [...document.querySelectorAll('.pn-item[data-kind]')].map((e) => e.getAttribute('data-kind')));
const out = {};
for (const k of kinds) {
  const before = await p.evaluate(() => document.querySelectorAll('.wc-node').length);
  await p.locator(`.pn-item[data-kind="${k}"]`).first().click();
  await p.waitForTimeout(60);
  const r = await p.evaluate((kind) => {
    const all = [...document.querySelectorAll(`.wc-node[data-kind="${kind}"]`)];
    const n = all[all.length - 1];
    return n ? { w: n.offsetWidth, h: n.offsetHeight } : null;
  }, k);
  out[k] = r;
}
console.log(JSON.stringify({ count: kinds.length, errors, sizes: out }));
await b.close();
