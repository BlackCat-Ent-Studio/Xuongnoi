import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record, openSample, SCRATCH } from './common.mjs';

const SHOTS = `${SCRATCH}/pathfinding`;
mkdirSync(SHOTS, { recursive: true });
const { browser, page, logs } = await openBrowser();
const fresh = async () => {
  await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
  await sleep(1200);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
    await page.locator('[data-tut="invite-no"]').click();
    await sleep(300);
  }
};
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const body = () => page.locator('body').innerText();

// ---- maze chase: stand still, the bot must find its way through the walls ----
await fresh();
await openSample(page, 'maze-chase');
await shot('maze-1-edit');
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(1000);
await shot('maze-2-start');
let lost = false;
for (let i = 0; i < 30 && !lost; i++) {
  await sleep(500);
  if (i === 6) await shot('maze-3-mid');
  lost = (await body()).includes('bắt được');
}
await shot('maze-4-end');
record('maze: bot reaches the idle player through the maze', lost, lost ? 'lose message shown' : 'no lose');

// ---- platform bot: climbs to the star unattended ----
await fresh();
await openSample(page, 'platform-bot');
await shot('plat-1-edit');
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(600);
await shot('plat-2-start');
let won = false;
for (let i = 0; i < 40 && !won; i++) {
  await sleep(300);
  if (i === 4) await shot('plat-3-mid');
  won = (await body()).includes('ngôi sao');
}
await shot('plat-4-end');
record('platform bot wins unattended', won, won ? 'win message shown' : 'no win');

record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
