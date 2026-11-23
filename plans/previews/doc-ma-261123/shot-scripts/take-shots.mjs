// Screenshots of the "Đọc mã" chooser (served by `python -m http.server 5391` in the preview folder).
// usage: node take-shots.mjs            (PW_ENTRY = file URL of a module exporting chromium, PAGE_URL, ONLY=part1|part2|part3)
// output: plans/reports/shots-code-reader-preview/*.png
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const PW_DEFAULT = pathToFileURL('C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/75fb5f30-1223-44d1-ba33-7a3950788f98/scratchpad/pw/node_modules/playwright-core/index.mjs').href;
const { chromium } = await import(process.env.PW_ENTRY ?? PW_DEFAULT);
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '..', '..', '..', 'reports', 'shots-code-reader-preview');
const URL_ = process.env.PAGE_URL ?? 'http://localhost:5391/index.html';
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

await page.goto(URL_);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

/** Element shot; the 3D canvas is a fixed layer over the page, so the element is first scrolled into the viewport. */
async function shot(sel, name) {
  const el = page.locator(sel);
  await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await sleep(700);
  await el.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot', name);
}
const want = (part) => !ONLY || ONLY === part;

for (const bg of ['light', 'dark']) {
  await page.evaluate((v) => window.preview.set({ bg: v, spin: 'off', far: 'vua', ...window.preview.poses.cheo }), bg);
  if (!ONLY) {
    await page.evaluate(() => window.scrollTo(0, 0));
    await sleep(700);
    await page.screenshot({ path: path.join(OUT, `page-top-${bg}.png`) });
  }
  if (want('part1')) {
    for (const id of ['A', 'B', 'C', 'D']) await shot(`#N-${id}`, `nhan-N-${id}-${bg}`);
    for (const far of ['gan', 'xa']) {
      await page.evaluate((v) => window.preview.set({ far: v }), far);
      for (const id of ['A', 'B', 'C', 'D']) await shot(`#v-far-${id}`, `nhan-xa-${far}-N-${id}-${bg}`);
    }
    for (const pose of ['tren', 'ngang']) {
      await page.evaluate((v) => window.preview.set({ far: 'vua', ...window.preview.poses[v] }), pose);
      for (const id of ['A', 'B', 'C', 'D']) await shot(`#v-near-${id}`, `nhan-${pose}-N-${id}-${bg}`);
    }
    await page.evaluate(() => window.preview.set({ ...window.preview.poses.cheo }));
  }
  if (want('part2')) for (const id of ['A', 'B', 'C']) await shot(`#T-${id}`, `the-T-${id}-${bg}`);
  if (want('part3')) {
    // a carton reaches the gate at 3.114 s: the flash, the number shown, and well after
    for (const [t, label] of [[3.19, 'loe-sang'], [3.9, 'hien-so'], [4.95, 'sau-do']]) {
      await page.evaluate((v) => window.preview.freeze(v), t);
      await shot('#p3', `cong-${label}-${bg}`);
    }
    await page.evaluate(() => window.preview.freeze(undefined));
  }
}

if (!ONLY) {
  // the real controls: drag turns the cartons, the pose buttons work, the page does not scroll sideways
  await page.evaluate(() => window.preview.set({ bg: 'light' }));
  const el = page.locator('#v-near-A');
  await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await sleep(300);
  const before = await page.evaluate(() => ({ ...window.preview.state }));
  const bb = await el.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 + 120, bb.y + bb.height / 2 + 40, { steps: 6 });
  await page.mouse.up();
  const after = await page.evaluate(() => ({ ...window.preview.state }));
  console.log('drag turned', (after.yaw - before.yaw).toFixed(2), 'rad, tilt', before.elev, '->', after.elev.toFixed(1));
  await page.click('button[data-pose="tren"]');
  console.log('pose button elev', await page.evaluate(() => window.preview.state.elev));
  await page.click('button[data-key="bg"][data-val="dark"]');
  console.log('dark class', await page.evaluate(() => document.documentElement.classList.contains('dark')));
  const g = page.locator('#v-QA');
  await g.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await sleep(300);
  const gb = await g.boundingBox();
  const cam = () => page.evaluate(() => { const p = window.preview.gateCamera.position; return { x: p.x, d: p.length() }; });
  const c0 = await cam();
  await page.mouse.move(gb.x + gb.width / 2, gb.y + gb.height / 2);
  await page.mouse.down();
  await page.mouse.move(gb.x + gb.width / 2 + 140, gb.y + gb.height / 2 + 10, { steps: 6 });
  await page.mouse.up();
  const c1 = await cam();
  console.log('gate orbit moved', Math.abs(c1.x - c0.x) > 0.05);
  console.log('sideways scroll', await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth));
}
console.log(logs.length ? logs.join('\n') : 'no console errors');
await context.close();
await browser.close();
