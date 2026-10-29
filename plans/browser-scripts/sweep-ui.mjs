// UI sweep: for each viewport, load every bundled sample (Tệp menu), check layout, play ~3 s, collect console errors.
// Usage: PORT=5180 SCRATCH=<dir> node sweep-ui.mjs [widthxheight ...]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const PORT = process.env.PORT ?? '5180';
const OUT = `${process.env.SCRATCH}/sweep`;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sizes = (process.argv.slice(2).length ? process.argv.slice(2) : ['1440x900', '1280x720', '1024x700']).map((s) => s.split('x').map(Number));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});

const layoutProbe = () => {
  const issues = [];
  const de = document.documentElement;
  if (de.scrollWidth > de.clientWidth + 1) issues.push(`h-overflow doc ${de.scrollWidth}>${de.clientWidth}`);
  if (document.body.scrollWidth > document.body.clientWidth + 1) issues.push(`h-overflow body`);
  const tb = document.querySelector('.topbar');
  if (tb) {
    const kids = [...tb.children].filter((c) => c.getBoundingClientRect().height > 0 && getComputedStyle(c).position !== 'absolute');
    const tops = new Set();
    for (const k of kids) {
      const r = k.getBoundingClientRect();
      tops.add(Math.round((r.top + r.height / 2) / 24));
    }
    if (tb.getBoundingClientRect().height > 60) issues.push(`topbar tall ${Math.round(tb.getBoundingClientRect().height)}`);
    if (tb.scrollWidth > tb.clientWidth + 1) issues.push(`topbar scroll ${tb.scrollWidth}>${tb.clientWidth}`);
    if (tops.size > 1) issues.push(`topbar children on ${tops.size} rows`);
  }
  // clipped text: leaf-ish elements whose text is wider than the box and overflow is hidden/ellipsis
  const sel = '.topbar *, .dock *, .wc-node *, .tab *, [role=tab], .palette-item, .prop-row *, .ld *, .st-row *, .console *';
  const seen = new Set();
  for (const el of document.querySelectorAll(sel)) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.closest('.mb-menu')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (el.clientWidth === 0 || !el.textContent?.trim()) continue;
    if (el.scrollWidth > el.clientWidth + 1 && (cs.overflowX === 'hidden' || cs.textOverflow === 'ellipsis') && el.children.length < 3) {
      const key = `${el.className}|${el.textContent.trim().slice(0, 20)}`;
      if (!seen.has(key)) {
        seen.add(key);
        issues.push(`clipped <${el.tagName.toLowerCase()} .${String(el.className).split(' ')[0]}> "${el.textContent.trim().slice(0, 30)}" ${el.scrollWidth}>${el.clientWidth}`);
      }
    }
  }
  return issues;
};

const rows = [];
for (const [w, h] of sizes) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  let logs = [];
  page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('dialog', (d) => { logs.push(`[dialog] ${d.message()}`); d.dismiss(); });
  await page.goto(`http://localhost:${PORT}/`);
  await sleep(1500);
  await page.screenshot({ path: `${OUT}/${w}-empty.png` });
  const emptyIssues = await page.evaluate(layoutProbe);
  rows.push({ vp: `${w}x${h}`, sample: '(empty board)', mode: '-', issues: emptyIssues, logs: [...logs], played: '-' });
  logs.length = 0;

  await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  const labels = await page.locator('.mb-item .mb-label').allInnerTexts();
  await page.keyboard.press('Escape');
  const sampleLabels = labels.slice(3, labels.length).filter((l) => !/^(2D|3D)/.test(l));
  for (const label of sampleLabels) {
    logs = [];
    await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
    await page.locator('.mb-item', { hasText: label }).first().click();
    await sleep(900);
    const mode = await page.evaluate(() => document.querySelector('.game-box')?.getAttribute('data-mode') ?? document.querySelector('.app')?.getAttribute('data-mode') ?? '?');
    const issuesEdit = await page.evaluate(layoutProbe);
    const slug = label.replace(/[^a-z0-9]+/gi, '-').slice(0, 24);
    await page.screenshot({ path: `${OUT}/${w}-${slug}-edit.png` });
    await page.locator('#btn-play').click();
    await sleep(3000);
    const issuesPlay = await page.evaluate(layoutProbe);
    const canvasOk = await page.evaluate(() => {
      const c = document.querySelector('.game-box canvas');
      return !!c && c.clientWidth > 0 && c.clientHeight > 0;
    });
    await page.screenshot({ path: `${OUT}/${w}-${slug}-play.png` });
    await page.locator('.pbtn.stop').click();
    await sleep(300);
    rows.push({ vp: `${w}x${h}`, sample: label, mode, issues: [...new Set([...issuesEdit, ...issuesPlay])], logs: [...logs], played: canvasOk ? 'ok' : 'NO CANVAS' });
  }
  await ctx.close();
}
await browser.close();
for (const r of rows) {
  console.log(`${r.logs.length || r.issues.length || (r.played !== 'ok' && r.played !== '-') ? 'FAIL' : 'PASS'} | ${r.vp} | ${r.sample} | mode=${r.mode} | play=${r.played} | issues=${JSON.stringify(r.issues)} | logs=${JSON.stringify(r.logs)}`);
}
