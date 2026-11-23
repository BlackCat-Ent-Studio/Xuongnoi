import { chromium } from 'playwright';

const OUT = 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/sweep';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('dialog', (d) => d.dismiss());

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

const stepNo = async () => (await page.locator('.ld-steps').getAttribute('aria-label').then((a) => (a ?? '').replace(/Bước (\d+) trên (\d+)/, 'Bước $1/$2')).catch(() => 'hidden'));
const dragKind = async (kind, dx, dy) => {
  const item = page.locator(`.palette-item[data-kind="${kind}"]`).first();
  const ib = await item.boundingBox();
  const cb = await page.locator('.wc').boundingBox();
  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await page.mouse.down();
  await page.mouse.move(ib.x + ib.width / 2 + 30, ib.y + ib.height / 2 + 10, { steps: 3 });
  await page.mouse.move(cb.x + dx, cb.y + dy, { steps: 6 });
  await page.mouse.up();
  await sleep(150);
};
const dotBox = async (sel) => page.locator(sel).first().boundingBox();
const probe = async (label, fromSel, toSel) => {
  const a = await dotBox(fromSel);
  const b = await dotBox(toSel);
  const hit = await page.evaluate(
    ({ x, y, cls }) => {
      const el = document.elementFromPoint(x, y);
      return el ? `${el.tagName}.${el.className}` : 'null';
    },
    { x: b.x + b.width / 2, y: b.y + b.height / 2 },
  );
  console.log(`${label} | from=${JSON.stringify(a && { x: a.x | 0, y: a.y | 0 })} to=${JSON.stringify(b && { x: b.x | 0, y: b.y | 0 })} topAtTarget=${hit}`);
};

await page.locator('[data-tut="tutorial"]').click();
await page.locator('.menu-item[data-lesson="win-lose"]').click();
await sleep(500);
// lesson 3 base board: counter, character, win-lose already present; add compare + const per tutorial steps
console.log('step at start', await stepNo());
await dragKind('win-lose', 600, 60);
await dragKind('compare', 600, 280);
await dragKind('const', 600, 500);
await page.locator('.wc-node[data-kind="const"] .wc-node-head').first().click();
await sleep(200);
await page.locator('.prop-row[data-param="value"] input').first().fill('-5');
await sleep(200);
console.log('step before wire', await stepNo());
await page.screenshot({ path: `${OUT}/debug-l3-before-wire.png` });
await probe('const.value -> compare.b', '.wc-node[data-kind="const"] .wc-port[data-port="value"][data-dir="out"] .wc-dot', '.wc-node[data-kind="compare"] .wc-port[data-port="b"][data-dir="in"] .wc-dot');
const wiresBefore = await page.locator('.wc-wire').count();
const a = await dotBox('.wc-node[data-kind="const"] .wc-port[data-port="value"][data-dir="out"] .wc-dot');
const b = await dotBox('.wc-node[data-kind="compare"] .wc-port[data-port="b"][data-dir="in"] .wc-dot');
await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
await page.mouse.down();
await page.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2, { steps: 8 });
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 3 });
await page.mouse.up();
await sleep(300);
console.log(`wires before=${wiresBefore} after=${await page.locator('.wc-wire').count()} step=${await stepNo()}`);
await page.screenshot({ path: `${OUT}/debug-l3-after-wire.png` });
console.log('LOGS', JSON.stringify(logs));
await browser.close();
