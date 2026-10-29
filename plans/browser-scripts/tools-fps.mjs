import { openBrowser, sleep, openSample } from './common.mjs';
const { browser, page } = await openBrowser();
await page.goto('http://localhost:5173/');
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
await openSample(page, 'pickaxe-rock');
await page.locator('#btn-play').click();
await sleep(800);
console.log('fps sample 1440x900:', await fps());
await page.setViewportSize({ width: 1920, height: 1100 });
await sleep(500);
console.log('fps 1920x1100:', await fps());
await browser.close();
