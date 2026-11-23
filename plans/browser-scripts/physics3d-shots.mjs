// Shots of puzzle levels 5-8 running WITH the reference solution wired in, to look for visual pass-through after the physics fix.
// usage: node physics3d-shots.mjs <desk|phone> [levelId ...]
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-physics3d/';
import fs from 'node:fs';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5208';
const all = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau', 'xuong-tong-hop'];
const device = process.argv[2] === 'phone' ? { name: 'phone', viewport: { width: 844, height: 390 } } : { name: 'desk', viewport: { width: 1280, height: 720 } };
const wanted = process.argv.slice(3);
const plan = [
  ['du-ba-thung', 'level05', [2, 5, 8, 11, 14, 18, 22]],
  ['ne-linh-gac', 'level06', [1.5, 3, 5, 8]],
  ['phan-loai-mau', 'level07', [1.5, 3, 5, 8, 12, 16, 20, 26]],
  ['xuong-tong-hop', 'level08', [2, 5, 8, 12, 16, 20, 25]],
].filter(([id]) => wanted.length === 0 || wanted.includes(id));

const VIEW = process.env.VIEW === 'overview' ? 'overview' : 'follow'; // the page opens following the robot; one tap on the view button gives the whole-stage overview
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const p = await b.newPage({ viewport: device.viewport, deviceScaleFactor: 2 });
// Only the stage (left part) matters for the pass-through check; crop to it at 2x.
const clip = device.name === 'phone' ? { x: 0, y: 0, width: 440, height: 390 } : { x: 30, y: 85, width: 540, height: 550 };
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.text().includes('[physics-watch]')) logs.push(m.text()); });
// Wire the reference solution into the locked board so the robots really carry crates.
let solved = null;
await p.route(/\/src\/puzzle\/levels\/level-0[5-8]\.ts/, async (route) => {
  const res = await route.fetch();
  let body = await res.text();
  const m = /export const (level0\d)/.exec(body);
  if (m && solved) body += `\n;${m[1]}.base = { ...${m[1]}.base, nodes: [...${m[1]}.base.nodes, ...${m[1]}.solution.nodes], wires: [...${m[1]}.base.wires, ...${m[1]}.solution.wires] };\n`;
  await route.fulfill({ response: res, body });
});
solved = true;
await p.goto(`${BASE}/giai-do.html`);
await p.evaluate((list) => {
  localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
  localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify([...list, ...list.map((i) => 'intro:' + i)]));
}, all);
for (const [id, , times] of plan) {
  await p.goto('about:blank');
  await p.goto(`${BASE}/giai-do.html#/level/${id}`);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}${device.name}-${VIEW}-${id}-0-ready.png` });
  if (VIEW === 'overview') await p.locator('.pz-viewtoggle').first().click({ force: true }).catch((e) => logs.push('toggle: ' + e.message));
  await p.locator('.pz-btn.run').first().click({ force: true });
  const t0 = Date.now();
  for (const t of times) {
    const wait = t * 1000 - (Date.now() - t0);
    if (wait > 0) await p.waitForTimeout(wait);
    const real = ((Date.now() - t0) / 1000).toFixed(1);
    await p.screenshot({ clip, path: `${out}${device.name}-${VIEW}-${id}-t${String(t).replace('.', '_')}-real${real}.png` });
  }
}
console.log(logs.join('\n') || 'no page errors, no physics-watch warnings');
await b.close();
