// Counts overlapping graph nodes in every bundled sample (edit view, 1440x900).
import { openBrowser, sleep } from './common.mjs';

const { browser, page } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
const labels = (await page.locator('.mb-item .mb-label').allInnerTexts()).filter((l) => /\(|Nhảy cóc|Mê cung/.test(l));
await page.keyboard.press('Escape');
for (const label of labels) {
  await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await page.locator('.mb-item', { hasText: label }).first().click();
  await sleep(600);
  const r = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('.wc-node')].map((n) => {
      const b = n.getBoundingClientRect();
      return { id: n.getAttribute('data-id'), x: b.x, y: b.y, w: b.width, h: b.height };
    });
    const pairs = [];
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i], b = boxes[j];
        if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) pairs.push(`${a.id}~${b.id}`);
      }
    return { nodes: boxes.length, pairs };
  });
  console.log(`${label.slice(0, 30)} | nodes=${r.nodes} | overlaps=${r.pairs.length} ${r.pairs.slice(0, 4).join(',')}`);
}
await browser.close();
