// Screenshots of the lower-level looks chooser.
// Serve the REPO ROOT (so the page finds the installed three.js): python -m http.server 5371
// usage: PW_ENTRY=<file URL of a module exporting chromium> node take-shots.mjs
// output: plans/reports/shots-lower-level-looks/*.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PW_ENTRY);
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '..', '..', 'reports', 'shots-lower-level-looks');
const URL_ = process.env.PAGE_URL ?? 'http://localhost:5371/plans/ui-mockups/lower-level-looks/index.html';
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'];
let browser;
for (const opt of [{}, { channel: 'chrome' }, { channel: 'msedge' }]) {
  try { browser = await chromium.launch({ headless: true, args, ...opt }); console.log('browser', opt.channel ?? 'bundled chromium'); break; } catch (e) { console.log('launch failed', opt.channel ?? 'bundled', String(e.message).split('\n')[0]); }
}
if (!browser) { console.log('NO BROWSER'); process.exit(2); }
const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('requestfailed', (r) => logs.push(`[requestfailed] ${r.url()}`));
const outside = new Set();
page.on('request', (r) => { const u = new URL(r.url()); if (u.hostname !== 'localhost' && u.hostname !== '127.0.0.1') outside.add(u.hostname); });

await page.goto(URL_);
try { await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }); } catch (e) { console.log('NOT READY', logs.join('\n')); await browser.close(); process.exit(3); }
console.log('three from:', await page.evaluate(() => window.preview.source), '| outside hosts:', [...outside].join(',') || 'none');
console.log('scenery cost', JSON.stringify(await page.evaluate(() => window.preview.cost)));

/** Element shot; the 3D canvas is a fixed layer over the page, so the element is first scrolled into the viewport. */
async function shot(sel, name) {
  const el = page.locator(sel);
  await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await sleep(900);
  await el.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot', name);
}
const want = (part) => !ONLY || ONLY.split(',').includes(part);

await page.evaluate(() => window.preview.freeze(0.9));
if (!ONLY) { await page.evaluate(() => window.scrollTo(0, 0)); await sleep(800); await page.screenshot({ path: path.join(OUT, 'page-top.png') }); }
if (want('p1')) for (const id of ['X-a', 'X-b', 'X-c']) await shot(`#${id}`, `1-xe-keo-${id}`);
if (want('p2')) for (const id of ['T-a', 'T-b', 'T-c']) await shot(`#${id}`, `2-xe-tai-${id}`);
if (want('p3')) for (const id of ['C-a', 'C-b']) await shot(`#${id}`, `3-cua-ben-${id}`);
if (want('p4')) for (const id of ['S-a', 'S-b']) await shot(`#${id}`, `4-tam-sang-${id}`);
if (want('p5')) {
  for (const id of ['K-a', 'K-b', 'K-c']) await shot(`#${id}`, `5-canh-${id}`);
  await page.evaluate(() => window.preview.set({ deck: 'dac' }));
  for (const id of ['K-a', 'K-b', 'K-c']) await shot(`#v-${id}-0`, `5-canh-${id}-san-dac`);
  await page.evaluate(() => { window.preview.set({ deck: 'trong' }); window.preview.setCam('low'); });
  for (const id of ['K-b', 'K-c']) await shot(`#v-${id}-0`, `5-canh-${id}-nhin-thap`);
  await page.evaluate(() => window.preview.setCam('game'));
}
if (want('extra')) {
  // dark page, a real drag, and no sideways scroll
  await page.evaluate(() => window.preview.set({ bg: 'dark' }));
  await shot('#X-c', 'extra-nen-toi-X-c');
  await page.evaluate(() => window.preview.set({ bg: 'light' }));
  const el = page.locator('#v-T-b-1');
  await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await sleep(300);
  const bb = await el.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 + 170, bb.y + bb.height / 2 - 30, { steps: 6 });
  await page.mouse.up();
  await shot('#T-b', 'extra-keo-xoay-T-b-nhin-tu-sau');
  console.log('sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
  await page.setViewportSize({ width: 400, height: 800 });
  await sleep(500);
  await shot('#X-b', 'extra-dien-thoai-X-b');
  console.log('sideways scroll (phone)', await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
}
console.log(logs.length ? logs.join('\n') : 'no console errors');
await context.close();
await browser.close();
