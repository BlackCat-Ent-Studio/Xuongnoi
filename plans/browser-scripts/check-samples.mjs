import { chromium } from 'file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs';

const OUT = 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/sweep';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
let logs = [];
const dialogs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('dialog', (d) => {
  dialogs.push(d.message());
  d.dismiss();
});
const summary = [];
const rec = (name, ok, d = '') => {
  summary.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${d}`);
};

await page.goto('http://localhost:5173/');
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
logs = [];

// ---- check 1: palette ----
const palette = await page.locator('.palette-item').evaluateAll((els) =>
  els.map((e) => ({ kind: e.dataset.kind, text: e.innerText.trim() })),
);
const kinds = [...new Set(palette.map((p) => p.kind))];
const cats = await page.locator('.palette-cat').allInnerTexts();
rec('1 palette has 41 kinds', kinds.length === 41, `kinds=${kinds.length} items=${palette.length}`);
rec('1 palette categories', cats.length > 0, cats.join(' | '));
rec('1 no console errors on load', logs.length === 0, logs.join(' || ') || 'none');
await page.screenshot({ path: `${OUT}/01-editor-palette.png` });
console.log('KINDS', kinds.join(','));

// ---- check 2: all samples ----
const SAMPLES = [
  'side-stars', 'top-collect', '3d-hop', 'key-door', 'pickaxe-rock', 'guard-patrol', 'cleaner-bot',
  'maze-chase', 'platform-bot', 'arena', 'race', 'dice-zones', 'portal-camera', 'dodge-shoot',
];
const KEYS = ['ArrowRight', 'KeyD', 'ArrowUp', 'KeyW', 'Space', 'ArrowLeft', 'KeyA', 'KeyE', 'KeyF', 'ArrowDown', 'KeyS'];
const sampleRows = [];
for (const id of SAMPLES) {
  logs = [];
  dialogs.length = 0;
  const row = { id, open: false, play: false, errors: 0, end: '' };
  try {
    await page.locator('button', { hasText: 'Mở ▾' }).click();
    await page.locator(`[data-sample="${id}"]`).click();
    await sleep(900);
    row.open = true;
    row.mode = await page.locator('.mode-select').inputValue().catch(() => '?');
    await page.locator('#btn-play').click();
    await sleep(800);
    row.play = (await page.locator('#btn-play').innerText()).trim() === 'Sửa';
    // ~5 s of mixed input
    for (let i = 0; i < 5; i++) {
      const pair = [KEYS[(i * 2) % KEYS.length], KEYS[(i * 2 + 1) % KEYS.length]];
      for (const k of pair) await page.keyboard.down(k);
      await sleep(400);
      for (const k of pair) await page.keyboard.up(k);
      await sleep(200);
      if (i === 2) await page.keyboard.press('Space');
    }
    await page.screenshot({ path: `${OUT}/s-${id}-play.png` });
    row.end = (await page.locator('.game-box').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 90);
    await page.locator('#btn-play').click();
    await sleep(500);
    row.backToEdit = (await page.locator('#btn-play').innerText()).trim() === 'Chơi';
  } catch (e) {
    row.err = String(e.message).split('\n')[0];
  }
  row.errors = logs.length;
  row.logs = logs.slice(0, 4);
  row.dialogs = [...dialogs];
  sampleRows.push(row);
  rec(`2 sample ${id}`, row.open && row.play && row.backToEdit && row.errors === 0, JSON.stringify({ ...row, logs: undefined }).slice(0, 300));
  if (row.logs.length) console.log('  LOGS', JSON.stringify(row.logs));
}
console.log('SAMPLE_TABLE', JSON.stringify(sampleRows));

// ---- check 4: dodge-shoot and portal-camera end-to-end ----
for (const id of ['dodge-shoot', 'portal-camera']) {
  logs = [];
  await page.locator('button', { hasText: 'Mở ▾' }).click();
  await page.locator(`[data-sample="${id}"]`).click();
  await sleep(900);
  await page.locator('#btn-play').click();
  await sleep(600);
  let overlay = '';
  const t0 = Date.now();
  let i = 0;
  while (Date.now() - t0 < 45000 && !overlay) {
    const k = KEYS[i % KEYS.length];
    await page.keyboard.down(k);
    await sleep(350);
    await page.keyboard.up(k);
    if (i % 3 === 0) await page.keyboard.press('Space');
    i++;
    const txt = await page.locator('.game-box').innerText().catch(() => '');
    if (/Thắng|Thua|Chiến thắng|thua mất/i.test(txt)) overlay = txt.replace(/\s+/g, ' ').slice(0, 120);
  }
  await page.screenshot({ path: `${OUT}/04-${id}-end.png` });
  rec(`4 ${id} win/lose overlay appears`, !!overlay, overlay || `no overlay after ${Math.round((Date.now() - t0) / 1000)}s`);
  rec(`4 ${id} console errors`, logs.length === 0, logs.join(' || ') || 'none');
  await page.locator('#btn-play').click();
  await sleep(500);
}

console.log('SUMMARY', summary.filter((s) => !s.ok).length, 'failing of', summary.length);
console.log('DIALOGS', JSON.stringify(dialogs));
await browser.close();
