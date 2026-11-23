// Screenshots of the wire-tidy preview. usage: node shot-wire-tidy.mjs   (opens index.html from file://)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'shots');
fs.mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.join(here, 'index.html')).href;
const logs = [];
const b = await chromium.launch();

async function open(viewport, hasTouch = false) {
  const p = await b.newPage({ viewport, deviceScaleFactor: 1, hasTouch });
  p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(700);
  return p;
}
const shot = (p, name) => p.screenshot({ path: path.join(out, name + '.png') });
const settle = (p, ms = 1100) => p.waitForTimeout(ms);
const ALL = { pins: true, avoid: true, focus: true, knots: true, arrange: true, labels: true };

const p = await open({ width: 1360, height: 820 });
const results = {};
for (const lv of ['5', '7']) {
  await p.evaluate((l) => WT.setLevel(l), lv);
  await settle(p, 500);
  await p.evaluate(() => WT.setToggles({}));
  await settle(p);
  await shot(p, `m${lv}-before`);
  results[lv] = await p.evaluate(() => { const c = WT.counts(); return { before: c.before, after: c.after, current: c.current }; });
  await p.evaluate((a) => WT.setToggles(a), ALL);
  await settle(p, 1600);
  await shot(p, `m${lv}-after`);
  results[lv].shown = await p.evaluate(() => WT.live().cur);
  // each toggle alone, numbers only
  const solo = {};
  for (const k of ['pins', 'avoid', 'arrange', 'labels']) {
    solo[k] = await p.evaluate((key) => { const b = WT.live(); return b.snapshot({ pins: false, avoid: false, focus: false, knots: false, arrange: false, labels: false, [key]: true }); }, k);
  }
  solo.pins_avoid = await p.evaluate(() => WT.live().snapshot({ pins: true, avoid: true, arrange: false }));
  solo.arrange_avoid_pins = await p.evaluate(() => WT.live().snapshot({ pins: true, avoid: true, arrange: true }));
  results[lv].solo = solo;
}

// focus mode (M7, all on): tap the go-to card
await p.evaluate(() => WT.setToggles({ pins: true, avoid: true, focus: true, knots: true, arrange: true, labels: true }));
await settle(p, 1400);
const gotoBox = await p.locator('.wc-node[data-id="s-goto"] .wc-name').boundingBox();
await p.mouse.click(gotoBox.x + 10, gotoBox.y + 6);
await settle(p, 500);
await p.mouse.move(5, 5);
await shot(p, 'm7-focus');
await p.mouse.click(40, 760);
await settle(p, 400);

// reroute knot (M7, everything on except labels): double-click the blue loop above the cards, drag the knot, then remove it with a double-click
await p.evaluate(() => WT.setToggles({ pins: true, avoid: true, focus: true, knots: true, arrange: true, labels: false }));
await settle(p, 1400);
const toScreen = (id, f) => p.evaluate(([wid, frac]) => {
  const b = WT.live(), r = b.routeById[wid], rect = b.host.getBoundingClientRect();
  // point on the longest segment of the route
  let best = 1, bl = 0;
  for (let j = 1; j < r.pts.length; j++) { const l = Math.hypot(r.pts[j].x - r.pts[j - 1].x, r.pts[j].y - r.pts[j - 1].y); if (l > bl) { bl = l; best = j; } }
  const a = r.pts[best - 1], c = r.pts[best], q = { x: a.x + (c.x - a.x) * frac, y: a.y + (c.y - a.y) * frac };
  return { x: rect.left + b.view.x + q.x * b.view.k, y: rect.top + b.view.y + q.y * b.view.k };
}, [id, f]);
const pt = await toScreen('sw3', 0.5);
await p.mouse.dblclick(pt.x, pt.y);
await settle(p, 300);
const knotPos = () => p.evaluate(() => { const b = WT.live(); for (const id in b.knots) { const k = b.knots[id][0], rect = b.host.getBoundingClientRect(); return { id, x: rect.left + b.view.x + k.x * b.view.k, y: rect.top + b.view.y + k.y * b.view.k }; } return null; });
const knot = await knotPos();
if (knot) {
  await p.mouse.move(knot.x, knot.y); await p.mouse.down(); await p.mouse.move(knot.x, knot.y + 60, { steps: 8 }); await p.mouse.up();
  await settle(p, 300);
}
results.knots = await p.evaluate(() => JSON.parse(JSON.stringify(WT.live().knots)));
results.knotCounts = await p.evaluate(() => WT.live().cur);
await p.mouse.move(5, 5);
await shot(p, 'm7-knot');
const k2 = await knotPos();
if (k2) {
  await p.mouse.dblclick(k2.x, k2.y);
  await settle(p, 300);
  results.knotsAfterRemove = await p.evaluate(() => JSON.parse(JSON.stringify(WT.live().knots)));
}

