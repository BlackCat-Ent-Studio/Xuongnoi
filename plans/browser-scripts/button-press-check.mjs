// Every button on each shell screen: centre x must not move on hover / mousedown / after release.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const base = 'http://localhost:5173/giai-do.html';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'cau-nhap-nhay', 'xuong-tong-hop'];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
let bad = 0, total = 0;

async function check(label) {
  const n = await p.locator('button:visible, a.pz-link:visible, .pz-stop:visible').count();
  for (let i = 0; i < n; i++) {
    const el = p.locator('button:visible, a.pz-link:visible, .pz-stop:visible').nth(i);
    const name = (await el.evaluate((e) => (e.className || e.tagName) + '|' + (e.textContent || '').trim().slice(0, 14))).replace(/\s+/g, ' ');
    const cx = async () => { const q = await el.boundingBox(); return q ? q.x + q.width / 2 : NaN; };
    const x0 = await cx();
    const q = await el.boundingBox();
    if (!q) continue;
    await p.mouse.move(q.x + q.width / 2, q.y + q.height / 2);
    await p.waitForTimeout(250);
    const x1 = await cx();
    await p.mouse.down();
    await p.waitForTimeout(250);
    const x2 = await cx();
    await p.mouse.move(2, 2); // leave before release: no click
    await p.mouse.up();
    await p.waitForTimeout(250);
    const x3 = await cx();
    total++;
    const worst = Math.max(Math.abs(x1 - x0), Math.abs(x2 - x0), Math.abs(x3 - x0));
    if (!(worst < 1.5)) { bad++; console.log('SHIFT', label, name, x0.toFixed(1), x1.toFixed(1), x2.toFixed(1), x3.toFixed(1)); }
  }
  console.log(label, 'buttons checked:', n);
}

await p.goto(base);
await p.evaluate(([progress, seen]) => {
  localStorage.setItem('xuongnoi.puzzle.progress', progress);
  localStorage.setItem('xuongnoi.puzzle.guideSeen', seen);
}, [JSON.stringify(Object.fromEntries(ids.slice(0, 3).map((i) => [i, { stars: 3 }]))), JSON.stringify([...ids, ...ids.map((i) => 'intro:' + i)])]);
await p.goto(base + '#/'); await p.reload(); await p.waitForTimeout(2200);
await check('title');
await p.click('.pz-settings-btn'); await p.waitForTimeout(600);
await check('settings');
await p.keyboard.press('Escape'); await p.waitForTimeout(400);
await p.goto(base + '#/map'); await p.waitForTimeout(7000);
await check('map');
await p.goto(base + '#/end'); await p.waitForTimeout(3000);
await check('end');
await p.goto(base + '#/level/bot-dau-tien'); await p.waitForTimeout(3500);
await check('level');
console.log('total', total, 'shifted', bad, 'pageerrors', errs.length);
await b.close();
process.exit(bad ? 1 : 0);
