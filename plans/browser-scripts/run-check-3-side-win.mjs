import { openBrowser, openSample, gameText, record, sleep, URL, SHOTS } from './common.mjs';

const { browser, page, logs } = await openBrowser();
const patterns = [300, 600, 900, 1250, 1600, 2000, 2400].map((d) => ({ name: `hold-space-delay-${d}ms`, hold: true, delay: d }));

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
  for (const p of patterns) {
    // Reset between attempts when a previous run ended.
    const cur = await gameText(page);
    if (cur.includes('Chơi lại')) {
      await page.locator('button', { hasText: 'Chơi lại' }).click();
      await sleep(900);
    }
    // Collect star-1 on the left first (stick left ~0.7s, walls at x=-6).
    await page.keyboard.down('ArrowLeft');
    await sleep(700);
    await page.keyboard.up('ArrowLeft');
    await sleep(200);

    const trace = [];
    await page.keyboard.down('ArrowRight');
    const t0 = Date.now();
    if (p.hold) { if (p.delay) await sleep(p.delay); await page.keyboard.down('Space'); }
    let outcome = 'timeout';
    while (Date.now() - t0 < 14000) {
      if (p.hold) await sleep(200);
      else {
        await page.keyboard.down('Space');
        await sleep(p.down);
        await page.keyboard.up('Space');
        await sleep(p.up);
      }
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
    await page.screenshot({ path: `${SHOTS}/30-side-win-${p.name.replace(/\//g, '_')}.png` });
    console.log(`attempt ${p.name}: outcome=${outcome} best=${best} trace=${trace.slice(-12).join(' ')}`);
    if (outcome === 'win') {
      won = true;
      break;
    }
  }

  const finalText = await gameText(page);
  if (won) {
    record('3 side-stars scripted win ("Thắng!" + message)', true, JSON.stringify(finalText.slice(0, 160)));
  } else {
    record('3 side-stars scripted win', false, `not won after ${patterns.length} patterns; best Sao=${best}; last text=${JSON.stringify(finalText.slice(0, 140))}`);
  }
  record('3 console errors (win attempt)', logs.length === 0, logs.join(' || ') || 'none');
} catch (e) {
  record('RUN ERROR', false, String(e && e.stack ? e.stack : e));
} finally {
  console.log('LOGS:', JSON.stringify(logs.slice(0, 20), null, 1));
  await browser.close();
}
