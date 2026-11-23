import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record, openSample, SCRATCH } from './common.mjs';
const SHOTS = `${SCRATCH}/job1`;
mkdirSync(SHOTS, { recursive: true });
const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
const shot = (n) => page.locator('.game-box').screenshot({ path: `${SHOTS}/${n}.png` });
await openSample(page, 'key-door');
await page.locator('#btn-play').click();
await sleep(900);
await page.keyboard.down('ArrowRight');
await sleep(2300);
await page.keyboard.up('ArrowRight');
await sleep(300);
await shot('j1-kd-hint');
const hint = page.locator('.game-box div', { hasText: /^Bấm F để mở$/ });
record('floating hint is in the DOM', (await hint.count()) >= 1, String(await hint.count()));
const b = await hint.first().boundingBox();
record('hint has a position inside the view', !!b && b.x > 0 && b.y > 0, JSON.stringify(b));
// grab the key, open the door: hint stays, door hidden
await page.keyboard.press('KeyE');
await sleep(300);
await page.keyboard.down('ArrowRight');
await sleep(1500);
await page.keyboard.up('ArrowRight');
await page.keyboard.press('KeyF');
await sleep(400);
await shot('j1-kd-opened');
record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
