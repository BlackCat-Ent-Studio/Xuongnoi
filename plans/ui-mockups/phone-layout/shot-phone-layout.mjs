// Screenshots every layout x checker x outcome at 844x390 (the phone screen element), plus camera pan/zoom states, desktop frame, swipe and PiP taps.
// Usage: node shot-phone-layout.mjs   (writes ./shots/*.png, prints console errors + camera assertions)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(path.join(dir, 'index.html')).href;
const out = path.join(dir, 'shots') + path.sep;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [], notes = [];
const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => { if (!/fonts\.g/.test(r.url())) logs.push(`requestfailed: ${r.url()}`); });
await page.goto(url);
await page.waitForSelector('body[data-ready="1"]', { timeout: 90000 });

const seg = (key, v) => page.click(`#ctrl .seg[data-key=${key}] button[data-v=${v}]`);
const shot = async (name) => { await page.waitForTimeout(450); await page.locator('#screen').screenshot({ path: out + name + '.png' }); };
const app = (fn, arg) => page.evaluate(fn, arg);
async function setCut(on, which = 'w1') { await page.selectOption('#cutWhich', which); const c = page.locator('#cut'); if ((await c.isChecked()) !== on) await c.click(); }
async function prep({ frame = 'phone', layout, checker, cut = false, which = 'w1' }) {
  await seg('frame', frame); await seg('layout', layout); await seg('checker', checker); await setCut(cut, which);
  await app(() => { __app.UI.panelOpen = true; __app.syncUI(); });
}
const seek = (t) => app((t) => __app.seek(t), t);

// ---- layout x checker x outcome ----
for (const layout of ['a', 'b', 'c']) for (const checker of ['v1', 'v2']) for (const cut of [false, true]) {
  const tag = `${layout}-${checker}-${cut ? 'fail' : 'ok'}`;
  await prep({ layout, checker, cut });
  if (layout === 'a' && checker === 'v1') {                       // idle board + stage for orientation
    await shot(`a-idle-board`); await app(() => __app.setView('stage')); await shot('a-idle-stage'); await app(() => __app.setView('board'));
  }
  await page.click('#run'); await page.waitForTimeout(500);
  await seek(3.3);                                                // robot just stepped on the button, door opening
  if (layout !== 'b') await shot(`${tag}-mid-stage`);              // A/C: CHẠY auto-switched to the stage
  else await shot(`${tag}-mid`);                                  // B: board + small window
  await seek(cut ? 8.2 : 7.2);
  if (layout !== 'b') await app(() => __app.setView('board'));
  await shot(`${tag}-end-board`);
  if (layout === 'b') { await app(() => __app.setPip('full')); await shot(`${tag}-end-pipfull`); await app(() => __app.setPip('small')); }
  if (layout !== 'b') { await app(() => __app.setView('stage')); await shot(`${tag}-end-stage`); }
  const info = await app(() => ({ view: __app.UI.view, pip: __app.UI.pip, failed: __app.sim.failed, won: __app.sim.won }));
  notes.push(`${tag}: ${JSON.stringify(info)}`);
  await page.click('#run'); await page.waitForTimeout(200);       // DỪNG
  const back = await app(() => __app.UI.view); notes.push(`${tag}: after DỪNG view=${back}`);
}

// ---- other two wires cut (V1, layout A) ----
for (const which of ['w3', 'w4']) {
  await prep({ layout: 'a', checker: 'v1', cut: true, which }); await page.click('#run'); await page.waitForTimeout(300);
  await seek(8.2); await app(() => __app.setView('board')); await shot(`a-v1-fail-${which}-board`);
  await page.click('#run');
}
await prep({ layout: 'a', checker: 'off', cut: true }); await page.click('#run'); await page.waitForTimeout(300); await seek(8.2); await app(() => __app.setView('board')); await shot('a-off-fail-board'); await page.click('#run');

