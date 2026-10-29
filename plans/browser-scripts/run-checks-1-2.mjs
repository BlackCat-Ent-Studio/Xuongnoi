import { openBrowser, openSample, gameText, badges, record, sleep, results, URL, SHOTS } from './common.mjs';

const { browser, page, logs } = await openBrowser();
try {
  // Check 1: editor loads
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.topbar', { timeout: 15000 });
  await sleep(800);
  await page.screenshot({ path: `${SHOTS}/01-editor-initial.png` });
  const parts = {
    topbar: await page.locator('.topbar').count(),
    palette: await page.locator('.palette').count(),
    canvas: await page.locator('.wc').count(),
    gameBox: await page.locator('.game-box').count(),
    gameCanvas: await page.locator('.game-box canvas').count(),
    props: await page.locator('.props').count(),
    paletteItems: await page.locator('.palette-item').count(),
  };
  record('1 editor loads', Object.values(parts).every((v) => v > 0) && parts.paletteItems >= 10,
    JSON.stringify(parts));
  record('1 no console errors at startup', logs.length === 0, logs.join(' || ') || 'none');

  // Check 2: side-stars sample
  await openSample(page, 'side-stars');
  await page.screenshot({ path: `${SHOTS}/02-side-stars-preview.png` });
  const previewBoxes = await page.evaluate(() => (document.querySelector('.game-box canvas') ? 'canvas' : 'none'));
  record('2 side-stars preview renders canvas', previewBoxes === 'canvas', `canvas=${previewBoxes}, logs=${logs.length}`);

  await page.locator('#btn-play').click();
  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/03-side-stars-playing-idle.png` });
  const idleBadges = await badges(page);
  record('2 side-stars play starts (Sửa label)', (await page.locator('#btn-play').innerText()).includes('Sửa'),
    `badges=${JSON.stringify(idleBadges)}`);

  // Hold right arrow, check the stick badge reacts and the character moves (screenshot diff done offline)
  await page.keyboard.down('ArrowRight');
  await sleep(900);
  const rightBadges = await badges(page);
  await page.screenshot({ path: `${SHOTS}/04-side-stars-moving-right.png` });
  await page.keyboard.up('ArrowRight');
  record('2 ArrowRight drives stick badge', rightBadges.some((t) => t.includes('1.00')), `badges=${JSON.stringify(rightBadges)}`);

  await page.keyboard.down('Space');
  await sleep(250);
  const jumpBadges = await badges(page);
  await page.screenshot({ path: `${SHOTS}/05-side-stars-jump.png` });
  await page.keyboard.up('Space');
  record('2 Space drives key -> jump badge', jumpBadges.some((t) => t.includes('Đúng')), `badges=${JSON.stringify(jumpBadges)}`);

  // Walk into the pit -> expect loss
  await page.keyboard.down('ArrowRight');
  let lost = false;
  const t0 = Date.now();
  while (Date.now() - t0 < 15000) {
    if ((await gameText(page)).includes('Thua!')) { lost = true; break; }
    await sleep(250);
  }
  await page.keyboard.up('ArrowRight');
  await page.screenshot({ path: `${SHOTS}/06-side-stars-lose.png` });
  record('2 fall/pit -> "Thua!" overlay', lost, `text=${JSON.stringify((await gameText(page)).slice(0, 200))}`);

  // Chơi lại
  await page.locator('button', { hasText: 'Chơi lại' }).click();
  await sleep(900);
  const afterRestart = await gameText(page);
  record('2 Chơi lại restarts (overlay gone)', !afterRestart.includes('Thua!') && !afterRestart.includes('Thắng!'), `text=${JSON.stringify(afterRestart.slice(0, 120))}`);
  await page.keyboard.down('ArrowRight');
  await sleep(600);
  await page.keyboard.up('ArrowRight');
  const afterRestartBadges = await badges(page);
  record('2 Chơi lại: input still drives game', afterRestartBadges.some((t) => t.includes('1.00')), JSON.stringify(afterRestartBadges));

  // Sửa returns to edit
  await page.locator('#btn-play').click();
  await sleep(700);
  const label = await page.locator('#btn-play').innerText();
  record('2 Sửa returns to edit mode', label.includes('Chơi') && !label.includes('Sửa'), `label=${label}`);
  await page.screenshot({ path: `${SHOTS}/07-side-stars-back-to-edit.png` });
  record('2 console errors after side-stars session', logs.length === 0, logs.join(' || ') || 'none');
} catch (e) {
  record('RUN ERROR', false, String(e && e.stack ? e.stack : e));
  await page.screenshot({ path: `${SHOTS}/error-run1.png` }).catch(() => {});
} finally {
  console.log('LOGS:', JSON.stringify(logs, null, 1));
  await browser.close();
}
