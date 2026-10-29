import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record, openSample, SCRATCH } from './common.mjs';

const SHOTS = `${SCRATCH}/items`;
mkdirSync(SHOTS, { recursive: true });
const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
// dismiss tutorial invite if shown
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const tap = async (code, ms = 60) => {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
};
const walk = async (ms, code = 'ArrowRight') => {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
};

await openSample(page, 'key-door');
await shot('01-edit-keydoor');
const palette = await page.locator('.palette-cat').allInnerTexts();
record('palette has Hành động category', palette.some((t) => t.includes('Hành động')), palette.join(','));
record('palette has item/carry/interact', (await page.locator('.palette-item[data-kind="item"], .palette-item[data-kind="carry"], .palette-item[data-kind="interact"]').count()) === 3, '');

await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(800);
await shot('02-start');
await walk(600); // to about x=-3
await sleep(150);
await tap('KeyE');
await sleep(300);
await shot('03-holding');
await walk(150);
await tap('KeyQ');
await sleep(180);
await shot('04-thrown-in-air');
await sleep(1200);
await shot('05-thrown-landed');
await walk(1300); // run up to the door where the key landed
await sleep(150);
await shot('05b-at-door-key-on-floor');
await tap('KeyE');
await sleep(250);
await shot('06-at-door-holding');
await tap('KeyF');
await sleep(500);
await shot('07-door-gone');
await walk(1800);
await sleep(800);
await shot('08-win');
const body = await page.locator('body').innerText();
record('win message shown', body.includes('thắng rồi'), body.includes('thắng rồi') ? 'yes' : 'no');

console.log('LOGS:', JSON.stringify(logs));
record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
