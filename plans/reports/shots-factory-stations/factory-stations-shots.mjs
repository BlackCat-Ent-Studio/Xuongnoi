// Shots of the sample "Xưởng phân loại kiện hàng (đang dựng: phần trạm)" in the real editor.
// usage: start `npx vite --port 5186 --strictPort` in the worktree's app folder, then `node factory-stations-shots.mjs`
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const PW_ROOT = process.env.PW_DIR ?? path.join(os.homedir(), 'AppData', 'Local', 'Temp', 'claude', 'a12094c0c35d488c', '75fb5f30-1223-44d1-ba33-7a3950788f98', 'scratchpad', 'pw');
const { chromium } = await import(pathToFileURL(path.join(PW_ROOT, 'node_modules', 'playwright-core', 'index.mjs')).href);
const BASE = process.env.BASE ?? 'http://localhost:5186';
const CHROME = process.env.CHROME ?? path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1248', 'chrome-win64', 'chrome.exe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const problems = [];
const notes = [];

const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });

async function open(theme) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, colorScheme: theme });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[console ${theme}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[pageerror ${theme}] ${e.message}`));
  page.on('dialog', (d) => { notes.push(`[dialog ${theme}] ${d.message()}`); void d.accept(); });
  await page.goto(BASE);
  await page.evaluate(([t]) => { localStorage.clear(); localStorage.setItem('xuong-noi:tutorial-seen', '1'); localStorage.setItem('xuong-noi:theme', t); localStorage.setItem('xuong-noi:ui-mode', 'teacher'); }, [theme]);
  await page.goto(BASE);
  await page.waitForSelector('.wc');
  await sleep(1200);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  return { context, page };
}

const shot = async (page, name) => { await sleep(400); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('shot', name); };
const fit = async (page) => { await page.locator('.wc[tabindex]').focus(); await page.locator('.wc-rail button[title="Vừa màn hình"]').click(); await sleep(500); };
const playKey = async (page) => { await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))); await sleep(400); };
const isPlaying = (page) => page.evaluate(() => document.querySelector('.app').classList.contains('playing'));

/** Cards (or stacked blocks) on the canvas whose boxes overlap, by their on-screen rectangles. */
const overlaps = (page) => page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.wc-node')].map((el) => ({ id: el.getAttribute('data-id') ?? el.className, r: el.getBoundingClientRect() })).filter((b) => b.r.width > 0);
  const hit = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i].r; const b = boxes[j].r;
    if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) hit.push(`${boxes[i].id} / ${boxes[j].id}`);
  }
  return { cards: boxes.length, hit };
});

for (const theme of ['light', 'dark']) {
  const { context, page } = await open(theme);
  // The menu path the user takes: Tệp > Bài mẫu > Xưởng phân loại kiện hàng (đang dựng: phần trạm)
  await page.locator('[data-menu="file"]').click(); await sleep(250);
  await page.locator('.mb-item', { hasText: 'Bài mẫu' }).first().hover(); await sleep(350);
  await shot(page, `0-menu-${theme}`);
  const entry = page.locator('.mb-menu .mb-item', { hasText: 'Xưởng phân loại kiện hàng' }).first();
  notes.push(`[${theme}] menu entry: ${await entry.textContent()}`);
  await entry.click(); await sleep(1800);
  await fit(page);
  notes.push(`[${theme}] factory level: ${JSON.stringify(await overlaps(page))}`);
  await shot(page, `1-factory-level-${theme}`);

  // Inside each circuit: first what the default layout shows, then the whole circuit zoomed out on the wide-board layout
  const wide = async (on) => { await page.locator('select.tb-layout').selectOption({ label: on ? 'Bố cục: Rộng bảng' : 'Bố cục: Mặc định' }); await sleep(500); };
  const zoomOut = async (times) => { for (let n = 0; n < times; n++) { await page.locator('.wc-rail button[title="Thu nhỏ"]').click(); await sleep(120); } await sleep(300); };
  const inside = async (name, enter, times) => {
    await enter(); await sleep(600);
    await fit(page);
    notes.push(`[${theme}] inside ${name}: ${JSON.stringify(await overlaps(page))}`);
    await shot(page, `${name}-${theme}`);
    await wide(true);
    await fit(page);
    await zoomOut(times);
    notes.push(`[${theme}] inside ${name}, zoom ${await page.locator('.wc-rail .wc-pct').textContent()}`);
    await shot(page, `${name}-whole-${theme}`);
    await wide(false);
    await page.keyboard.press('Escape'); await sleep(500);
  };
  await inside('2-inside-tram-nap', () => page.locator('.wc-node[data-id="tram-nap"] .wc-inst-open').click(), 8);
  await inside('3-inside-cua-tha', async () => { const tool = page.locator('.ck-pal-item[data-circuit="cua-tha"] .ck-pal-tool[title="Mở ra sửa"]'); await tool.scrollIntoViewIfNeeded().catch(() => {}); await tool.click(); }, 3);
  if (theme === 'light') {
    await inside('5-inside-luat-chia-cua', () => page.locator('.wc-node[data-id="luat"] .wc-inst-open').click(), 0);
    await inside('6-inside-chuyen-tam', () => page.locator('.wc-node[data-id="chuyen-tam"] .wc-inst-open').click(), 3);
  }
  await fit(page);

  // Run the whole board: the board with live values first, then the 3D view on its own tab
  await playKey(page);
  const t0 = Date.now();
  notes.push(`[${theme}] playing: ${await isPlaying(page)}`);
  const at = async (s) => { await sleep(Math.max(0, s * 1000 - (Date.now() - t0))); };
  await at(8);
  await shot(page, `4-running-board-08s-${theme}`);
  await page.locator('button.tab', { hasText: 'Mô phỏng' }).click(); await sleep(600);
  for (const s of theme === 'light' ? [11, 13, 15, 17, 19, 22, 30, 45, 60, 90] : [13, 17, 30]) {
    await at(s);
    await shot(page, `4-running-3d-${String(s).padStart(2, '0')}s-${theme}`);
  }
  await playKey(page);
  await context.close();
}

await browser.close();
console.log(notes.join('\n'));
console.log(problems.length ? `PROBLEMS:\n${problems.join('\n')}` : 'no page errors');
