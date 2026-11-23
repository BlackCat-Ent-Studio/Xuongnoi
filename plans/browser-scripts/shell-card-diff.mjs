// Pixel check: one node card of level 1 on main (:5202) vs the shell branch (:5201). Must be identical.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-shell/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
for (const [tag, port] of [['main', 5202], ['shell', 5201]]) {
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  await p.goto(`http://localhost:${port}/giai-do.html`);
  await p.evaluate(() => { localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(['bot-dau-tien'])); localStorage.removeItem('xuongnoi.puzzle.progress'); });
  await p.goto(`http://localhost:${port}/giai-do.html#/level/bot-dau-tien`);
  await p.reload();
  await p.waitForTimeout(3500);
  await p.locator('.wc-node[data-id="touch-flag"]').screenshot({ path: `${out}card-${tag}.png` });
  await p.close();
}
await b.close();
const a = fs.readFileSync(out + 'card-main.png');
const c = fs.readFileSync(out + 'card-shell.png');
console.log('sizes', a.length, c.length, 'identical bytes:', a.equals(c));
