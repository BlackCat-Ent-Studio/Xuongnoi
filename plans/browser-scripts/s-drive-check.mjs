// s-drive check on :5273: three samples (line follow 3D, obstacle avoider, square path) from Tệp -> Bài mẫu.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-s-drive/';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
const only = process.argv[2];
const samples = [
  ['line', 'Robot dò đường', [8000, 9000]],
  ['avoid', 'Robot tránh vật cản', [8000, 12000]],
  ['square', 'Robot đi hình vuông', [8000, 12000]],
].filter(([k]) => !only || only === k);
for (const [tag, label, waits] of samples) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', (e) => logs.push(`${tag} pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} ${m.text()}`); });
  await p.goto('http://localhost:5273/');
  await sleep(1500);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await sleep(1500);
  if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  await p.locator('[data-menu="file"]').click();
  await sleep(200);
  await p.locator('.mb-item', { hasText: 'Bài mẫu' }).hover();
  await sleep(300);
  await p.locator('.mb-item', { hasText: label }).first().click();
  await sleep(1500);
  await p.screenshot({ path: OUT + `${tag}-1-board.png` });
  await p.locator('[title="Vừa màn hình"], [aria-label="Vừa màn hình"]').first().click().catch((e) => logs.push('fit click failed ' + e.message.slice(0, 80)));
  await sleep(600);
  await p.mouse.click(1074, 398); await sleep(200);
  for (let z = 0; z < 4; z++) { await p.mouse.click(274, 550); await sleep(200); }
  await sleep(500);
  await p.screenshot({ path: OUT + `${tag}-1b-board-fit.png` });
  await p.locator('[data-tut="play"]').click();
  await sleep(1500);
  await p.locator('button, [role=tab]', { hasText: 'Màn chơi' }).first().click().catch(() => {});
  let k = 2;
  for (const w of waits) {
    await sleep(w);
    await p.screenshot({ path: OUT + `${tag}-${k}-run.png` });
    k++;
  }
  await p.close();
}
console.log('LOGS', JSON.stringify(logs));
await b.close();
