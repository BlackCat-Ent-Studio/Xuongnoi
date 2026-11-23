// Screenshots the node rename review page (desktop + phone) and tests search / copy.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-node-rename/';
const url = 'file:///D:/workspace/GameBuilder/plans/ui-mockups/node-rename/index.html';
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
const p = await ctx.newPage();
const logs = [];
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto(url);
await p.waitForTimeout(800);
await p.screenshot({ path: out + 'top.png' });
const sections = await p.locator('.sec').count();
const rows = await p.locator('.row').count();
console.log('sections', sections, 'rows', rows);
for (const [i, cat] of ['logic', 'object', 'brain'].entries()) {
  await p.locator(`.chip[data-cat="${cat}"]`).click();
  await p.waitForTimeout(200);
  await p.screenshot({ path: out + `cat-${cat}.png`, fullPage: true });
}
await p.locator('.chip[data-cat="all"]').click();
await p.fill('#q', 'raycast');
console.log('search raycast ->', await p.locator('.row:not(.hide)').count());
await p.fill('#q', '');
await p.locator('.row[data-id="touch"] .cb').check();
await p.locator('.row[data-id="touch"] .edit').fill('Chạm vật');
await p.click('#copy');
console.log(await p.evaluate(() => navigator.clipboard.readText()));
const ph = await b.newPage({ viewport: { width: 390, height: 844 } });
await ph.goto(url); await ph.waitForTimeout(600);
await ph.locator('.chip[data-cat="logic"]').click();
await ph.screenshot({ path: out + 'phone.png' });
const overflow = await ph.evaluate(() => document.documentElement.scrollWidth > innerWidth);
console.log('phone horizontal overflow', overflow);
console.log(logs.join('\n') || 'no console errors');
await b.close();
