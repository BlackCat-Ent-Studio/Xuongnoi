// :5173 by default (URL env overrides) - "Vật lý thật" crates: gravity row, handbook try-board, 3D scene, top view, load failure, lazy chunk.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-w2-crates-main/';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const v = (x, y, z = 0) => ({ x, y, z });

const node = (id, kind, x, y, params) => ({ id, kind, params, pos: { x, y } });
const wiresOf = (list) => list.map(([a, ap, b, bp], i) => ({ id: 'w' + i, from: { node: a, port: ap }, to: { node: b, port: bp } }));
const file = (name, mode, settings, nodes, wires = []) => ({ format_version: 1, name, mode, graph: { settings: { ...settings }, nodes, wires: wiresOf(wires) } });
const crate = (id, row, x, y, z, over = {}) => node(id, 'item', 40 + row * 10, row * 90, { shape: 'crate', carryable: 'no', position: v(x, y, z), size: v(0.5, 0.5, 0.5), color: '#c2813a', ...over });
const pusher = (id, row, from, to, y, z, speed = 0.6) =>
  node(id, 'moving-platform', 300, row * 90, { position: v(from, y, z), to: v(to, y, z), size: v(0.4, 0.2, 0.8), speed, wait: 0, loop: 'once', color: '#f59e0b' });

const crates3d = file('Thùng 3D', '3d', { realPhysics: true }, [
  node('floor', 'block', 0, 0, { position: v(0, -0.5, 0), size: v(30, 1, 14), color: '#65a30d' }),
  // Stack of three.
  crate('s1', 1, -9, 0.25, -5), crate('s2', 2, -9, 0.76, -5), crate('s3', 3, -9, 1.27, -5),
  // Tall crates: one pushed at the top, one near the floor.
  crate('t1', 4, -4, 0.6, -3, { size: v(0.4, 1.2, 0.4), mass: 10, shape: 'box' }), pusher('p1', 4, -7, 0, 1.1, -3),
  crate('t2', 5, -4, 0.6, -0.5, { size: v(0.4, 1.2, 0.4), mass: 10, shape: 'box' }), pusher('p2', 5, -7, 0, 0.15, -0.5),
  // A pile dropped from above.
  crate('d1', 6, 4, 2.0, -3, { size: v(0.7, 0.4, 0.5) }), crate('d2', 7, 4.2, 3.0, -3.1, { size: v(0.5, 0.5, 0.5) }), crate('d3', 8, 3.9, 4.0, -2.8, { size: v(0.6, 0.3, 0.6) }),
  crate('d4', 9, 4.1, 5.0, -3.0, { size: v(0.4, 0.8, 0.4), shape: 'box' }),
  // A belt with crates queueing against a wall.
  node('belt', 'block', 0, 700, { position: v(5, -0.5, 3), size: v(8, 1, 1.4), style: 'conveyor', beltSpeed: 1, beltWalls: 'no', color: '#475569' }),
  node('wall', 'block', 0, 800, { position: v(9.3, 0.4, 3), size: v(0.3, 0.8, 1.4), color: '#64748b' }),
  crate('b1', 10, 3, 0.25, 3, { color: '#3b82f6' }), crate('b2', 11, 4.2, 0.25, 3, { color: '#ef4444' }), crate('b3', 12, 5.4, 0.25, 3, { color: '#22c55e' }),
  // A robot pushing a 3 kg crate (and not a 4 kg one).
  node('bot', 'robot-body', 600, 0, { position: v(-8, 0.15, 3), heading: 0, height: 0.3, pushObjects: 'yes', color: '#2563eb' }),
  node('ml', 'motor', 800, -40, { side: -0.4, maxForce: 30 }),
  node('mr', 'motor', 800, 40, { side: 0.4, maxForce: 30 }),
  node('pw', 'const', 600, 120, { value: 1 }),
  crate('r1', 13, -4, 0.3, 3, { size: v(0.6, 0.6, 0.6), mass: 3, color: '#a855f7' }),
  crate('r2', 14, -4, 0.3, 5, { size: v(0.6, 0.6, 0.6), mass: 4, color: '#f97316' }),
  node('bot2', 'robot-body', 600, 300, { position: v(-8, 0.15, 5), heading: 0, height: 0.3, pushObjects: 'yes', color: '#0ea5e9' }),
  node('ml2', 'motor', 800, 260, { side: -0.4, maxForce: 30 }),
  node('mr2', 'motor', 800, 340, { side: 0.4, maxForce: 30 }),
], [
  ['pw', 'value', 'ml', 'power'], ['pw', 'value', 'mr', 'power'], ['bot', 'self', 'ml', 'body'], ['bot', 'self', 'mr', 'body'],
  ['pw', 'value', 'ml2', 'power'], ['pw', 'value', 'mr2', 'power'], ['bot2', 'self', 'ml2', 'body'], ['bot2', 'self', 'mr2', 'body'],
]);

