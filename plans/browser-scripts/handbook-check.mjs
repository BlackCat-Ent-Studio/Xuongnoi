import { chromium } from 'playwright';

const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-handbook-final/';
const errors = [];
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto('http://localhost:5173/');
await page.waitForTimeout(1500);
// Dismiss a first-visit invite if shown.
const no = page.locator('[data-tut="invite-no"]');
if (await no.isVisible().catch(() => false)) await no.click();

async function openHandbook() {
  await page.getByRole('button', { name: 'Trợ giúp' }).first().click();
  await page.getByText('Sổ tay mảnh ghép', { exact: true }).first().click();
  await page.waitForSelector('.hb-modal');
}

await openHandbook();
await page.screenshot({ path: OUT + '1-levels.png' });
await page.fill('.hb-search', 'cam bien vung');
await page.waitForTimeout(300);
await page.locator('.hb-list .hb-row-label').first().click();
await page.waitForTimeout(300);
await page.screenshot({ path: OUT + '2-zone-page.png' });
const pageText = await page.locator('.hb-page').evaluate((e) => e.textContent ?? '');
console.log('PAGE_HAS_EXAMPLE', pageText.includes('Ví dụ'), 'HAS_TIPS', pageText.includes('Mẹo'));
await page.getByRole('button', { name: 'Thử ngay' }).click();
await page.waitForTimeout(800);
console.log('MODAL_CLOSED', !(await page.locator('.hb-modal').isVisible().catch(() => false)));
console.log('GAME_NAME', await page.locator('.top-bar, header').first().innerText().then((t) => t.split('\n').find((l) => l.includes('Thử')) ?? 'n/a'));
await page.screenshot({ path: OUT + '3-try-board.png' });
await page.locator('[data-tut="play"]').click();
await page.waitForTimeout(2500);
await page.screenshot({ path: OUT + '4-try-playing.png' });
await page.locator('.pbtn.stop').click();
await page.waitForTimeout(500);

await openHandbook();
await page.fill('.hb-search', 'phim bam');
await page.waitForTimeout(300);
await page.locator('.hb-list .hb-row-label').first().click();
const learn = page.locator('.hb-actions button', { hasText: 'Học trong bài' });
console.log('LEARN_BTN', await learn.innerText().catch(() => 'missing'));
await learn.click();
await page.waitForTimeout(1000);
await page.screenshot({ path: OUT + '5-lesson-started.png' });
console.log('ERRORS', JSON.stringify(errors));
await browser.close();
