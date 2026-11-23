// :5173 — 3D view: a 2 kg and a 40 kg robot with the same motors, "Vật lý thật" off then on.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-w2-traction/';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const node = (id, kind, x, y, params) => ({ id, kind, params, pos: { x, y } });
const board = (real) => {
  const wires = [];
  const w = (a, ap, b, bp) => wires.push({ id: 'w' + wires.length, from: { node: a, port: ap }, to: { node: b, port: bp } });
  const nodes = [node('p', 'const', 0, 0, { value: 1 })];
  for (const [tag, mass, z, corner] of [['a', 2, -1.5, 'top-left'], ['b', 40, 1.5, 'top-right']]) {
    nodes.push(
      node('body' + tag, 'robot-body', 220, z * 150, { position: { x: -6, y: 0.5, z }, mass, color: mass > 10 ? '#ef4444' : '#3b82f6' }),
      node('ml' + tag, 'motor', 460, z * 150 - 80, { side: -0.35 }),
      node('mr' + tag, 'motor', 460, z * 150 + 80, { side: 0.35 }),
      node('n' + tag, 'show-number', 700, z * 150, { label: mass + ' kg (m/s)', corner }),
    );
    for (const m of ['ml', 'mr']) { w('p', 'value', m + tag, 'power'); w('body' + tag, 'self', m + tag, 'body'); }
    w('body' + tag, 'speed', 'n' + tag, 'value');
  }
  return { format_version: 1, name: 'Nặng nhẹ', mode: '3d', graph: { settings: { ...(real ? { realPhysics: true } : {}), wireRule: true }, nodes, wires } };
};
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const logs = [];
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
for (const real of [false, true]) {
  await p.goto('http://localhost:5173/');
  await p.evaluate((j) => { localStorage.clear(); localStorage.setItem('xuong-noi:autosave', j); }, JSON.stringify(board(real)));
  await p.reload();
  await sleep(2500);
  if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  await p.locator('[data-tut="play"]').click();
  for (const t of [700, 2500]) {
    await sleep(t === 700 ? 700 : 1800);
    await p.screenshot({ path: `${OUT}3d-${real ? 'on' : 'off'}-${t}ms.png` });
  }
}
console.log('LOGS', JSON.stringify(logs));
await b.close();
