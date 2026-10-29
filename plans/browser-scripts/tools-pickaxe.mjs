import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record, openSample, SCRATCH } from './common.mjs';

const SHOTS = `${SCRATCH}/tools`;
mkdirSync(SHOTS, { recursive: true });
const { browser, page, logs } = await openBrowser();
await page.goto('http://localhost:5173/');
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
const box = () => page.locator('.game-box');
const shot = async (n) => {
  await box().screenshot({ path: `${SHOTS}/${n}.png` });
};
const tap = async (code, ms = 60) => {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
};
const walk = async (ms, code = 'ArrowRight') => {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
};
const gameText = async () => (await page.locator('body').innerText());

await openSample(page, 'pickaxe-rock');
await page.screenshot({ path: `${SHOTS}/p01-edit.png` });
const kinds = await page.locator('.wc-node').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')));
record('board has hand-tool node', kinds.includes('hand-tool'), kinds.join(','));

await page.locator('#btn-play').click();
await sleep(900);
await shot('p02-start');
await walk(1250); // to about x=-0.75 : pickaxe in reach, sword far behind
await sleep(150);
await tap('KeyE');
await sleep(300);
await shot('p03-pickaxe-in-hand');
await walk(1000); // against the rock
await sleep(150);
await tap('KeyF');
await shot('p04-swing-a');
await shot('p05-swing-b');
await sleep(500);
await shot('p06-rock-gone');
await walk(1600);
await sleep(900);
await shot('p07-win');
const body = await gameText();
record('win message shown', body.includes('thắng rồi'), body.includes('thắng rồi') ? 'yes' : 'no');

console.log('LOGS:', JSON.stringify(logs));
record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
