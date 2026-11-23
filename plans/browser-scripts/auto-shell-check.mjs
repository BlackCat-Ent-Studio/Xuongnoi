// Auto-shell check: one 2D button + sub-switch, Bài mẫu menu, new-game dialog, lessons chapter order. Port 5263; BEFORE from 5256.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-auto-shell/';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
async function page(port, w, h) {
  const p = await b.newPage({ viewport: { width: w, height: h } });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  await p.goto(`http://localhost:${port}/`);
  await sleep(1500);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await sleep(1500);
  if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  return p;
}
const top = (p, name) => p.locator('header.topbar').screenshot({ path: OUT + name });
const mode = (p) => p.evaluate(() => document.querySelector('.seg-opt[aria-checked="true"]')?.dataset.mode + '|' + (document.querySelector('.sub2d')?.value ?? ''));

// BEFORE (main)
for (const [w, h, tag] of [[1440, 900, 'desktop'], [844, 390, 'phone']]) {
  const p = await page(5256, w, h);
  await top(p, `00-before-${tag}-topbar.png`);
  await p.close();
}
for (const [w, h, tag] of [[1440, 900, 'desktop'], [844, 390, 'phone']]) {
  const p = await page(5263, w, h);
  console.log(tag, 'fresh board mode', await mode(p));
  await p.screenshot({ path: OUT + `10-${tag}-full-fresh.png` });
  await top(p, `11-${tag}-topbar-3d.png`);
  await p.locator('.seg-opt[data-mode="2d"]').click(); await sleep(500);
  console.log(tag, 'after 2D click', await mode(p));
  await top(p, `12-${tag}-topbar-2d-side.png`);
  await p.locator('.sub2d').selectOption('2d-top'); await sleep(500);
  console.log(tag, 'sub = top', await mode(p));
  await top(p, `13-${tag}-topbar-2d-top.png`);
  await p.locator('.seg-opt[data-mode="3d"]').click(); await sleep(500);
  console.log(tag, '3d', await mode(p));
  await p.locator('.seg-opt[data-mode="2d"]').click(); await sleep(500);
  console.log(tag, 'back to 2D -> remembers top?', await mode(p));
  await p.locator('.sub2d').selectOption('2d-side'); await sleep(300);
  console.log(tag, 'sub = side', await mode(p));
  await p.locator('.seg-opt[data-mode="2d"]').focus(); await p.keyboard.press('ArrowRight'); await sleep(300);
  console.log(tag, 'arrow right', await mode(p));
  await p.locator('[data-menu="file"]').click(); await sleep(200);
  await p.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  await p.screenshot({ path: OUT + `20-${tag}-samples-menu.png` });
  console.log(tag, 'samples', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.mb-menu .mb-item')].map((e) => e.textContent.trim().slice(0, 40)))));
  await p.keyboard.press('Escape');
  await p.mouse.click(w / 2, h / 2); await sleep(200);
  await p.locator('[data-menu="file"]').click(); await sleep(200);
  await p.locator('.mb-item', { hasText: 'Tạo game mới' }).click(); await sleep(400);
  await p.screenshot({ path: OUT + `30-${tag}-new-game.png` });
  console.log(tag, 'new game order', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.mode-choice')].map((e) => e.dataset.mode))), 'focused', await p.evaluate(() => document.activeElement?.dataset?.mode));
  await p.keyboard.press('Escape'); await sleep(200);
  await p.locator('[data-tut="tutorial"]').click(); await sleep(500);
  await p.screenshot({ path: OUT + `40-${tag}-lessons-menu.png` });
  console.log(tag, 'chapters', JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.tut-chapter')].map((e) => e.textContent))));
  console.log(tag, 'menu count', await p.evaluate(() => document.querySelector('.tut-menu-count')?.textContent));
  await p.close();
}
console.log('console errors', JSON.stringify(logs));
await b.close();
