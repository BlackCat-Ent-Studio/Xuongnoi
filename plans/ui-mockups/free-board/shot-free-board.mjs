// Screenshots + behaviour checks of the free-board preview. usage: node shot-free-board.mjs   (opens index.html from file://)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(here, 'shots');
fs.mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.join(here, 'index.html')).href;
const logs = [], results = {};
const b = await chromium.launch();

async function open(viewport, hasTouch = false) {
  const p = await b.newPage({ viewport, deviceScaleFactor: 1, hasTouch });
  p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
  await p.goto(url, { waitUntil: 'load' });
  await p.waitForTimeout(700);
  return p;
}
const settle = (p, ms = 600) => p.waitForTimeout(ms);
const view = (p) => p.evaluate(() => ({ ...FB.board.view }));
/** A screen point on bare board (not on a card), found by scanning the board. */
const emptyPoint = (p) => p.evaluate(() => {
  const h = document.querySelector('#board'), r = h.getBoundingClientRect();
  for (let y = r.bottom - 90; y > r.top + 50; y -= 14) for (let x = r.right - 40; x > r.left + 40; x -= 14) {
    const t = document.elementFromPoint(x, y); if (t && (t === h || t.classList.contains('wc-world') || t.closest('svg'))) return { x, y };
  }
  return null;
});
const lowText = (p) => p.evaluate(() => Math.min(...[...document.querySelectorAll('.wc-node .wc-pl')].map((e) => e.getBoundingClientRect().height)));

