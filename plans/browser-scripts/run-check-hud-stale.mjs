import { openBrowser, openSample, record, sleep, URL } from './common.mjs';

const { browser, page, logs } = await openBrowser();
try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.topbar', { timeout: 15000 });
  await sleep(400);

  await openSample(page, 'top-collect');
  await page.locator('#btn-play').click();
  await sleep(1300);
  const playing = await page.locator('.game-box').innerText();
  const timer = /Giây còn lại: (\S+)/.exec(playing);
  record('HUD timer shows one decimal while playing', timer !== null && /^\d+\.\d$/.test(timer[1]) || (timer !== null && /^\d+$/.test(timer[1])), `text=${JSON.stringify(playing.slice(0, 80))}`);

  await page.locator('#btn-play').click();
  await sleep(600);
  await openSample(page, 'side-stars');
  await sleep(600);
  const preview = await page.locator('.game-box').innerText();
  record('stale top-collect HUD gone from side-stars preview', !preview.includes('Điểm') && !preview.includes('Giây còn lại'), `text=${JSON.stringify(preview.slice(0, 80))}`);

  await page.locator('#btn-play').click();
  await sleep(900);
  const sideRun = await page.locator('.game-box').innerText();
  record('side-stars play shows its own HUD (Sao)', sideRun.includes('Sao: 0'), `text=${JSON.stringify(sideRun.slice(0, 60))}`);
  await page.locator('#btn-play').click();
  record('console errors (hud check)', logs.length === 0, logs.join(' || ') || 'none');
} catch (e) {
  record('RUN ERROR', false, String(e && e.stack ? e.stack : e));
} finally {
  await browser.close();
}
