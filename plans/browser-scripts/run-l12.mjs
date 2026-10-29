import { chromium } from 'file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs';

const OUT = 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/l12';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const context = await browser.newContext({ viewport: { width: 1920, height: 1100 } });
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
  const title = await page.locator('.tut-title').innerText().catch(() => 'hidden');
  const prog = await page.locator('.tut-progress').innerText().catch(() => '');
  rec(label, title === id, `${prog} | ${title}`);
};
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` });
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
const num = async (param, value) => {
  await page.locator(`.prop-row[data-param="${param}"] input`).first().fill(String(value));
  await page.locator(`.prop-row[data-param="${param}"] input`).first().blur();
  await sleep(250);
};
const play = async () => {
  await page.locator('[data-tut="play"]').click();
  await sleep(600);
};

await page.goto('http://localhost:5192/');
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
rec('menu lists lesson 12', (await page.locator('[data-lesson="platforms-shooting"]').count()) === 1);
await page.locator('[data-lesson="platforms-shooting"]').click();
await sleep(700);
await stepIs('intro', 'Qua hố, hạ mục tiêu, tới cờ');
await shot('01-start');
await page.locator('.tut-panel [data-tut="next"]').click();
await sleep(300);

const heroId = await page.locator('.wc-node[data-kind="character"]').first().getAttribute('data-id');
const keyIds = await page.locator('.wc-node[data-kind="key"]').evaluateAll((els) => els.map((e) => e.dataset.id));
const healthId = await page.locator('.wc-node[data-kind="health"]').first().getAttribute('data-id');
const orId = await page.locator('.wc-node[data-kind="or"]').first().getAttribute('data-id');
const fireKey = keyIds[1];

await stepIs('add platform', 'Thêm bệ di chuyển');
const plat = await add('moving-platform', 700, 80);
await stepIs('platform A', 'Đặt điểm A bên bờ trái');
await select(plat);
await axis('position', 0, -2);
await axis('position', 1, -0.25);
await stepIs('platform B', 'Đặt điểm B bên bờ phải');
await axis('to', 0, 2);
await axis('to', 1, -0.25);
await stepIs('play ride', 'Đi nhờ bệ');
await play();
await shot('02-ride-start');
await page.keyboard.down('ArrowRight');
await sleep(1500);
await page.keyboard.up('ArrowRight');
await sleep(3300);
await shot('03-wait-platform');
await page.keyboard.down('ArrowRight');
await sleep(900);
await page.keyboard.up('ArrowRight');
await sleep(2500);
await shot('04-riding');
await stepIs('still on ride step while playing', 'Quay lại sửa');
await page.locator('[data-tut="play"]').click();
await sleep(600);
await stepIs('edit -> shooter', 'Thêm khối Bắn đạn');
const gun = await add('shooter', 1000, 80);
await stepIs('wire shooter', 'Ai là người bắn?');
await wire(heroId, 'self', gun, 'shooter');
await stepIs('wire fire', 'Bấm J để bắn');
await wire(fireKey, 'held', gun, 'fire');
await stepIs('play shoot', 'Bắn mục tiêu');
await shot('05-shooter-wired');
await play();
await stepIs('shoot step', 'Bắn đủ ba phát');
await page.keyboard.down('ArrowRight');
await sleep(1500);
await page.keyboard.up('ArrowRight');
await sleep(3300);
await page.keyboard.down('ArrowRight');
await sleep(1900);
await page.keyboard.up('ArrowRight');
await sleep(300);
for (let i = 0; i < 4; i++) {
  await page.keyboard.press('j');
  await sleep(700);
}
await shot('06-shooting');
await page.locator('[data-tut="play"]').click();
await sleep(600);
await stepIs('edit -> spawner', 'Thêm khối Sinh vật thể');
const spawner = await add('spawner', 700, 500);
await stepIs('spawner setup', 'Cho đá rơi trên đường tới cổng');
await select(spawner);
await axis('position', 0, 10.5);
await axis('position', 1, 6);
await num('lifetime', 1);
await stepIs('toucher', 'Ai bị đá làm hại?');
await wire(heroId, 'self', spawner, 'toucher');
await stepIs('lose', 'Chạm đá là thua');
await wire(spawner, 'touched', orId, 'b');
await stepIs('timer', 'Thêm Hẹn giờ 3 giây');
const timer = await add('timer', 1000, 500);
await select(timer);
await num('seconds', 3);
await stepIs('timer->spawn', 'Hết giờ là thả đá');
await wire(timer, 'done', spawner, 'spawn');
await stepIs('add loop or', 'Thêm một khối Hoặc để lặp');
const loop = await add('or', 1000, 700);
await stepIs('loop in', 'Hết giờ vào khối Hoặc mới');
await wire(timer, 'done', loop, 'a');
await stepIs('loop out', 'Đếm lại mãi mãi');
await wire(loop, 'out', timer, 'reset');
await stepIs('add rotating', 'Thêm bệ xoay làm cổng');
const gate = await add('rotating-platform', 700, 700);
await stepIs('rotating setup', 'Dựng cổng trước cờ');
await select(gate);
await axis('position', 0, 13);
await axis('position', 1, 2);
await axis('size', 0, 0.5);
await axis('size', 1, 4);
await stepIs('turn wire', 'Mục tiêu gục thì cổng xoay');
await wire(healthId, 'dead', gate, 'turn');
await stepIs('play final', 'Chơi cả ván');
await shot('07-built');

let title = '';
for (let attempt = 0; attempt < 3 && title !== 'Tới cờ rồi!'; attempt++) {
  if (attempt > 0) {
    // lost: back to edit then play again
    await page.locator('[data-tut="play"]').click();
    await sleep(600);
  }
  await play();
  await page.keyboard.down('ArrowRight');
  await sleep(1500);
  await page.keyboard.up('ArrowRight');
  await sleep(3300);
  await page.keyboard.down('ArrowRight');
  await sleep(1900);
  await page.keyboard.up('ArrowRight');
  await sleep(300);
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('j');
    await sleep(700);
  }
  await shot(`08-gate-open-${attempt}`);
  await sleep(1500);
  await page.keyboard.down('ArrowRight');
  const t0 = Date.now();
  while (Date.now() - t0 < 12000) {
    await sleep(250);
    title = await page.locator('.tut-title').innerText().catch(() => '');
    if (title === 'Tới cờ rồi!') break;
  }
  await page.keyboard.up('ArrowRight');
  await shot(`09-end-${attempt}`);
}
rec('lesson reached win step', title === 'Tới cờ rồi!', title);
console.log('LOGS', JSON.stringify(logs));
console.log(failed ? `FAILED ${failed}` : 'ALL PASS');
await browser.close();
