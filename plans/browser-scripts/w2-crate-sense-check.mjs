// :5294 by default (URL env overrides) - "Vật lý thật": cards read a crate that tipped over by its real shape.
// Board: a 1.2 m tall crate is pushed over; a red marker 2.7 m to the right carries a Va chạm card (reach 1.4 m), a zone counts crates.
// Upright the crate is 2.3 m (face to face) from the marker (card off, zone 0); lying it ends about 1.1 m from it (card on, zone 1).
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-w2-main/crate-sense/';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const v = (x, y, z = 0) => ({ x, y, z });

const node = (id, kind, x, y, params) => ({ id, kind, params, pos: { x, y } });
const wiresOf = (list) => list.map(([a, ap, b, bp], i) => ({ id: 'w' + i, from: { node: a, port: ap }, to: { node: b, port: bp } }));
const file = (name, mode, settings, nodes, wires = []) => ({ format_version: 1, name, mode, graph: { settings: { ...settings }, nodes, wires: wiresOf(wires) } });

const board = (realPhysics) =>
  file('Đọc thùng đổ', '3d', realPhysics ? { realPhysics: true } : {}, [
    node('floor', 'block', 0, 0, { position: v(0, -0.5, 0), size: v(24, 1, 8), color: '#65a30d' }),
    node('crate', 'item', 40, 90, { shape: 'box', carryable: 'no', position: v(0, 0.6, 0), size: v(0.4, 1.2, 0.4), mass: 10, color: '#c2813a' }),
    node('push', 'moving-platform', 40, 180, { position: v(-1.4, 1.1, 0), to: v(0.6, 1.1, 0), size: v(0.3, 0.2, 0.8), speed: 0.5, wait: 0, loop: 'once', color: '#f59e0b' }),
    node('probe', 'block', 40, 270, { type: 'pickup', position: v(2.7, 0.2, 0), size: v(0.4, 0.4, 0.4), color: '#ef4444' }),
    node('near', 'touch', 300, 90, { grow: 1.4, mode: 'edge' }),
    node('nearNum', 'bool-to-number', 520, 90, { whenOn: 1, whenOff: 0 }),
    node('nearShow', 'show-number', 700, 90, { label: 'Thùng trong tầm 1,4 m của hộp đỏ (1 = có)', corner: 'top-left' }),
    node('zone', 'zone', 300, 220, { center: v(0.8, 0.5, 0), size: v(1, 1, 1), filter: 'item', rule: 'touch' }),
    node('zoneShow', 'show-number', 700, 220, { label: 'Thùng trong vùng (x từ 0,3 đến 1,3 m)', corner: 'top-right' }),
  ], [
    ['probe', 'self', 'near', 'a'],
    ['crate', 'self', 'near', 'b'],
    ['near', 'touching', 'nearNum', 'on'],
    ['nearNum', 'value', 'nearShow', 'value'],
    ['zone', 'count', 'zoneShow', 'value'],
  ]);

const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });

async function load(boardJson) {
  await p.goto(URL);
  await p.evaluate((j) => { localStorage.clear(); localStorage.setItem('xuong-noi:autosave', j); }, JSON.stringify(boardJson));
  await p.reload();
  await sleep(2500);
  if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
}

async function play(prefix, times) {
  await p.locator('[data-tut="play"]').click();
  await p.getByText('Mô phỏng', { exact: true }).first().click().catch(() => undefined);
  await sleep(300);
  await p.mouse.move(720, 450);
  for (let i = 0; i < 1; i++) { await p.mouse.wheel(0, -300); await sleep(120); }
  let last = 0;
  for (const t of times) {
    await sleep(t - last);
    last = t;
    await p.screenshot({ path: `${OUT}${prefix}-${t}ms.png` });
  }
}

// Switch on: upright (card and zone read 0), then the crate lies down and both read it by its real shape.
await load(board(true));
await play('on', [800, 2500, 4500, 7000, 11000]);
// Switch off: the crate never tips, so the readings stay as they were.
await load(board(false));
await play('off', [800, 11000]);
console.log('LOGS', JSON.stringify(logs));
await b.close();
