// Combined check after merging pack models: city 3D close-up while driving + FPS, then every sample once.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');

const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-pack-combined/';
const URL = 'http://localhost:5173/';
const errors = [];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const SAMPLE_LABELS = ['Nhặt sao', 'Thu thập', 'Nhảy cóc 3D', 'Chìa khoá và cánh cửa', 'Cuốc đá mở đường', 'Lính gác', 'Bot dọn dẹp',
  'Mê cung', 'Bot leo bục', 'Võ đài', 'Đua xe về đích', 'Xúc xắc và vùng', 'Cổng dịch chuyển', 'Né và bắn',
  'Thành phố giao hàng (lái', 'Thành phố giao hàng 3D'];

async function openSample(index) {
  const label = SAMPLE_LABELS[index];
  if (!label) return null;
  await page.goto(URL);
  await page.waitForTimeout(1500);
  const no = page.locator('[data-tut="invite-no"]');
  if (await no.isVisible().catch(() => false)) await no.click();
  await page.getByRole('button', { name: 'Tệp' }).first().click();
  await page.getByText('Mở game mẫu').first().click();
  await page.waitForTimeout(400);
  await page.getByText(label).first().click();
  await page.waitForTimeout(1500);
  await page.locator('text=Màn chơi >> visible=true').first().click();
  await page.waitForTimeout(5000);
  return label;
}

async function fps(ms) {
  return page.evaluate((ms) => new Promise((ok) => {
    let n = 0; const t0 = performance.now();
    const f = () => { n++; if (performance.now() - t0 < ms) requestAnimationFrame(f); else ok(Math.round((n * 1000) / ms)); };
    requestAnimationFrame(f);
  }), ms);
}

const mode = process.argv[2] ?? 'all';
if (mode === 'all' || mode === 'city') {
  // city-delivery-3d by title
  await page.goto(URL);
  await page.waitForTimeout(1500);
  const no = page.locator('[data-tut="invite-no"]');
  if (await no.isVisible().catch(() => false)) await no.click();
  await page.getByRole('button', { name: 'Tệp' }).first().click();
  await page.getByText('Mở game mẫu').first().click();
  await page.waitForTimeout(400);
  await page.getByText('Thành phố giao hàng 3D').first().click();
  await page.waitForTimeout(1500);
  await page.locator('text=Màn chơi >> visible=true').first().click();
  await page.waitForTimeout(8000);
  await page.screenshot({ path: OUT + 'city-edit.png' });
  console.log('edit fps', await fps(3000));
  await page.locator('[data-tut="play"]').click();
  await page.waitForTimeout(4000);
  await page.getByText('Bấm để lái xe').first().click().catch(() => undefined);
  await page.waitForTimeout(800);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1800);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(1500);
  await page.keyboard.up('KeyW');
  await page.screenshot({ path: OUT + 'city-drive.png' });
  console.log('play fps', await fps(3000));
  await page.mouse.move(700, 400);
  for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -400);
  await page.waitForTimeout(800);
  await page.screenshot({ path: OUT + 'city-drive-zoom.png' });
}
if (mode === 'all' || mode === 'samples') {
  for (let i = 0; i < 20; i++) {
    const label = await openSample(i);
    if (!label) break;
    await page.screenshot({ path: `${OUT}sample-${String(i).padStart(2, '0')}.png` });
    console.log(i, label);
  }
}
console.log('ERRORS', JSON.stringify(errors.slice(0, 20)));
await browser.close();
