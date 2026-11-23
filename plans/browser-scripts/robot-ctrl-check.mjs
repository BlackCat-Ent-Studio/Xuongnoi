const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-robot-ctrl/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5253';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const errors = [];
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('response', (r) => { if (r.status() >= 400) errors.push('HTTP ' + r.status() + ' ' + r.url()); });
p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await p.goto(`${BASE}/`);
await sleep(1500);
await p.evaluate(() => localStorage.clear());
await p.reload();
await sleep(1500);
if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }

async function openPage(query) {
  await p.getByRole('button', { name: 'Trợ giúp' }).first().click();
  await p.getByText('Sổ tay mảnh ghép', { exact: true }).first().click();
  await p.waitForSelector('.hb-modal');
  await p.fill('.hb-search', query);
  await sleep(300);
  await p.locator('.hb-list .hb-row-label').first().click();
  await sleep(300);
}

await openPage('PID');
await p.screenshot({ path: OUT + '01-handbook-pid.png' });
await p.getByRole('button', { name: 'Thử ngay' }).click();
await sleep(1000);
await p.screenshot({ path: OUT + '02-tryboard-pid.png' });
await p.locator('.wc-node[data-id="pid"] .wc-name').click({ force: true });
await sleep(500);
const adv = p.locator('summary', { hasText: 'Nâng cao' }).first();
if (await adv.isVisible().catch(() => false)) await adv.click();
await sleep(300);
await p.screenshot({ path: OUT + '03-pid-properties.png' });
await p.locator('[data-tut="play"]').click();
await sleep(9000);
await p.screenshot({ path: OUT + '04-playing-plot.png' });
await sleep(1500);
await p.locator('button, [role=tab]', { hasText: 'Màn chơi' }).first().click();
await sleep(2500);
await p.screenshot({ path: OUT + '05-playing-full-view.png' });
const plotInfo = await p.evaluate(() => [...document.querySelectorAll('[data-ui-plot]')].map((e) => [e.getBoundingClientRect().width, e.getBoundingClientRect().height, e.innerText]));
console.log('PLOT_EL', JSON.stringify(plotInfo));
console.log('ERRORS', JSON.stringify(errors));
await b.close();