const top = file('Thùng nhìn từ trên', '2d-top', { realPhysics: true }, [
  node('c1', 'item', 40, 0, { shape: 'crate', carryable: 'no', position: v(0, 0.3, 0), size: v(1.2, 0.6, 0.6), color: '#c2813a', mass: 4 }),
  node('c2', 'item', 40, 90, { shape: 'crate', carryable: 'no', position: v(4, 0.3, 0.2), size: v(0.6, 0.6, 0.6), color: '#3b82f6', mass: 1 }),
  // Pushes the long crate off-centre, so it spins; then pushes the small one.
  node('p', 'moving-platform', 300, 0, { position: v(-3, 0.3, 0.45), to: v(8, 0.3, 0.45), size: v(0.4, 0.5, 0.5), speed: 0.8, wait: 0, loop: 'once', color: '#f59e0b' }),
]);

const empty = (settings) => file('Trống', '3d', settings, []);

const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
const requests = [];
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
p.on('request', (r) => { if (/rapier3d/i.test(r.url())) requests.push(r.url().slice(0, 140)); });

async function load(board) {
  await p.goto(URL);
  await p.evaluate((j) => { localStorage.clear(); if (j) localStorage.setItem('xuong-noi:autosave', j); }, board ? JSON.stringify(board) : null);
  await p.reload();
  await sleep(2500);
  if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
}
async function zoomAt(x, y, clicks) {
  await p.mouse.move(x, y);
  for (let i = 0; i < clicks; i++) { await p.mouse.wheel(0, -300); await sleep(120); }
}
async function playShots(prefix, times, zoom) {
  await p.locator('[data-tut="play"]').click();
  // The big stage lives behind the "Mô phỏng" tab.
  await p.getByText('Mô phỏng', { exact: true }).first().click().catch(() => undefined);
  if (zoom) { await sleep(300); await zoomAt(zoom.x, zoom.y, zoom.clicks); }
  let last = 0;
  for (const t of times) {
    await sleep(t - last);
    last = t;
    await p.screenshot({ path: `${OUT}${prefix}-${t}ms.png` });
  }
}

// 1. The gravity row under the switch, then a new number typed in.
await load(empty({ realPhysics: true }));
const row = p.locator('[data-setting="gravity"]');
console.log('gravity row visible:', await row.isVisible(), '| switch row visible:', await p.locator('[data-setting="real-physics"]').isVisible());
await p.locator('.pn-props').screenshot({ path: OUT + '1-gravity-row.png' });
await row.locator('input').fill('1.62');
await sleep(1800);
console.log('autosave gravity after typing:', await p.evaluate(() => JSON.parse(localStorage.getItem('xuong-noi:autosave') ?? '{}').graph?.settings));
await p.locator('.pn-props').screenshot({ path: OUT + '2-gravity-typed.png' });
console.log('requests before any play (expect none):', JSON.stringify(requests));

// 2. Handbook page and its "Thử ngay" board.
await load(empty({ realPhysics: true }));
const helpBtn = p.locator('[data-setting="gravity"] .hb-help');
await helpBtn.click();
await sleep(800);
console.log('try button visible:', await p.locator('[data-hb-action="try"]').isVisible().catch(() => false));
await p.screenshot({ path: OUT + '3-handbook-page.png' });
await p.locator('[data-hb-action="try"]').click();
await sleep(1200);
await playShots('4-try-board-left', [1500, 3200, 4500, 6500, 9000], { x: 640, y: 360, clicks: 4 });
console.log('requests after playing the try board:', JSON.stringify(requests));

// 3. 3D scene.
await load(crates3d);
await playShots('5-scene3d', [600, 3500, 7000, 11000]);

// 4. Top view: off-centre push spins the long crate.
await load(top);
await playShots('6-top', [1500, 4500, 7500]);

// 5. The engine cannot be fetched: clear message, game still runs on the plain rules.
await p.route('**/*rapier3d*', (r) => r.abort());
await load(crates3d);
await playShots('7-load-failed', [500, 4000]);
console.log('banner text:', await p.locator('text=Không tải được bộ máy').first().textContent().catch(() => '(not found)'));
await p.unroute('**/*rapier3d*');

// 6. A board without the switch never asks for the engine.
requests.length = 0;
await load(file('Không bật', '3d', {}, crates3d.graph.nodes, []));
await playShots('8-switch-off', [3000]);
console.log('requests with the switch off (expect none):', JSON.stringify(requests));
console.log('LOGS', JSON.stringify(logs));
await b.close();
