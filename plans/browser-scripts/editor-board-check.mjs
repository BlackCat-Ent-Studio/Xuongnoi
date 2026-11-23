const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function openBrowser() {
  const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('dialog', (d) => { logs.push(`[DIALOG] ${d.message()}`); d.dismiss(); });
  return { browser, context, page, logs };
}
async function openSample(page, label) {
  await page.locator('[data-menu="file"]').click();
  await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await page.locator('.mb-item', { hasText: label }).first().click();
  await sleep(700);
}

const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-editor-board';
const PORT = process.env.PORT ?? 5242;
const { browser, page, logs } = await openBrowser();
const res = [];
const check = (name, ok, d = '') => {
  res.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} ${d}`);
};
import fs from 'node:fs';
fs.mkdirSync(OUT, { recursive: true });
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png`, timeout: 120000 });

await page.goto(`http://localhost:${PORT}/${process.env.QS ?? ""}`);
await sleep(1500);
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}

const wirePathD = () => page.evaluate(() => [...document.querySelectorAll('.wc-wire')].map((p) => p.getAttribute('d')));
const wireMid = (idx) => page.evaluate((i) => {
  const hit = document.querySelectorAll('.wc-wire-hit')[i];
  const len = hit.getTotalLength();
  const p = hit.getPointAtLength(len / 2);
  const m = hit.getScreenCTM();
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}, idx);

// ---------- small sample ----------
await openSample(page, 'Nhặt sao');
await sleep(600);
const ds = await wirePathD();
check('sample wires drawn', ds.length > 2, `${ds.length} wires`);
check('wires are routed (rounded corners Q)', ds.some((d) => d.includes(' Q ')), `${ds.filter((d) => d.includes(' Q ')).length}/${ds.length} have corners`);
await shot('01-small-sample-routed');

// double-tap a wire -> knot, then drag it
const before = await wirePathD();
let idx = 0;
let mid = await wireMid(idx);
// pick a wire with a clear point (not under a card): test elementFromPoint
for (let i = 0; i < before.length; i++) {
  const m = await wireMid(i);
  const hitEl = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.className?.baseVal ?? document.elementFromPoint(x, y)?.className, m);
  if (String(hitEl).includes('wc-wire-hit')) { idx = i; mid = m; break; }
}
await page.mouse.click(mid.x, mid.y);
await page.mouse.move(mid.x, mid.y);
await page.mouse.down();
await page.mouse.up();
await sleep(120);
check('double tap adds a knot', (await page.locator('.wc-knot').count()) === 1, `knots=${await page.locator('.wc-knot').count()}`);
const kn = await page.locator('.wc-knot').first().boundingBox();
const kx = kn.x + kn.width / 2;
const ky = kn.y + kn.height / 2;
await page.mouse.move(kx, ky);
await page.mouse.down();
await page.mouse.move(kx, ky + 90, { steps: 8 });
await page.mouse.up();
await sleep(150);
const kn2 = await page.locator('.wc-knot').first().boundingBox();
check('knot dragged', Math.abs(kn2.y - kn.y) > 60, `dy=${Math.round(kn2.y - kn.y)}`);
await shot('02-knot-dragged');
const saved = await page.evaluate(() => JSON.stringify(Object.keys(JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => k.includes('autosave')) ?? '') ?? '{}')?.graph?.knots ?? {})));
console.log('autosave knots keys', saved);
// undo removes it
await page.keyboard.press('Control+z');
await sleep(150);
check('undo takes the knot back (move step)', (await page.locator('.wc-knot').count()) <= 1);
await page.keyboard.press('Control+z');
await sleep(150);
check('undo twice: no knot', (await page.locator('.wc-knot').count()) === 0);
await page.keyboard.press('Control+y');
await page.keyboard.press('Control+y');
await sleep(150);
check('redo brings the knot', (await page.locator('.wc-knot').count()) === 1);

