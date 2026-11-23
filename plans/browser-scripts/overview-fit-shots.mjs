// Screenshots every puzzle level in overview mode for each closeness preset and viewport (trial slider hidden).
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-overview-fit/';
const base = process.env.BASE ?? 'http://localhost:5206';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau', 'xuong-tong-hop'];
const presets = ['hien-tai', 'gan-vua', 'rat-gan'];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
for (const [tag, vp] of [['desk', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
  const p = await b.newPage({ viewport: vp });
  p.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag}: ${m.text()}`); });
  p.on('pageerror', (e) => logs.push(`${tag} pageerror: ${e.message}`));
  await p.goto(`${base}/giai-do.html`);
  await p.evaluate((list) => localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }])))), ids);
  await p.reload();
  await p.waitForTimeout(1000);
  for (const [n, id] of ids.entries()) {
    for (const [pi, pname] of presets.entries()) {
      await p.goto(`${base}/giai-do.html#/level/${id}`);
      await p.waitForTimeout(1800);
      const vt = p.locator('.pz-viewtoggle');
      if ((await vt.textContent()) === 'Theo nhân vật') await vt.click();
      await p.evaluate((i) => {
        const s = document.querySelector('.pz-fit-trial input');
        s.value = String(i);
        s.dispatchEvent(new Event('input', { bubbles: true }));
      }, pi);
      await p.evaluate(() => { const g = document.querySelector('.pz-fit-trial'); if (g) g.style.display = 'none'; });
      await p.waitForTimeout(900);
      await p.screenshot({ path: `${out}${tag}-${pname}-${n + 1}-${id}.png` });
    }
  }
  await p.close();
}
console.log(logs.slice(0, 20).join('\n') || 'no console errors');
await b.close();
