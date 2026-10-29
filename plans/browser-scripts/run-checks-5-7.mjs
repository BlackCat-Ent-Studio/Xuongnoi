import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { openBrowser, openSample, gameText, record, sleep, URL, SHOTS } from './common.mjs';

const { browser, page, logs } = await openBrowser();

/** Centroid (in page px) of pixels close to an RGB colour inside the game box. */
async function colourCentroid(rgb, tol = 10) {
  const box = await page.locator('.game-box').boundingBox();
  const file = `${SHOTS}/tmp-gamebox.png`;
  await page.screenshot({ path: file, clip: box });
  const png = PNG.sync.read(readFileSync(file));
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let y = 0; y < png.height; y++) {
    for (let x = 0; x < png.width; x++) {
      const i = (y * png.width + x) * 4;
      if (
        Math.abs(png.data[i] - rgb[0]) <= tol &&
        Math.abs(png.data[i + 1] - rgb[1]) <= tol &&
        Math.abs(png.data[i + 2] - rgb[2]) <= tol
      ) {
        sx += x;
        sy += y;
        n++;
      }
    }
  }
  if (n < 20) return { n, x: null, y: null, box };
  return { n, x: box.x + sx / n, y: box.y + sy / n, box };
}

const readSaved = () => page.evaluate(() => localStorage.getItem('xuong-noi:autosave'));
const savedNode = (raw, id) => JSON.parse(raw).graph.nodes.find((n) => n.id === id);
const modeSelect = page.locator('.mode-select');