// ---- camera: pan / zoom / pinch / ctrl+wheel / double tap / clamp (layout A, stage) ----
await prep({ layout: 'a', checker: 'v1' });
await page.click('#run'); await page.waitForTimeout(300); await seek(3.0);
const box = await page.locator('#stageView').boundingBox();
const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
const camState = () => app(() => ({ z: +__app.cam.zoom.toFixed(2), x: +__app.cam.cx.toFixed(2), y: +__app.cam.cy.toFixed(2) }));
await shot('cam-1-fit'); notes.push('cam fit ' + JSON.stringify(await camState()));
await page.mouse.move(cx - 120, cy + 20); for (let i = 0; i < 6; i++) await page.mouse.wheel(0, -120); await page.waitForTimeout(100);
await shot('cam-2-wheel-zoom'); notes.push('after wheel ' + JSON.stringify(await camState()));
await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 260, cy + 10, { steps: 8 }); await page.mouse.up();
await shot('cam-3-pan-drag'); notes.push('after drag right ' + JSON.stringify(await camState()));
await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 3000 > 0 ? 5 : 5, cy - 200, { steps: 12 }); await page.mouse.up();
notes.push('after hard drag left/up (clamp) ' + JSON.stringify(await camState()));
await shot('cam-4-clamped-edge');
await page.click('#zReset'); await page.waitForTimeout(700); notes.push('after ⟳ ' + JSON.stringify(await camState()));
await page.keyboard.down('Control'); await page.mouse.move(cx + 100, cy); await page.mouse.wheel(0, -60); await page.mouse.wheel(0, -60); await page.mouse.wheel(0, -60); await page.keyboard.up('Control'); await page.waitForTimeout(100);
await shot('cam-5-ctrl-wheel'); notes.push('after ctrl+wheel ' + JSON.stringify(await camState()));
await page.mouse.dblclick(cx, cy); await page.waitForTimeout(800); notes.push('after double click ' + JSON.stringify(await camState()));
await shot('cam-6-after-dblclick-fit');
// synthetic two-finger pinch (touch pointers)
await app(({ x, y }) => {
  const el = document.getElementById('stageView');
  const ev = (type, id, px, py) => el.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', clientX: px, clientY: py, bubbles: true, cancelable: true, isPrimary: id === 1 }));
  ev('pointerdown', 1, x - 40, y); ev('pointerdown', 2, x + 40, y);
  for (let i = 1; i <= 8; i++) { ev('pointermove', 1, x - 40 - i * 14, y); ev('pointermove', 2, x + 40 + i * 14, y); }
  ev('pointerup', 1, x - 150, y); ev('pointerup', 2, x + 150, y);
}, { x: cx, y: cy });
await shot('cam-7-pinch'); notes.push('after pinch-out ' + JSON.stringify(await camState()));
// synthetic double tap (touch)
await app(({ x, y }) => {
  const el = document.getElementById('stageView');
  const ev = (type, px, py) => el.dispatchEvent(new PointerEvent(type, { pointerId: 5, pointerType: 'touch', clientX: px, clientY: py, bubbles: true, cancelable: true, isPrimary: true }));
  ev('pointerdown', x, y); ev('pointerup', x, y); setTimeout(() => { ev('pointerdown', x + 2, y); ev('pointerup', x + 2, y); }, 120);
}, { x: cx, y: cy });
await page.waitForTimeout(900); notes.push('after touch double tap ' + JSON.stringify(await camState()));
await page.click('#run');

// ---- layout B: PiP tap enlarge / tap shrink / camera inside the big view ----
await prep({ layout: 'b', checker: 'v1' });
await page.click('#run'); await page.waitForTimeout(300); await seek(3.0);
const pb = await page.locator('#stageView').boundingBox();
await page.mouse.click(pb.x + pb.width / 2, pb.y + pb.height / 2); await page.waitForTimeout(500);
notes.push('B after tap small PiP: pip=' + await app(() => __app.UI.pip)); await shot('b-pip-enlarged');
const fb = await page.locator('#stageView').boundingBox();
await page.mouse.move(fb.x + 400, fb.y + 150); for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -120); await shot('b-pip-enlarged-zoomed');
notes.push('B zoomed in big view: ' + JSON.stringify(await camState()));
await page.mouse.dblclick(fb.x + 400, fb.y + 150); await page.waitForTimeout(800);
notes.push('B after dblclick in big view: pip=' + await app(() => __app.UI.pip) + ' cam ' + JSON.stringify(await camState()));
await page.mouse.click(fb.x + 300, fb.y + 120); await page.waitForTimeout(700);
notes.push('B after single tap in big view: pip=' + await app(() => __app.UI.pip));
await page.click('#run');

// ---- layout C: swipe ----
await prep({ layout: 'c', checker: 'v1' });
const bb = await page.locator('#boardView').boundingBox();
await page.mouse.move(bb.x + 600, bb.y + 270); await page.mouse.down(); await page.mouse.move(bb.x + 200, bb.y + 275, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(500);
notes.push('C swipe left on board -> view=' + await app(() => __app.UI.view)); await shot('c-after-swipe-left');
await page.mouse.move(bb.x + 12, bb.y + 200); await page.mouse.down(); await page.mouse.move(bb.x + 300, bb.y + 205, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(500);
notes.push('C swipe right from edge -> view=' + await app(() => __app.UI.view));

// ---- desktop frame ----
for (const [layout, checker, cut] of [['a', 'v1', true], ['b', 'v2', true]]) {
  await prep({ frame: 'desktop', layout, checker, cut }); await page.click('#run'); await page.waitForTimeout(400); await seek(8.2);
  if (layout === 'a') await app(() => __app.setView('board'));
  await page.waitForTimeout(500); await page.screenshot({ path: out + `desktop-${layout}-${checker}-fail-page.png`, fullPage: true });
  await page.click('#run');
}
console.log(notes.join('\n'));
console.log('--- console ---\n' + (logs.slice(0, 30).join('\n') || 'no console errors'));
await browser.close();
