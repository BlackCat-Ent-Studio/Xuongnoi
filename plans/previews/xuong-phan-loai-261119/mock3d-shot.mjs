// Runs each layout headless for a while (jam check), then pictures every layout from two angles.
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const { chromium } = await import(pathToFileURL(path.join(here, 'pw', 'node_modules', 'playwright-core', 'index.mjs')).href);
const url = process.argv[2] || 'http://localhost:5173/tests/showcase/factory-mockup.html';
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 860 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await page.goto(url);
await page.waitForFunction(() => !!window.__mock, null, { timeout: 120000 });
for (const id of ['gon', 'vua', 'haidau', 'lon']) console.log(JSON.stringify(await page.evaluate((i) => window.__mock.trial(i, 120), id)));
for (const id of ['gon', 'vua', 'haidau', 'lon']) {
  await page.click(`[data-layout="${id}"]`);
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(here, `grid-${id}-all.png`) });
  if (id === 'vua') for (const c of ['station', 'hole', 'ground', 'top']) { await page.click(`[data-cam="${c}"]`); await page.waitForTimeout(2000); await page.screenshot({ path: path.join(here, `grid-${id}-${c}.png`) }); }
}
console.log(JSON.stringify(logs.slice(0, 6)));
await browser.close();
