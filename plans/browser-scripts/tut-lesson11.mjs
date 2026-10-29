import { chromium } from 'playwright';

const OUT = 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/l11';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const context = await browser.newContext({ viewport: { width: 1920, height: 1700 } });
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
const title = async () => (await page.locator('.ld-body').isVisible().catch(() => false)) ? await page.locator('.ld-title').innerText() : 'hidden';
const step = async (label, expectTitle) => {
  const t = await title();
  const prog = await page.locator('.ld-steps').getAttribute('aria-label').then((a) => (a ?? '').replace(/Bước (\d+) trên (\d+)/, 'Bước $1/$2')).catch(() => '');
  rec(label, t === expectTitle, `${prog} | ${t}`);
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
const addNode = async (kind, x, y) => {
  const before = await ids();
  await dragKind(kind, x, y);
  const after = await ids();
  return after.find((i) => !before.includes(i));
};
const nodeSel = (id) => `.wc-node[data-id="${id}"]`;
const wire = async (from, fromPort, to, toPort) => {
  const a = await page.locator(`${from} .wc-port[data-port="${fromPort}"][data-dir="out"] .wc-dot`).first().boundingBox();
  const b = await page.locator(`${to} .wc-port[data-port="${toPort}"][data-dir="in"] .wc-dot`).first().boundingBox();
  if (!a || !b) throw new Error(`port missing ${from}.${fromPort} -> ${to}.${toPort}`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2, { steps: 8 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 3 });
  await page.mouse.up();
  await sleep(250);
};
const attrId = (sel) => page.locator(sel).first().getAttribute('data-id');
const hud = async () => (await page.locator('body').innerText()).replace(/\s+/g, ' ');

await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) await page.locator('[data-tut="invite-no"]').click();
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) await page.locator('[data-tut="invite-no"]').click();
logs.length = 0;

await page.locator('[data-tut="tutorial"]').click();
rec('menu lists lesson 11', (await page.locator('.menu-item[data-lesson="chance-zones"]').count()) === 1);
await page.locator('.menu-item[data-lesson="chance-zones"]').click();
await sleep(800);
await step('intro', 'Thử vận may');
await page.screenshot({ path: `${OUT}/l11-00-start.png` });
await page.locator('.ld [data-tut="next"]').click();
await sleep(300);
await step('watch', 'Xem thử trước');
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(1000);
await step('playing', 'Quay lại sửa');
await page.locator('.pbtn.stop').click();
await sleep(600);
await step('edit', 'Thêm Cảm biến vùng');

const zone = await addNode('zone', 700, 60);
await step('zone added', 'Thêm Số ngẫu nhiên');
await page.screenshot({ path: `${OUT}/l11-01-zone.png` });
const dice = await addNode('random', 1000, 300);
const and = await addNode('and', 700, 300);
await step('and added', 'Bấm E và đứng trong vùng');
const keyE = await page.locator('.wc-node[data-kind="key"]').evaluateAll((els) => els.map((e) => e.dataset.id));
// find the KeyE node: select each and read its param
let keyEId = null;
for (const id of keyE) {
  await page.locator(`${nodeSel(id)} .wc-node-head`).first().click();
  await sleep(150);
  const txt = await page.locator('.prop-row[data-param="key"]').first().innerText().catch(() => '');
  if (/KeyE|\bE\b/.test(txt)) keyEId = id;
}
rec('found key E', !!keyEId, String(keyEId));
await wire(nodeSel(keyEId), 'pressed', nodeSel(and), 'a');
await wire(nodeSel(zone), 'inside', nodeSel(and), 'b');
await step('and wired', 'Cho phép tung');
await wire(nodeSel(and), 'out', nodeSel(dice), 'roll');
await step('roll wired', 'Thêm Hiện số');
const show = await addNode('show-number', 1000, 520);
await wire(nodeSel(dice), 'value', nodeSel(show), 'value');
await step('show wired', 'Thêm So sánh');
const cmp = await addNode('compare', 700, 520);
await step('compare added', 'Thêm Hằng số');
const five = await addNode('const', 700, 700);
await step('const added', 'Đặt số 5');
await page.locator(`${nodeSel(five)} .wc-node-head`).first().click();
await sleep(200);
await page.locator('.prop-row[data-param="value"] input').first().fill('5');
await sleep(300);
await step('five set', 'Số tung có từ 5 trở lên không?');
await wire(nodeSel(dice), 'value', nodeSel(cmp), 'a');
await wire(nodeSel(five), 'value', nodeSel(cmp), 'b');
await step('compare wired', 'Thêm Công tắc nhớ');
const latch = await addNode('latch', 1000, 700);
await wire(nodeSel(cmp), 'out', nodeSel(latch), 'set');
await step('latch wired', 'Mở cổng');
const gateId = await page.locator('.wc-node[data-kind="block"]').evaluateAll((els) => els.map((e) => e.dataset.id));
// gate = block node whose header says tall solid; try each until the step advances
let opened = false;
for (const id of [gateId[2]]) {
  await wire(nodeSel(latch), 'on', nodeSel(id), 'hide');
  if ((await title()) === 'Thử đổ xúc xắc') {
    opened = true;
    break;
  }
}
rec('gate wire accepted by gate block only', opened);
await page.screenshot({ path: `${OUT}/l11-02-wired.png` });