try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.topbar', { timeout: 15000 });
  await sleep(500);

  // Check 5a: Tạo mới dialog creates a board in chosen mode
  await page.locator('button', { hasText: 'Tạo mới' }).click();
  await sleep(300);
  const choices = await page.locator('.mode-choice').count();
  record('5 Tạo mới dialog shows 3 modes', choices === 3, `choices=${choices}`);
  await page.screenshot({ path: `${SHOTS}/50-new-game-dialog.png` });
  await page.locator('.mode-choice[data-mode="3d"]').click();
  await sleep(500);
  record('5 Tạo mới → 3D creates 3d board', (await modeSelect.inputValue()) === '3d', `mode=${await modeSelect.inputValue()}`);
  await modeSelect.selectOption('2d-side');
  await sleep(300);

  // Check 5b: side-stars -> switch to top view and play
  await openSample(page, 'side-stars');
  await modeSelect.selectOption('2d-top');
  await sleep(700);
  const status1 = await page.locator('.status').innerText();
  await page.screenshot({ path: `${SHOTS}/51-side-stars-as-top-preview.png` });
  record('5 side-stars switched to 2D top, preview still renders', (await page.locator('.game-box canvas').count()) === 1, `status="${status1}"`);
  await page.locator('#btn-play').click();
  await sleep(900);
  await page.keyboard.down('ArrowRight');
  await sleep(500);
  const badges1 = await page.locator('.wc-badge').allInnerTexts();
  await page.screenshot({ path: `${SHOTS}/52-side-stars-top-playing.png` });
  await page.keyboard.up('ArrowRight');
  record('5 side-stars in 2D top still plays (stick badge reacts)', badges1.includes('1.00'), `badges head=${JSON.stringify(badges1.slice(0, 3))}`);
  await page.locator('#btn-play').click();
  await sleep(500);
  await modeSelect.selectOption('2d-side');
  await sleep(600);

  // Check 5c: top-collect -> 3D and play
  await openSample(page, 'top-collect');
  await modeSelect.selectOption('3d');
  await sleep(700);
  await page.locator('#btn-play').click();
  await sleep(1000);
  await page.keyboard.down('KeyD');
  await sleep(500);
  const badges3d = await page.locator('.wc-badge').allInnerTexts();
  await page.screenshot({ path: `${SHOTS}/53-top-collect-as-3d-playing.png` });
  await page.keyboard.up('KeyD');
  record('5 top-collect in 3D plays (stick.x badge 1.00 on D)', badges3d.includes('1.00'), `badges head=${JSON.stringify(badges3d.slice(0, 3))}`);
  await page.locator('#btn-play').click();
  await sleep(500);
  await modeSelect.selectOption('2d-top');
  await sleep(500);
  record('5 mode switch (3d → 2d-top) keeps board editable', (await page.locator('#btn-play').innerText()).includes('Chơi'), 'ok');

  // Check 7: entity drag in edit mode on side-stars (platform-1 is dark brown (115,69,3) in lit view)
  await openSample(page, 'side-stars');
  await sleep(500);
  const before = await readSaved(); // may be null before the first autosave
  await sleep(1300);
  const preRaw = (await readSaved()) ?? before;
  const plat = await colourCentroid([115, 69, 3], 8);
  await page.screenshot({ path: `${SHOTS}/60-side-stars-before-drag.png` });
  record('7 found platform-1 pixels in game view', plat.x !== null, `pixels=${plat.n}`);
  if (plat.x !== null) {
    const x0 = plat.x;
    const y0 = plat.y;
    await page.mouse.move(x0, y0);
    await page.mouse.down();
    await page.mouse.move(x0 + 30, y0, { steps: 6 });
    await page.mouse.move(x0 + 80, y0, { steps: 10 });
    await page.mouse.up();
    await sleep(1600); // debounce + preview rebuild
    const postRaw = await readSaved();
    await page.screenshot({ path: `${SHOTS}/61-side-stars-after-drag.png` });
    const p0 = savedNode(preRaw, 'platform-1').params.position;
    const p1 = savedNode(postRaw, 'platform-1').params.position;
    record('7 entity drag changes platform-1 position param (x moves, y kept)', p1.x !== p0.x && p1.y === p0.y, `before=${JSON.stringify(p0)} after=${JSON.stringify(p1)}`);
    record('7 snap to 0.5 grid', Math.abs(p1.x * 2 - Math.round(p1.x * 2)) < 1e-9, `x=${p1.x}`);
  }

  // Check 6: reload restores board (autosave)
  const nodesBefore = await page.locator('.wc-node').count();
  const wiresBefore = await page.evaluate(() => document.querySelectorAll('path.wc-wire:not(.wc-wire-temp)').length);
  await sleep(1300);
  const savedBefore = await readSaved();
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.topbar', { timeout: 15000 });
  await sleep(900);
  const nodesAfter = await page.locator('.wc-node').count();
  const wiresAfter = await page.evaluate(() => document.querySelectorAll('path.wc-wire:not(.wc-wire-temp)').length);
  const savedAfter = await readSaved();
  const nameAfter = await page.locator('.name-input').inputValue();
  record(
    '6 reload restores board (nodes/wires/name)',
    nodesAfter === nodesBefore && wiresAfter === wiresBefore && nameAfter === 'Nhặt sao',
    `nodes ${nodesBefore}->${nodesAfter}, wires ${wiresBefore}->${wiresAfter}, name=${nameAfter}, savedSame=${savedBefore === savedAfter}`,
  );
  const restoredPlat = savedNode(savedAfter, 'platform-1').params.position;
  record('6 reload keeps dragged position', JSON.stringify(restoredPlat) === JSON.stringify(savedNode(savedBefore, 'platform-1').params.position), JSON.stringify(restoredPlat));
  await page.screenshot({ path: `${SHOTS}/62-after-reload.png` });
  record('6 console errors during reload checks', logs.length === 0, logs.join(' || ') || 'none');
} catch (e) {
  record('RUN ERROR', false, String(e && e.stack ? e.stack : e));
  await page.screenshot({ path: `${SHOTS}/error-run5-7.png` }).catch(() => {});
} finally {
  console.log('LOGS:', JSON.stringify(logs, null, 1));
  await browser.close();
}
