import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record, SCRATCH } from './common.mjs';
import { panelInfo, dragKind, wire, nodeOf, selectNode, setSelect, clickNext, startLesson, nodeCount } from './tut-common.mjs';

const SHOTS = `${SCRATCH}/tools`;
mkdirSync(SHOTS, { recursive: true });
const { browser, page, logs } = await openBrowser();
await page.setViewportSize({ width: 1920, height: 1100 });
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const yes = async () => (await page.locator('.wc-badge', { hasText: 'Đúng' }).count());
/** Walk right in small chunks and press E until the "Đúng" badge count rises (the tool reached the hand). */
const equipLoop = async () => {
  const base = await yes();
  for (let i = 0; i < 80; i++) {
    await walk(250);
    await sleep(200);
    // The pressed pulse lasts one tick, so watch the badge while the key is down instead of looking afterwards.
    await page.keyboard.down('KeyE');
    let seen = 0;
    for (let t = Date.now(); Date.now() - t < 250; ) {
      seen = Math.max(seen, await yes());
      await sleep(10);
    }
    await page.keyboard.up('KeyE');
    await sleep(300);
    if (seen > base || (await yes()) > base) return true;
  }
  return false;
};
const TOTAL = 21;
const step = async (label, n) => {
  const info = await panelInfo(page);
  record(label, info.visible && info.progress === `Bước ${n}/${TOTAL}`, `${info.progress} | ${info.title}`);
};
const idOf = async (kind, nth) => `.wc-node[data-id="${await page.locator(`.wc-node[data-kind="${kind}"]`).nth(nth).getAttribute('data-id')}"]`;
const setKey = async (code) => {
  await page.locator('.prop-key').click();
  await sleep(100);
  await page.keyboard.press(code);
  await sleep(200);
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

await startLesson(page, 'hand-tools');
await step('intro', 1);
record('lesson board has 8 nodes', (await nodeCount(page)) === 8, String(await nodeCount(page)));
await shot('l5-01-intro');
await clickNext(page);
await step('add item', 2);
await dragKind(page, 'item', 560, 520);
await step('item shape step', 3);
await selectNode(page, 'item', 0);
await setSelect(page, 'shape', 'pickaxe');
await step('item hold step', 4);
await setSelect(page, 'holdStyle', 'hand');
await step('add hand-tool', 5);
await dragKind(page, 'hand-tool', 720, 40);
await step('wire hand', 6);
await wire(page, nodeOf('character'), 'self', nodeOf('hand-tool'), 'character');
await step('add key e', 7);
await dragKind(page, 'key', 40, 400);
await step('key e code', 8);
await selectNode(page, 'key', 1);
await setKey('KeyE');
await step('wire equip', 9);
await wire(page, await idOf('key', 1), 'pressed', nodeOf('hand-tool'), 'toggle');
await step('add key f', 10);
await dragKind(page, 'key', 40, 520);
await step('key f code', 11);
await selectNode(page, 'key', 2);
await setKey('KeyF');
await step('wire use', 12);
await wire(page, await idOf('key', 2), 'pressed', nodeOf('hand-tool'), 'use');
await step('play tool', 13);
await shot('l5-02-wired');
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(1000);
record('first play: tool reaches the hand', await equipLoop(), '');
await tap('KeyF', 120);
await sleep(100);
await shot('l5-03-tool-in-hand');
await step('back to edit', 14);
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(500);
await page.setViewportSize({ width: 1920, height: 1100 });
await sleep(300);
await step('add and', 15);
await dragKind(page, 'and', 720, 380);
await step('wire rock', 16);
await wire(page, await idOf('block', 1), 'usedOn', nodeOf('and'), 'a');
await step('wire in hand', 17);
await wire(page, await idOf('item', 0), 'inHand', nodeOf('and'), 'b');
await step('wire break', 18);
await shot('l5-04-wire-break-step');
await wire(page, nodeOf('and'), 'out', await idOf('block', 1), 'hide');
await step('play break', 19);
await shot('l5-05-all-wired');
await page.setViewportSize({ width: 1440, height: 900 });
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(1000);
await step('win step', 20);
record('second play: tool reaches the hand', await equipLoop(), '');
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 80 && (await panelInfo(page)).progress === `Bước 20/${TOTAL}`; i++) {
  await tap('KeyF', 120);
  await sleep(450);
}
await page.keyboard.up('ArrowRight');
await sleep(600);
await step('done', 21);
await shot('l5-06-won');
await clickNext(page);
record('panel closed after finish', !(await page.locator('.ld-body').isVisible()), '');
console.log('LOGS:', JSON.stringify(logs));
record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
