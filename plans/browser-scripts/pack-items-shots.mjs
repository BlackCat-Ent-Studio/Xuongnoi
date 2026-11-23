const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-pack-items';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
async function fresh() {
  await page.goto('http://localhost:5203/');
  await sleep(1500);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
}
async function open(label) {
  await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await page.locator('.mb-item', { hasText: label }).first().click();
  await sleep(2500);
}
for (const [id, label] of [['city3d', 'Thành phố giao hàng 3D'], ['keydoor', 'Chìa khoá và cánh cửa'], ['stars', 'Nhặt sao'], ['cleaner', 'Bot dọn dẹp'], ['pickaxe', 'Cuốc đá mở đường']]) {
  await fresh();
  await open(label);
  await page.locator('text=Màn chơi >> visible=true').first().click(); await sleep(1500);
  await page.screenshot({ path: `${OUT}/${id}-1-edit.png` });
  await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
  await sleep(2500);
  await page.keyboard.down('KeyD'); await sleep(1200); await page.keyboard.up('KeyD');
  await page.screenshot({ path: `${OUT}/${id}-2-play.png` });
  await sleep(3000);
  await page.screenshot({ path: `${OUT}/${id}-3-later.png` });
}
console.log(logs.join('\n') || 'no console errors');
await browser.close();
