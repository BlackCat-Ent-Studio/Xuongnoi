import { openBrowser, openSample, gameText, record, sleep, URL, SHOTS } from './common.mjs';

// Engine probe (60 Hz ticks): left 30 ticks, then Space held 2 ticks every 40 ticks, offset 0 -> win.
// Browser ticks follow requestAnimationFrame, so the cadence is approximate: 500 ms left, Space 33 ms every 667 ms.
const { browser, page, logs } = await openBrowser();
const saoOf = (t) => {
  const m = /Sao: (\d+)/.exec(t);
  return m ? Number(m[1]) : null;
};

try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.topbar', { timeout: 15000 });
  await sleep(500);
  await openSample(page, 'side-stars');
  await page.locator('#btn-play').click();
  await sleep(900);

  let won = false;
  let best = 0;
  for (const offsetMs of [0, 120, 260]) {
    if ((await gameText(page)).includes('Chơi lại')) {
      await page.locator('button', { hasText: 'Chơi lại' }).click();
      await sleep(900);
    }
    await page.keyboard.down('ArrowLeft');
    await sleep(500);
    await page.keyboard.up('ArrowLeft');
    await sleep(200);

    await page.keyboard.down('ArrowRight');
    await sleep(offsetMs);
    const trace = [];
    const t0 = Date.now();
    let outcome = 'timeout';
    while (Date.now() - t0 < 16000) {
      await page.keyboard.down('Space');
      await sleep(33);
      await page.keyboard.up('Space');
      await sleep(634);
      const txt = await gameText(page);
      const s = saoOf(txt);
      trace.push(`${Math.round((Date.now() - t0) / 100) / 10}s:${s}`);
      if (s !== null) best = Math.max(best, s);
      if (txt.includes('Thắng!')) { outcome = 'win'; break; }
      if (txt.includes('Thua!')) { outcome = 'lose'; break; }
    }
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('Space');
    await sleep(200);
    await page.screenshot({ path: `${SHOTS}/31-side-win-pulse-offset-${offsetMs}.png` });
    console.log(`attempt offset=${offsetMs}ms: outcome=${outcome} best=${best} trace=${trace.slice(-10).join(' ')}`);
    if (outcome === 'win') {
      won = true;
      break;
    }
  }

  const finalText = await gameText(page);
  record('3 side-stars scripted win ("Thắng!")', won, won ? JSON.stringify(finalText.slice(0, 160)) : `best Sao=${best}; last=${JSON.stringify(finalText.slice(0, 120))}`);
  record('3 console errors (pulse win attempt)', logs.length === 0, logs.join(' || ') || 'none');
} catch (e) {
  record('RUN ERROR', false, String(e && e.stack ? e.stack : e));
} finally {
  await browser.close();
}