// ---------- focus ----------
const wiredId = await page.evaluate(() => { const k = Object.keys(localStorage).find((x) => x.includes('autosave')); const g = JSON.parse(localStorage.getItem(k)).graph; return g.wires[Math.floor(g.wires.length / 2)].to.node; });
console.log('focus target', wiredId);
const head = page.locator(`.wc-node[data-id="${wiredId}"] .wc-node-head`);
const hb = await head.boundingBox();
await page.mouse.move(hb.x + 40, hb.y + hb.height / 2);
await page.mouse.down();
await page.mouse.move(hb.x + 43, hb.y + hb.height / 2 + 2);
await page.mouse.up();
await sleep(400);
const nFaded = await page.locator('.wc-node.faded').count();
const nLit = await page.locator('.wc-wire-g.lit').count();
check('tap card focuses', (await page.locator('.wc.focusing').count()) === 1 && nFaded > 0 && nLit > 0, `faded=${nFaded} lit=${nLit}`);
const posBefore = await page.evaluate(() => [...document.querySelectorAll('.wc-node')].map((n) => n.style.left + n.style.top).join('|'));
await shot('03-focus');
await page.keyboard.press('Escape');
await sleep(350);
check('Esc clears focus', (await page.locator('.wc.focusing').count()) === 0 && (await page.locator('.wc-node.faded').count()) === 0);
{ const b = await head.boundingBox(); await page.mouse.click(b.x + 40, b.y + 10); }
await sleep(300);
check('tap again focuses', (await page.locator('.wc.focusing').count()) === 1);
await page.mouse.click(1100, 330);
await sleep(350);
check('tap empty board clears focus', (await page.locator('.wc.focusing').count()) === 0);
const posAfter = await page.evaluate(() => [...document.querySelectorAll('.wc-node')].map((n) => n.style.left + n.style.top).join('|'));
check('taps did not move cards', posBefore === posAfter);

// wobble tap: no wire redraw
const dBefore = (await wirePathD()).join('');
const hb2 = await head.boundingBox();
await page.mouse.move(hb2.x + 40, hb2.y + 10);
await page.mouse.down();
await page.mouse.move(hb2.x + 43, hb2.y + 13);
await page.mouse.move(hb2.x + 41, hb2.y + 9);
await page.mouse.up();
await sleep(200);
check('6px wobble = tap, wires unchanged', (await wirePathD()).join('') === dBefore);
await page.mouse.click(1100, 330);

// ---------- drop settle ----------
const rects = await page.evaluate(() => [...document.querySelectorAll('.wc-node')].map((n) => { const r = n.getBoundingClientRect(); return { id: n.dataset.id, x: r.x, y: r.y, w: r.width, h: r.height, l: n.style.left, t: n.style.top }; }));
const a = rects[0];
const b = rects.find((r) => r.id !== a.id && Math.abs(r.x - a.x) > 100);
await page.mouse.move(a.x + 40, a.y + 12);
await page.mouse.down();
await page.mouse.move(b.x + 40, b.y + 30, { steps: 10 });
await shot('04-drop-before-release');
await page.mouse.up();
await sleep(300);
const after = await page.evaluate((id) => { const n = document.querySelector(`.wc-node[data-id="${id}"]`); const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }, a.id);
const others = await page.evaluate((id) => [...document.querySelectorAll('.wc-node')].filter((n) => n.dataset.id !== id).map((n) => { const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height }; }), a.id);
const overlap = others.some((o) => after.x < o.x + o.w - 1 && after.x + after.w > o.x + 1 && after.y < o.y + o.h - 1 && after.y + after.h > o.y + 1);
check('dropped on a card: slides off, no overlap', !overlap, `dropped ~(${Math.round(b.x + 40 - 40)},${Math.round(b.y + 30 - 12)}) now (${Math.round(after.x)},${Math.round(after.y)})`);
await shot('05-drop-after');
// free-space drop stays exact: move the right-most card 37px right, 20px down (free space there)
const c = await page.evaluate(() => {
  const heads = [...document.querySelectorAll('.wc-node .wc-node-head')].map((h) => ({ h, r: h.getBoundingClientRect() })).filter((q) => q.r.y > 100 && q.r.y < 300 && q.h.contains(document.elementFromPoint(q.r.x + 20, q.r.y + q.r.height / 2)));
  heads.sort((p, q) => q.r.x - p.r.x);
  const n = heads[0].h.closest('.wc-node');
  return { id: n.dataset.id, x: heads[0].r.x, y: heads[0].r.y, h: heads[0].r.height, l: parseFloat(n.style.left), t: parseFloat(n.style.top) };
});
await page.mouse.move(c.x + 20, c.y + c.h / 2);
await page.mouse.down();
await page.mouse.move(c.x + 20 + 37, c.y + c.h / 2 + 20, { steps: 6 });
await page.mouse.up();
await sleep(300);
const c2 = await page.evaluate((id) => { const n = document.querySelector(`.wc-node[data-id="${id}"]`); return { l: parseFloat(n.style.left), t: parseFloat(n.style.top) }; }, c.id);
console.log('free drop moved world px by', c2.l - c.l, c2.t - c.t, '(zoom-scaled pointer delta 37,20)');
const zoomNow = await page.evaluate(() => parseFloat(document.querySelector('.wc-world').style.transform.match(/scale\(([^)]+)\)/)[1]));
check('free-space drop lands exactly at pointer delta (no slide)', Math.abs(c2.l - c.l - Math.round(37 / zoomNow)) <= 1 && Math.abs(c2.t - c.t - Math.round(20 / zoomNow)) <= 1, `zoom=${zoomNow.toFixed(2)}`);

