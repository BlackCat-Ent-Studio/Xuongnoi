// Shots of the new cards on the real editor (Học sinh mode, light theme).
// Needs the dev server of the pieces worktree: `npm run dev -- --port 5312 --strictPort` in app/.
// usage: BASE=http://localhost:5312 node take-shots.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.BASE ??= 'http://localhost:5312';
const { launch, openEditor, sleep } = await import('../../browser-scripts/ui-c-lib.mjs');
const OUT = path.dirname(fileURLToPath(import.meta.url));
const browser = await launch();
const allLogs = [];
const facts = {};

/** Builds a board inside the page from the app's own modules, stores it as the autosave and reloads the editor on it. */
async function openBoard(page, recipe) {
  await page.evaluate(async (r) => {
    const io = await import('/src/io/index.ts');
    const boards = await import('/src/handbook/boards-memory-dispatch.ts');
    const arm = await import('/src/handbook/boards-robot-arm.ts');
    const board = r.named ? boards[r.named]() : arm.build(r.label, r.note, r.nodes, r.wires ?? [], '3d');
    localStorage.setItem('xuong-noi:autosave', io.serializeBoard(board));
  }, recipe);
  await page.reload();
  await sleep(2500);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
}

const card = (page, kind) => page.locator(`.wc-node[data-kind="${kind}"]`).first();
const box = async (page, kind) => (await card(page, kind).boundingBox());

/** Labels of a card whose text is cut off (scroll size larger than the box) or that stick out of the card. */
async function clipped(page, kind) {
  return card(page, kind).evaluate((el) => {
    const out = [];
    const cb = el.getBoundingClientRect();
    for (const e of el.querySelectorAll('*')) {
      if (e.children.length > 0 || !e.textContent.trim() || e.textContent.trim() === '?') continue;
      const b = e.getBoundingClientRect();
      if (e.scrollWidth > e.clientWidth + 1 || b.right > cb.right + 1 || b.left < cb.left - 1) out.push(e.textContent.trim());
    }
    return out;
  });
}

async function shotCard(page, kind, name) {
  await card(page, kind).scrollIntoViewIfNeeded().catch(() => {});
  await sleep(300);
  await card(page, kind).screenshot({ path: path.join(OUT, `${name}.png`) });
  facts[name] = { box: await box(page, kind), clipped: await clipped(page, kind), zoom: await page.evaluate(() => document.querySelector('.wc-world, .wc-content, .wc-stage')?.style.transform ?? '') };
  console.log('shot', name, JSON.stringify(facts[name]));
}

const { page, logs } = await openEditor(browser, { theme: 'light', mode: 'student', width: 1600, height: 1000 });

// 1. Nhớ số on its try board.
await openBoard(page, { named: 'trySampleHold' });
await page.screenshot({ path: path.join(OUT, '1-sample-hold-board.png') });
await shotCard(page, 'sample-hold', '1-sample-hold-card');

// 2. Bộ điều phối (2 machines) on its try board, selected so the panel shows its settings.
await openBoard(page, { named: 'tryDispatcher' });
await card(page, 'dispatcher').locator('.wc-node-head').click();
await sleep(500);
await page.screenshot({ path: path.join(OUT, '2-dispatcher-board.png') });
await shotCard(page, 'dispatcher', '2-dispatcher-card');

await page.setViewportSize({ width: 2400, height: 1500 });
// 3. Bộ điều phối at 8 and 12 machines next to a 12-step Chuỗi bước with its done ports.
await openBoard(page, {
  label: 'so chiều cao',
  note: 'Bộ điều phối 8 máy, 12 máy và Chuỗi bước 12 bước.',
  nodes: [
    { alias: 'd8', kind: 'dispatcher', x: 20, y: 20, params: { machines: 8 } },
    { alias: 'd12', kind: 'dispatcher', x: 440, y: 20, params: { machines: 12 } },
    { alias: 'seq', kind: 'sequence', x: 860, y: 20, params: { stepCount: 12, showDone: 'yes' } },
    { alias: 'd8code', kind: 'dispatcher', x: 1200, y: 20, params: { machines: 8, showCode: 'yes' } },
  ],
});
await page.evaluate(() => { for (const e of document.querySelectorAll('.game-pip, [class*="pip"]')) e.style.display = 'none'; });
const cards = page.locator('.wc-node');
const heights = await cards.evaluateAll((els) => els.map((e) => ({ kind: e.dataset.kind, rows: e.querySelectorAll('.wc-port').length, h: Math.round(e.getBoundingClientRect().height), w: Math.round(e.getBoundingClientRect().width) })));
facts.heights = heights;
console.log('heights', JSON.stringify(heights));
await page.screenshot({ path: path.join(OUT, '3-dispatcher-8-12-vs-sequence-12.png'), fullPage: false });
const names = ['3-dispatcher-8-machines-card', '3-dispatcher-12-machines-card', '3-sequence-12-steps-card', '3-dispatcher-8-machines-with-codes-card'];
for (let n = 0; n < names.length; n++) {
  await cards.nth(n).screenshot({ path: path.join(OUT, `${names[n]}.png`) });
  const cut = await cards.nth(n).evaluate((el) => [...el.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() && e.textContent.trim() !== '?' && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim()));
  facts[names[n]] = { clipped: cut };
  console.log('shot', names[n], JSON.stringify(cut));
}

