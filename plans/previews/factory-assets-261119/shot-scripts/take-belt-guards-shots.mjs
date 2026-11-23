// Screenshots of the belt side-guard chooser (served by the static preview server).
// usage: PW_ENTRY=<file URL of a module exporting chromium> node take-belt-guards-shots.mjs
// output: ../shots/belt-guards-*.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PW_ENTRY ?? 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..', 'shots');
const URL_ = process.env.PAGE_URL ?? 'http://localhost:5390/belt-guards.html';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()}`));

await page.goto(URL_);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
// a time when one carton is clear of the gate posts and one is under the gate
await page.evaluate(() => window.preview.freeze(1.2));

const NAMES = { A: 'A-lan-can-ong', B: 'B-thanh-thap', C: 'C-kinh-trong', D: 'D-khong-ve', X: 'hien-tai' };
const VIEWS = { cheo: 'default', ngang: 'nhin-ngang' };
for (const bg of ['light', 'dark']) {
  await page.click(`button[data-key="bg"][data-val="${bg}"]`);
  for (const id of Object.keys(NAMES)) {
    await page.click(`button[data-key="guard"][data-val="${id}"]`);
    for (const [camName, label] of Object.entries(VIEWS)) {
      await page.click(`button[data-cam="${camName}"]`);
      await sleep(900);
      const el = page.locator('#v-main');
      await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
      await sleep(300);
      await el.screenshot({ path: path.join(OUT, `belt-guards-${NAMES[id]}-${label}-${bg}.png`) });
      console.log('shot', id, label, bg);
    }
  }
}

// whole page (buttons, thumbnails, answer line), both backgrounds, and the end-on camera
for (const bg of ['light', 'dark']) {
  await page.click(`button[data-key="bg"][data-val="${bg}"]`);
  await page.click('button[data-key="guard"][data-val="A"]');
  await page.click('button[data-cam="cheo"]');
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT, `belt-guards-page-${bg}.png`), fullPage: false });
  await page.click('button[data-cam="ngang"]');
  await sleep(1200);
  await page.screenshot({ path: path.join(OUT, `belt-guards-page-nhin-ngang-${bg}.png`), fullPage: false });
}
await page.click('button[data-key="bg"][data-val="light"]');
await page.click('button[data-key="guard"][data-val="C"]');
await page.click('button[data-cam="dau"]');
await sleep(1200);
await page.locator('#v-main').screenshot({ path: path.join(OUT, 'belt-guards-C-kinh-trong-dau-bang-light.png') });

// the real controls: drag to orbit, wheel to zoom
const pos = () => page.evaluate(() => { const p = window.preview.camera.position; return { x: p.x, d: p.length() }; });
await page.click('button[data-cam="cheo"]');
const before = await pos();
const bb = await page.locator('#v-main').boundingBox();
await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
await page.mouse.down();
await page.mouse.move(bb.x + bb.width / 2 + 140, bb.y + bb.height / 2 + 10, { steps: 6 });
await page.mouse.up();
const dragged = await pos();
await page.mouse.wheel(0, -400);
await sleep(300);
const zoomed = await pos();
console.log('orbit moved', Math.abs(dragged.x - before.x) > 0.05, '| zoom', before.d.toFixed(2), '->', zoomed.d.toFixed(2));
console.log('page height', await page.evaluate(() => document.documentElement.scrollHeight), 'viewport 1000');
console.log(logs.length ? logs.join('\n') : 'no console errors');
await context.close();
await browser.close();
