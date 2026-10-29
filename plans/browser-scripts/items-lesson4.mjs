import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record, SCRATCH } from './common.mjs';
import { panelInfo, dragKind, wire, nodeOf, selectNode, setSelect, clickNext, startLesson, nodeCount } from './tut-common.mjs';

const SHOTS = `${SCRATCH}/items`;
mkdirSync(SHOTS, { recursive: true });
const { browser, page, logs } = await openBrowser();
await page.setViewportSize({ width: 1920, height: 1100 });
await page.goto('http://localhost:5173/');
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const TOTAL = 22;
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

await startLesson(page, 'carry-use');
await step('intro', 1);
record('lesson board has 9 nodes', (await nodeCount(page)) === 9, String(await nodeCount(page)));
await shot('20-l4-intro');
await clickNext(page);
await step('add item', 2);
await dragKind(page, 'item', 560, 520);
await step('item shape step', 3);
await selectNode(page, 'item', 1);
await setSelect(page, 'shape', 'key');
await step('add carry', 4);
await dragKind(page, 'carry', 720, 40);
await step('wire carry', 5);
await wire(page, nodeOf('character'), 'self', nodeOf('carry'), 'character');
await step('add key e', 6);
await dragKind(page, 'key', 40, 400);
await step('key e code', 7);
await selectNode(page, 'key', 1);
await setKey('KeyE');
await step('wire grab', 8);
await wire(page, await idOf('key', 1), 'pressed', nodeOf('carry'), 'grab');
await step('play carry', 9);
await shot('21-l4-wired-grab');
await page.setViewportSize({ width: 1440, height: 900 });
await page.locator('[data-tut="play"]').click();
await sleep(1000);
await walk(800);
await tap('KeyE');
await sleep(300);
await shot('22-l4-holding');
await step('back to edit', 10);
await page.locator('[data-tut="play"]').click();
await sleep(500);
await page.setViewportSize({ width: 1920, height: 1100 });
await sleep(300);
await step('add interact', 11);
await dragKind(page, 'interact', 720, 200);
await step('wire interact', 12);
await wire(page, nodeOf('character'), 'self', nodeOf('interact'), 'character');
await step('add key f', 13);
await dragKind(page, 'key', 40, 520);
await step('key f code', 14);
await selectNode(page, 'key', 2);
await setKey('KeyF');
await step('wire press', 15);
await wire(page, await idOf('key', 2), 'pressed', nodeOf('interact'), 'press');
await step('add and', 16);
await dragKind(page, 'and', 720, 380);
await step('wire lock', 17);
await wire(page, await idOf('item', 0), 'interacted', nodeOf('and'), 'a');
await step('wire holding', 18);
await wire(page, nodeOf('carry'), 'holding', nodeOf('and'), 'b');
await step('wire open', 19);
await shot('23-l4-wire-open-step');
await wire(page, nodeOf('and'), 'out', await idOf('block', 1), 'hide');
await step('play open', 20);
await shot('24-l4-all-wired');
await page.setViewportSize({ width: 1440, height: 900 });
await page.locator('[data-tut="play"]').click();
await sleep(1000);
await step('win step', 21);
await page.keyboard.down('ArrowRight');
let shotDoor = false;
for (let i = 0; i < 250 && (await panelInfo(page)).progress === `Bước 21/${TOTAL}`; i++) {
  await tap('KeyE', 40);
  await sleep(120);
  await tap('KeyF', 40);
  await sleep(120);
  if (i === 25 && !shotDoor) { shotDoor = true; await shot('25-l4-at-door'); }
}
await page.keyboard.up('ArrowRight');
await sleep(600);
await step('done', 22);
await shot('27-l4-won');
await clickNext(page);
record('panel closed after finish', !(await page.locator('.tut-panel').isVisible()), '');
console.log('LOGS:', JSON.stringify(logs));
record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
