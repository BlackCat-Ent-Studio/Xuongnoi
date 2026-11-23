// Every menu sample, fit to screen, in both modes (light) and one dark: shows the re-laid-out shipped boards.
import { launch, openEditor, sleep } from './ui-c-lib.mjs';
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder-ui-c/plans/reports/shots-ui-c-step1/samples/';
fs.mkdirSync(OUT, { recursive: true });
const b = await launch();
for (const [theme, mode] of [['light', 'student'], ['light', 'teacher'], ['dark', 'student']]) {
  const { page, ctx } = await openEditor(b, { theme, mode, width: 1600, height: 1000 });
  await page.locator('[data-menu="file"]').click(); await sleep(200);
  await page.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  const labels = await page.$$eval('.mb-sub .mb-item', (els) => els.map((e) => e.textContent.trim()));
  await page.keyboard.press('Escape');
  let i = 0;
  for (const l of labels) {
    i++;
    await page.locator('[data-menu="file"]').click(); await sleep(200);
    await page.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
    await page.locator('.mb-sub .mb-item', { hasText: l }).first().click(); await sleep(1400);
    await page.locator('.wc-rail button[aria-label*="Vừa"], .wc-rail button[title*="Vừa"]').first().click(); await sleep(600);
    await page.screenshot({ path: `${OUT}${theme}-${mode}-${i}.png` });
  }
  await ctx.close();
}
await b.close();
