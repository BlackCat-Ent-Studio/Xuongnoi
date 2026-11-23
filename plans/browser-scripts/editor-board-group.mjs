// Inside a group of the city sample: routing, knots kept per board, wire crossing the group edge.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-editor-board';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.env.PORT ?? 5242;
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
page.setDefaultTimeout(8000);
const logs = [];
page.on('pageerror', (e) => logs.push(e.message));
const check = (n, ok, d = '') => console.log(`${ok ? 'PASS' : 'FAIL'} | ${n} ${d}`);
await page.goto(`http://localhost:${PORT}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) await page.locator('[data-tut="invite-no"]').click();
await page.locator('[data-menu="file"]').click();
await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
await page.locator('.mb-item', { hasText: 'Thành phố giao hàng 3D' }).first().click();
await sleep(1500);
await page.addStyleTag({ content: '.pip{display:none !important}' }); // the floating game window covers part of the board

const routedCount = () => page.evaluate(() => ({ wires: document.querySelectorAll('.wc-wire').length, routed: [...document.querySelectorAll('.wc-wire')].filter((p) => p.getAttribute('d').includes(' Q ')).length, knots: document.querySelectorAll('.wc-knot').length }));
console.log('main', JSON.stringify(await routedCount()));

// a wire at the main board that leaves a group block (double-tap it)
const mainWire = await page.evaluate(() => {
  const hits = [...document.querySelectorAll('.wc-wire-hit')];
  for (let i = 0; i < hits.length; i++) {
    const len = hits[i].getTotalLength();
    for (const f of [0.5, 0.35, 0.65, 0.25, 0.75]) {
      const p = hits[i].getPointAtLength(len * f);
      const m = hits[i].getScreenCTM();
      const x = m.a * p.x + m.c * p.y + m.e;
      const y = m.b * p.x + m.d * p.y + m.f;
      if (x > 260 && x < 1130 && y > 90 && y < 640 && document.elementFromPoint(x, y) === hits[i]) return { x, y, id: hits[i].dataset.wire };
    }
  }
  return null;
});
console.log('main wire to double tap', JSON.stringify(mainWire));
if (mainWire) {
  await page.mouse.click(mainWire.x, mainWire.y);
  await page.mouse.move(mainWire.x, mainWire.y);
  await page.mouse.down();
  await page.mouse.up();
  await sleep(200);
  check('main board: double tap adds a knot on a wire (groups present)', (await routedCount()).knots === 1);
}
await page.screenshot({ path: `${OUT}/06-city-main-knot.png`, timeout: 60000 });

// pan so the group is clear of the corner tools: drag from an empty spot of the board
const empty = await page.evaluate(() => {
  const wc = document.querySelector('.wc');
  for (let y = 560; y > 120; y -= 20) for (let x = 1100; x > 300; x -= 20) {
    const e = document.elementFromPoint(x, y);
    if (e === wc || e?.classList?.contains('wc-world')) return { x, y };
  }
  return null;
});
await page.mouse.move(empty.x, empty.y);
await page.mouse.down();
await page.mouse.move(empty.x, empty.y - 300, { steps: 8 });
await page.mouse.up();
await sleep(300);
// enter the 57-card group
const b = await page.locator('.wc-group[data-id="truck"]').boundingBox();
console.log('truck box', JSON.stringify(b));
await page.evaluate(() => { window.__rt = []; });
await page.mouse.dblclick(b.x + b.width / 2, b.y + 14);
await sleep(1500);
const inside = await routedCount();
const cards = await page.locator('.wc-node').count();
console.log(`inside group: cards=${cards}`, JSON.stringify(inside));
check('group scope: wires routed and main knot not drawn here', inside.routed > 20 && inside.knots === 0);
console.log('open-scope routeWires', JSON.stringify(await page.evaluate(() => window.__rt)));
await page.screenshot({ path: `${OUT}/08-city-group-routed.png`, timeout: 60000 });

// double tap inside the group
const gw = await page.evaluate(() => {
  const hits = [...document.querySelectorAll('.wc-wire-hit')];
  for (let i = 0; i < hits.length; i++) {
    const len = hits[i].getTotalLength();
    for (const f of [0.5, 0.35, 0.65]) {
      const p = hits[i].getPointAtLength(len * f);
      const m = hits[i].getScreenCTM();
      const x = m.a * p.x + m.c * p.y + m.e;
      const y = m.b * p.x + m.d * p.y + m.f;
      if (x > 260 && x < 1130 && y > 90 && y < 640 && document.elementFromPoint(x, y) === hits[i]) return { x, y };
    }
  }
  return null;
});
if (gw) {
  await page.mouse.click(gw.x, gw.y);
  await page.mouse.move(gw.x, gw.y);
  await page.mouse.down();
  await page.mouse.up();
  await sleep(200);
  check('inside group: double tap adds a knot', (await routedCount()).knots === 1);
}
// timing: drag a card inside the group, JS per frame
await page.evaluate(() => { window.__rt = []; });
const hb = await page.evaluate(() => {
  for (const h of document.querySelectorAll('.wc-node .wc-node-head')) {
    const r = h.getBoundingClientRect();
    if (r.x > 280 && r.x < 1000 && r.y > 120 && r.y < 560 && h.contains(document.elementFromPoint(r.x + 20, r.y + r.height / 2))) return { x: r.x, y: r.y, h: r.height };
  }
  return null;
});
if (hb) {
  await page.mouse.move(hb.x + 20, hb.y + hb.h / 2);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) await page.mouse.move(hb.x + 20 + i * 3, hb.y + hb.h / 2 + i * 2);
  await sleep(200);
  const rt = await page.evaluate(() => window.__rt);
  await page.mouse.up();
  await sleep(300);
  const fr = rt.filter((q) => q[0] === 'frame');
  console.log(`group drag: per-frame JS calls=${fr.length} avg=${(fr.reduce((p, q) => p + q[2], 0) / fr.length).toFixed(1)}ms max=${Math.max(...fr.map((q) => q[2]))}ms wires/frame=${(fr.reduce((p, q) => p + q[1], 0) / fr.length).toFixed(1)}`);
  console.log('after drop routeWires', JSON.stringify((await page.evaluate(() => window.__rt)).filter((q) => q[0] === 'all')));
}
await page.screenshot({ path: `${OUT}/09-city-group-knot.png`, timeout: 60000 });
// back to the main board: group knot gone, main knot back
await page.locator('.wc-crumb-back').click();
await sleep(1000);
const back = await routedCount();
console.log('back on main', JSON.stringify(back));
check('main board keeps only its own knot', back.knots === 1);
console.log(logs.join('\n') || 'no page errors');
await browser.close();
