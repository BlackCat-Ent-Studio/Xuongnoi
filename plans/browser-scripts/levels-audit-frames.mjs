// Burst of frames of puzzle levels 1-8 running WITH the reference solution wired in (844x390), to read every pick-up and drop.
// usage: node carry-place-frames.mjs <levelId> [frames] [pauseMs]
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-levels-audit/frames/';

const BASE = 'http://localhost:5220';
const all = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau', 'xuong-tong-hop'];
const id = process.argv[2];
const runDir = out + id + '/';
fs.rmSync(runDir, { recursive: true, force: true });
fs.mkdirSync(runDir, { recursive: true });
const frames = Number(process.argv[3] ?? 60);
const pause = Number(process.argv[4] ?? 0);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.text().includes('[physics-watch]') || m.type() === 'error') logs.push(m.text()); });
await p.route(/\/src\/puzzle\/levels\/level-0[1-8]\.ts/, async (route) => {
  const res = await route.fetch();
  let body = await res.text();
  const m = /export const (level0\d)/.exec(body);
  if (m) body += `\n;${m[1]}.base = { ...${m[1]}.base, nodes: [...${m[1]}.base.nodes, ...${m[1]}.solution.nodes], wires: [...${m[1]}.base.wires, ...${m[1]}.solution.wires] };\n`;
  await route.fulfill({ response: res, body });
});
await p.goto(`${BASE}/giai-do.html`);
await p.evaluate((list) => {
  localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
  localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify([...list, ...list.map((i) => 'intro:' + i)]));
}, all);
await p.goto('about:blank');
await p.goto(`${BASE}/giai-do.html#/level/${id}`);
await p.waitForTimeout(3000);
await p.locator('.pz-btn.run').first().click({ force: true });
for (let z = 0; z < Number(process.env.ZO ?? 0); z++) await p.locator('.pz-cam button').nth(1).click({ force: true }).catch(() => {});
const t0 = Date.now();
for (let i = 0; i < frames; i++) {
  const real = ((Date.now() - t0) / 1000).toFixed(1);
  await p.screenshot({ type: 'jpeg', quality: 70, path: `${runDir}${id}-${String(i).padStart(3, '0')}-real${real}.jpg` });
  if (pause) await p.waitForTimeout(pause);
}
console.log(logs.join('\n') || 'no page errors, no physics-watch warnings');
await b.close();
