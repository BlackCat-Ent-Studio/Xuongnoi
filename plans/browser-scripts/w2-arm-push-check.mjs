// Dev server on :5293 (URL env overrides) - with "Vật lý thật" on, a piston and an arm link push tall crates through the engine:
// pushed high the crate tips, pushed low it slides. Shots in plans/reports/shots-w2-arm-push/.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-w2-main/arm-push/';
fs.mkdirSync(OUT, { recursive: true });
const URL = process.env.URL ?? 'http://localhost:5173/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const v = (x, y, z = 0) => ({ x, y, z });

const node = (id, kind, x, y, params) => ({ id, kind, params, pos: { x, y } });
const wiresOf = (list) => list.map(([a, ap, b, bp], i) => ({ id: 'w' + i, from: { node: a, port: ap }, to: { node: b, port: bp } }));
const file = (name, mode, settings, nodes, wires = []) => ({ format_version: 1, name, mode, graph: { settings: { ...settings }, nodes, wires: wiresOf(wires) } });
const tall = (id, row, x, z) => node(id, 'item', 40 + row * 10, row * 90, { shape: 'box', carryable: 'no', position: v(x, 0.6, z), size: v(0.4, 1.2, 0.4), mass: 10, mu: 0.5, color: '#c2813a' });
const piston = (id, row, y, z) => node(id, 'linear-actuator', 300, row * 90, { position: v(-9, y, z), stroke: 2, maxForce: 100, speed: 0.4, headSize: 0.3, color: '#0ea5e9' });

const board = file('Piston và tay máy đẩy thùng', '3d', { realPhysics: true }, [
  node('floor', 'block', 0, 0, { position: v(0, -0.5, 0), size: v(30, 1, 16), color: '#65a30d' }),
  node('go', 'on-start', 0, 100, {}),
  // Piston high up: the tall crate tips. Piston low: the same crate slides.
  tall('t1', 2, -6, -3), piston('p1', 2, 1.1, -3),
  tall('t2', 3, -6, 0), piston('p2', 3, 0.15, 0),
  // An arm: a yaw joint 1 m up on a post sweeps a 2 m link across a third crate.
  node('post', 'block', 0, 300, { position: v(4, 0.3, 4), size: v(1.2, 0.6, 0.6), color: '#64748b' }),
  node('ang', 'const', 0, 400, { value: 60 }),
  node('j', 'joint', 300, 300, { axis: 'yaw', min: -90, max: 90, start: 0, maxTorque: 500, maxSpeed: 15, mount: v(1, 0.7, 0), solid: 'yes' }),
  node('l', 'link', 600, 300, { length: 2, mass: 1, thickness: 0.2, solid: 'yes' }),
  tall('t3', 6, 6.5, 3.5),
  node('cam', 'camera', 600, 0, { mode: 'fixed', point: v(-2, 0.5, 0), zoom: 0.5, view: 'tilted' }),
], [
  ['go', 'started', 'p1', 'extend'], ['go', 'started', 'p2', 'extend'],
  ['post', 'self', 'j', 'base'], ['go', 'started', 'j', 'power'], ['ang', 'value', 'j', 'angle'], ['j', 'tip', 'l', 'base'], ['go', 'started', 'cam', 'on'],
]);

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
for (const t of [1000, 2500, 4000, 5500, 7000, 9000, 12000, 16000]) {
  await sleep(t - last);
  last = t;
  await p.screenshot({ path: `${OUT}scene-${t}ms.png` });
}
console.log('LOGS', JSON.stringify(logs));
await b.close();
