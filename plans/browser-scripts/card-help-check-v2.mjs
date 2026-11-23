// Card "?" help: puzzle L5 card + tray chip popups (desktop + phone), "Xem đầy đủ", editor card popup, hint stars unchanged.
// usage: node card-help-check.mjs   (dev server on 5232 from D:\workspace\GameBuilder-help\app)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-card-help-v2/';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5173';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung'];
const prior = ids.slice(0, 4);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];

async function openPuzzle(viewport) {
  const p = await b.newPage({ viewport, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  await p.goto(`${BASE}/giai-do.html`);
  await p.evaluate(([list, seen]) => {
    localStorage.clear();
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(seen));
  }, [prior, [...ids, ...ids.map((i) => 'intro:' + i)]]);
  await p.goto('about:blank');
  await p.goto(`${BASE}/giai-do.html#/level/du-ba-thung`);
  await p.waitForTimeout(3000);
  if (await p.locator('.pz-task-body:visible').count()) await p.locator('button:has-text("Đề bài")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

async function puzzleRound(tag, viewport) {
  const p = await openPuzzle(viewport);
  const badge = () => p.locator('.pz-hint-badge').innerText();
  const before = await badge();
  await p.screenshot({ path: `${out}${tag}-1-board.png` });
  // tray chip "?"
  const chipHelp = p.locator('.pz-chip-wrap > .hb-card-help').first();
  console.log(tag, 'CHIP_HELP_COUNT', await p.locator('.pz-chip-wrap > .hb-card-help').count());
  await chipHelp.click({ force: true });
  await p.waitForSelector('.ch-box');
  await p.screenshot({ path: `${out}${tag}-2-chip-popup.png` });
  const box = await p.locator('.ch-box').boundingBox();
  console.log(tag, 'POPUP_BOX', JSON.stringify(box), 'fits', box.y >= 0 && box.y + box.height <= viewport.height && box.x >= 0 && box.x + box.width <= viewport.width);
  await p.keyboard.press('Escape');
  console.log(tag, 'ESC_CLOSED', (await p.locator('.ch-overlay').count()) === 0);
  // add a piece from the tray, then card "?"
  await p.locator('.pz-chip').first().click();
  await p.waitForTimeout(500);
  const cardHelp = p.locator('.wc-node:not(.pz-locked) .hb-card-help').first();
  const nodesBefore = await p.locator('.wc-node').count();
  await cardHelp.click({ force: true });
  await p.waitForSelector('.ch-box');
  console.log(tag, 'CARD_NOT_FOCUSED', (await p.locator('.pz-picked').count()) === 0, 'NODES_SAME', nodesBefore === (await p.locator('.wc-node').count()));
  await p.screenshot({ path: `${out}${tag}-3-card-popup.png` });
  // tap outside closes
  await p.mouse.click(5, 5);
  console.log(tag, 'OUTSIDE_CLOSED', (await p.locator('.ch-overlay').count()) === 0);
  // locked card "?"
  const locked = p.locator('.wc-node.pz-locked .hb-card-help').first();
  console.log(tag, 'LOCKED_HAS_HELP', (await locked.count()) > 0);
  // full handbook
  await cardHelp.click({ force: true });
  await p.waitForSelector('.ch-box');
  await p.locator('.ch-full').click();
  await p.waitForSelector('.hb-modal', { state: 'visible' });
  await p.waitForTimeout(500);
  console.log(tag, 'POPUP_GONE', (await p.locator('.ch-overlay').count()) === 0, 'HB_ACTIONS_HIDDEN', (await p.locator('.hb-actions').count()) === 0);
  await p.screenshot({ path: `${out}${tag}-4-full-handbook.png` });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  console.log(tag, 'HB_CLOSED', !(await p.locator('.hb-modal').isVisible()));
  console.log(tag, 'HINT_BADGE', before, '->', await badge());
  await p.close();
}

await puzzleRound('desktop', { width: 1280, height: 720 });
await puzzleRound('phone', { width: 844, height: 390 });

// editor: sample card
{
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  await p.goto(`${BASE}/`);
  await p.waitForTimeout(2500);
  const no = p.locator('[data-tut="invite-no"]');
  if (await no.isVisible().catch(() => false)) await no.click();
  await p.waitForTimeout(500);
  for (const k of ['key', 'and']) await p.locator(`.palette-item[data-kind="${k}"]`).first().click();
  await p.locator('text=Bảng nối').first().click().catch(() => {});
  await p.waitForTimeout(500);
  const count = await p.locator('.wc-node:not(.wc-group) .hb-card-help').count();
  console.log('EDITOR_CARDS_WITH_HELP', count, 'GROUP_HELP', await p.locator('.wc-group .hb-card-help').count());
  const sizes = await p.locator('.wc-node').evaluateAll((els) => els.slice(0, 6).map((e) => [e.offsetWidth, e.offsetHeight]));
  console.log('EDITOR_SIZES', JSON.stringify(sizes));
  await p.screenshot({ path: `${out}editor-1-board.png` });
  await p.locator('.wc-node .hb-card-help').first().click({ force: true });
  await p.waitForSelector('.ch-box');
  await p.screenshot({ path: `${out}editor-2-popup.png` });
  await p.locator('.ch-full').click();
  await p.waitForSelector('.hb-modal', { state: 'visible' });
  await p.screenshot({ path: `${out}editor-3-full.png` });
  await p.close();
}
console.log('ERRORS', JSON.stringify(logs));
await b.close();
