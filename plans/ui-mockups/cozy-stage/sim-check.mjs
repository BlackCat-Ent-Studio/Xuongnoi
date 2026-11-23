// Sanity check: every scene loops for 60 s of sim time without errors; bridge fall path; UI toggles; copy JSON.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, permissions: ['clipboard-read', 'clipboard-write'] });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await page.goto(pathToFileURL(path.join(dir, 'index.html')).href);
await page.waitForSelector('body[data-ready="1"]', { timeout: 90000 });
const res = await page.evaluate(() => {
  const out = {}; const st = window.__stage;
  for (const id of ['l2', 'l3', 'l5', 'l6', 'l7']) {
    const rt = st.RT[id]; rt.reset(); let resets = 0, last = 1e9;
    for (let i = 0; i < 3600; i++) {
      rt.step(1 / 60); const a = rt.focus();
      if (a.x < last - 3) resets++; last = a.x;
      if (Number.isNaN(a.x) || Number.isNaN(a.y) || Number.isNaN(a.z)) return { err: id + ' NaN' };
    }
    out[id] = { resets, x: +rt.focus().x.toFixed(2) };
  }
  const r7 = st.RT.l7; r7.bridgeMode = 'show'; r7.reset(); for (let i = 0; i < 150; i++) r7.step(1 / 60);
  const onBridge = r7.focus().x; r7.bridgeMode = 'hide'; let fell = false;
  for (let i = 0; i < 120; i++) { r7.step(1 / 60); if (r7.focus().y < -0.3) fell = true; }
  out.bridge = { onBridge: +onBridge.toFixed(2), fell, afterX: +r7.focus().x.toFixed(2) };
  return out;
});
console.log(JSON.stringify(res));
await page.click('button[data-frame="phone"]'); await page.waitForTimeout(300);
console.log('phone stage px', await page.evaluate(() => { const r = document.getElementById('stage').getBoundingClientRect(); return [r.width, r.height]; }));
await page.click('button[data-scene="l7"]'); await page.click('button[data-bridge="hide"]');
await page.fill('#sScale', '2'); await page.dispatchEvent('#sScale', 'input'); await page.fill('#sZoom', '1.5'); await page.dispatchEvent('#sZoom', 'input');
await page.click('button[data-scene="kit"]'); await page.click('button[data-item="star"]'); await page.waitForTimeout(500);
await page.click('#bCopy'); await page.waitForTimeout(300);
console.log('copied', await page.evaluate(() => navigator.clipboard.readText()).catch((e) => 'ERR ' + e.message));
console.log(logs.join('\n') || 'no console errors');
await browser.close();
