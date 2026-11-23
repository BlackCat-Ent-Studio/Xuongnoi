// The showcase board opened in the REAL editor ("Mở file…"), played for a few seconds, in the light and the dark theme.
// usage: PW_ENTRY=<file URL of playwright-core index.mjs> node app-theme-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PW_ENTRY ?? 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..');
const BASE = process.env.BASE ?? 'http://localhost:5184';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

// the board file, from the harness page
const tmp = await browser.newPage();
await tmp.goto(`${BASE}/tests/showcase/scene-harness.html`);
await tmp.waitForFunction(() => !!window.__harness, null, { timeout: 120000 });
const json = await tmp.evaluate(() => window.__harness.showcaseJson({ tilt: 25, gripperClosed: false, gateLamp: '#45e07a' }));
const file = path.join(OUT, 'pixel-compare', 'factory-showcase-board.json');
fs.mkdirSync(path.dirname(file), { recursive: true });
fs.writeFileSync(file, json);
await tmp.close();

for (const theme of ['light', 'dark']) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: theme });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  await page.addInitScript((t) => {
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.clear();
      localStorage.setItem('xuong-noi:theme', t);
      sessionStorage.setItem('__seeded', '1');
    }
  }, theme);
  await page.goto(`${BASE}/`);
  await sleep(2500);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  await page.locator('[data-menu="file"]').click();
  await sleep(300);
  const chooser = page.waitForEvent('filechooser', { timeout: 15000 });
  await page.locator('.mb-item', { hasText: 'Mở file' }).first().click();
  await (await chooser).setFiles(file);
  await sleep(2500);
  await page.screenshot({ path: path.join(OUT, `app-${theme}-editing.png`) });
  await page.locator('[data-tut="play"]').click();
  await sleep(6000);
  await page.screenshot({ path: path.join(OUT, `app-${theme}-playing.png`) });
  console.log(theme, 'done', logs.length ? '\n' + [...new Set(logs)].join('\n') : '(no page errors)');
  await ctx.close();
}
await browser.close();
