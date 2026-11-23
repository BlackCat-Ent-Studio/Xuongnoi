import { chromium } from 'playwright';

const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-board-final/';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto('http://localhost:5173/');
await page.waitForTimeout(1500);
const no = page.locator('[data-tut="invite-no"]');
if (await no.isVisible().catch(() => false)) await no.click();
await page.getByRole('button', { name: 'Tệp' }).first().click();
await page.getByText('Mở game mẫu').first().click();
await page.waitForTimeout(300);
await page.getByText('Nhặt sao (nhảy 2D)').first().click();
await page.waitForTimeout(1200);
await page.getByText('Bảng nối', { exact: true }).first().click().catch(() => {});
await page.waitForTimeout(800);
await page.screenshot({ path: OUT + '1-edit.png' });
await page.locator('[data-tut="play"]').click();
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT + '2-play.png' });
await page.keyboard.up('ArrowRight');
const audit = await page.evaluate(() => {
  let out = 0, total = 0;
  for (const dot of document.querySelectorAll('.wc-node .wc-dot')) {
    const card = dot.closest('.wc-node');
    const a = dot.getBoundingClientRect(), b = card.getBoundingClientRect();
    total++;
    if (a.left < b.left - 0.5 || a.right > b.right + 0.5) out++;
  }
  return { total, out, live: document.querySelectorAll('[data-live="on"]').length, hot: document.querySelectorAll('.wc-node.is-hot').length };
});
console.log('AUDIT', JSON.stringify(audit));
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
