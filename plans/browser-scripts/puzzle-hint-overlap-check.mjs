// Level 3 on :5173: press "?" once and screenshot, to check the cat bubble no longer overlaps the task box.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-hints/';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao'];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
p.on('pageerror', (e) => logs.push(e.message));
await p.goto('http://localhost:5173/giai-do.html');
await p.evaluate((list) => {
  localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 3 }]))));
  localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(['bot-dau-tien', 'intro:nhat-sao']));
}, ids);
await p.reload(); await p.waitForTimeout(800); await p.click('text=Nhặt sao');
await p.waitForTimeout(2500);
await p.screenshot({ path: out + 'fix-before-click.png' }); console.log('errors:', logs.join(' | ') || 'none', 'hash:', await p.evaluate(() => location.hash));
await p.locator('.pz-hint-btn').click({ force: true });
await p.waitForTimeout(2500);
await p.screenshot({ path: out + 'fix-level3-hint-no-overlap.png' });
console.log(logs.join('\n') || 'no page errors');
await b.close();
