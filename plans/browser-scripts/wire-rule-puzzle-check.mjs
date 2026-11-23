// Opens five puzzle levels on :5230, marks every guide as seen, and screenshots each board (desktop landscape). Logs console errors.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import { mkdirSync } from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-wire-rule/';
mkdirSync(out, { recursive: true });
const PORT = process.env.PORT ?? 5230;
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau'];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await p.goto(`http://localhost:${PORT}/giai-do.html`);
await p.evaluate((list) => {
  localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
  localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify([...list, ...list.map((i) => `intro:${i}`)]));
}, ids);
await p.reload();
await p.waitForTimeout(1200);
for (const [n, id] of ids.entries()) {
  if (![0, 4, 5, 6].includes(n)) continue;
  await p.goto(`http://localhost:${PORT}/giai-do.html#/level/${id}`);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out + `puzzle-${n + 1}-${id}.png` });
}
console.log(logs.slice(0, 20).join('\n') || 'no console errors');
await b.close();
