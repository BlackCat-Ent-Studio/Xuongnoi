// Two-way highlight in the editor "Xưởng Nối" (dev server :5216). usage: node obj-cards-editor.mjs [sampleId]
import { launch, OUT, VIEWPORTS } from './outline-icons-lib.mjs';
const SAMPLE = process.argv[2] ?? 'platform-bot';
const BASE = 'http://localhost:5216/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const rec = (name, ok, detail = '') => { results.push(ok); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); };
const logs = [];
const browser = await launch();

for (const vp of ['phone', 'desk']) {
  const page = await browser.newPage({ viewport: VIEWPORTS[vp] });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${vp}: ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`${vp}: pageerror ${e.message}`));
  await page.goto(BASE);
  const ok = await page.evaluate(async (id) => {
    const io = await import('/src/io/index.ts');
    const s = io.listSamples().find((x) => x.id === id);
    if (!s) return io.listSamples().map((x) => x.id).join(',');
    localStorage.clear();
    localStorage.setItem('xuong-noi:autosave', io.serializeBoard(s.board));
    return 'ok';
  }, SAMPLE);
  if (ok !== 'ok') { console.log('sample ids:', ok); process.exit(2); }
  await page.reload();
  await sleep(2500);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  await page.screenshot({ path: `${OUT}${vp}-editor-0-start.png`, timeout: 120000 });

  const nodes = await page.$$eval('.wc-node', (els) => els.map((e) => ({ id: e.dataset.id, kind: e.dataset.kind })));
  console.log(vp, 'cards', JSON.stringify(nodes));
  const objects = nodes.filter((n) => ['character', 'block', 'item', 'vehicle'].includes(n.kind));
  const hero = objects.find((n) => n.kind === 'character') ?? objects[0];
  rec(`${vp} sample has object cards`, !!hero, SAMPLE);

  // card -> object: tap the card header
  const head = page.locator(`.wc-node[data-id="${hero.id}"] .wc-node-head`);
  await head.scrollIntoViewIfNeeded().catch(() => {});
  const hb = await head.boundingBox();
  await page.mouse.click(hb.x + hb.width * 0.4, hb.y + hb.height / 2);
  await sleep(900);
  rec(`${vp} card selected`, (await page.locator(`.wc-node.selected[data-id="${hero.id}"]`).count()) === 1);
  await page.screenshot({ path: `${OUT}${vp}-editor-1-card-selected-glow.png`, timeout: 120000 });

  // object -> card: tap another object on the stage
  const other = objects.find((n) => n.id !== hero.id && n.kind === 'block') ?? objects.find((n) => n.id !== hero.id);
  const pt = await page.evaluate((i) => window.__pzScreenOf?.(i) ?? null, other.id);
  console.log(vp, 'tap target', other.id, JSON.stringify(pt));
  rec(`${vp} object has a screen point`, !!pt && pt.x > 0 && pt.y > 0);
  if (pt) {
    await page.mouse.click(pt.x, pt.y);
    await sleep(900);
    const sel = await page.locator('.wc-node.selected').evaluateAll((els) => els.map((e) => e.dataset.id));
    console.log(vp, 'selected after stage tap', JSON.stringify(sel));
    rec(`${vp} stage tap selects its card`, sel.length === 1 && sel[0] === other.id);
    rec(`${vp} card flashes`, (await page.locator(`.wc-node.wc-flash[data-id="${other.id}"]`).count()) === 1);
    await page.screenshot({ path: `${OUT}${vp}-editor-2-object-tapped-card-flash.png`, timeout: 120000 });
    // second tap lets go
    await page.mouse.click(pt.x, pt.y);
    await sleep(500);
    rec(`${vp} second tap clears selection`, (await page.locator('.wc-node.selected').count()) === 0);
    // select again, then tap empty stage space
    await page.mouse.click(pt.x, pt.y);
    await sleep(400);
    const r = await page.evaluate(() => { const c = document.querySelector('.cam-reset').parentElement.querySelector('canvas'); const b = c.getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
    await page.mouse.click(r.x + r.w * 0.5, Math.max(r.y + r.h * 0.12, 70));
    await sleep(500);
    rec(`${vp} tap on empty space clears`, (await page.locator('.wc-node.selected').count()) === 0);
    // drag still moves camera without selecting: drag empty space
    await page.mouse.move(r.x + r.w * 0.5, Math.max(r.y + r.h * 0.12, 70));
    await page.mouse.down();
    await page.mouse.move(r.x + r.w * 0.55, r.y + r.h * 0.2, { steps: 4 });
    await page.mouse.up();
    await sleep(300);
    rec(`${vp} drag on empty space selects nothing`, (await page.locator('.wc-node.selected').count()) === 0);
  }
  await page.close();
}
await browser.close();
console.log(logs.length ? 'LOGS\n' + logs.join('\n') : 'no console errors/warnings');
console.log(`${results.filter(Boolean).length}/${results.length} passed`);
process.exit(results.every(Boolean) ? 0 : 1);
