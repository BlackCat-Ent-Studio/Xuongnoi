// On a fresh empty board only the launchpad shows; the canvas's own empty hint is hidden behind it. After starting a blank game the hint returns.
import { openBrowser, sleep, record } from './common.mjs';

const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1000);
record('launchpad visible', await page.locator('.launchpad').isVisible(), '');
record('canvas hint hidden while launchpad shows', !(await page.locator('.wc-hint').isVisible()), '');
await page.locator('[data-launch="blank"]').click();
await sleep(300);
record('launchpad gone after Tự làm', !(await page.locator('.launchpad').isVisible()), '');
record('canvas hint back on the empty board', await page.locator('.wc-hint').isVisible(), '');
record('no console errors', logs.length === 0, JSON.stringify(logs));
await browser.close();
