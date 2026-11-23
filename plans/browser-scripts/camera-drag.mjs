import fs from 'node:fs';
import { openBrowser, openSample, sleep, record, SCRATCH } from './common.mjs';

const OUT = `${SCRATCH}/camera`;
const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').count()) await page.locator('[data-tut="invite-no"]').click();
await openSample(page, 'side-stars');
await sleep(500);
const box = page.locator('.game-box');
const r = await box.boundingBox();
// zoom in then pan
await page.mouse.move(r.x + 120, r.y + 160);
await page.mouse.wheel(0, -300);
await sleep(300);
await page.mouse.move(r.x + 300, r.y + 60);
await page.mouse.down();
await page.mouse.move(r.x + 250, r.y + 80, { steps: 5 });
await page.mouse.up();
await sleep(300);
await box.screenshot({ path: `${OUT}/drag-A-before.png` });
// star at approx (115,165) in default; find via pixel scan is heavy: use known star after zoom visible in image A, try point
const sx = Number(process.argv[2] ?? 0), sy = Number(process.argv[3] ?? 0);
if (sx && sy) {
  await page.mouse.move(r.x + sx, r.y + sy);
  await page.mouse.down();
  await page.mouse.move(r.x + sx + 30, r.y + sy - 50, { steps: 6 });
  await page.mouse.up();
  await sleep(500);
  await box.screenshot({ path: `${OUT}/drag-B-after.png` });
}
record('no console errors', logs.length === 0, logs.join(' || ') || 'none');
await browser.close();
