// Dev server on :5295 (URL env overrides) - with "Vật lý thật" on, five pistons push the same 10 kg tall crate:
// 30 N high (tips), 15 N high (stalls, overloaded), 45 N low (stalls), 55 N low (slides), 100 N low at 12 m/s (crate is not launched).
// Shots in plans/reports/shots-w2-push-tip-force/.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-w2-main/push-tip-force/';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const v = (x, y, z = 0) => ({ x, y, z });

const node = (id, kind, x, y, params) => ({ id, kind, params, pos: { x, y } });
const wiresOf = (list) => list.map(([a, ap, b, bp], i) => ({ id: 'w' + i, from: { node: a, port: ap }, to: { node: b, port: bp } }));
const file = (name, mode, settings, nodes, wires = []) => ({ format_version: 1, name, mode, graph: { settings: { ...settings }, nodes, wires: wiresOf(wires) } });
const tall = (id, row, z) => node(id, 'item', 40 + row * 10, row * 90, { shape: 'box', carryable: 'no', position: v(-6, 0.6, z), size: v(0.4, 1.2, 0.4), mass: 10, mu: 0.5, color: '#c2813a' });
const piston = (id, row, y, z, force, speed) => node(id, 'linear-actuator', 300, row * 90, { position: v(-9, y, z), stroke: 2, maxForce: force, speed, headSize: 0.3, color: '#0ea5e9' });
const label = (id, row, z, text) => node(id, 'show-text', 700, row * 90, { text, corner: 'top-left', color: '#ffffff' });

const rows = [
  ['a', 1.1, -4, 30, 0.4],
  ['b', 1.1, -2, 15, 0.4],
  ['c', 0.15, 0, 45, 0.4],
  ['d', 0.15, 2, 55, 0.4],
  ['e', 0.15, 4, 100, 12],
];
const nodes = [node('floor', 'block', 0, 0, { position: v(0, -0.5, 0), size: v(30, 1, 16), color: '#65a30d' }), node('go', 'on-start', 0, 100, {}), node('cam', 'camera', 600, 0, { mode: 'fixed', point: v(-4, 0.5, 0), zoom: 0.5, view: 'tilted' })];
const wires = [['go', 'started', 'cam', 'on']];
rows.forEach(([id, y, z, force, speed], i) => {
  nodes.push(tall('t' + id, i + 2, z), piston('p' + id, i + 2, y, z, force, speed));
  wires.push(['go', 'started', 'p' + id, 'extend']);
});
const board = file('Đẩy cao thì đổ, đẩy thấp thì trượt', '3d', { realPhysics: true }, nodes, wires);

const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });

await p.goto(URL);
await p.evaluate((j) => { localStorage.clear(); localStorage.setItem('xuong-noi:autosave', j); }, JSON.stringify(board));
await p.reload();
await sleep(2500);
if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
await p.locator('[data-tut="play"]').click();
await p.getByText('Mô phỏng', { exact: true }).first().click().catch(() => undefined);
let last = 0;
for (const t of [1000, 2500, 4000, 5500, 7000, 9000, 12000]) {
  await sleep(t - last);
  last = t;
  await p.screenshot({ path: `${OUT}scene-${t}ms.png` });
}
console.log('LOGS', JSON.stringify(logs));
await b.close();
