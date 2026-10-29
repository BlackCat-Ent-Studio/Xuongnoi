import { openBrowser, sleep, openSample } from './common.mjs';
const { browser, page } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) await page.locator('[data-tut="invite-no"]').click();
const fps = () =>
  page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => {
          n++;
          if (performance.now() - t0 < 1000) requestAnimationFrame(f);
          else res(n);
        };
        requestAnimationFrame(f);
      }),
  );
for (const sample of ['key-door', 'pickaxe-rock']) {
  await openSample(page, sample);
  await page.locator('.wc-node[data-kind="key"] .wc-node-head').nth(2).click();
  await sleep(300);
  await page.locator('#btn-play').click();
  await sleep(800);
  console.log(sample, 'selected key + play fps', await fps());
  await page.keyboard.down('ArrowRight');
  await sleep(500);
  console.log(sample, 'moving fps', await fps());
  await page.keyboard.up('ArrowRight');
  await page.locator('#btn-play').click();
  await sleep(300);
}
await browser.close();
