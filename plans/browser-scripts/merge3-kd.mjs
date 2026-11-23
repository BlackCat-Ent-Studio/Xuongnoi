import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record, openSample, SCRATCH } from './common.mjs';
const SHOTS = `${SCRATCH}/merge3`;
mkdirSync(SHOTS, { recursive: true });
const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
const shot = (n) => page.locator('.game-box').screenshot({ path: `${SHOTS}/${n}.png` });
const ids = ['side-stars', 'top-collect', '3d-hop', 'key-door', 'pickaxe-rock', 'guard-patrol', 'cleaner-bot', 'maze-chase', 'platform-bot', 'arena', 'race'];
for (const id of []) {
  await openSample(page, id);
  await page.locator('#btn-play').click();
  await sleep(700);
  for (const k of ['ArrowRight', 'ArrowUp', 'ArrowLeft', 'ArrowDown']) {
    await page.keyboard.down(k);
    await page.keyboard.down('Space');
    await sleep(500);
    await page.keyboard.up('Space');
    await page.keyboard.up(k);
  }
  await page.keyboard.press('KeyE');
  await sleep(300);
  await shot(id);
  record(`${id} plays, no errors`, logs.length === 0, logs.join(' || '));
  await page.locator('#btn-play').click().catch(() => {});
  await sleep(300);
}
// key-door hint
await openSample(page, 'key-door');
await page.locator('#btn-play').click();
await sleep(900);
const hint = page.locator('.game-box div', { hasText: /^Bấm F để mở$/ });
const vis = async () => (await hint.count()) > 0 && (await hint.first().isVisible());
await page.keyboard.down('ArrowRight'); await sleep(420); await page.keyboard.up('ArrowRight'); await sleep(200);
await page.keyboard.down('KeyE'); await sleep(150); await page.keyboard.up('KeyE'); await sleep(300);
await page.keyboard.down('ArrowRight'); await sleep(1700); await page.keyboard.up('ArrowRight'); await sleep(200);
record('hint visible before', await vis(), '');
await page.keyboard.down('KeyF'); await sleep(150); await page.keyboard.up('KeyF');
await sleep(500);
await shot('keydoor-opened');
record('hint hidden after', !(await vis()), '');
await page.keyboard.down('ArrowRight'); await sleep(1500); await page.keyboard.up('ArrowRight'); await sleep(500);
record('won', /thắng/i.test(await page.locator('.game-box').innerText()), '');
record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
