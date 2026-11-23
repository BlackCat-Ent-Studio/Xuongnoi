const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');

const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-pack-blocks/';
const samples = [
  ['city3d', 'Thành phố giao hàng 3D'],
  ['city2d', 'Thành phố giao hàng (lái xe tải'],
  ['pickaxe', 'Cuốc đá mở đường'],
  ['maze', 'Mê cung'],
];
const only = process.argv[2];
const errors = [];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
for (const [key, label] of samples) {
  if (only && only !== key) continue;
  await page.goto('http://localhost:5201/');
  await page.waitForTimeout(1500);
  const no = page.locator('[data-tut="invite-no"]');
  if (await no.isVisible().catch(() => false)) await no.click();
  await page.getByRole('button', { name: 'Tệp' }).first().click();
  await page.getByText('Mở game mẫu').first().click();
  await page.waitForTimeout(300);
  await page.getByText(label).first().click();
  await page.waitForTimeout(1500);
  await page.locator('text=Màn chơi >> visible=true').first().click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: OUT + key + '-edit.png' });
  await page.locator('[data-tut="play"]').click();
  await page.waitForTimeout(5000);
  await page.screenshot({ path: OUT + key + '-play.png' });
}
console.log('ERRORS', JSON.stringify(errors.slice(0, 15)));
await browser.close();
