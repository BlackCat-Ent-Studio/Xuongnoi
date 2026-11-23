// Dumps the on-screen rectangles of every card of level 7 (plain level) at a viewport. usage: node l7-card-rects.mjs <w> <h>
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const BASE = 'http://localhost:5222';
const all = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau', 'xuong-tong-hop'];
const w = Number(process.argv[2] ?? 844), h = Number(process.argv[3] ?? 390);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
await p.goto(`${BASE}/giai-do.html`);
await p.evaluate((list) => {
  localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
  localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify([...list, ...list.map((i) => 'intro:' + i)]));
}, all);
await p.goto('about:blank');
await p.goto(`${BASE}/giai-do.html#/level/phan-loai-mau`);
await p.waitForTimeout(3000);
const rects = await p.evaluate(() => {
  const r = (el) => { const b = el.getBoundingClientRect(); return `${Math.round(b.left)},${Math.round(b.top)} ${Math.round(b.width)}x${Math.round(b.height)} -> bottom ${Math.round(b.bottom)}`; };
  const out = [];
  document.querySelectorAll('.wc-node').forEach((n) => out.push(`${n.dataset.id ?? n.dataset.kind}: ${r(n)}`));
  const world = document.querySelector('.wc-world'); if (world) out.push('world: ' + r(world));
  const board = document.querySelector('.pz-board'); if (board) out.push('board: ' + r(board));
  const tray = document.querySelector('.pz-tray, .pz-bottom'); if (tray) out.push('tray: ' + r(tray));
  return out;
});
console.log(rects.join('\n'));
await b.close();
