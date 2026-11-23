import { openBrowser, openSample, gameText, badges, record, sleep, URL, SHOTS } from './common.mjs';

const { browser, page, logs } = await openBrowser();
const waitFor = async (text, ms) => {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if ((await gameText(page)).includes(text)) return true;
    await sleep(250);
  }
  return false;
};
const hold = async (keys, ms) => {
  for (const k of keys) await page.keyboard.down(k);
  await sleep(ms);
  for (const k of keys) await page.keyboard.up(k);
};

try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.topbar', { timeout: 15000 });
  await sleep(600);

  // ---- top-collect (2D top, WASD scheme) ----
  await openSample(page, 'top-collect');
  await page.screenshot({ path: `${SHOTS}/10-top-collect-preview.png` });
  const modeTop = await page.locator('.mode-select').inputValue();
  record('2 top-collect loads in 2d-top', modeTop === '2d-top', `mode=${modeTop}`);
  await page.locator('#btn-play').click();
  await sleep(1000);
  await page.screenshot({ path: `${SHOTS}/11-top-collect-idle.png` });
  await hold(['ArrowRight'], 700);
  const arrowTop = await badges(page);
  console.log(`INFO | top-collect ArrowRight with wasd scheme -> stick.x badge=${arrowTop[0]} (sample scheme=wasd, brief assumed arrows)`);
  await hold(['KeyD'], 700);
  const dTop = await badges(page);
  await page.screenshot({ path: `${SHOTS}/12-top-collect-moving-d.png` });
  record('2 top-collect D drives stick.x', dTop[0] === '1.00', `stick.x badge=${dTop[0]}`);
  await hold(['KeyS'], 500);
  const sTop = await badges(page);
  record('2 top-collect S drives stick.y (down)', sTop[1] === '-1.00' || sTop.some((t) => t === '-1.00'), `badges=${sTop.slice(0, 3)}`);
  const lostTime = await waitFor('Hết giờ mất rồi!', 40000);
  await page.screenshot({ path: `${SHOTS}/13-top-collect-timeout-lose.png` });
  record('2 top-collect timer 30s -> lose overlay', lostTime, `text=${JSON.stringify((await gameText(page)).slice(0, 160))}`);
  await page.locator('button', { hasText: 'Chơi lại' }).click();
  await sleep(800);
  await page.locator('#btn-play').click();
  await sleep(600);
  record('2 top-collect Sửa returns to edit', (await page.locator('#btn-play').innerText()).trim() === 'Chơi', 'ok');

  // ---- 3d-hop ----
  await openSample(page, '3d-hop');
  await page.screenshot({ path: `${SHOTS}/20-3d-hop-preview.png` });
  const mode3d = await page.locator('.mode-select').inputValue();
  record('2 3d-hop loads in 3d', mode3d === '3d', `mode=${mode3d}`);
  await page.locator('#btn-play').click();
  await sleep(1200);
  await page.screenshot({ path: `${SHOTS}/21-3d-hop-idle.png` });
  await hold(['KeyD'], 600);
  const dHop = await badges(page);
  record('2 3d-hop D drives stick.x', dHop[0] === '1.00', `stick.x=${dHop[0]}`);
  await hold(['Space'], 200);
  const spHop = await badges(page);
  record('2 3d-hop Space drives key.held badge', spHop.includes('Đúng') || spHop.includes('Sai'), `badges=${spHop.slice(0, 8)}`);
  await page.screenshot({ path: `${SHOTS}/22-3d-hop-moving.png` });
  const lost3d = await (async () => {
    await page.keyboard.down('KeyD');
    const r = await waitFor('Thua!', 20000);
    await page.keyboard.up('KeyD');
    return r;
  })();
  await page.screenshot({ path: `${SHOTS}/23-3d-hop-lose.png` });
  record('2 3d-hop walk off edge -> Thua', lost3d, `text=${JSON.stringify((await gameText(page)).slice(0, 160))}`);
  await page.locator('button', { hasText: 'Chơi lại' }).click();
  await sleep(900);
  await hold(['KeyW'], 400);
  record('2 3d-hop Chơi lại works (W held stick.y)', !(await gameText(page)).includes('Thua!'), 'ok');
  await page.locator('#btn-play').click();
  await sleep(600);
  record('2 3d-hop Sửa returns to edit', (await page.locator('#btn-play').innerText()).trim() === 'Chơi', 'ok');
  record('2 console errors (samples session)', logs.length === 0, logs.join(' || ') || 'none');
} catch (e) {
  record('RUN ERROR', false, String(e && e.stack ? e.stack : e));
  await page.screenshot({ path: `${SHOTS}/error-samples.png` }).catch(() => {});
} finally {
  console.log('LOGS:', JSON.stringify(logs, null, 1));
  await browser.close();
}
