// Mechanics check on :5254: scale try-board playing, properties panel material params, damaged (squashed) crates, handbook topic.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-mechanics/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5254';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
const watch = (p) => {
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
};

// ---- damaged crates (dev-only page) ----
if (process.env.ONLY !== 'editor') {
  const p = await b.newPage({ viewport: { width: 900, height: 520 } });
  watch(p);
  await p.goto(`${BASE}/tmp-damaged.html`);
  await p.waitForFunction(() => window.ready === true, null, { timeout: 30000 });
  await sleep(700);
  await p.screenshot({ path: OUT + '10-crates-before-squeeze.png' });
  await sleep(2200);
  await p.screenshot({ path: OUT + '11-crates-after-squeeze.png' });
  await p.close();
}

// ---- editor ----
if (process.env.ONLY !== 'damaged') {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  watch(p);
  await p.goto(`${BASE}/`);
  await sleep(1500);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await sleep(1500);
  if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  // handbook: force-sensor page, then the try board
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('handbook:open', { detail: 'force-sensor' })));
  await p.waitForSelector('.hb-modal', { state: 'visible' });
  await sleep(500);
  await p.screenshot({ path: OUT + '01-handbook-force-sensor.png' });
  await p.locator('[data-hb-action="try"]').click();
  await sleep(1200);
  await p.screenshot({ path: OUT + '02-scale-board-editor.png' });
  // properties of the scale block + a crate (material params under Nâng cao)
  const nodes = p.locator('.wc-node');
  const n = await nodes.count();
  console.log('NODES', n);
  // play
  await p.locator('.play .pbtn.primary').click();
  await sleep(3500);
  await p.screenshot({ path: OUT + '03-scale-board-playing.png' });
  await p.keyboard.press('Space');
  await sleep(1200);
  await p.screenshot({ path: OUT + '04-scale-board-after-space.png' });
  await p.locator('.play .pbtn.stop').click();
  await sleep(500);
  // select the heavy crate card and open Nâng cao
  const crates = p.locator('.wc-node', { hasText: 'Đồ vật' });
  console.log('CRATE CARDS', await crates.count());
  await crates.nth(2).click({ position: { x: 20, y: 12 } });
  await sleep(500);
  const adv = p.locator('.pn-adv-h').first();
  if (await adv.count()) await adv.click();
  await sleep(400);
  await p.screenshot({ path: OUT + '05-properties-crate-material.png' });
  const rows = await p.locator('.prop-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-param')));
  console.log('PROP ROWS', JSON.stringify(rows));
  // handbook topic
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('handbook:open', { detail: 'topic:engineering-physics' })));
  await p.waitForSelector('.hb-modal', { state: 'visible' });
  await sleep(500);
  await p.screenshot({ path: OUT + '06-handbook-topic-physics.png' });
  await p.close();
}
console.log('LOGS', JSON.stringify(logs));
await b.close();
