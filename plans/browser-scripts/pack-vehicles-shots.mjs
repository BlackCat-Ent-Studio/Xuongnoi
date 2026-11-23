import { chromium } from 'file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs';

const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-pack-vehicles';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
await page.goto('http://localhost:5202/');
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) await page.locator('[data-tut="invite-no"]').click();
for (const [id, label] of [['city', 'Thành phố giao hàng 3D'], ['race', 'Đua xe về đích']]) {
  await page.locator('[data-menu="file"]').click();
  await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await page.locator('.mb-item', { hasText: label }).first().click();
  await sleep(1000);
  await page.screenshot({ path: `${OUT}/${id}-0-edit.png` });
  await page.evaluate(() => (document.querySelector('.app.playing') ? null : document.querySelector('[data-tut="play"]'))?.click());
  await page.locator('button, .tab, [role=tab]', { hasText: /^\s*Màn chơi\s*$/ }).first().click().catch(() => logs.push('tab click failed'));
  await sleep(1500);
  await page.mouse.click(581, 19);
  await sleep(800);
  await page.mouse.move(700, 360);
  for (let k = 0; k < 6; k++) { await page.mouse.wheel(0, -300); await sleep(100); }
  await sleep(1500);
  await page.getByText('Bấm để lái xe').click({ timeout: 3000 }).catch(() => {});
  await page.mouse.click(700, 500);
  await page.keyboard.down('KeyW');
  await sleep(1500);
  for (let i = 1; i <= 6; i++) { await sleep(2000); await page.screenshot({ path: `${OUT}/${id}-${i}.png`, clip: { x: 242, y: 74, width: 912, height: 576 } }); }
  await page.keyboard.up('KeyW');
  await page.evaluate(() => document.querySelector('.pbtn.stop')?.click());
  await sleep(800);
}
console.log(logs.join('\n') || 'no console errors');
await browser.close();
