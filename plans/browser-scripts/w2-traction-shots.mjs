// :5291 — "Vật lý thật" toggle in the properties panel, then a robot on low-mu floor with showSlip running.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-w2-traction/';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const node = (id, kind, x, params) => ({ id, kind, params, pos: { x, y: 0 } });
const board = (friction, real = true) => ({
  format_version: 1, name: 'Trượt', mode: '2d-top',
  graph: {
    settings: { ...(real ? { realPhysics: true } : {}), wireRule: true },
    nodes: [
      node('p', 'const', 0, { value: 1 }),
      node('body', 'robot-body', 200, { position: { x: -4, y: 0.5, z: 0 }, friction }),
      node('ml', 'motor', 400, { side: -0.35, maxRpm: 300, accel: 10000, showSlip: 'yes' }),
      node('mr', 'motor', 400, { side: 0.35, maxRpm: 300, accel: 10000 }),
      node('slip', 'show-number', 600, { label: 'Trượt (m/s)' }),
      node('ground', 'show-number', 600, { label: 'Robot (m/s)', corner: 'top-right' }),
    ],
    wires: [
      ['p', 'value', 'ml', 'power'], ['p', 'value', 'mr', 'power'],
      ['body', 'self', 'ml', 'body'], ['body', 'self', 'mr', 'body'],
      ['ml', 'slipSpeed', 'slip', 'value'], ['body', 'speed', 'ground', 'value'],
    ].map(([a, ap, b, bp], i) => ({ id: 'w' + i, from: { node: a, port: ap }, to: { node: b, port: bp } })),
  },
});
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
async function load(json, shot) {
  await p.goto('http://localhost:5291/');
  await p.evaluate((j) => { localStorage.clear(); if (j) localStorage.setItem('xuong-noi:autosave', j); }, json);
  await p.reload();
  await sleep(2500);
  if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
}
await load(JSON.stringify(board(0.8, false)));
await p.mouse.click(5, 5);
await sleep(300);
await p.screenshot({ path: OUT + '1-toggle-panel.png' });
const row = p.locator('[data-setting="real-physics"]');
console.log('ROW visible', await row.isVisible(), (await row.innerText()).replace(/\n/g, ' | '));
await row.locator('input').check();
await sleep(300);
console.log('CHECKED', await row.locator('input').isChecked());
await row.screenshot({ path: OUT + '2-toggle-on-closeup.png' });
await load(JSON.stringify(board(0.2)));
await p.locator('[data-tut="play"]').click();
await sleep(1500);
await p.screenshot({ path: OUT + '3-slip-low-mu.png' });
await sleep(1500);
await p.screenshot({ path: OUT + '4-slip-low-mu-later.png' });
console.log('LOGS', JSON.stringify(logs));
await b.close();
