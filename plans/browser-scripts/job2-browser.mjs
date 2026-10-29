import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record, SCRATCH } from './common.mjs';
import { panelInfo, dragKind, wire, clickNext, startLesson } from './tut-common.mjs';
const SAMPLE_NAMES = {"side-stars": "Nhặt sao", "top-collect": "Thu thập", "3d-hop": "Nhảy cóc 3D", "key-door": "Chìa khoá", "pickaxe-rock": "Cuốc đá", "guard-patrol": "Lính gác", "cleaner-bot": "Bot dọn dẹp", "maze-chase": "Mê cung", "platform-bot": "Bot leo bục", "arena": "Võ đài", "race": "Đua xe", "dice-zones": "Xúc xắc", "portal-camera": "Cổng dịch chuyển", "dodge-shoot": "Né và bắn"};

const SHOTS = `${SCRATCH}/job2`;
mkdirSync(SHOTS, { recursive: true });
const URL = `http://localhost:${process.env.PORT ?? 5173}/`;
const { browser, page, logs } = await openBrowser();
await page.setViewportSize({ width: 1600, height: 1000 });

async function fresh() {
  await page.goto(URL);
  await sleep(1200);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
    await page.locator('[data-tut="invite-no"]').click();
    await sleep(300);
  }
}
const shot = (n) => page.screenshot({ path: `${SHOTS}/${n}.png` });
const gshot = (n) => page.locator('.game-box').screenshot({ path: `${SHOTS}/${n}.png` });
const body = () => page.locator('body').innerText();
async function openSample(id) {
  await page.locator('[data-menu="file"]').click();
  await page.locator('.mb-item', { hasText: SAMPLE_NAMES[id] }).first().click();
  await sleep(700);
}

async function sweepFight(done, max, shotAt = []) {
  for (let i = 0; i < max; i++) {
    const dir = i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(dir);
    await sleep(i % 2 === 0 ? 300 : 150);
    await tap('KeyF');
    await sleep(120);
    await page.keyboard.up(dir);
    if (shotAt.includes(i)) await gshot(`fight-sweep-${i}`);
    if (await done()) return true;
  }
  return false;
}
async function tap(k) {
  await page.keyboard.down(k);
  await sleep(90);
  await page.keyboard.up(k);
}
const play = () => page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());

// ---------- arena: idle player gets beaten ----------
await fresh();
await openSample('arena');
await shot('arena-1-edit');
await play();
await sleep(700);
await shot('arena-2-start');
let lost = false;
let n = 0;
for (let i = 0; i < 60 && !lost; i++) {
  await sleep(250);
  if (i % 2 === 0) await gshot(`arena-3-idle-${String(n++).padStart(2, '0')}`);
  lost = (await body()).includes('gục mất');
}
await sleep(300);
await shot('arena-4-lost');
record('idle player loses in arena', lost, lost ? 'lose text shown' : 'no loss');

// ---------- arena: take the sword and win ----------
await fresh();
await openSample('arena');
await play();
await sleep(500);
await page.keyboard.down('ArrowRight');
await sleep(300);
await page.keyboard.up('ArrowRight');
await tap('KeyE');
await sleep(200);
await shot('arena-5-sword');
const won = await sweepFight(async () => (await body()).includes('hạ đối thủ') , 80, Array.from({ length: 80 }, (_, i) => i));
for (let k = 0; k < 6; k++) { await gshot(`post-win-${k}`); await sleep(120); }
await shot('arena-7-won');
record('player with sword wins arena', won, won ? 'win text shown' : 'no win');

// ---------- lesson 8 through the UI ----------
await fresh();
const id = async (kind, nth) =>
  `.wc-node[data-id="${await page.locator(`.wc-node[data-kind="${kind}"]`).nth(nth).getAttribute('data-id')}"]`;
const botSel = async () => {
  const n = await page.locator('.wc-node[data-kind="character"]').count();
  for (let i = 0; i < n; i++) {
    const loc = page.locator('.wc-node[data-kind="character"]').nth(i);
    const t = await loc.innerText();
    if (t.includes('Bot') || t.includes('bot')) return `.wc-node[data-id="${await loc.getAttribute('data-id')}"]`;
  }
  return id('character', 1);
};
await page.locator('[data-tut="tutorial"]').click();
record('menu lists combat lesson', (await page.locator('.menu-item[data-lesson="combat"]').count()) === 1, '');
await page.locator('[data-tut="tutorial"]').click();
await startLesson(page, 'combat');
const info = async (label) => {
  const i = await panelInfo(page);
  console.log(label, '|', i.progress, '|', i.title);
  return i;
};
await info('start');
await shot('l8-01-intro');
await clickNext(page);
await info('after next');
await dragKind(page, 'health', 700, 500);
await info('added health');
await shot('l8-02-added');
const bot = await botSel();
const health2 = await id('health', 1);
await wire(page, bot, 'self', health2, 'self');
await info('wired self');
await wire(page, health2, 'dead', await id('win-lose', 0), 'win');
await info('wired win');
await shot('l8-03-wired');
await play();
await sleep(700);
await info('playing');
await page.keyboard.down('ArrowRight');
await sleep(300);
await page.keyboard.up('ArrowRight');
await tap('KeyE');
await sleep(200);
const lessonWon = await sweepFight(async () => (await body()).includes('hạ được bot'), 60);
await sleep(300);
await shot('l8-04-won');
const afterWin = await info('after win');
record('lesson 8 detects the win', lessonWon && !!afterWin.visible, afterWin.progress);
await play();
await sleep(500);
const edit = await info('back to edit');
await dragKind(page, 'fight', 700, 600);
await info('added fight');
const fight = await id('fight', 0);
await wire(page, bot, 'self', fight, 'self');
await wire(page, await id('character', 0), 'self', fight, 'target');
await wire(page, fight, 'moveX', bot, 'moveX');
await info('wired move');
const botHand = await (async () => {
  const hands = await page.locator('.wc-node[data-kind="hand-tool"]').count();
  return id('hand-tool', hands - 1);
})();
await shot('l8-05-before-attack');
await wire(page, fight, 'attack', botHand, 'use');
const fin = await info('wired attack');
await shot('l8-06-wired');
await play();
await sleep(500);
await info('playing fight');
let outcome = false;
for (let i = 0; i < 60 && !outcome; i++) {
  await sleep(300);
  if (i === 6) await shot('l8-07-fight');
  const t = await body();
  outcome = t.includes('gục mất') || t.includes('hạ được bot');
}
await shot('l8-08-result');
const last = await info('result');
record('lesson 8 reaches the end', outcome, last.progress + ' ' + last.title);

console.log('LOGS', JSON.stringify(logs, null, 1));
record('no console errors', logs.filter((l) => !l.includes('GPU stall') && !l.includes('swiftshader')).length === 0, `${logs.length} logs`);
await browser.close();
