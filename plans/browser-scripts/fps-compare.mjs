import { openBrowser, sleep, openSample } from './common.mjs';
const port = process.argv[2];
const { browser, page } = await openBrowser();
await page.goto(`http://localhost:${port}/`);
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
const out = [];
for (const id of ['side-stars', 'key-door']) {
  await openSample(page, id);
  await page.locator('[data-tut="play"]').click();
  await sleep(800);
  const fps = await page.evaluate(
    () =>
      new Promise((res) => {
        let n = 0;
        const t0 = performance.now();
        const f = () => {
          n++;
          if (performance.now() - t0 < 2500) requestAnimationFrame(f);
          else res(n / 2.5);
        };
        requestAnimationFrame(f);
      }),
  );
  out.push(`${id}=${fps.toFixed(1)}`);
  await page.locator('[data-tut="play"]').click();
  await sleep(300);
}
console.log(`port ${port} fps ${out.join(' ')}`);
await browser.close();
