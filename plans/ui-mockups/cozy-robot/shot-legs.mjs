const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const url = pathToFileURL(path.join(dir, 'robot-legs.html')).href;
const out = path.join(dir, 'shots-legs');
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(url);
await page.waitForSelector('body[data-ready="1"]', { timeout: 30000 });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(out, 'default.png') });
console.log('tris', await page.evaluate(() => window.__robot.tris));
const waits = { walk: 700, jump: 450, happy: 900, sad: 1500 };
for (const s of ['walk', 'jump', 'happy', 'sad']) {
  await page.evaluate((x) => window.__robot.setState(x), s);
  await page.waitForTimeout(waits[s]);
  await page.screenshot({ path: path.join(out, s + '.png') });
}
await page.evaluate(() => window.__robot.setState('idle'));
await page.setViewportSize({ width: 400, height: 800 });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(out, 'phone.png'), fullPage: true });
console.log('scrollW', await page.evaluate(() => document.documentElement.scrollWidth));
console.log(logs.join('\n') || 'no console errors');
await browser.close();
