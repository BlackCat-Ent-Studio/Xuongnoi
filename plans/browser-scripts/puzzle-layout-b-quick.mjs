// Quick look at one level in layout B. usage: node puzzle-layout-b-quick.mjs <levelNo 1-8> <w> <h>
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const [no = '2', w = '844', h = '390'] = process.argv.slice(2);
const out = 'D:/workspace/GameBuilder/plans/reports/shots-layout-b/';
const BASE = 'http://localhost:5207/giai-do.html';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau', 'xuong-tong-hop'];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: +w, height: +h } });
const logs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('pageerror ' + e.message));
await p.goto(BASE);
await p.evaluate((list) => {
  localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
  localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(list.concat(list.map((i) => 'intro:' + i))));
}, ids);
await p.goto(BASE + '#/map');
await p.reload();
await p.waitForSelector('.pz-stop', { timeout: 8000 });
await p.waitForTimeout(800);
await p.locator('.pz-stop').nth(+no - 1).click();
await p.waitForSelector('.pz-pip-hit', { timeout: 8000 });
await p.waitForTimeout(2500);
await p.screenshot({ path: out + `quick-${no}-${w}-board.png` });
await p.click('.pz-pip-hit');
await p.waitForTimeout(1200);
await p.screenshot({ path: out + `quick-${no}-${w}-stage.png` });
console.log(logs.join('\n') || 'no console errors');
await b.close();
