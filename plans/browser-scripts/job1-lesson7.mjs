import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record, SCRATCH } from './common.mjs';
import { panelInfo, dragKind, wire, selectNode, setNumber, clickNext, startLesson, nodeCount } from './tut-common.mjs';

const SHOTS = `${SCRATCH}/job1`;
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
const TOTAL = 19;
const step = async (label, n) => {
  const info = await panelInfo(page);
  record(label, info.visible && info.progress === `Bước ${n}/${TOTAL}`, `${info.progress} | ${info.title}`);
};
const id = async (kind, nth) =>
  `.wc-node[data-id="${await page.locator(`.wc-node[data-kind="${kind}"]`).nth(nth).getAttribute('data-id')}"]`;

await page.locator('[data-tut="tutorial"]').click();
record('menu lists lesson 7', (await page.locator('[data-lesson="chores"]').count()) === 1, '');
await page.locator('[data-tut="tutorial"]').click();

await startLesson(page, 'chores');
await step('intro', 1);
record('board nodes', (await nodeCount(page)) >= 14, String(await nodeCount(page)));
await shot('l7-01-intro');
await clickNext(page);
await step('watch', 2);
await page.locator('[data-tut="play"]').click();
await sleep(2500);
await shot('l7-02-chaos');
await step('back to edit', 3);
await page.locator('[data-tut="play"]').click();
await sleep(500);
await step('add sequence', 4);
await dragKind(page, 'sequence', 20, 420);
await step('count', 5);
await selectNode(page, 'sequence');
await setNumber(page, 'stepCount', 3);
await step('wire1', 6);
const seq = await id('sequence', 0);
await shot('l7-03-before-wiring');
const go = [await id('go-to', 0), await id('go-to', 1), await id('go-to', 2)];
await wire(page, seq, 'step1', go[0], 'go');
await step('wire2', 7);
await wire(page, seq, 'step2', go[1], 'go');
await step('wire3', 8);
await wire(page, seq, 'step3', go[2], 'go');
await step('wire next', 9);
await wire(page, await id('or', 1), 'out', seq, 'next');
await step('play order', 10);
await shot('l7-04-wired-order');
await page.locator('[data-tut="play"]').click();
await sleep(5000);
await shot('l7-05-order-playing');
await step('back to edit 2', 11);
await page.locator('[data-tut="play"]').click();
await sleep(500);
await step('add carry', 12);
await dragKind(page, 'carry', 560, 500);
await step('wire carry', 13);
const bot = await id('character', 1);
await wire(page, bot, 'self', await id('carry', 0), 'character');
await step('wire grab', 14);
await wire(page, go[0], 'arrivedPulse', await id('carry', 0), 'grab');
await step('wire drop', 15);
await wire(page, go[1], 'arrivedPulse', await id('carry', 0), 'drop');
await step('wire finished', 16);
await wire(page, seq, 'finished', await id('win-lose', 0), 'win');
await step('play chores', 17);
await shot('l7-06-all-wired');
await page.locator('[data-tut="play"]').click();
let won = false;
for (let i = 0; i < 80 && !won; i++) {
  await sleep(500);
  if (i === 8 || i === 16) await shot('l7-07-carrying');
  won = (await panelInfo(page)).progress === `Bước 19/${TOTAL}`;
}
await shot('l7-08-win');
record('bot finished chores (step 19)', won, (await panelInfo(page)).progress ?? '');
await step('done', 19);
await page.locator('.tut-panel button', { hasText: 'Hoàn thành' }).click();
await sleep(300);
record('panel closed after finish', !(await page.locator('.tut-panel').isVisible()), '');
record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
