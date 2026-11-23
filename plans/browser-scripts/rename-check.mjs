// Rename check on :5243: editor sample cards (new names + EN line), palette alias search, handbook page, puzzle level 3 board + guide bubble.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-rename/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5243';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];

// ---- editor ----
if (process.env.ONLY !== 'puzzle') {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  await p.goto(`${BASE}/`);
  await sleep(1500);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await sleep(1500);
  if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  await p.locator('[data-menu="file"]').click();
  await p.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await p.locator('.mb-item', { hasText: 'Nhặt sao' }).first().click();
  await sleep(900);
  await p.screenshot({ path: OUT + '01-editor-nhat-sao.png' });
  const names = await p.locator('.wc-node .wc-name').allInnerTexts();
  const subs = await p.locator('.wc-node .wc-sub').allInnerTexts();
  const ports = await p.locator('.wc-node .wc-port-label, .wc-node .wc-port span').allInnerTexts().catch(() => []);
  console.log('CARD_NAMES', JSON.stringify(names));
  console.log('CARD_SUBS', JSON.stringify(subs));
  console.log('PORT_LABELS', JSON.stringify([...new Set(ports)].slice(0, 40)));
  const sizes = await p.locator('.wc-node').evaluateAll((els) => els.map((e) => [e.offsetWidth, e.offsetHeight]));
  console.log('CARD_SIZES', JSON.stringify(sizes));
  // palette alias search
  const search = p.locator('.pn-search-input');
  for (const q of ['Đi tới', 'Chạm nhau', 'Chuỗi việc', 'Hộp hỏi']) {
    await search.fill(q);
    await sleep(300);
    const kinds = await p.locator('.palette-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-kind')));
    console.log('SEARCH', q, JSON.stringify(kinds));
    if (q === 'Đi tới') await p.screenshot({ path: OUT + '02-palette-search-di-toi.png' });
  }
  await search.fill('');
  // handbook via card help
  await p.locator('.wc-node .hb-card-help').first().click({ force: true });
  await p.waitForSelector('.ch-box');
  await p.locator('.ch-full').click();
  await p.waitForSelector('.hb-modal', { state: 'visible' });
  await sleep(500);
  await p.screenshot({ path: OUT + '03-handbook-page.png' });
  await p.close();
}

// ---- puzzle level 3 ----
{
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await p.goto(`${BASE}/giai-do.html`);
  const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao'];
  await p.evaluate((list) => {
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 3 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(['bot-dau-tien', 'intro:nhat-sao']));
  }, ids);
  await p.reload(); await sleep(1500); await p.screenshot({ path: OUT + '04a-puzzle-list.png' }); await p.locator('.pz-play').click({ force: true }); await sleep(1200); await p.screenshot({ path: OUT + '04b-puzzle-levels.png' }); console.log('LIST', (await p.locator('body').innerText()).replace(/s+/g,' ').slice(0,500)); await p.click('text=Nhặt sao');
  await sleep(2500);
  await p.screenshot({ path: OUT + '04-puzzle-level3.png' });
  await p.locator('.pz-hint-btn').click({ force: true });
  await sleep(2500);
  await p.screenshot({ path: OUT + '05-puzzle-level3-hint.png' });
  console.log('PUZZLE_TEXT', (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600));
  await p.close();
}
console.log('ERRORS', JSON.stringify(logs));
await b.close();
