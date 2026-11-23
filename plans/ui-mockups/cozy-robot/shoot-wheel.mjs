const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const dir = 'D:/workspace/GameBuilder/plans/ui-mockups/cozy-robot/';
const url = 'file:///' + dir + 'robot-wheel.html';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForSelector('#tris:not(:empty)', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: dir + 'shots-wheel/default.png' });
for (const [name, label, wait] of [['run', 'Chạy', 1200], ['jump-a', 'Nhảy', 400], ['jump-b', 'Nhảy', 450], ['happy', 'Vui', 1500], ['sad', 'Buồn', 1800]]) {
  if (name !== 'jump-b') await page.click(`button:has-text("${label}")`);
  await page.waitForTimeout(wait);
  await page.screenshot({ path: dir + `shots-wheel/${name}.png`, clip: { x: 0, y: 0, width: 900, height: 800 } });
}
await page.setViewportSize({ width: 400, height: 800 });
await page.click('button:has-text("Đứng yên")');
await page.waitForTimeout(1200);
await page.screenshot({ path: dir + 'shots-wheel/phone.png', fullPage: true });
const sw = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
console.log('scrollWidth/innerWidth', sw);
console.log(logs.join('\n') || 'no console errors');
await browser.close();
