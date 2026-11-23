// Opens the three robot samples that ship with "Vật lý thật" on from Tệp > Bài mẫu, presses Chạy, shoots the 3D view at several times.
// Server: npx vite --port 5297 --strictPort (in app/). ONLY=line,avoid,square limits the list.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder-samples-robots/plans/reports/shots-samples-real-robots/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5297';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto(`${BASE}/`);
await sleep(2500);
await p.evaluate(() => localStorage.clear());
await p.reload();
await sleep(2500);
if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }

const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const samples = [
  { key: 'line', label: 'Robot dò đường', shots: [3, 10, 25] },
  { key: 'avoid', label: 'Robot tránh vật cản', shots: [3, 12, 30] },
  { key: 'agv', label: 'Xe tự hành', shots: [6, 14, 22, 40] },
  { key: 'square', label: 'Robot đi hình vuông', shots: [4, 12, 30] },
];
for (const s of samples) {
  if (only && !only.includes(s.key)) continue;
  await p.locator('[data-menu="file"]').click(); await sleep(200);
  await p.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  await p.locator('.mb-menu .mb-item', { hasText: s.label }).click(); await sleep(1500);
  await p.screenshot({ path: OUT + `${s.key}-0-board.png` });
  await p.locator('.play .pbtn.primary').click();
  await p.locator('button:has-text("Mô phỏng"):visible').first().click(); await sleep(400);
  let last = 0;
  let i = 1;
  for (const t of s.shots) {
    await sleep((t - last) * 1000); last = t;
    await p.screenshot({ path: OUT + `${s.key}-${i++}-run-${t}s.png` });
  }
  await p.locator('.play .pbtn.stop').click();
  await sleep(600);
  await p.locator('button:has-text("Bảng nối"):visible').first().click().catch(() => {}); await sleep(300);
}
console.log('LOGS', JSON.stringify(logs.slice(0, 8)));
await b.close();
