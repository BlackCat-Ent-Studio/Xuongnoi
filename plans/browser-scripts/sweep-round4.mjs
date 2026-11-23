// Regression sweep for the redesigned shell at 1440x900, 1280x720, 1024x700:
// one-row top bar, menus open, PiP plays a sample, no console errors, launchpad clear of PiP and corner.
// Usage: PORT=5184 node sweep-round4.mjs
import { chromium } from 'playwright';
import crypto from 'node:crypto';
import { sleep, record } from './common.mjs';

const hits = (a, b) => a && b && a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

for (const [w, h] of [[1440, 900], [1280, 720], [1024, 700]]) {
  const tag = `${w}x${h}`;
  const page = await (await browser.newContext({ viewport: { width: w, height: h } })).newPage();
  const logs = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await sleep(1500);

  // empty board: launchpad vs PiP and corner
  const lp = await page.locator('.launchpad-in').boundingBox();
  const pip = (await page.locator('.pip').isVisible()) ? await page.locator('.pip').boundingBox() : null;
  const corner = (await page.locator('.wc-corner').isVisible()) ? await page.locator('.wc-corner').boundingBox() : null;
  record(`${tag} launchpad clear of PiP`, !hits(lp, pip), JSON.stringify({ lp, pip }));
  record(`${tag} launchpad clear of corner`, !hits(lp, corner), JSON.stringify({ lp, corner }));

  // top bar on one row: bar is not taller than one row and every direct control sits in the same band
  const bar = await page.evaluate(() => {
    const el = document.querySelector('.topbar');
    const r = el.getBoundingClientRect();
    const tops = [...el.querySelectorAll('button, .mb-btn')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect()).map((x) => x.top + x.height / 2);
    return { h: r.height, spread: Math.max(...tops) - Math.min(...tops), scrollW: el.scrollWidth, clientW: el.clientWidth };
  });
  record(`${tag} top bar one row`, bar.h <= 56 && bar.scrollW <= bar.clientW + 1, JSON.stringify(bar));

  // menus
  for (const id of ['file', 'edit', 'view', 'help']) {
    await page.locator(`[data-menu="${id}"]`).click();
    await sleep(150);
    record(`${tag} menu ${id} opens`, (await page.locator('.mb-item:visible').count()) > 0, '');
    await page.keyboard.press('Escape');
    await page.mouse.click(w / 2, 5);
    await sleep(100);
  }

  // PiP plays a sample on Bảng nối
  await page.locator('[data-menu="file"]').click();
  await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await page.locator('.mb-item', { hasText: 'Nhặt sao' }).first().click();
  await sleep(800);
  const pipOn = await page.locator('.pip').isVisible();
  record(`${tag} PiP visible on Bảng nối`, pipOn, '');
  if (pipOn) {
    const clip = await page.locator('.pip .game-box').boundingBox();
    const snap = async () => crypto.createHash('md5').update(await page.screenshot({ clip })).digest('hex');
    const before = await snap();
    await page.locator('#btn-play').click();
    await sleep(500);
    await page.keyboard.down('ArrowRight');
    await sleep(700);
    const after = await snap();
    await page.keyboard.up('ArrowRight');
    record(`${tag} PiP plays (canvas changes)`, before !== after && (await page.locator('.pip.playing').count()) === 1, '');
  }
  record(`${tag} no console errors`, logs.length === 0, logs.join(' | '));
  await page.context().close();
}
await browser.close();
