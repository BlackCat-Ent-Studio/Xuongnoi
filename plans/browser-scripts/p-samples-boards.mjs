// p-samples boards on :5285: wiring view of each rebuilt sample, zoomed out so the whole board shows.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-p-samples/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5285';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 1800, height: 1000 } });
await p.goto(`${BASE}/`);
await sleep(3000);
await p.evaluate(() => localStorage.clear());
await p.reload();
await sleep(3000);
if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
const samples = [
  { key: 'square', label: 'Robot đi hình vuông' },
  { key: 'door', label: 'Cửa tự động' },
  { key: 'arm', label: 'Tay máy tự gắp' },
  { key: 'sorter', label: 'Băng chuyền phân loại' },
];
for (const s of samples) {
  await p.locator('[data-menu="file"]').click(); await sleep(200);
  await p.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  await p.locator('.mb-menu .mb-item', { hasText: s.label }).click(); await sleep(1500);
  await p.locator('.wc-rail > button:nth-of-type(4)').click().catch(() => {}); await sleep(500);
  await p.locator('.wc-rail > button:nth-of-type(3)').click().catch(() => {}); await sleep(300);
  await p.screenshot({ path: OUT + `${s.key}-0b-board-wide.png` });
}
await b.close();