await page.setViewportSize({ width: 1600, height: 1000 });
// 4. Tạo đối tượng with three random classes: the card and its settings panel with Nâng cao open.
await openBoard(page, { named: 'spawnerClassBoard' });
await card(page, 'spawner').locator('.wc-node-head').click();
await sleep(500);
await shotCard(page, 'spawner', '4-spawner-classes-card');
const adv = page.locator('.pn-adv');
if (!(await adv.evaluate((d) => d.open))) await adv.locator('summary').click();
await sleep(400);
const shownRows = await page.$$eval('.pn-adv .prop-row', (rows) => rows.filter((r) => !r.hidden).map((r) => r.querySelector('.prop-label')?.textContent ?? ''));
facts.spawnerAdvancedRows = shownRows;
console.log('advanced rows', JSON.stringify(shownRows));
await page.screenshot({ path: path.join(OUT, '4-spawner-classes-page.png') });
const panel = page.locator('.pn-props').first();
// The panel scrolls: grow it for the picture so every row is on it.
await panel.evaluate((el) => { el.style.maxHeight = 'none'; el.style.height = 'auto'; el.style.overflow = 'visible'; let p = el.parentElement; while (p && p !== document.body) { p.style.maxHeight = 'none'; p.style.height = 'auto'; p.style.overflow = 'visible'; p = p.parentElement; } });
await page.setViewportSize({ width: 1600, height: 2600 });
await sleep(500);
await page.locator('.pn-adv').screenshot({ path: path.join(OUT, '4-spawner-classes-panel-advanced.png') });
facts.panelClipped = await panel.evaluate((el) => [...el.querySelectorAll('.prop-label')].filter((e) => !e.closest('[hidden]') && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent));
console.log('panel clipped labels', JSON.stringify(facts.panelClipped));

// 5. The same panel with the toggle off: no class row is listed.
await page.setViewportSize({ width: 1600, height: 1000 });
await page.reload();
await sleep(2500);
await card(page, 'spawner').locator('.wc-node-head').click();
await sleep(400);
const adv2 = page.locator('.pn-adv');
if (!(await adv2.evaluate((d) => d.open))) await adv2.locator('summary').click();
const row = page.locator('.prop-row[data-param="randomClass"]');
if (await row.locator('select').count()) await row.locator('select').selectOption('no'); else await row.locator('.pn-switch').click();
await sleep(500);
facts.spawnerAdvancedRowsOff = await page.$$eval('.pn-adv .prop-row', (rows) => rows.filter((r) => !r.hidden).map((r) => r.querySelector('.prop-label')?.textContent ?? ''));
facts.spawnerPortsOff = await card(page, 'spawner').evaluate((el) => el.querySelectorAll('.wc-port').length);
console.log('advanced rows with the toggle off', JSON.stringify(facts.spawnerAdvancedRowsOff), 'ports', facts.spawnerPortsOff);
await page.screenshot({ path: path.join(OUT, '5-spawner-classes-off-page.png') });

// 6. Palette search finds the two new cards.
await openBoard(page, { named: 'trySampleHold' });
for (const [q, name] of [['Nhớ số', '6-palette-nho-so'], ['điều phối', '6-palette-dieu-phoi']]) {
  const input = page.locator('.pn-head input').first();
  await input.fill(q);
  await sleep(400);
  facts[name] = await page.$$eval('.palette-item[data-kind]', (els) => els.map((e) => e.dataset.kind));
  console.log(name, JSON.stringify(facts[name]));
  await page.locator('.palette, .pn-palette, .palette-list').first().screenshot({ path: path.join(OUT, `${name}.png`) }).catch(() => {});
}

allLogs.push(...logs);
console.log(allLogs.length ? 'PAGE LOGS\n' + allLogs.join('\n') : 'no console errors');
await browser.close();
