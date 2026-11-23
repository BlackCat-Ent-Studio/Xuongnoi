// Layout B two-way swap: board-full, swapping, stage-full running, stage-full fail (V1 bubble / V2 checklist), swap back by tapping the mini board, camera in stage-full.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const out = path.join(dir, 'shots') + path.sep;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [], notes = [];
const page = await browser.newPage({ viewport: { width: 1360, height: 860 } });
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
page.on('requestfailed', (r) => { if (!/fonts\.g/.test(r.url())) logs.push(`requestfailed: ${r.url()}`); });
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href);
await page.waitForSelector('body[data-ready="1"]', { timeout: 90000 });
const shot = async (n, wait = 600) => { await page.waitForTimeout(wait); await page.locator('#screen').screenshot({ path: out + n + '.png' }); };
const st = () => page.evaluate(() => ({ layout: __app.UI.layout, pip: __app.UI.pip, running: __app.UI.running, z: +__app.cam.zoom.toFixed(2) }));
notes.push('default ' + JSON.stringify(await st()));

for (const checker of ['v1', 'v2']) {
  await page.click(`#ctrl .seg[data-key=checker] button[data-v=${checker}]`);
  for (const cut of [false, true]) {
    const c = page.locator('#cut'); if ((await c.isChecked()) !== cut) await c.click();
    const tag = `bswap-${checker}-${cut ? 'fail' : 'ok'}`;
    await page.waitForTimeout(500);
    await shot(`${tag}-1-board-full`);
    await page.click('#run'); await shot(`${tag}-2-swapping`, 180);        // mid-animation
    await page.evaluate(() => __app.seek(3.3)); await shot(`${tag}-3-stage-running`);
    await page.evaluate((t) => __app.seek(t), cut ? 8.2 : 7.2); await shot(`${tag}-4-stage-end`);
    notes.push(`${tag} after run: ${JSON.stringify(await st())}`);
    // tap the mini board to swap back
    const bb = await page.locator('#boardView').boundingBox();
    await page.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2); await shot(`${tag}-5-swapped-back`);
    notes.push(`${tag} after tapping mini board: ${JSON.stringify(await st())}`);
    await page.click('#run'); await page.waitForTimeout(400);
    notes.push(`${tag} after DỪNG: ${JSON.stringify(await st())}`);
  }
}
// tap the small stage -> enlarge (while not running), camera in stage-full, then DỪNG swaps back
await page.click('#ctrl .seg[data-key=checker] button[data-v=v1]');
const sb = await page.locator('#stageView').boundingBox();
await page.mouse.click(sb.x + sb.width / 2, sb.y + sb.height / 2); await page.waitForTimeout(600);
notes.push('tap corner stage: ' + JSON.stringify(await st()));
const fb = await page.locator('#stageView').boundingBox();
await page.mouse.move(fb.x + 420, fb.y + 160); for (let i = 0; i < 4; i++) await page.mouse.wheel(0, -120);
await page.mouse.move(fb.x + 420, fb.y + 160); await page.mouse.down(); await page.mouse.move(fb.x + 250, fb.y + 160, { steps: 6 }); await page.mouse.up();
await shot('bswap-camera-zoomed-pan'); notes.push('camera in stage-full: ' + JSON.stringify(await st()));
await page.mouse.dblclick(fb.x + 420, fb.y + 160); await page.waitForTimeout(700);
notes.push('dblclick fit: ' + JSON.stringify(await st()));
await page.click('#shrink'); await page.waitForTimeout(600); notes.push('shrink button: ' + JSON.stringify(await st()));
console.log(notes.join('\n'));
console.log('--- console ---\n' + (logs.slice(0, 20).join('\n') || 'no console errors'));
await browser.close();
