const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import path from 'node:path'; import fs from 'node:fs'; import { fileURLToPath, pathToFileURL } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, 'shots-chibi'); fs.mkdirSync(out, { recursive: true });
const url = pathToFileURL(path.join(dir, 'cat-chibi.html')).href + '?still=1';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('console', m => { if (['error', 'warning'].includes(m.type())) errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto(url); await page.waitForSelector('#stage canvas'); await page.waitForTimeout(2500);
const stage = page.locator('.stage-wrap');
const names = ['normal','angry'];
await stage.screenshot({ path: path.join(out, '00-default.png') });
{ const b = await page.locator('#stage').boundingBox(); const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx + 110, cy, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(900);
  await stage.screenshot({ path: path.join(out, '01-side.png') });
  await page.mouse.move(cx, cy); await page.mouse.down(); await page.mouse.move(cx - 110, cy, { steps: 12 }); await page.mouse.up(); await page.waitForTimeout(900); }
for (const n of names) {
  await page.click(`#exprs .chip[data-k="${n}"]`); await page.waitForTimeout(n === 'box' ? 1800 : 1300);
  await stage.screenshot({ path: path.join(out, `expr-${n}.png`) });
}
await page.click('#exprs .chip[data-k="normal"]');

console.log('tri:', await page.textContent('#tri'));
const p2 = await browser.newPage({ viewport: { width: 400, height: 860 } });
p2.on('pageerror', e => errs.push('pageerror400: ' + e.message));
await p2.goto(url); await p2.waitForTimeout(2500);
await p2.screenshot({ path: path.join(out, 'mobile-400.png'), fullPage: true });
console.log('scrollW', await p2.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
console.log(errs.join('\n') || 'no console errors');
await browser.close();
