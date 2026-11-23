// Inside a group of the city sample: routing, knots kept per board, wire crossing the group edge.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-editor-board';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.env.PORT ?? 5242;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(8000);
const logs = [];
page.on('pageerror', (e) => logs.push(e.message));
const check = (n, ok, d = '') => console.log(`${ok ? 'PASS' : 'FAIL'} | ${n} ${d}`);
await page.goto(`http://localhost:${PORT}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) await page.locator('[data-tut="invite-no"]').click();
await page.locator('[data-menu="file"]').click();
await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
await page.locator('.mb-item', { hasText: 'Thành phố giao hàng (lái xe tải' }).first().click();
await sleep(1500);
await page.addStyleTag({ content: '.pip{display:none !important}' }); // the floating game window covers part of the board


const info = async () => page.evaluate(() => ({ cards: document.querySelectorAll('.wc-node').length, wires: document.querySelectorAll('.wc-wire').length, routed: [...document.querySelectorAll('.wc-wire')].filter((p) => p.getAttribute('d').includes(' Q ')).length, rt: window.__rt }));
console.log('flat city-delivery', JSON.stringify(await info()));
await page.screenshot({ path: `${OUT}/10-city-flat-127.png`, timeout: 60000 });
const hb = await page.evaluate(() => { for (const h of document.querySelectorAll('.wc-node .wc-node-head')) { const r = h.getBoundingClientRect(); if (r.x > 300 && r.x < 1000 && r.y > 120 && r.y < 560 && h.contains(document.elementFromPoint(r.x + 12, r.y + r.height / 2))) return { x: r.x, y: r.y, h: r.height }; } return null; });
await page.evaluate(() => { window.__rt = []; });
await page.mouse.move(hb.x + 12, hb.y + hb.h / 2);
await page.mouse.down();
for (let i = 1; i <= 30; i++) await page.mouse.move(hb.x + 12 + i * 3, hb.y + hb.h / 2 + i * 2);
await sleep(200);
const fr = (await page.evaluate(() => window.__rt)).filter((q) => q[0] === 'frame');
console.log(`drag: per-frame JS calls=${fr.length} avg=${(fr.reduce((p, q) => p + q[2], 0) / fr.length).toFixed(1)}ms max=${Math.max(...fr.map((q) => q[2]))}ms`);
await page.mouse.up();
await sleep(300);
console.log('drop', JSON.stringify((await page.evaluate(() => window.__rt)).filter((q) => q[0] === 'all')));
await browser.close();
