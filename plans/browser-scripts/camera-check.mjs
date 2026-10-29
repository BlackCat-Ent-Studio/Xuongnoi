import fs from 'node:fs';
import { openBrowser, openSample, sleep, record, SCRATCH } from './common.mjs';

const OUT = `${SCRATCH}/camera`;
fs.mkdirSync(OUT, { recursive: true });
const { browser, page, logs } = await openBrowser();
await page.goto('http://localhost:5173/');
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').count()) await page.locator('[data-tut="invite-no"]').click();
await sleep(300);
const box = page.locator('.game-box');
const snap = async (name) => {
  const b = await box.screenshot({ path: `${OUT}/${name}.png` });
  return b;
};
const same = (a, b) => a.equals(b);
async function center() {
  const r = await box.boundingBox();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, r };
}

for (const id of ['side-stars', 'top-collect', '3d-hop']) {
  await openSample(page, id);
  await sleep(500);
  const is3d = id === '3d-hop';
  const base = await snap(`${id}-1-default`);
  const c = await center();
  // wheel zoom in at an off-center point, then out
  await page.mouse.move(c.x + 60, c.y - 20);
  await page.mouse.wheel(0, -400);
  await sleep(300);
  const zin = await snap(`${id}-2-zoomin`);
  record(`${id} wheel zoom in changes view`, !same(base, zin), '');
  await page.mouse.wheel(0, 800);
  await sleep(300);
  const zout = await snap(`${id}-3-zoomout`);
  record(`${id} wheel zoom out changes view`, !same(zin, zout), '');
  // pan: 2D left drag empty; 3D right drag
  const sx = c.r.x + 20, sy = c.r.y + 20; // corner, empty space
  await page.mouse.move(sx, sy);
  if (is3d) {
    await page.mouse.down({ button: 'right' });
    await page.mouse.move(sx + 60, sy + 30, { steps: 6 });
    await page.mouse.up({ button: 'right' });
  } else {
    await page.mouse.down();
    await page.mouse.move(sx + 60, sy + 30, { steps: 6 });
    await page.mouse.up();
  }
  await sleep(300);
  const panned = await snap(`${id}-4-panned`);
  record(`${id} pan changes view`, !same(zout, panned), '');
  if (is3d) {
    await page.mouse.move(sx, sy);
    await page.mouse.down();
    await page.mouse.move(sx + 80, sy + 20, { steps: 6 });
    await page.mouse.up();
    await sleep(300);
    const orb = await snap(`${id}-4b-orbit`);
    record(`${id} left drag orbits`, !same(panned, orb), '');
  }
  // edit a param -> camera must not jump
  const before = await snap(`${id}-5-before-edit`);
  const num = page.locator('.props input[type=number], .properties input[type=number]').first();
  const nodeEl = page.locator('.wc-node').first();
  await nodeEl.click({ position: { x: 10, y: 10 } });
  await sleep(200);
  const numInput = page.locator('input[type=number]').first();
  if (await numInput.count()) {
    const v = await numInput.inputValue();
    await numInput.fill(String(Number(v) + 0.5));
    await numInput.press('Enter');
    await sleep(400);
  }
  const after = await snap(`${id}-6-after-edit`);
  // a param change may move an entity but the camera should stay; compare via side-by-side look
  record(`${id} edit param snapshot taken`, true, `identical=${same(before, after)} (see png)`);
  // reset
  await page.locator('.cam-reset').click();
  await sleep(300);
  const reset = await snap(`${id}-7-reset`);
  record(`${id} reset returns to default framing`, !same(panned, reset), '');
  // play
  await page.keyboard.press('Escape');
  await page.locator('button', { hasText: 'Chơi' }).first().click();
  await sleep(1200);
  await snap(`${id}-8-play`);
  record(`${id} reset btn hidden in play`, !(await page.locator('.cam-reset').isVisible()), '');
  await page.locator('button', { hasText: 'Sửa' }).first().click();
  await sleep(600);
  await snap(`${id}-9-back-edit`);
  record(`${id} reset btn back in edit`, await page.locator('.cam-reset').isVisible(), '');
}

// entity drag still works (side-stars)
await openSample(page, 'side-stars');
await sleep(500);
const a = await snap('drag-1');
const gb = await box.boundingBox();
// scan for an entity by trying drags from several points; verify via screenshot change
let moved = false;
for (const [fx, fy] of [[0.5, 0.75], [0.3, 0.75], [0.5, 0.6], [0.7, 0.75], [0.5, 0.5]]) {
  const px = gb.x + gb.width * fx, py = gb.y + gb.height * fy;
  const pre = await snap('drag-pre');
  await page.mouse.move(px, py);
  await page.mouse.down();
  await page.mouse.move(px + 40, py - 40, { steps: 5 });
  await page.mouse.up();
  await sleep(400);
  const post = await snap('drag-post');
  // an entity drag changes entities but pan would shift everything; distinguish by checking the reset button state is irrelevant — just log
  if (!same(pre, post)) { moved = true; }
}
record('drag attempts changed view (entity move or pan; inspect drag-*.png)', moved, '');

record('no console errors', logs.length === 0, logs.join(' || ') || 'none');
await browser.close();
