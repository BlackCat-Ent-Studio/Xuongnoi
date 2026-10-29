import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record, SCRATCH } from './common.mjs';
import { panelInfo, dragKind, wire, nodeOf, selectNode, setSelect, clickNext, startLesson, nodeCount } from './tut-common.mjs';

const SHOTS = `${SCRATCH}/bots`;
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
const TOTAL = 16;
const step = async (label, n) => {
  const info = await panelInfo(page);
  record(label, info.visible && info.progress === `Bước ${n}/${TOTAL}`, `${info.progress} | ${info.title}`);
};
const idOf = async (kind, nth) =>
  `.wc-node[data-id="${await page.locator(`.wc-node[data-kind="${kind}"]`).nth(nth).getAttribute('data-id')}"]`;

// the lesson shows up in the menu
await page.locator('[data-tut="tutorial"]').click();
record('menu lists lesson 6', (await page.locator('[data-lesson="make-bot"]').count()) === 1, '');
await page.locator('[data-tut="tutorial"]').click();

await startLesson(page, 'make-bot');
await step('intro', 1);
record('lesson board has 4 nodes', (await nodeCount(page)) === 4, String(await nodeCount(page)));
await shot('l6-01-intro');
await clickNext(page);
await step('add bot character', 2);
await dragKind(page, 'character', 560, 20);
await step('bot role', 3);
await selectNode(page, 'character', 1);
await setSelect(page, 'role', 'bot');
await step('add patrol', 4);
await dragKind(page, 'patrol', 820, 20);
await step('wire bot self', 5);
const bot = await idOf('character', 1);
await wire(page, bot, 'self', nodeOf('patrol'), 'self');
await step('wire bot move', 6);
await shot('l6-02-wire-move-step');
await wire(page, nodeOf('patrol'), 'moveX', bot, 'moveX');
await step('play patrol', 7);
await page.locator('[data-tut="play"]').click();
await sleep(2500);
await shot('l6-03-patrol-playing');
await step('back to edit', 8);
await page.locator('[data-tut="play"]').click();
await sleep(500);
await step('add touch', 9);
await dragKind(page, 'touch', 560, 330);
await step('wire touch a', 10);
await wire(page, await idOf('character', 0), 'self', nodeOf('touch'), 'a');
await step('wire touch b', 11);
await wire(page, bot, 'self', nodeOf('touch'), 'b');
await step('add end', 12);
await dragKind(page, 'win-lose', 820, 330);
await step('wire lose', 13);
await wire(page, nodeOf('touch'), 'touching', nodeOf('win-lose'), 'lose');
await step('play caught', 14);
await shot('l6-04-all-wired');
await page.setViewportSize({ width: 1440, height: 900 });
await page.locator('[data-tut="play"]').click();
await sleep(800);
await page.keyboard.down('ArrowRight');
let caught = false;
for (let i = 0; i < 40 && !caught; i++) {
  await sleep(500);
  caught = (await panelInfo(page)).progress === `Bước 16/${TOTAL}`;
}
await page.keyboard.up('ArrowRight');
await shot('l6-05-caught');
record('bot catches the player (step 16)', caught, (await panelInfo(page)).progress ?? '');
const body = await page.locator('body').innerText();
record('lose message shown', body.includes('Thua mất rồi'), '');
await sleep(300);
await step('done', 16);
await page.locator('.tut-panel button', { hasText: 'Hoàn thành' }).click();
await sleep(300);
record('panel closed after finish', !(await page.locator('.tut-panel').isVisible()), '');
record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
