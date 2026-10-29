import { openBrowser, sleep } from './common.mjs';
import { startLesson } from './tut-common.mjs';
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
for (const lesson of ['hand-tools']) {
  await startLesson(page, lesson);
  await page.locator('.tut-panel [data-tut="next"]').click();
  await sleep(300);
  console.log('panel', await page.locator('.tut-title').innerText(), 'hl', await page.locator('.tut-hl').count());
  console.log(lesson, 'fps editing', await fps());
  await page.locator('[data-tut="play"]').click();
  await sleep(800);
  console.log(lesson, 'fps playing', await fps());
  await page.locator('[data-tut="play"]').click();
  await sleep(400);
  await page.locator('.tut-panel [data-tut="exit"], .tut-panel :text("Thoát")').first().click().catch(() => {});
  await sleep(300);
}
await browser.close();
