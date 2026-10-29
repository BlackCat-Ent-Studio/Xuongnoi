import { chromium } from 'playwright';

const OUT = 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/l13';
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
const stepIs = async (label, id) => {
  const title = await page.locator('.ld-title').innerText().catch(() => 'hidden');
  const prog = await page.locator('.ld-steps').getAttribute('aria-label').then((a) => (a ?? '').replace(/Bước (\d+) trên (\d+)/, 'Bước $1/$2')).catch(() => '');
  rec(label, title === id, `${prog} | ${title}`);
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
const add = async (kind, x, y) => {
  const before = await ids();
  await dragKind(kind, x, y);
  const after = await ids();
  return after.find((v) => !before.includes(v));
};
const dot = (nodeSel, port, dir) => page.locator(`${nodeSel} .wc-port[data-port="${port}"][data-dir="${dir}"] .wc-dot`).first().boundingBox();
const nodeSel = (id) => `.wc-node[data-id="${id}"]`;
const wire = async (from, fromPort, to, toPort) => {
  const a = await dot(nodeSel(from), fromPort, 'out');
  const b = await dot(nodeSel(to), toPort, 'in');
  if (!a || !b) throw new Error(`port missing ${from}.${fromPort} -> ${to}.${toPort}`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2, { steps: 8 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 3 });
  await page.mouse.up();
  await sleep(250);
};
const select = async (id) => {
  await page.locator(nodeSel(id) + ' .wc-node-head').first().click();
  await sleep(200);
};
const axis = async (param, n, value) => {
  await page.locator(`.prop-row[data-param="${param}"] .prop-axis input`).nth(n).fill(String(value));
  await page.locator(`.prop-row[data-param="${param}"] .prop-axis input`).nth(n).blur();
  await sleep(250);
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
rec('menu lists lesson 13', (await page.locator('.menu-item[data-lesson="camera-portals"]').count()) === 1);
await page.locator('.menu-item[data-lesson="camera-portals"]').click();
await sleep(700);
await stepIs('intro', 'Vực quá rộng để nhảy');
await page.screenshot({ path: `${OUT}/01-start.png` });
await page.locator('.ld [data-tut="next"]').click();
await sleep(300);
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(1000);
await stepIs('playing -> back', 'Quay lại sửa');
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(600);
await stepIs('edit -> portals', 'Thêm hai cổng');

const heroId = await page.locator('.wc-node[data-kind="character"]').first().getAttribute('data-id');
const flagId = await page.locator('.wc-node[data-kind="block"]').evaluateAll((els) => {
  // the pickup block is the one whose title mentions it; fall back to last block
  return els[els.length - 1].dataset.id;
});

const pa = await add('portal', 700, 60);
await add('portal', 700, 330);
const all = await ids();
const pb = all[all.length - 1];
await stepIs('2 portals -> place', 'Đặt một cổng sang đảo');
await select(pb);
await axis('position', 0, 22);
await stepIs('placed -> pair', 'Ghép hai cổng thành một cặp');
await wire(pb, 'self', pa, 'partner');
await stepIs('paired -> try', 'Đi qua cổng');
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(500);
await page.keyboard.down('ArrowRight');
await sleep(2500);
await page.keyboard.up('ArrowRight');
await page.screenshot({ path: `${OUT}/02-after-portal-no-camera.png` });
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(600);
await stepIs('try -> edit2', 'Thêm mảnh ghép Khoảng cách');

// the second "Quay lại sửa" is step index 8; the check auto-advanced because play was stopped
const dist = await add('distance', 1000, 60);
await stepIs('distance added -> wire', 'Đo từ nhân vật tới cờ');
// find flag: pickup block = block node whose id is not first two blocks; locate by label via data-kind and position param is unreadable, so try each
const blocks = await page.locator('.wc-node[data-kind="block"]').evaluateAll((els) => els.map((e) => e.dataset.id));
let flagOk = null;
for (const b of blocks.reverse()) {
  await wire(b, 'self', dist, 'b');
  const t = await page.locator('.ld-title').innerText();
  if (t !== 'Đo từ nhân vật tới cờ' || (await page.locator('.wc-wire').count()) > 0) {
    flagOk = b;
  }
  break;
}
void flagOk;
void flagId;
await wire(heroId, 'self', dist, 'a');
await stepIs('dist wired -> threshold', 'Gần là bao nhiêu?');
await select(dist);
await page.locator('.prop-row[data-param="threshold"] input').first().fill('8');
await page.locator('.prop-row[data-param="threshold"] input').first().blur();
await sleep(300);
await stepIs('threshold -> camera', 'Thêm Máy quay');
const cam = await add('camera', 1000, 280);
await stepIs('camera -> on', 'Gần cờ thì bật máy quay');
await wire(dist, 'within', cam, 'on');
await stepIs('on -> zoom', 'Phóng to');
await select(cam);
await page.locator('.prop-row[data-param="zoom"] input').first().fill('1.8');
await page.locator('.prop-row[data-param="zoom"] input').first().blur();
await sleep(300);
await stepIs('zoom -> shake', 'Rung khi qua cổng');
await wire(pa, 'used', cam, 'shake');
await stepIs('shake -> key', 'Thêm phím R');
const key = await add('key', 700, 600);
await select(key);
await page.locator('.prop-key').first().click();
await sleep(150);
await page.keyboard.press('KeyR');
await sleep(300);
await stepIs('key R -> teleport', 'Thêm Dịch chuyển');
const tele = await add('teleport', 1000, 520);
await stepIs('teleport -> wire', 'Bấm R để về nhà');
await wire(heroId, 'self', tele, 'who');
await wire(key, 'pressed', tele, 'go');
await stepIs('tele wired -> home', 'Chọn nơi về');
await select(tele);
await axis('position', 0, -8);
await stepIs('home -> win nodes', 'Thêm mảnh ghép thắng');
const touch = await add('touch', 700, 800);
const end = await add('win-lose', 1000, 760);
await stepIs('win nodes -> wire', 'Chạm cờ là thắng');
await wire(heroId, 'self', touch, 'a');
const blocks2 = await page.locator('.wc-node[data-kind="block"]').evaluateAll((els) => els.map((e) => e.dataset.id));
await wire(blocks2[blocks2.length - 1], 'self', touch, 'b');
await wire(touch, 'touching', end, 'win');
await stepIs('wired -> play', 'Chạy thử');
await page.screenshot({ path: `${OUT}/03-built.png` });

await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(500);
await page.keyboard.down('ArrowRight');
let shot = 0;
const t0 = Date.now();
let title = '';
while (Date.now() - t0 < 30000) {
  await sleep(250);
  title = await page.locator('.ld-title').innerText().catch(() => '');
  if (Date.now() - t0 > 3000 && shot === 0) {
    await page.screenshot({ path: `${OUT}/04-play-mid.png` });
    shot = 1;
  }
  if (Date.now() - t0 > 4500 && shot === 1) {
    await page.screenshot({ path: `${OUT}/05-play-zoom.png` });
    shot = 2;
  }
  if (title === 'Bạn qua vực rồi!') break;
}
await page.keyboard.up('ArrowRight');
await page.screenshot({ path: `${OUT}/06-end.png` });
rec('lesson finished', title === 'Bạn qua vực rồi!', title);
console.log('LOGS', JSON.stringify(logs));
console.log(failed ? `FAILED ${failed}` : 'ALL PASS');
await browser.close();