// ---------- timing on city ----------
async function frameStats(label, run) {
  await page.evaluate(() => {
    window.__ft = [];
    let last = performance.now();
    const loop = (t) => { window.__ft.push(t - last); last = t; window.__raf = requestAnimationFrame(loop); };
    window.__raf = requestAnimationFrame(loop);
  });
  await run();
  const ft = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__ft; });
  const rt = await page.evaluate(() => { const r = window.__rt ?? []; window.__rt = []; return r; });
  for (const kind of ['all', 'some', 'frame']) {
    const r = rt.filter((q) => q[0] === kind);
    if (r.length) console.log(`  ${kind === 'frame' ? 'per-frame wire redraw (JS)' : `routeWires ${kind}`}: calls=${r.length} wires/call=${(r.reduce((p, q) => p + q[1], 0) / r.length).toFixed(1)} ms avg=${(r.reduce((p, q) => p + q[2], 0) / r.length).toFixed(1)} max=${Math.max(...r.map((q) => q[2]))}`);
  }
  const s = [...ft].sort((x, y) => x - y);
  const avg = ft.reduce((p, q) => p + q, 0) / ft.length;
  console.log(`TIMING ${label}: frames=${ft.length} avg=${avg.toFixed(1)}ms p95=${s[Math.floor(s.length * 0.95)]?.toFixed(1)}ms max=${s[s.length - 1]?.toFixed(1)}ms`);
  return { avg, max: s[s.length - 1] };
}
async function dragCard(selector, dx, dy) {
  const hbx = await page.locator(selector).first().boundingBox();
  await page.mouse.move(hbx.x + 30, hbx.y + 12);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) await page.mouse.move(hbx.x + 30 + (dx * i) / 30, hbx.y + 12 + (dy * i) / 30);
  await page.mouse.up();
}
async function panBoard() {
  await page.mouse.move(700, 850);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) await page.mouse.move(700 + i * 6, 850 - i * 3);
  await page.mouse.up();
}

if (process.env.CITY !== '0' && process.env.PERF !== '0') {
  await page.evaluate(() => localStorage.clear());
  await openSample(page, 'Nhặt sao');
  await sleep(500);
  await frameStats('small drag card', () => dragCard('.wc-node .wc-node-head', 160, 80));
  await frameStats('small pan', panBoard);
  const t0 = Date.now();
  await openSample(page, 'Thành phố giao hàng 3D');
  await sleep(1500);
  console.log('open city ms ~', Date.now() - t0 - 2200);
  const cards = await page.locator('.wc-node').count();
  const wires = await page.locator('.wc-wire').count();
  const curved = await page.evaluate(() => [...document.querySelectorAll('.wc-wire')].filter((p) => p.getAttribute('d').includes(' Q ')).length);
  console.log(`city main view: cards(visible)=${cards} wires=${wires} routedWires=${curved}`);
  await shot('06-city-main');
  await frameStats('city main drag card', () => dragCard('.wc-node .wc-node-head, .wc-group .wc-node-head', 120, 60));
  await frameStats('city main pan', panBoard);
  await shot('07-city-after');
  // enter the biggest group that has wires (57 cards, 74 inside wires)
  const ids = await page.evaluate(() => [...document.querySelectorAll('.wc-group')].map((g) => g.dataset.id));
  let best = null;
  for (const id of ids) {
    const b = await page.locator(`.wc-group[data-id="${id}"]`).boundingBox();
    if (!b) continue;
    await page.evaluate(() => { window.__rt = []; });
    await page.mouse.dblclick(b.x + b.width / 2, b.y + 14);
    await sleep(1200);
    const n = await page.locator('.wc-node').count();
    if (n >= 50 && n <= 60) { best = n; break; }
    await page.keyboard.press('Escape');
    await page.locator('.wc-crumb button').first().click().catch(() => {});
    await sleep(600);
  }
  console.log('inside group cards =', best, 'wires =', await page.locator('.wc-wire').count(), 'routed =', await page.evaluate(() => [...document.querySelectorAll('.wc-wire')].filter((p) => p.getAttribute('d').includes(' Q ')).length));
  console.log('  scope open routeWires', JSON.stringify(await page.evaluate(() => window.__rt)));
  await shot('08-city-big-group');
  await frameStats('city big group drag card', () => dragCard('.wc-node .wc-node-head', 120, 60));
  await frameStats('city big group pan', panBoard);
}

console.log(logs.filter((l) => !l.includes('WebGL') && !l.includes('GPU')).join('\n') || 'no console errors');
console.log(`${res.filter(Boolean).length}/${res.length} checks passed`);
await browser.close();
