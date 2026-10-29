import { openBrowser, sleep, openSample } from './common.mjs';
const { browser, page } = await openBrowser();
await page.goto('http://localhost:5173/');
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
for (const id of ['side-stars', 'cleaner-bot']) {
  await openSample(page, id);
  await page.locator('[data-tut="play"]').click();
  await sleep(800);
  const frames = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => {
          n++;
          if (performance.now() - t0 < 2000) requestAnimationFrame(f);
          else res(n / 2);
        };
        requestAnimationFrame(f);
      }),
  );
  console.log(id, 'fps', frames);
  await page.locator('[data-tut="play"]').click();
  await sleep(300);
}
await browser.close();
