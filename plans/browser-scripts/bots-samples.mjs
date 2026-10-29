import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record, openSample, SCRATCH } from './common.mjs';

const SHOTS = `${SCRATCH}/bots`;
mkdirSync(SHOTS, { recursive: true });
const { browser, page, logs } = await openBrowser();
await page.goto('http://localhost:5173/');
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const body = () => page.locator('body').innerText();

// palette has the brain category and four nodes
const cats = await page.locator('.palette-cat').allInnerTexts();
record('palette has Bộ não', cats.some((t) => t.toLowerCase().includes('bộ não')), cats.join(','));
for (const k of ['patrol', 'go-to', 'chase', 'sequence']) {
  record(`palette item ${k}`, (await page.locator(`.palette-item[data-kind="${k}"]`).count()) === 1, '');
}

// ---- cleaner bot ----
await openSample(page, 'cleaner-bot');
await shot('cleaner-1-edit');
await page.locator('[data-tut="play"]').click();
await sleep(1500);
await shot('cleaner-2-start');
let won = false;
for (let i = 0; i < 40 && !won; i++) {
  await sleep(1500);
  if (i === 6) await shot('cleaner-3-mid');
  won = (await body()).includes('dọn sạch');
}
await shot('cleaner-4-end');
record('cleaner bot wins unattended', won, won ? 'win message shown' : 'no win');

// ---- guard patrol ----
await page.reload();
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
await openSample(page, 'guard-patrol');
await shot('guard-1-edit');
await page.locator('[data-tut="play"]').click();
await sleep(1200);
await shot('guard-2-start');
// walk toward the guard's beat and stand still: it should catch us
await page.keyboard.down('KeyD');
await sleep(1500);
await page.keyboard.up('KeyD');
await shot('guard-3-near');
let lost = false;
for (let i = 0; i < 20 && !lost; i++) {
  await sleep(700);
  lost = (await body()).includes('bắt được');
}
await shot('guard-4-end');
record('guard catches the player', lost, lost ? 'lose message shown' : 'no lose');

// old samples still run
for (const id of ['side-stars', 'top-collect', '3d-hop', 'key-door', 'pickaxe-rock']) {
  await page.reload();
  await sleep(1000);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
    await page.locator('[data-tut="invite-no"]').click();
    await sleep(300);
  }
  await openSample(page, id);
  await page.locator('[data-tut="play"]').click();
  await sleep(1200);
  await shot(`old-${id}`);
}

record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