// play: the dice part
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(1500);
await step('play roll', 'Quay lại sửa');
const k = page.keyboard;
const diceNow = async () => [...(await hud()).matchAll(/Điểm: (\d+)(?![.\d])/g)].map((x) => Number(x[1]))[0];
// Walk right in short bursts and tap E after each one until the dice shows a number (standing in the zone).
const walkAndRoll = async () => {
  for (let i = 0; i < 30; i++) {
    await k.down('ArrowRight');
    await sleep(500);
    await k.up('ArrowRight');
    await sleep(300);
    await k.down('KeyE');
    await sleep(350);
    await k.up('KeyE');
    await sleep(300);
    if ((await diceNow()) > 0) return true;
  }
  return false;
};
const rolled0 = await walkAndRoll();
let rolled = [];
let gateOpen = false;
for (let i = 0; i < 40 && !gateOpen; i++) {
  const m = await diceNow();
  if (m !== undefined) rolled.push(m);
  if (m >= 5) { gateOpen = true; break; }
  await k.down('KeyE');
  await sleep(350);
  await k.up('KeyE');
  await sleep(300);
}
rec('rolled with E in zone', rolled0 && rolled.length > 0, rolled.join(','));
rec('got a 5 or 6', gateOpen);
await page.screenshot({ path: `${OUT}/l11-03-rolled.png` });
console.log('HUD', (await hud()).slice(0, 200));
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(600);
await step('back to edit 2', 'Thêm Khoảng cách');

const dist = await addNode('distance', 700, 880);
const heroId = await attrId('.wc-node[data-kind="character"]');
let flagId = null;
for (const id of await page.locator('.wc-node[data-kind="block"]').evaluateAll((els) => els.map((e) => e.dataset.id))) {
  await page.locator(`${nodeSel(id)} .wc-node-head`).first().click();
  await sleep(120);
  const col = await page.locator('.prop-row[data-param="color"] input').first().inputValue().catch(() => '');
  if (col.toLowerCase() === '#ef4444') flagId = id;
}
rec('found flag', !!flagId);
await wire(nodeSel(heroId), 'self', nodeSel(dist), 'a');
await wire(nodeSel(flagId), 'self', nodeSel(dist), 'b');
await step('dist wired', 'Thêm Hiện số thứ hai');
const show2 = await addNode('show-number', 1000, 880);
await wire(nodeSel(dist), 'distance', nodeSel(show2), 'value');
await step('show2 wired', 'Thêm mảnh ghép Thắng/Thua');
const end = await addNode('win-lose', 1150, 700);
await wire(nodeSel(dist), 'within', nodeSel(end), 'win');
await step('win wired', 'Chơi tới cờ');
await page.screenshot({ path: `${OUT}/l11-04-final-board.png` });

await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(1500);
await walkAndRoll();
let ok = false;
for (let i = 0; i < 40 && !ok; i++) {
  if ((await diceNow()) >= 5) { ok = true; break; }
  await k.down('KeyE');
  await sleep(350);
  await k.up('KeyE');
  await sleep(300);
}
rec('final: rolled 5+', ok);
await k.down('ArrowRight');
let won = false;
for (let i = 0; i < 200 && !won; i++) {
  await sleep(250);
  if (i % 20 === 0) { console.log('t', i, [...(await hud()).matchAll(/Điểm: (\S+)/g)].map((x) => x[1]).join(' / ')); await page.screenshot({ path: `${OUT}/dbg-${String(i).padStart(3, '0')}.png`, clip: { x: 1500, y: 56, width: 420, height: 300 } }); }
  if ((await hud()).includes('Bạn thắng rồi') || (await title()) === 'Bạn gặp may rồi!') won = true;
}
await k.up('ArrowRight');
await page.screenshot({ path: `${OUT}/l11-05-win.png` });
rec('reaches win', won, await title());
rec('console errors', logs.length === 0, logs.join(' || ') || 'none');
console.log('FAILED_COUNT', failed);
await browser.close();
