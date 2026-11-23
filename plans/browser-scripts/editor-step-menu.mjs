const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
await p.goto('http://localhost:5241/');
await p.waitForTimeout(1200);
await p.getByText('Tệp', { exact: true }).first().click();
await p.waitForTimeout(300);
console.log(JSON.stringify(await p.evaluate(() => [...document.querySelectorAll('[role=menuitem]')].map((e) => (e.textContent || '').trim().slice(0, 50)))));
await b.close();
