// Screenshots of the guard-vision preview v2. Stage-only (1000x562) for each state + one full-page desktop view.
// States are reached with the same headless sim the page uses (deterministic), then frozen and drawn.
// Usage: node shot-guard-vision.mjs
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const base = pathToFileURL(path.join(dir, 'index.html')).href;
const out = path.join(dir, 'shots');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];

async function open(w, h, query) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  page.on('requestfailed', (r) => { if (!/fonts\.g/.test(r.url())) logs.push('requestfailed: ' + r.url()); });
  await page.goto(base + query);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 90000 });
  return page;
}
async function snap(page, name, full) { await page.waitForTimeout(250); await page.screenshot({ path: path.join(out, name + '.png'), fullPage: !!full }); }

// each shot: query + a function body (string) run in the page that returns the frozen sim time
const shots = [
  { name: 'gv2-1-start', q: '?bare=1&t=0.2' },
  // waiting at the 2nd cover, verdict "TRON" (second wait of the default run)
  { name: 'gv2-2-waiting-tron', run: `let w = 0, was = false; return __gv.seekUntil('correct', (s) => { const waiting = s.h.v < 0.05 && s.info && !s.info.go && s.idx >= 2 && s.t > 1; if (waiting && !was) w++; was = waiting; return waiting && s.info.W < 1.2; })` },
  // chaining: right after the cat passes a cover without stopping
  { name: 'gv2-3-chaining', run: `let at = null; return __gv.seekUntil('correct', (s) => { if (s.chains >= 1 && at === null) at = s.t; return at !== null && s.t > at + 0.35; })` },
  { name: 'gv2-4a-lose-old-distance', q: '?bare=1&mode=distance&t=30' },
  { name: 'gv2-4b-lose-rash', q: '?bare=1&mode=rash&t=30' },
  { name: 'gv2-4c-lose-nowire-timeout', q: '?bare=1&mode=none&t=65' },
  { name: 'gv2-5-win', q: '?bare=1&mode=correct&t=30' },
  { name: 'gv2-6-preset-C-waiting', q: '?bare=1&preset=C', run: `return __gv.seekUntil('correct', (s) => s.h.v < 0.05 && s.info && !s.info.go && s.idx >= 2 && s.t > 1)` },
];
for (const s of shots) {
  const page = await open(1000, 562, s.q || '?bare=1');
  let t;
  if (s.run) t = await page.evaluate(`(() => { ${s.run} })()`);
  await snap(page, s.name);
  console.log(s.name, JSON.stringify(await page.evaluate(() => ({ seen: window.__gv.sim.seen, over: window.__gv.sim.over && window.__gv.sim.over.reason, t: +window.__gv.sim.t.toFixed(2), idx: window.__gv.sim.idx, think: document.getElementById('think').textContent, chip: document.getElementById('chip').textContent }))));
  await page.close();
}
{
  const page = await open(1280, 900, '?t=5&mode=correct');
  await page.click('#bCheck'); await page.waitForTimeout(3500);
  await snap(page, 'gv2-0-full-page', true);
  await page.close();
}
console.log(logs.join('\n') || 'no console errors');
await browser.close();
