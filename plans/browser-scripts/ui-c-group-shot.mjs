// Group cards and the inside of a group (stubs, breadcrumb) in the new look.
import { launch, openEditor, openSample, sleep } from './ui-c-lib.mjs';
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder-ui-c/plans/reports/shots-ui-c-step1/';
fs.mkdirSync(OUT, { recursive: true });
const b = await launch();
for (const [theme, mode] of [['light', 'student'], ['dark', 'teacher']]) {
  const { page, ctx } = await openEditor(b, { theme, mode, width: 1440, height: 900 });
  await openSample(page, 'Robot đi hình vuông');
  await page.locator('.wc').click({ position: { x: 30, y: 30 } });
  // group the first six cards: click one, ctrl+click the rest
  const heads = page.locator('.wc-node .wc-node-head');
  await heads.nth(0).click();
  for (let i = 1; i < 6; i++) await heads.nth(i).click({ modifiers: ['Shift'] }).catch(() => {});
  await page.keyboard.press('Control+g'); await sleep(600);
  await page.locator('.wc-rail button[aria-label*="Vừa"], .wc-rail button[title*="Vừa"]').first().click().catch(() => {}); await sleep(500);
  await page.screenshot({ path: `${OUT}group-${theme}-${mode}-1-closed.png` });
  const grp = page.locator('.wc-group').first();
  if (await grp.count()) {
    await grp.locator('.wc-node-head').dblclick({ position: { x: 60, y: 10 } }); await sleep(700);
    await page.locator('.wc-rail button[aria-label*="Vừa"], .wc-rail button[title*="Vừa"]').first().click().catch(() => {}); await sleep(500);
    await page.screenshot({ path: `${OUT}group-${theme}-${mode}-2-inside.png` });
  } else console.log('no group made');
  await ctx.close();
}
await b.close();
