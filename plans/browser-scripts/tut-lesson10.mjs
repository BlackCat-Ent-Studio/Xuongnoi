import { chromium } from 'playwright';

const OUT = 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/sweep';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const context = await browser.newContext({ viewport: { width: 1920, height: 1300 } });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('dialog', (d) => d.dismiss());

let failed = 0;
const rec = (name, ok, d = '') => {
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${d}`);
};
const panel = async () => {
  if (!(await page.locator('.ld-body').isVisible().catch(() => false))) return { visible: false };
  return {
    visible: true,
    progress: await page.locator('.ld-steps').getAttribute('aria-label').then((a) => (a ?? '').replace(/Bước (\d+) trên (\d+)/, 'Bước $1/$2')),
    title: await page.locator('.ld-title').innerText(),
  };
};
const step = async (label, n) => {
  const p = await panel();
  rec(label, p.visible && p.progress === `Bước ${n}/23`, `${p.progress ?? 'hidden'} | ${p.title ?? ''}`);
};
const dragKind = async (kind, x, y) => {
  const item = page.locator(`.palette-item[data-kind="${kind}"]`).first();
  await item.scrollIntoViewIfNeeded();
  const ib = await item.boundingBox();
  const cb = await page.locator('.wc').boundingBox();
  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await page.mouse.down();
  await page.mouse.move(ib.x + ib.width / 2 + 30, ib.y + ib.height / 2 + 10, { steps: 3 });
  await page.mouse.move(cb.x + x, cb.y + y, { steps: 6 });
  await page.mouse.up();
  await sleep(200);
};
const ids = () => page.locator('.wc-node').evaluateAll((els) => els.map((e) => e.dataset.id));
const newId = async (before) => {
  const after = await ids();
  return after.find((x) => !before.includes(x));
};
const dot = async (nodeSel, port, dir) => {
  const loc = page.locator(`${nodeSel} .wc-port[data-port="${port}"][data-dir="${dir}"] .wc-dot`).first();
  return loc.boundingBox();
};
const wire = async (from, fromPort, to, toPort) => {
  const a = await dot(from, fromPort, 'out');
  const b = await dot(to, toPort, 'in');
  if (!a || !b) throw new Error(`port missing ${from}.${fromPort} -> ${to}.${toPort}`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2, { steps: 8 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 3 });
  await page.mouse.up();
  await sleep(250);
};
const nodeSel = (id) => `.wc-node[data-id="${id}"]`;
const kindSel = (kind) => `.wc-node[data-kind="${kind}"]`;
const dragHeadOf = async (sel, dx, dy) => {
  const hb = await page.locator(`${sel} .wc-node-head`).first().boundingBox();
  await page.mouse.move(hb.x + 10, hb.y + 8);
  await page.mouse.down();
  await page.mouse.move(hb.x + 10 + dx, hb.y + 8 + dy, { steps: 8 });
  await page.mouse.up();
  await sleep(150);
};

await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
logs.length = 0;

await page.locator('[data-tut="tutorial"]').click();
rec('menu lists lesson 10', (await page.locator('.menu-item[data-lesson="bot-driver"]').count()) === 1);
await page.locator('.menu-item[data-lesson="bot-driver"]').click();
await sleep(700);
await step('L10 intro', 1);
await page.locator('.ld [data-tut="next"]').click();
await sleep(300);
await step('L10 watch', 2);
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(1200);
await step('L10 playing -> back-to-edit', 3);
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(600);
await step('L10 edit -> add sequence', 4);
await page.screenshot({ path: `${OUT}/l10-00-start.png` });

// 4: sequence
let before = await ids();
await dragKind('sequence', 760, 60);
const seq = await newId(before);
await step('L10 add sequence -> add go-to', 5);
// 5: walker go-to
before = await ids();
await dragKind('go-to', 760, 300);
const walk = await newId(before);
await step('L10 add go-to -> wire walker who', 6);
const bot = kindSel('character');
const car = kindSel('vehicle');
const botId = await page.locator(bot).first().getAttribute('data-id');
const carId = await page.locator(car).first().getAttribute('data-id');
// flag: pickup block (the block node that is not the walls); only one carries type=pickup
const flagId = await page.locator(kindSel('block')).first().getAttribute('data-id');
await page.locator(nodeSel(flagId)+' .wc-node-head').first().click();
await sleep(200);
rec('L10 flag block is pickup', (await page.locator('.prop-row[data-param="type"] select').first().inputValue()) === 'pickup');
await page.screenshot({ path: `${OUT}/l10-01-after-walker.png` });
await wire(nodeSel(botId), 'self', nodeSel(walk), 'self');
await wire(nodeSel(carId), 'self', nodeSel(walk), 'target');
await step('L10 wired walker who -> wire walker move', 7);
await wire(nodeSel(walk), 'moveX', nodeSel(botId), 'moveX');
await wire(nodeSel(walk), 'moveY', nodeSel(botId), 'moveY');
await step('L10 wired walker move -> stop distance', 8);
// set stopDistance on walker via the properties panel
await page.locator(nodeSel(walk)+' .wc-node-head').first().click();
await sleep(200);
await page.locator('.prop-row[data-param="stopDistance"] input').first().fill('2');
await sleep(300);
await step('L10 stopDistance -> wire step1', 9);
await wire(nodeSel(seq), 'step1', nodeSel(walk), 'go');
await step('L10 wire step1 -> add enter-exit', 10);

// 10: enter-exit
before = await ids();
await dragKind('enter-exit', 760, 520);
const enter = await newId(before);
await step('L10 add enter -> wire enter who', 11);
await wire(nodeSel(botId), 'self', nodeSel(enter), 'character');
await step('L10 wire enter who -> wire arrive', 12);
await wire(nodeSel(walk), 'arrivedPulse', nodeSel(enter), 'press');
await wire(nodeSel(walk), 'arrivedPulse', nodeSel(seq), 'next');
await step('L10 wire arrive -> add go-to drive', 13);

// 13: driver go-to
before = await ids();
await dragKind('go-to', 1060, 300);
const drive = await newId(before);
await step('L10 add go-to drive -> wire drive who', 14);
await wire(nodeSel(carId), 'self', nodeSel(drive), 'self');
await wire(nodeSel(flagId), 'self', nodeSel(drive), 'target');
await step('L10 wire drive who -> wire step2', 15);
await wire(nodeSel(seq), 'step2', nodeSel(drive), 'go');
await step('L10 wire step2 -> wire drive move', 16);
await wire(nodeSel(drive), 'moveX', nodeSel(carId), 'moveX');
await wire(nodeSel(drive), 'moveY', nodeSel(carId), 'moveY');
await step('L10 wire drive move -> add touch', 17);

// 17: touch
before = await ids();
await dragKind('touch', 1060, 60);
const touch = await newId(before);
await step('L10 add touch -> wire touch', 18);
await wire(nodeSel(carId), 'self', nodeSel(touch), 'a');
await wire(nodeSel(flagId), 'self', nodeSel(touch), 'b');
await step('L10 wire touch -> add win-lose', 19);

// 19: win-lose
before = await ids();
await dragKind('win-lose', 1060, 520);
const endId = await newId(before);
await step('L10 add win-lose -> wire win', 20);
await wire(nodeSel(touch), 'touching', nodeSel(endId), 'win');
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
const t0 = Date.now();
let last = '';
let winSeen = false;
let guard = 0;
while (Date.now() - t0 < 90000 && guard++ < 400) {
  await sleep(400);
  const p = await panel();
  const game = (await page.locator('.game-box').innerText().catch(() => '')).replace(/\s+/g, ' ');
  const key = `${p.visible ? p.progress + ' ' + p.title : 'hidden'} | ${game.slice(0, 60)}`;
  if (key !== last) {
    console.log(`t=${((Date.now() - t0) / 1000).toFixed(1)}s ${key}`);
    last = key;
  }
  if (game.includes('Thắng') || (p.visible && p.progress === 'Bước 23/23')) {
    winSeen = true;
    break;
  }
}
await page.screenshot({ path: `${OUT}/l10-03-run.png` });
rec('L10 play reaches win (overlay or win step)', winSeen, `${Math.round((Date.now() - t0) / 1000)}s`);
rec('L10 console errors', logs.length === 0, logs.join(' || ') || 'none');
console.log('FAILED_COUNT', failed);
await browser.close();