async function suite(tag, viewport, touch) {
  const p = await open(viewport, touch);
  for (const lv of ['5', '7']) {
    const k = `${tag}-m${lv}`;
    await p.evaluate(([l]) => { FB.setLevel(l); FB.setAge('old'); FB.setLevel(l); }, [lv]);
    await settle(p);
    await p.screenshot({ path: path.join(out, `${k}-old.png`) });
    results[k + '-old'] = await p.evaluate(() => ({ scale: FB.board.nodes[0].s, labelH: Math.min(...[...document.querySelectorAll('.wc-node .wc-pl')].map((e) => e.getBoundingClientRect().height)) }));
    await p.evaluate(() => FB.setAge('new'));
    await settle(p);
    await p.screenshot({ path: path.join(out, `${k}-new.png`) });
    results[k + '-new-open'] = await view(p);
    const e = await emptyPoint(p);
    results[k + '-empty'] = e;
    // zoom in around the pointer
    await p.mouse.move(e.x, e.y);
    for (let i = 0; i < 4; i++) await p.mouse.wheel(0, -120);
    await settle(p, 300);
    await p.screenshot({ path: path.join(out, `${k}-new-zoomin.png`) });
    results[k + '-zoomin'] = await view(p);
    // zoom limits
    for (let i = 0; i < 30; i++) await p.mouse.wheel(0, -120);
    const maxK = (await view(p)).k;
    for (let i = 0; i < 60; i++) await p.mouse.wheel(0, 120);
    const minK = (await view(p)).k;
    results[k + '-limits'] = { maxK, minK };
    // pan far away (no bounds): drag on empty twice
    await p.evaluate(() => FB.board.fit(false));
    const e2 = await emptyPoint(p), v0 = await view(p);
    await p.mouse.move(e2.x, e2.y); await p.mouse.down(); await p.mouse.move(e2.x - 160, e2.y - 70, { steps: 8 }); await p.mouse.up();
    await settle(p, 200);
    await p.screenshot({ path: path.join(out, `${k}-new-pan.png`) });
    const v1 = await view(p);
    await p.mouse.move(e2.x, e2.y); await p.mouse.down(); await p.mouse.move(e2.x + 700, e2.y + 400, { steps: 8 }); await p.mouse.up();
    results[k + '-pan'] = { v0, v1, far: await view(p) };
    // double-click on empty = fit again
    const e3 = await emptyPoint(p);
    await p.mouse.dblclick(e3.x, e3.y);
    await settle(p, 700);
    await p.screenshot({ path: path.join(out, `${k}-new-dblfit.png`) });
    results[k + '-dblfit'] = { v: await view(p), expect: await p.evaluate(() => FB.board.fitTarget()) };
  }
  // interaction checks on Màn 5 (new)
  await p.evaluate(() => FB.setLevel('5'));
  await settle(p);
  // tap on card / pin must not pan
  const before = await view(p);
  const head = await p.locator('.wc-node[data-id="s-find"] .wc-name').boundingBox();
  await p.mouse.move(head.x + 4, head.y + 4); await p.mouse.down(); await p.mouse.move(head.x + 7, head.y + 6); await p.mouse.up();
  const body = await p.locator('.wc-node[data-id="s-go"] .wc-pl').first().boundingBox();
  await p.mouse.move(body.x + 4, body.y + 4); await p.mouse.down(); await p.mouse.move(body.x + 6, body.y + 4); await p.mouse.up();
  results[tag + '-tapNoPan'] = { before, after: await view(p) };
  // drag card by header (world space); first bring it to the middle of the screen
  await p.evaluate(() => { const b = FB.board, n = b.byId['s-find'], r = b.host.getBoundingClientRect(); b.setView({ k: b.view.k, x: r.width / 2 - n.x * b.view.k, y: r.height / 2 - n.y * b.view.k }); });
  const n0 = await p.evaluate(() => { const n = FB.board.byId['s-find']; return { x: n.x, y: n.y }; });
  const h2 = await p.locator('.wc-node[data-id="s-find"] .wc-name').boundingBox();
  await p.mouse.move(h2.x + 4, h2.y + 4); await p.mouse.down(); await p.mouse.move(h2.x + 54, h2.y + 64, { steps: 6 }); await p.mouse.up();
  results[tag + '-cardDrag'] = { n0, n1: await p.evaluate(() => { const n = FB.board.byId['s-find']; return { x: n.x, y: n.y }; }), k: (await view(p)).k };
  // wire drag: robot self (object) -> s-next? connect robot.self -> s-hands.character exists; try new link slot-1.self -> s-go.target (replaces)
  await p.evaluate(() => FB.board.fit(false));
  const wiresBefore = await p.evaluate(() => FB.board.wires.length);
  const from = await p.locator('.wc-node[data-id="slot-3"] .wc-port.out .wc-dot').boundingBox();
  const to = await p.locator('.wc-node[data-id="s-go"] .wc-port.in[data-port="target"] .wc-dot').boundingBox();
  await p.mouse.move(from.x + 7, from.y + 7); await p.mouse.down(); await p.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 }); await p.mouse.move(to.x + 9, to.y + 9, { steps: 6 });
  await p.screenshot({ path: path.join(out, `${tag}-m5-wiredrag.png`) });
  await p.mouse.up();
  results[tag + '-wire'] = { wiresBefore, wiresAfter: await p.evaluate(() => FB.board.wires.length), last: await p.evaluate(() => JSON.stringify(FB.board.wires[FB.board.wires.length - 1])) };
  // tray: drop a card at the centre of the current view
  await p.evaluate(() => FB.board.fit(false));
  const e = await emptyPoint(p);
  await p.mouse.move(e.x, e.y); await p.mouse.down(); await p.mouse.move(e.x - 120, e.y - 40, { steps: 6 }); await p.mouse.up();
  await p.locator('.pz-chip').first().click();
  await settle(p, 200);
  results[tag + '-tray'] = await p.evaluate(() => {
    const b = FB.board, n = b.nodes[b.nodes.length - 1], r = b.host.getBoundingClientRect(), v = b.view;
    return { kind: n.kind, centreScreen: { x: r.left + v.x + (n.x + n.m.w / 2) * v.k, y: r.top + v.y + (n.y + n.m.h / 2) * v.k }, hostCentre: { x: r.left + r.width / 2, y: r.top + (r.height - 60) / 2 } };
  });
  await p.screenshot({ path: path.join(out, `${tag}-m5-tray-drop.png`) });
  // pinch (synthetic touch pointers) zooms around the midpoint
  const vp0 = await view(p), r = await p.evaluate(() => { const q = document.querySelector('#board').getBoundingClientRect(); return { l: q.left, t: q.top, w: q.width, h: q.height }; });
  const cx = r.l + r.w / 2, cy = r.t + r.h / 2;
  await p.evaluate(([cx, cy]) => {
    const h = document.querySelector('#board'), mk = (type, id, x, y) => h.dispatchEvent(new PointerEvent(type, { pointerId: id, pointerType: 'touch', isPrimary: id === 11, clientX: x, clientY: y, bubbles: true, button: 0 }));
    mk('pointerdown', 11, cx - 40, cy); mk('pointerdown', 12, cx + 40, cy);
    for (let i = 1; i <= 8; i++) { mk('pointermove', 11, cx - 40 - i * 12, cy); mk('pointermove', 12, cx + 40 + i * 12, cy); }
    mk('pointerup', 11, cx - 136, cy); mk('pointerup', 12, cx + 136, cy);
  }, [cx, cy]);
  results[tag + '-pinch'] = { before: vp0, after: await view(p) };
  await p.screenshot({ path: path.join(out, `${tag}-m5-pinch.png`) });
  await p.close();
}

await suite('desk', { width: 1280, height: 720 }, false);
await suite('phone', { width: 844, height: 390 }, true);

// real touch: tap and double-tap on empty board on the phone
{
  const p = await open({ width: 844, height: 390 }, true);
  await p.evaluate(() => FB.board.zoomAt(1.6, 400, 200));
  const k1 = (await view(p)).k;
  const e = await emptyPoint(p);
  await p.touchscreen.tap(e.x, e.y); await p.waitForTimeout(120); await p.touchscreen.tap(e.x, e.y);
  await settle(p, 700);
  results['phone-doubletap'] = { zoomedK: k1, afterK: (await view(p)).k, fitK: (await p.evaluate(() => FB.board.fitTarget())).k };
  await p.close();
}

fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify(results, null, 1));
console.log(JSON.stringify(results, null, 1));
console.log('logs:', logs.length ? logs : 'none');
await b.close();
