// Lists the Bảng tin issue rows ("Việc cần sửa") for every bundled sample. A shipped sample should have none.
import { openBrowser, sleep } from './common.mjs';

const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
const labels = (await page.locator('.mb-item .mb-label').allInnerTexts()).filter((l) => /\(|Nhảy cóc|Mê cung/.test(l));
await page.keyboard.press('Escape');
for (const label of labels) {
  await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await page.locator('.mb-item', { hasText: label }).first().click();
  await sleep(600);
  const rows = await page.locator('.cs-issue').allInnerTexts().catch(() => []);
  const tab = await page.locator('#tab-console').innerText();
  console.log(`${label} | tab="${tab.replace(/\s+/g, ' ')}" | ${JSON.stringify(rows)}`);
}
console.log('console logs:', JSON.stringify(logs));
await browser.close();
