// Debug: desktop level 3 wires report a self-wire. usage: node puzzle-layout-b-debug.mjs
import { launch, openPage, setSave, openLevel, levelData, solveBoard, VIEWPORTS } from './layout-b-lib.mjs';

const logs = [];
const browser = await launch();
const page = await openPage(browser, VIEWPORTS.desk, logs, 'desk');
await setSave(page, { seen: true });
await openLevel(page, 3);
await page.locator('.pz-hint-btn').click(); await page.waitForTimeout(900);
const data = await levelData(page, 3);
const placed = await solveBoard(page, data, { piecesOnly: true });
await solveBoard(page, data, { placedIds: placed, paramsOnly: true });
const resolve = (id) => placed.get(id) ?? id;
const pickedNow = () => page.evaluate(() => [...document.querySelectorAll('.wc-port.pick')].map((r) => r.closest('.wc-node').dataset.id + ':' + r.dataset.dir + ':' + r.dataset.port));
for (const w of data.solution.wires) {
  const f = `.wc-node[data-id="${resolve(w.from.node)}"] .wc-port[data-dir="out"][data-port="${w.from.port}"] .wc-dot`;
  const t = `.wc-node[data-id="${resolve(w.to.node)}"] .wc-port[data-dir="in"][data-port="${w.to.port}"] .wc-dot`;
  const fb = await page.locator(f).boundingBox();
  const under = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e ? e.className + '|' + (e.closest('.wc-node')?.dataset.id ?? '-') : 'none'; }, { x: fb.x + fb.width / 2, y: fb.y + fb.height / 2 });
  await page.mouse.click(fb.x + fb.width / 2, fb.y + fb.height / 2);
  await page.waitForTimeout(100);
  const p1 = await pickedNow();
  const tb = await page.locator(t).boundingBox();
  const under2 = await page.evaluate(({ x, y }) => { const e = document.elementFromPoint(x, y); return e ? e.className + '|' + (e.closest('.wc-node')?.dataset.id ?? '-') : 'none'; }, { x: tb.x + tb.width / 2, y: tb.y + tb.height / 2 });
  await page.mouse.click(tb.x + tb.width / 2, tb.y + tb.height / 2);
  await page.waitForTimeout(150);
  console.log(w.id, JSON.stringify({ fromUnder: under, picked: p1, toUnder: under2, toast: await page.locator('.pz-toast:not([hidden])').textContent().catch(() => '') }));
}
console.log(logs.join('\n'));
await browser.close();