// labels (item 6) alone on the original layout + tapped label on the arranged one
await p.evaluate(() => WT.setToggles({ pins: true, avoid: true, focus: true, knots: true, arrange: true, labels: true }));
await settle(p, 1400);
const chip = p.locator('.chip:not(.src)').nth(1);
await chip.click();
await settle(p, 400);
await shot(p, 'm7-labels-tap');
await p.mouse.click(40, 760);
await p.evaluate(() => WT.setLevel('5'));
await settle(p, 400);
await p.evaluate((a) => WT.setToggles(a), ALL);
await settle(p, 1600);
await shot(p, 'm5-labels');

// compare view
await p.evaluate(() => WT.setCompare(true));
await settle(p, 800);
await p.evaluate((a) => WT.setToggles(a), ALL);
await settle(p, 1600);
await shot(p, 'm5-compare');

// phone
const ph = await open({ width: 844, height: 390 }, true);
await ph.evaluate((a) => WT.setToggles(a), ALL);
await settle(ph, 1600);
await shot(ph, 'phone-m5-after');
await ph.evaluate(() => WT.setLevel('7'));
await settle(ph, 500);
await ph.evaluate((a) => WT.setToggles(a), ALL);
await settle(ph, 1600);
await shot(ph, 'phone-m7-after');
await ph.evaluate(() => WT.setToggles({}));
await settle(ph, 1200);
await shot(ph, 'phone-m7-before');

// phone touch checks: tap a card (focus), double-tap a wire (knot), pinch is covered by wheel in desktop run
await ph.evaluate(() => WT.setLevel('5'));
await settle(ph, 500);
await ph.evaluate((a) => WT.setToggles(a), ALL);
await settle(ph, 1600);
const card = await ph.locator('.wc-node[data-id="s-find"] .wc-name').boundingBox();
await ph.touchscreen.tap(card.x + 8, card.y + 6);
await settle(ph, 400);
results.phoneFocus = await ph.evaluate(() => ({ node: WT.live().focusNode, dimmed: document.querySelectorAll('.wire-g.dim').length }));
await shot(ph, 'phone-focus');
await ph.touchscreen.tap(8, 330);
const wp = await ph.evaluate(() => { const b = WT.live(), r = b.routeById['sw5'], q = r.pts[Math.floor(r.pts.length / 2)], rect = b.host.getBoundingClientRect(); return { x: rect.left + b.view.x + q.x * b.view.k, y: rect.top + b.view.y + q.y * b.view.k }; });
await ph.touchscreen.tap(wp.x, wp.y); await ph.waitForTimeout(120); await ph.touchscreen.tap(wp.x, wp.y);
await settle(ph, 300);
results.phoneKnot = await ph.evaluate(() => JSON.parse(JSON.stringify(WT.live().knots)));
await shot(ph, 'phone-knot');

fs.writeFileSync(path.join(out, 'counts.json'), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
console.log('logs:', logs.length ? logs : 'none');
await b.close();
