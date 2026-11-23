// Screenshots every puzzle level (edit + running) at 1280x720 and 844x390 on the stage port (:5204), plus triangle counts.
// usage: node stage-port-check.mjs [outDir] [levelNumbers comma list]
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = process.argv[2] ?? 'D:/workspace/GameBuilder/plans/reports/shots-stage-port/';
const only = (process.argv[3] ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
const overview = process.argv[4] === 'overview';
const prefix = overview ? 'ov-' : '';
const base = 'http://localhost:5204/giai-do.html';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'cau-nhap-nhay', 'xuong-tong-hop'];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const tris = {};
for (const [tag, vp] of [['desk', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
  const p = await b.newPage({ viewport: vp });
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${tag}: ${m.text()}`); });
  p.on('pageerror', (e) => logs.push(`${tag} pageerror: ${e.message}`));
  await p.goto(base);
  await p.evaluate((list) => {
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(list.flatMap((i) => [i, `intro:${i}`])));
  }, ids);
  await p.reload();
  await p.waitForTimeout(1200);
  for (const [n, id] of ids.entries()) {
    if (!only.includes(n + 1)) continue;
    await p.goto(`${base}#/level/${id}`);
    await p.reload();
    await p.waitForTimeout(2600);
    if (overview) { await p.click('.pz-viewtoggle'); await p.waitForTimeout(600); }
    await p.screenshot({ path: out + `${prefix}${tag}-${n + 1}-edit.png` });
    const t0 = await p.evaluate(() => window.__pzRenderInfo?.render.triangles ?? -1);
    await p.click('.pz-btn.run');
    await p.waitForTimeout(3200);
    await p.screenshot({ path: out + `${prefix}${tag}-${n + 1}-run.png` });
    const t1 = await p.evaluate(() => window.__pzRenderInfo?.render.triangles ?? -1);
    tris[`${tag}-${n + 1}`] = [t0, t1];
  }
  await p.close();
}
console.log('triangles [edit, run]:', JSON.stringify(tris));
console.log(logs.slice(0, 20).join('\n') || 'no console errors');
await b.close();
