import { openBrowser, openSample, sleep, URL, SCRATCH } from './common.mjs';
import fs from 'node:fs';
const OUT = `${SCRATCH}/styles`;
fs.mkdirSync(OUT, { recursive: true });
const LOOKS = ['human', 'robot', 'cat', 'chick', 'jelly', 'dino'];
const { browser, page, logs } = await openBrowser();
const cells = {};
try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.topbar', { timeout: 15000 });
  await sleep(500);
  if (await page.locator('[data-tut="invite-no"]').isVisible()) await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);

  for (const look of LOOKS) {
    await openSample(page, 'side-stars');
    await sleep(500);
    await page.locator('.wc-node[data-kind="character"] .wc-node-head').first().click();
    await sleep(300);
    if (look === 'human') await page.screenshot({ path: `${OUT}/panel-picker.png` });
    // keyboard-free click on the tile
    await page.locator(`.look-tile[data-look="${look}"]`).click();
    await sleep(400);
    const checked = await page.locator(`.look-tile[data-look="${look}"]`).getAttribute('aria-checked');
    console.log(look, 'aria-checked', checked);
    await page.screenshot({ path: `${OUT}/panel-${look}.png`, clip: { x: 1000, y: 60, width: 440, height: 600 } });
    await page.locator('#btn-play').click();
    await sleep(900);
    await page.mouse.move(700, 400);
    await page.mouse.wheel(0, -2500);
    await sleep(500);
    const box = page.locator('.game-box');
    const grab = async (name) => {
      const buf = await box.screenshot();
      fs.writeFileSync(`${OUT}/${look}-${name}.png`, buf);
      (cells[look] ??= {})[name] = buf.toString('base64');
    };
    await grab('idle');
    await page.keyboard.down('ArrowRight');
    await sleep(450);
    await grab('walk');
    await sleep(110);
    await grab('walk2');
    await page.keyboard.up('ArrowRight');
    await sleep(500);
    await page.keyboard.down('Space');
    await sleep(250);
    await grab('jump');
    await page.keyboard.up('Space');
    await sleep(900);
    await page.locator('#btn-play').click();
    await sleep(400);
  }

  // montage page
  const names = ['idle', 'walk', 'walk2', 'jump'];
  const html = `<body style="margin:0;background:#fff;font:14px sans-serif"><table cellspacing=2>${LOOKS.map(
    (l) => `<tr><td>${l}</td>${names.map((n) => `<td><img width=300 src="data:image/png;base64,${cells[l][n]}"></td>`).join('')}</tr>`,
  ).join('')}</table></body>`;
  const p2 = await page.context().newPage();
  await p2.setViewportSize({ width: 1300, height: 1250 });
  await p2.setContent(html);
  await sleep(500);
  await p2.screenshot({ path: `${OUT}/montage.png`, fullPage: true });
  console.log('logs', JSON.stringify(logs).slice(0, 1200));
} catch (e) {
  console.log('ERR', e);
} finally {
  await browser.close();
}
