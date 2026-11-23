// Opens the editor (Xưởng Nối) on :5204 and screenshots it, to see that the stage port left it alone.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
const logs = [];
p.on('console', (m) => { if (['error'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await p.goto('http://localhost:5204/');
await p.waitForTimeout(3000);
await p.screenshot({ path: 'D:/workspace/GameBuilder/plans/reports/shots-stage-port/editor-home.png' });
console.log(logs.join('\n') || 'no console errors');
await b.close();
