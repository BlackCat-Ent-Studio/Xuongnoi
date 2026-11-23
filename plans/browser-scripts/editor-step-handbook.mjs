const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-editor-step/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
await p.goto('http://localhost:5241/');
await p.waitForTimeout(1200);
await p.getByRole('button', { name: 'Không', exact: true }).first().click({ timeout: 2000 }).catch(() => {});
await p.getByText('Trợ giúp', { exact: true }).first().click();
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[role=menuitem]')].map((e) => (e.textContent || '').trim().slice(0, 40)))));
await p.getByText(/Sổ tay/).first().click();
await p.waitForTimeout(800);
for (const [name, tag] of [['Chạy theo tuyến', 'route'], ['Vật thể', 'block']]) {
  await p.getByText(name, { exact: true }).first().click();
  await p.waitForTimeout(400);
  const btns = await p.locator('[data-hb-action]').evaluateAll((l) => l.map((e) => e.textContent));
  console.log(name, JSON.stringify(btns));
  await p.screenshot({ path: out + `handbook-${tag}.png` });
  const extra = p.locator('[data-hb-action="try-extra"]');
  await extra.click();
  await p.waitForTimeout(800);
  console.log('board opened:', await p.locator('.name-input').inputValue());
  if (tag === 'route') {
    await p.getByText(/Sổ tay/).first().click().catch(async () => { await p.getByText('Trợ giúp', { exact: true }).first().click(); await p.getByText(/Sổ tay/).first().click(); });
    await p.waitForTimeout(500);
  }
}
console.log(logs.join('\n'));
await b.close();
