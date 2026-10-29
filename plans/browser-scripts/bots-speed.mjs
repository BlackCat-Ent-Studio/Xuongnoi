import { openBrowser, sleep, openSample } from './common.mjs';
const { browser, page } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
await page.locator('[data-tut="invite-no"]').click().catch(() => {});
await openSample(page, 'top-collect');
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
const t0 = Date.now();
for (let k = 0; k < 4; k++) {
  await sleep(1000);
  console.log(((Date.now() - t0) / 1000).toFixed(2), JSON.stringify(await page.locator('.game-box').innerText()));
}
await browser.close();
