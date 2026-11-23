// The first-launch invite must disappear when a lesson is started some other way (launchpad), and stay gone after a reload.
import { openBrowser, sleep, record } from './common.mjs';

const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1000);
record('invite shown on first launch', await page.locator('.tut-invite').isVisible(), '');
await page.locator('[data-launch="learn"]').click();
await sleep(600);
record('invite hidden once a lesson started', !(await page.locator('.tut-invite').isVisible()), '');
await page.reload();
await sleep(1000);
record('invite not back after reload', !(await page.locator('.tut-invite').isVisible()), '');
record('no console errors', logs.length === 0, JSON.stringify(logs));
await browser.close();
