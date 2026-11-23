// Lesson "Xem dây chạy từng bước" end to end + handbook extra buttons + touch fullscreen call.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-editor-step/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await p.goto('http://localhost:5241/');
await p.waitForTimeout(1200);
await p.getByRole('button', { name: 'Có', exact: true }).first().click({ timeout: 2000 }).catch(() => {});
await p.waitForTimeout(500);
await p.screenshot({ path: out + 'lesson-0-menu.png' });
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('.ld-list li, .ld-list button')].map((e) => (e.textContent || '').trim().slice(0, 60)).slice(0, 12))));
const item = p.getByText('Xem dây chạy từng bước').first();
console.log('lesson in list:', await item.count());
await item.click();
await p.waitForTimeout(800);
const panel = async () => (await p.evaluate(() => (document.querySelector('.ld-card')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 260)));
console.log('1', await panel());
await p.locator('.ld-btns button').last().click().catch(() => {});
await p.waitForTimeout(400);
console.log('2', await panel());
await p.locator('#btn-play').click();
await p.waitForTimeout(600);
console.log('3', await panel());
await p.locator('[data-tut="step"]').click();
await p.waitForTimeout(500);
console.log('4', await panel());
for (let i = 0; i < 60; i++) {
  if (!(await p.locator('[data-tut="step"]').isDisabled())) break;
  await p.waitForTimeout(250);
}
await p.waitForTimeout(500);
console.log('5', await panel());
await p.screenshot({ path: out + 'lesson-1-paused.png' });
await p.locator('[data-tut="step"]').click();
for (let i = 0; i < 60; i++) {
  await p.waitForTimeout(250);
  if (!(await p.locator('[data-tut="step"]').isDisabled())) break;
}
await p.waitForTimeout(500);
console.log('6', await panel());
console.log(logs.join('\n'));
await b.close();
