// Rewrites node positions in app/src/samples/*.json so no two nodes overlap at the current node size.
// Keeps the original layout: nodes are processed top to bottom and pushed down past anything they overlap.
// Usage: PORT=5180 SAMPLES_DIR=<abs path to app/src/samples> node relayout-samples.mjs [--write]
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { openBrowser, sleep } from './common.mjs';

const DIR = process.env.SAMPLES_DIR;
const write = process.argv.includes('--write');
const files = readdirSync(DIR).filter((f) => f.endsWith('.json'));
const jsons = new Map(files.map((f) => [f, readFileSync(`${DIR}/${f}`, 'utf8')]));
const byName = (label) => {
  for (const [f, text] of jsons) {
    const name = JSON.parse(text).name;
    if (label.startsWith(name)) return f;
  }
  return null;
};

const { browser, page } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
const labels = (await page.locator('.mb-item .mb-label').allInnerTexts()).filter((l) => /\(|Nhảy cóc|Mê cung/.test(l));
await page.keyboard.press('Escape');

const pending = [];
for (const label of labels) {
  const file = byName(label);
  if (!file) { console.log(`no file for ${label}`); continue; }
  await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await page.locator('.mb-item', { hasText: label }).first().click();
  await sleep(600);
  const sizes = await page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.wc-node')].map((n) => [n.getAttribute('data-id'), { w: n.offsetWidth, h: n.offsetHeight }])));
  const data = JSON.parse(jsons.get(file));
  const GAP = 28;
  const order = [...data.graph.nodes].sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);
  const placed = [];
  let moved = 0;
  for (const n of order) {
    const s = sizes[n.id] ?? { w: 170, h: 90 };
    let { x, y } = n.pos;
    for (let guard = 0; guard < 200; guard++) {
      const hit = placed.find((p) => x < p.x + p.w + 12 && x + s.w + 12 > p.x && y < p.y + p.h + GAP && y + s.h + GAP > p.y);
      if (!hit) break;
      y = hit.y + hit.h + GAP;
    }
    if (y !== n.pos.y) moved++;
    n.pos = { x, y };
    placed.push({ x, y, w: s.w, h: s.h });
  }
  console.log(`${file}: nodes=${order.length} moved=${moved}`);
  pending.push([file, data]);
}
await browser.close();
// Written after the browser closes: the dev server reloads the page when a sample file changes.
for (const [file, data] of pending) {
  if (!write) continue;
  const original = jsons.get(file);
  const text = JSON.stringify(data, null, 2) + (original.endsWith('\n') ? '\n' : '');
  writeFileSync(`${DIR}/${file}`, original.includes('\r\n') ? text.replace(/\n/g, '\r\n') : text); // keep the file's line endings
}
