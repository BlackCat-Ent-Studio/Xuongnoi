// L7 board shots: locked script cards on the left, desktop and phone, before running; then run frames of the plain level.
// usage: node l7-board-shots.mjs [runFrames] [pauseMs]
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-l7-board/';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5222';
const all = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau', 'xuong-tong-hop'];
const frames = Number(process.argv[2] ?? 0);
const pause = Number(process.argv[3] ?? 0);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];

async function open(viewport, withSolution) {
  const p = await b.newPage({ viewport, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.text().includes('[physics-watch]') || m.type() === 'error') logs.push(m.text()); });
  if (withSolution) {
    await p.route(/\/src\/puzzle\/levels\/level-07\.ts/, async (route) => {
      const res = await route.fetch();
      let body = await res.text();
      body += `\n;level07.base = { ...level07.base, nodes: [...level07.base.nodes, ...level07.solution.nodes], wires: [...level07.base.wires, ...level07.solution.wires] };\n`;
      await route.fulfill({ response: res, body });
    });
  }
  await p.goto(`${BASE}/giai-do.html`);
  await p.evaluate((list) => {
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify([...list, ...list.map((i) => 'intro:' + i)]));
  }, all);
  await p.goto('about:blank');
  await p.goto(`${BASE}/giai-do.html#/level/phan-loai-mau`);
  await p.waitForTimeout(3000);
  const task = p.locator('.pz-task-btn, button:has-text("Đề bài")').first();
  if (await p.locator('.pz-task:visible').count()) await task.click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
  const p = await open(vp, false);
  await p.screenshot({ path: `${out}board-${name}.png` });
  await p.close();
  const q = await open(vp, true);
  await q.screenshot({ path: `${out}board-${name}-with-solution.png` });
  await q.close();
}

if (frames > 0) {
  const p = await open({ width: 844, height: 390 }, true);
  await p.locator('.pz-btn.run').first().click({ force: true });
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const real = ((Date.now() - t0) / 1000).toFixed(1);
    await p.screenshot({ type: 'jpeg', quality: 70, path: `${out}run-${String(i).padStart(3, '0')}-real${real}.jpg` });
    if (pause) await p.waitForTimeout(pause);
  }
}
console.log(logs.join('\n') || 'no page errors, no physics-watch warnings');
await b.close();
