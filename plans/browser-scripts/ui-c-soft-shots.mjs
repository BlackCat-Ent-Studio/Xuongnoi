// Light theme "Xám dịu": empty, robot, sorter with a card selected, running, handbook, a menu open; both modes; plus legend containment.
import { launch, openEditor, openSample, fit, sleep } from './ui-c-lib.mjs';
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-ui-c-main/';
fs.mkdirSync(OUT, { recursive: true });
const b = await launch();
for (const mode of ['student', 'teacher']) {
  for (const w of [1440, 1024]) {
    const { page, ctx } = await openEditor(b, { theme: 'light', mode, width: w, height: w === 1440 ? 900 : 768 });
    const tag = `${mode}-${w}`;
    const legend = await page.evaluate(() => { const l = document.querySelector('.wc-legend'); const r = l.getBoundingClientRect(); return l.scrollWidth <= l.clientWidth + 1 && [...l.children].every((c) => c.getBoundingClientRect().right <= r.right + 0.5); });
    console.log(tag, 'legend contains its words:', legend);
    if (w !== 1440) { await ctx.close(); continue; }
    await page.screenshot({ path: `${OUT}${tag}-1-empty.png` });
    await openSample(page, 'Robot dò đường'); await fit(page);
    await page.screenshot({ path: `${OUT}${tag}-2-robot.png` });
    await openSample(page, 'Băng chuyền phân loại'); await fit(page);
    await page.locator('.wc-node .wc-node-head').nth(2).click(); await sleep(500);
    await page.screenshot({ path: `${OUT}${tag}-3-sorter-selected.png` });
    await page.locator('.wc').click({ position: { x: 20, y: 120 } }).catch(() => {});
    await page.locator('[data-tut="play"]').click(); await sleep(4000);
    await page.screenshot({ path: `${OUT}${tag}-4-running.png` });
    await page.locator('.pbtn.stop').click(); await sleep(500);
    await page.locator('[data-menu="help"]').click(); await sleep(200);
    await page.locator('.mb-item', { hasText: 'Sổ tay mảnh ghép' }).click(); await sleep(900);
    await page.screenshot({ path: `${OUT}${tag}-5-handbook.png` });
    await page.keyboard.press('Escape'); await page.locator('.hb-head button, .modal-overlay .btn').first().click().catch(() => {}); await sleep(300);
    await page.locator('[data-menu="view"]').click(); await sleep(300);
    await page.screenshot({ path: `${OUT}${tag}-6-menu.png` });
    await ctx.close();
  }
}
await b.close();
