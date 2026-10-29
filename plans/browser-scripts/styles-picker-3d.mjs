import { openBrowser, openSample, sleep, URL, SCRATCH } from './common.mjs';
const OUT = `${SCRATCH}/styles`;
const { browser, page, logs } = await openBrowser();
try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.topbar', { timeout: 15000 });
  await sleep(500);
  if (await page.locator('[data-tut="invite-no"]').isVisible()) await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
  await openSample(page, 'side-stars');
  await page.locator('.wc-node[data-kind="character"] .wc-node-head').first().click();
  await sleep(300);
  const picker = page.locator('.look-picker');
  await picker.scrollIntoViewIfNeeded();
  await picker.screenshot({ path: `${OUT}/picker-blue.png` });
  // keyboard: focus selected tile, ArrowRight twice -> cat
  await page.locator('.look-tile[aria-checked="true"]').focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  await sleep(200);
  console.log('after 2x ArrowRight checked =', await page.locator('.look-tile[aria-checked="true"]').getAttribute('data-look'),
    'focus on', await page.evaluate(() => document.activeElement?.dataset?.look));
  console.log('tabindex0 count', await page.locator('.look-tile[tabindex="0"]').count());
  // change color -> thumbnails refresh
  await page.locator('.prop-color').evaluate((el) => { el.value = '#e11d48'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await sleep(500);
  await picker.screenshot({ path: `${OUT}/picker-red.png` });

  // 3d-hop with robot
  await openSample(page, '3d-hop');
  await sleep(500);
  await page.locator('.wc-node[data-kind="character"] .wc-node-head').first().click();
  await sleep(300);
  await page.locator('.look-tile[data-look="cat"]').click();
  await sleep(300);
  await page.locator('#btn-play').click();
  await sleep(900);
  await page.mouse.move(1000, 400);
  await page.mouse.wheel(0, -900);
  await sleep(500);
  await page.keyboard.down('ArrowUp');
  await sleep(500);
  await page.locator('.game-box').screenshot({ path: `${OUT}/3d-hop-cat-walk.png` });
  await page.keyboard.down('Space');
  await sleep(250);
  await page.locator('.game-box').screenshot({ path: `${OUT}/3d-hop-cat-jump.png` });
  console.log('logs', JSON.stringify(logs).slice(0, 800));
} catch (e) {
  console.log('ERR', e);
} finally {
  await browser.close();
}
