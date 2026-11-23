// Opens "Tay máy tự gắp và đặt" from Tệp > Bài mẫu, plays it and shoots a burst around the first pick/carry/release.
// Needs `npx vite --port 5299 --strictPort` in the worktree app/.  PREFIX=before|after  ANGLE=a|b  FROM=13 TO=30 STEP=0.8
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder-gripper-hold/plans/reports/shots-gripper-hold/';
fs.mkdirSync(OUT, { recursive: true });
const PREFIX = process.env.PREFIX ?? 'before';
const ANGLE = process.env.ANGLE ?? 'a';
const FROM = Number(process.env.FROM ?? 13);
const TO = Number(process.env.TO ?? 30);
const STEP = Number(process.env.STEP ?? 0.8);
const BASE = 'http://localhost:5299';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto(`${BASE}/`);
await sleep(2500);
await p.evaluate(() => localStorage.clear());
await p.reload();
await sleep(2500);
if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
await p.locator('[data-menu="file"]').click(); await sleep(200);
await p.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
await p.locator('.mb-menu .mb-item', { hasText: 'Tay máy tự gắp' }).click(); await sleep(1500);
await p.locator('.wc-rail > button:nth-of-type(4)').click().catch(() => {}); await sleep(600);
await p.locator('.play .pbtn.primary').click();
await p.locator('button:has-text("Mô phỏng"):visible').first().click();
const t0 = Date.now();
if (ANGLE === 'b') {
  // a second viewpoint: drag the 3D view round and zoom in on the pick point
  const box = await p.locator('canvas').first().boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy); await p.mouse.down({ button: 'right' }); await p.mouse.move(cx - 260, cy + 40, { steps: 8 }); await p.mouse.up({ button: 'right' });
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx - 220, cy + 30, { steps: 8 }); await p.mouse.up();
  await p.mouse.wheel(0, -500);
}
let i = 0;
while ((Date.now() - t0) / 1000 < TO) {
  const t = (Date.now() - t0) / 1000;
  if (t >= FROM) await p.screenshot({ path: OUT + `${PREFIX}-${ANGLE}-${String(i++).padStart(2, '0')}-w${t.toFixed(1)}s.png` });
  await sleep(STEP * 1000);
}
await p.locator('.play .pbtn.stop').click().catch(() => {});
console.log('LOGS', JSON.stringify(logs.slice(0, 8)));
await b.close();
