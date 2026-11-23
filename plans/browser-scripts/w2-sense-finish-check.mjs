// :5296 by default (URL env overrides) - "Vật lý thật": the scale reads the share of a crate that lies half on it and half on a floor block.
// Board: scale (amber) and floor block (blue) of the same height side by side; a 10 kg crate on the seam. Two sensors read them.
// Hand values: crate in the middle 5 kg / 5 kg; crate shifted 0.15 m onto the block 1.25 kg / 8.75 kg.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-w2-main/sense-finish/';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const v = (x, y, z = 0) => ({ x, y, z });

const node = (id, kind, x, y, params) => ({ id, kind, params, pos: { x, y } });
const wiresOf = (list) => list.map(([a, ap, b, bp], i) => ({ id: 'w' + i, from: { node: a, port: ap }, to: { node: b, port: bp } }));
const file = (name, mode, settings, nodes, wires = []) => ({ format_version: 1, name, mode, graph: { settings: { ...settings }, nodes, wires: wiresOf(wires) } });

const board = (crateX, realPhysics = true) =>
  file('Cân đọc phần của thùng', '3d', realPhysics ? { realPhysics: true } : {}, [
    node('floor', 'block', 0, 0, { position: v(0, -0.5, 0), size: v(24, 1, 8), color: '#65a30d' }),
    node('scale', 'block', 40, 90, { position: v(-0.5, 0.1, 0), size: v(1, 0.2, 1), color: '#f59e0b' }),
    node('side', 'block', 40, 180, { position: v(0.5, 0.1, 0), size: v(1, 0.2, 1), color: '#3b82f6' }),
    node('crate', 'item', 40, 270, { shape: 'box', carryable: 'no', position: v(crateX, 0.4, 0), size: v(0.4, 0.4, 0.4), mass: 10, color: '#c2813a' }),
    node('w1', 'force-sensor', 300, 90, { mode: 'scale' }),
    node('w2', 'force-sensor', 300, 220, { mode: 'scale' }),
    node('s1', 'show-number', 560, 90, { label: 'Cân vàng đọc (kg)', corner: 'top-left' }),
    node('s2', 'show-number', 560, 220, { label: 'Khối sàn xanh đọc (kg)', corner: 'top-right' }),
  ], [
    ['scale', 'self', 'w1', 'who'],
    ['side', 'self', 'w2', 'who'],
    ['w1', 'mass', 's1', 'value'],
    ['w2', 'mass', 's2', 'value'],
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
  for (let i = 0; i < 2; i++) { await p.mouse.wheel(0, -300); await sleep(120); }
  let last = 0;
  for (const t of times) {
    await sleep(t - last);
    last = t;
    await p.screenshot({ path: `${OUT}${prefix}-${t}ms.png` });
  }
}

// Crate on the seam: 5 / 5.
await load(board(0));
await play('half', [4000, 6000]);
// Crate shifted 0.15 m onto the floor block: 1.25 / 8.75.
await load(board(0.15));
await play('quarter', [6000]);
// Switch off: whole mass on any support that it touches (old rule): 10 on each.
await load(board(0, false));
await play('off', [4000]);
console.log('LOGS', JSON.stringify(logs));
await b.close();
