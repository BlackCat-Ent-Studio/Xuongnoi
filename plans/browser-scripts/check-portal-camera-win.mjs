import { chromium } from 'playwright';

const OUT = 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/sweep';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('dialog', (d) => d.dismiss());

await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}

await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
await page.locator('.mb-item', { hasText: 'Cổng dịch chuyển' }).first().click();
await sleep(900);
await page.locator('#btn-play').click();
await sleep(600);

// hold right the whole run, tap Space every ~1.2 s to clear the pit edge
await page.keyboard.down('ArrowRight');
const t0 = Date.now();
let overlay = '';
let lastTap = 0;
let sawPortalText = '';
let i = 0;
while (Date.now() - t0 < 40000 && !overlay) {
  await sleep(200);
  if (Date.now() - lastTap > 1200) {
    await page.keyboard.press('Space');
    lastTap = Date.now();
  }
  const txt = (await page.locator('.game-box').innerText().catch(() => '')).replace(/\s+/g, ' ');
  if (i % 10 === 0) console.log(`t=${Math.round((Date.now() - t0) / 1000)}s ${txt.slice(0, 140)}`);
  if (/Thắng|Thua|đích/i.test(txt.replace(/Chạm cổng tím.*?về lại./, ''))) overlay = txt.slice(0, 160);
  i++;
}
await page.keyboard.up('ArrowRight');
await page.screenshot({ path: `${OUT}/04-portal-camera-end.png` });
console.log(overlay ? `PASS | portal-camera win overlay | ${overlay}` : 'FAIL | portal-camera no win overlay in 40s');
console.log('LOGS', JSON.stringify(logs));
await browser.close();
