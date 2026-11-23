// Opens the puzzle page on :5173, screenshots the level list and every real level (desktop + phone landscape).
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-puzzle-levels/';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'cau-nhap-nhay', 'xuong-tong-hop'];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
for (const [tag, vp] of [['desk', { width: 1280, height: 800 }], ['phone', { width: 844, height: 390 }]]) {
  const p = await b.newPage({ viewport: vp });
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${tag}: ${m.text()}`); });
  p.on('pageerror', (e) => logs.push(`${tag} pageerror: ${e.message}`));
  await p.goto('http://localhost:5173/giai-do.html');
  // unlock every level so each can be opened directly
  await p.evaluate((list) => localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }])))), ids);
  await p.reload();
  await p.waitForTimeout(1200);
  if (tag === 'desk') await p.screenshot({ path: out + 'list.png' });
  for (const [n, id] of ids.entries()) {
    await p.goto(`http://localhost:5173/giai-do.html#/level/${id}`);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: out + `${tag}-${n + 1}-${id}.png` });
  }
  await p.close();
}
console.log(logs.slice(0, 20).join('\n') || 'no console errors');
await b.close();
