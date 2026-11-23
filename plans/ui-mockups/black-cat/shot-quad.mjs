const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
import path from 'node:path';

const dir = 'D:/workspace/GameBuilder/plans/ui-mockups/black-cat';
const out = path.join(dir, 'shots-quad');
fs.mkdirSync(out, { recursive: true });
const url = 'file:///' + dir + '/cat-quad.html';

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', e => errs.push('pageerror: ' + e.message));
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__cat, null, { timeout: 30000 });
await page.waitForTimeout(2500);
await page.evaluate(() => { window.__cat.stopAuto(); window.__cat.resetCamera(); });
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(out, '00-default.png') });

for (const [n, c] of [['side', [6.2, 1.8, 0.2]], ['back-top', [-1.5, 6.5, -3.5]], ['back', [-2.5, 2.5, -6]], ['user', [4, 4.5, -4]], ['front', [0, 2.2, 6.6]]]) {
  await page.evaluate((c) => window.__cat.setCamera(...c), c);
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(out, `v-${n}.png`) });
}
await page.evaluate(() => window.__cat.resetCamera());
await page.waitForTimeout(400);
const exprs = ['normal','big','blush','angry','cry','sleep','surprise','box','logo'];
for (const [i, id] of exprs.entries()) {
  await page.evaluate((id) => window.__cat.setExpression(id), id);
  await page.waitForTimeout(1900);
  await page.screenshot({ path: path.join(out, `${String(i + 1).padStart(2, '0')}-${id}.png`) });
}
await page.evaluate(() => { window.__cat.setExpression('normal'); window.__cat.setMotion('walk'); });
await page.waitForTimeout(1500);
await page.screenshot({ path: path.join(out, '10-walk.png') });
await page.evaluate(() => window.__cat.setMotion('jump'));
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(out, '11-jump.png') });
await page.evaluate(() => window.__cat.setMotion('idle'));
await page.evaluate(() => { const set = (id, v) => { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); };
  set('sRingSize', 0.8); set('sRingThick', 0.13); set('sRingY', -0.1); set('sRingZ', 0.1); set('sRingTilt', 25); set('sXSize', 1.6); });
await page.waitForTimeout(700);
await page.screenshot({ path: path.join(out, '14-sliders.png') });
await page.evaluate(() => window.__cat.setCamera(4, 4.5, -4));
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(out, '15-sliders-back.png') });
await page.click('#btnReset'); await page.waitForTimeout(300);
console.log('tris', await page.evaluate(() => window.__cat.tris()));

await page.evaluate(() => { window.__cat.setExpression('normal'); window.__cat.setMotion('idle'); });
const m = await browser.newPage({ viewport: { width: 400, height: 800 } });
m.on('pageerror', e => errs.push('m pageerror: ' + e.message));
await m.goto(url, { waitUntil: 'load' });
await m.waitForFunction(() => window.__cat, null, { timeout: 30000 });
await m.waitForTimeout(2000);
await m.evaluate(() => { window.__cat.stopAuto(); window.__cat.resetCamera(); });
await m.waitForTimeout(500);
await m.screenshot({ path: path.join(out, '12-mobile400.png') });
await m.screenshot({ path: path.join(out, '13-mobile400-full.png'), fullPage: true });
console.log('scrollW', await m.evaluate(() => [document.documentElement.scrollWidth, innerWidth]));
console.log(errs.join('\n') || 'no console errors');
await browser.close();
