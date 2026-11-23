// Opens the four samples that ship with "Vật lý thật" from Tệp > Bài mẫu, runs each and shoots at several times.
// Needs `npx vite --port 5298 --strictPort` in app/. ONLY=door,arm,sorter,robot-arm limits the list.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder-samples-cells/plans/reports/shots-samples-real-cells/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5298';
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
  { key: 'door', label: 'Cửa tự động', shots: [6, 10, 16, 24] },
  { key: 'arm', label: 'Tay máy tự gắp', shots: [5, 9, 14, 24, 40] },
  { key: 'sorter', label: 'Băng chuyền phân loại', shots: [12, 20, 30, 45] },
];
for (const s of samples) {
  if (only && !only.includes(s.key)) continue;
  await p.locator('[data-menu="file"]').click(); await sleep(200);
  await p.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  await p.locator('.mb-menu .mb-item', { hasText: s.label }).click(); await sleep(1500);
  await p.locator('.wc-rail > button:nth-of-type(4)').click().catch(() => {}); await sleep(600);
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
// robot-arm is an archived sample (not in the menu): open its saved file, then play it with the keys.
if (!only || only.includes('robot-arm')) {
  await p.locator('[data-menu="file"]').click(); await sleep(200);
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.mb-item', { hasText: 'Mở file' }).click()]);
  await chooser.setFiles(OUT + 'robot-arm.xuongnoi.json'); await sleep(1500);
  await p.locator('.wc-rail > button:nth-of-type(4)').click().catch(() => {}); await sleep(600);
  await p.screenshot({ path: OUT + 'robot-arm-0-board.png' });
  await p.locator('.play .pbtn.primary').click();
  await p.locator('button:has-text("Mô phỏng"):visible').first().click(); await sleep(1500);
  const tap = async (k, n = 1) => { for (let i = 0; i < n; i++) { await p.keyboard.down(k); await sleep(120); await p.keyboard.up(k); await sleep(200); } };
  await tap('KeyS', 2); await tap('KeyA', 2); await sleep(2500);
  await p.screenshot({ path: OUT + 'robot-arm-1-reach.png' });
  await tap('ArrowUp', 1);
  await p.keyboard.down('Space'); await sleep(1200);
  await p.screenshot({ path: OUT + 'robot-arm-2-gripped.png' });
  await tap('KeyW', 2); await sleep(2000);
  await p.screenshot({ path: OUT + 'robot-arm-3-lifted.png' });
  await p.keyboard.up('Space'); await sleep(3000);
  await p.screenshot({ path: OUT + 'robot-arm-4-released.png' });
  await p.locator('.play .pbtn.stop').click();
}
console.log('LOGS', JSON.stringify(logs.slice(0, 8)));
await b.close();
