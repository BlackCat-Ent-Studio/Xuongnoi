// Editor "Va chạm thật" check on :5211 — toggle states, menu, sample stays OFF, play with a hero and a crate (3D + 2D side), handbook topic.
// usage: node editor-solid-check.mjs   (dev server on 5211)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-editor-solid/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5211/';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
let p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
const results = [];
const rec = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} | ${detail}`); };
const shot = (name) => p.screenshot({ path: OUT + name + '.png' });
const dismissInvite = async () => {
  if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
};
const toggle = () => p.locator('.pn-setting input[type=checkbox]');
const autosave = async () => JSON.parse((await p.evaluate(() => localStorage.getItem('xuong-noi:autosave'))) ?? 'null');

// ---- 1. fresh start: a new board is ON ----
await p.goto(BASE);
await p.evaluate(() => localStorage.clear());
await p.reload();
await sleep(2000);
await dismissInvite();
await sleep(500);
rec('1 toggle exists on the empty properties panel', (await toggle().count()) === 1);
rec('1 new board shows Va chạm thật ON', await toggle().isChecked());
rec('1 label text', (await p.locator('.pn-setting-label').innerText()).includes('Va chạm thật'));
rec('1 tooltip is one plain line', ((await p.locator('.pn-setting-label').getAttribute('title')) ?? '').length > 20);
await shot('01-new-board-on');

// ---- 2. the Tệp menu item mirrors it ----
await p.locator('.mb-btn[data-menu=file]').click();
await sleep(300);
const menuItem = p.locator('.mb-item', { hasText: 'Va chạm thật' });
rec('2 Tệp menu has the item', (await menuItem.count()) === 1);
const menuChecked = await menuItem.evaluate((el) => el.className + '|' + el.getAttribute('aria-checked'));
rec('2 menu item is ticked', /true|checked|on/.test(menuChecked), menuChecked);
await shot('02-file-menu');
await p.keyboard.press('Escape');
await sleep(200);

// ---- 3. toggle off/on from the panel, saved with the board ----
await toggle().uncheck();
await sleep(1400);
rec('3 off removes the field from the autosave', (await autosave())?.graph?.settings === undefined);
await toggle().check();
await sleep(1400);
rec('3 on writes graph.settings.solidBodies', (await autosave())?.graph?.settings?.solidBodies === true);
// from the menu
await p.locator('.mb-btn[data-menu=file]').click();
await p.locator('.mb-item', { hasText: 'Va chạm thật' }).click();
await sleep(1400);
rec('3 menu click toggles it off', !(await toggle().isChecked()) && (await autosave())?.graph?.settings === undefined);
await toggle().check();
await sleep(300);

// ---- 4. a sample stays OFF ----
await p.locator('.mb-btn[data-menu=file]').click();
await p.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
await sleep(300);
await p.locator('.mb-item', { hasText: 'Nhặt sao' }).first().click();
await sleep(1500);
rec('4 sample shows OFF', !(await toggle().isChecked()));
await shot('04-sample-off');
rec('4 sample autosave has no settings', (await autosave())?.graph?.settings === undefined);

// ---- 5. play a simple ON board: hero + crate, 3D and 2D side ----
const node = (id, kind, params, x, y) => ({ id, kind, params, pos: { x, y } });
const board = (name, mode, settings) => ({
  format_version: 1, name, mode,
  graph: {
    nodes: [
      node('floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 8 }, color: '#65a30d' }, 20, 20),
      node('stick-1', 'stick', { scheme: 'wasd' }, 20, 160),
      node('hero', 'character', { position: { x: -4, y: 0.5, z: 0 }, color: '#3b82f6' }, 260, 20),
      node('crate', 'item', { position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#f59e0b', carryable: 'no' }, 260, 220),
    ],
    wires: [
      { id: 'w1', from: { node: 'stick-1', port: 'x' }, to: { node: 'hero', port: 'moveX' } },
      { id: 'w2', from: { node: 'stick-1', port: 'y' }, to: { node: 'hero', port: 'moveY' } },
    ],
    ...(settings ? { settings: { solidBodies: true } } : {}),
  },
});
for (const [mode, on] of [['3d', true], ['2d-side', true], ['3d', false]]) {
  const tag = `${mode}-${on ? 'on' : 'off'}`;
  // A fresh page per board: the old page would flush its own pending autosave over ours when it unloads.
  await p.close();
  p = await ctx.newPage();
  p.on('console', (m) => { if (m.type() === 'error') logs.push('console: ' + m.text()); });
  p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
  await p.addInitScript((json) => { if (!sessionStorage.getItem('seeded')) { localStorage.clear(); localStorage.setItem('xuong-noi:autosave', json); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(board('Thử ' + tag, mode, on)));
  await p.goto(BASE);
  await sleep(2000);
  await dismissInvite();
  rec(`5 ${tag}: board loads with the switch ${on ? 'ON' : 'OFF'}`, (await toggle().isChecked()) === on);
  await p.locator('#btn-play').click();
  await sleep(800);
  await p.locator('.game-box, canvas').first().focus().catch(() => {});
  await p.keyboard.down('KeyD');
  await sleep(4500);
  await shot(`05-play-${tag}-after-walk`);
  await p.keyboard.up('KeyD');
  await sleep(300);
  await p.locator('.pbtn.stop').click().catch(() => {});
  await sleep(500);
}

// ---- 6. handbook ----
await p.locator('.mb-btn[data-menu=help]').click();
await p.locator('.mb-item', { hasText: 'Sổ tay' }).click();
await sleep(800);
rec('6 handbook list has the topic row', (await p.locator('.hb-topic').count()) === 1);
await p.locator('.hb-topic').click();
await sleep(300);
rec('6 topic page shows', (await p.locator('.hb-page').innerText()).toLowerCase().includes('khi bật'));
await shot('06-handbook-topic');
await p.locator('.hb-search').fill('cầm');
await sleep(300);
await p.locator('.hb-row[data-kind=carry]').click();
await sleep(300);
await shot('07-handbook-carry');
rec('6 carry page mentions it', (await p.locator('.hb-page').innerText()).includes('Va chạm thật'));
await p.keyboard.press('Escape');

console.log('\nconsole problems:', logs.length ? '\n' + logs.join('\n') : 'none');
console.log(`${results.filter((r) => r.ok).length}/${results.length} passed`);
await b.close();
