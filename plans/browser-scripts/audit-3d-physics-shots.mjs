// Read-only audit: runs 3D levels 5-8 (empty answer = only the locked wiring) and screenshots the stage over time,
// to see characters walking through crates, crates stacking inside each other, etc.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-3d-audit/';
const all = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau', 'xuong-tong-hop'];
const plan = process.argv[2]==='overview' ? [['ne-linh-gac',[2.2],true],['xuong-tong-hop',[1.5,8,14],true],['du-ba-thung',[12,25],true]] : [
  ['du-ba-thung', [1, 3.5, 4.2, 5, 9, 12, 20], false],
  ['ne-linh-gac', [1, 1.8, 2.2, 2.6], false],
  ['phan-loai-mau', [0.5, 0.9, 1.4, 2, 2.6, 3.2, 4], false],
  ['phan-loai-mau', [0.6, 1.0, 1.5, 2.1, 2.7], true],
  ['xuong-tong-hop', [1, 1.5, 3, 6, 10, 14], false],
];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await p.goto('http://localhost:5173/giai-do.html');
await p.evaluate((list) => {
  localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
  localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify([...list, ...list.map((i) => 'intro:' + i)]));
}, all);
for (const [id, times, follow] of plan) {
  await p.goto('about:blank');
  await p.goto(`http://localhost:5173/giai-do.html#/level/${id}`);
  await p.waitForTimeout(2500);
  const tag = `${id}${follow ? '-follow' : ''}`;
  await p.screenshot({ path: `${out}${tag}-0-edit.png` });
  if (follow) await p.locator('.pz-viewtoggle').first().click({ force: true }).catch((e) => logs.push('toggle: ' + e.message));
  await p.locator('.pz-btn.run').first().click({ force: true });
  const t0 = Date.now();
  for (const t of times) {
    const wait = t * 1000 - (Date.now() - t0);
    if (wait > 0) await p.waitForTimeout(wait);
    const real = ((Date.now() - t0) / 1000).toFixed(1);
    await p.screenshot({ path: `${out}${tag}-t${String(t).replace('.', '_')}-real${real}.png` });
  }
}
console.log(logs.join('\n') || 'no page errors');
await b.close();
