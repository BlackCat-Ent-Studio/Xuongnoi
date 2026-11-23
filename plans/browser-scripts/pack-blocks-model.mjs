const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
// usage: node pack-blocks-model.mjs <model path under mega-pack-world> <out name>
const model = process.argv[2];
const out = process.argv[3];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 800, height: 900 } });
page.on('pageerror', (e) => console.log('PAGEERR', String(e)));
await page.goto('http://localhost:5201/zz-debug.html?side=' + (process.argv[4] ?? 0) + '&m=' + encodeURIComponent(model));
await page.waitForTimeout(3000);
console.log(await page.title());
await page.screenshot({ path: 'D:/workspace/GameBuilder/plans/reports/shots-pack-blocks/model-' + out + '.png' });
await browser.close();
