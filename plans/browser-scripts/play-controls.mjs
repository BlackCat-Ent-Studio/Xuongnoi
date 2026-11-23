// Play / pause / step / resume / live-edit / stop / Ctrl+Enter / issue "Xem" / scene tree, on the Nhặt sao sample in the DEFAULT layout.
// Usage: PORT=5180 SCRATCH=<dir> node play-controls.mjs   (needs python with Pillow for charx.py)
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { openBrowser, sleep, record, openSample } from './common.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const OUT = process.env.SCRATCH;
const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1000);
await openSample(page, 'Nhặt sao');
await page.screenshot({ path: `${OUT}/pc-1-loaded.png` });

const shot = async () => {
  const f = `${OUT}/pc-char.png`;
  const b = await page.locator('.game-box').boundingBox();
  await page.screenshot({ path: f, clip: { x: b.x, y: b.y, width: b.width, height: b.height } });
  return spawnSync('python', [`${here}/charx.py`, f], { encoding: 'utf-8' }).stdout.trim();
};
const same = (a, b) => {
  const [ax, ay] = a.split(',').map(Number);
  const [bx, by] = b.split(',').map(Number);
  return Math.abs(ax - bx) <= 2 && Math.abs(ay - by) <= 3;
};
const charNode = () => page.locator('.wc-node[data-kind="character"]').first();
const stepBtn = page.getByRole('button', { name: 'Từng bước' });

// pick the character in the graph first so the Inspector stays on it during play
await charNode().locator('.wc-node-head').click();
await sleep(300);
await page.locator('#btn-play').click();
await sleep(1000);
record('play: shows the game tab', await page.locator('.game-box').isVisible(), '');
record('play: first button is Chơi lại', (await page.locator('#btn-play span').innerText()) === 'Chơi lại', '');
await page.screenshot({ path: `${OUT}/pc-2-playing.png` });
const idle1 = await shot();
await sleep(400);
record('play: idle world stable (metric sanity)', same(idle1, await shot()), idle1);
await page.keyboard.down('ArrowRight');
await sleep(250);
await page.keyboard.up('ArrowRight');
const m1 = await shot();
record('play: arrow key moves the world', !same(m1, idle1), `${idle1} -> ${m1}`);

await page.getByRole('button', { name: 'Tạm dừng' }).click();
await sleep(400);
record('pause: .paused class', (await page.locator('.app.paused').count()) === 1, '');
await page.keyboard.down('ArrowRight');
const p1 = await shot();
await sleep(800);
record('pause: frozen with key held', same(p1, await shot()), p1);
record('pause: button reads Tiếp tục', (await page.getByRole('button', { name: 'Tiếp tục' }).count()) === 1, '');
await page.screenshot({ path: `${OUT}/pc-3-paused.png` });

record('step: enabled while paused', await stepBtn.isEnabled(), '');
await page.keyboard.up('ArrowRight');
await page.keyboard.down('Space');
const trace = [await shot()];
for (let i = 0; i < 6; i++) {
  for (let j = 0; j < 3; j++) {
    await stepBtn.click();
    await sleep(60);
  }
  trace.push(await shot());
}
await page.keyboard.up('Space');
record('step: clicks advance the world', trace.some((t) => !same(t, trace[0])), trace.join(' '));
await sleep(500);
record('step: frozen again after', same(trace[trace.length - 1], await shot()), '');

await page.getByRole('button', { name: 'Tiếp tục' }).click();
await sleep(200);
record('resume: .paused gone', (await page.locator('.app.paused').count()) === 0, '');
await page.keyboard.press('Control+Enter');
await sleep(400);
record('Ctrl+Enter stops', (await page.locator('.app.playing').count()) === 0, '');
await page.keyboard.press('Control+Enter');
await sleep(900);
record('Ctrl+Enter starts', (await page.locator('.app.playing').count()) === 1, '');

// live speed edit: the Inspector is still on the character
const speed = page.locator('[data-param="speed"] input').first();
record('inspector shows speed 5', (await speed.inputValue()) === '5', await speed.inputValue());
await page.screenshot({ path: `${OUT}/pc-4-inspector.png` });
await speed.fill('0');
await page.evaluate(() => document.activeElement && document.activeElement.blur());
await sleep(300);
const log = await page.locator('.cs-log').innerText();
record('live: log says applied, not deferred', log.includes('Đã đổi giá trị khi đang chơi') && !log.includes('Sẽ áp dụng'), log.replace(/\n/g, ' / ').slice(-120));
const z0 = await shot();
await page.keyboard.down('ArrowLeft');
await sleep(500);
const z1 = await shot();
await page.keyboard.up('ArrowLeft');
record('live: speed 0 -> world does not move', same(z0, z1), `${z0} -> ${z1}`);

await page.getByRole('button', { name: 'Dừng', exact: true }).click();
await sleep(500);
record('stop: not playing', (await page.locator('.app.playing').count()) === 0, '');
record('stop: speed 0 kept', (await page.locator('[data-param="speed"] input').first().inputValue()) === '0', '');
await page.screenshot({ path: `${OUT}/pc-5-stopped.png` });

// issues + Xem (the graph tab is back after stop)
await page.locator('.dock-left [role=tab]', { hasText: 'Mảnh ghép' }).first().click();
const nBefore = await page.locator('.wc-node').count();
await page.locator('[data-kind="carry"]').first().dispatchEvent('click');
await sleep(500);
record('palette add makes a node', (await page.locator('.wc-node').count()) === nBefore + 1, '');
const rows = await page.locator('.cs-issue').allInnerTexts();
record('issues: missing wire listed', rows.some((r) => r.includes('chưa nối')), rows.join(' || ').replace(/\n/g, ' '));
record('issues: badge = count', (await page.locator('#tab-console .cs-badge').innerText()) === String(rows.length), '');
await page.locator('.cs-issue .cs-btn').first().click();
await sleep(400);
const box = await page.locator('.wc-node[data-kind="carry"]').first().boundingBox();
const wc = await page.locator('.wc').first().boundingBox();
const dx = Math.abs(box.x + box.width / 2 - (wc.x + wc.width / 2));
const dy = Math.abs(box.y + box.height / 2 - (wc.y + wc.height / 2));
record('Xem: node centred in canvas', dx < 40 && dy < 40, `dx=${dx.toFixed(0)} dy=${dy.toFixed(0)}`);
await page.screenshot({ path: `${OUT}/pc-6-xem.png` });
await page.keyboard.press('Control+z');
await sleep(300);
record('undo removes the added node', (await page.locator('.wc-node').count()) === nBefore, '');

// scene tree: select + pan
await page.locator('.dock-left [role=tab]', { hasText: 'Cảnh' }).first().click();
await sleep(200);
const treeRows = page.locator('.dock-left .st-row:has(.st-tile)');
const count = await treeRows.count();
record('scene tree has rows', count > 3, String(count));
if (count > 3) {
  await treeRows.nth(count - 1).click();
  await sleep(500);
  const selected = await page.locator('.wc-node.selected').count();
  const sb = selected ? await page.locator('.wc-node.selected').first().boundingBox() : null;
  const inView = sb && sb.x >= wc.x - 4 && sb.x + sb.width <= wc.x + wc.width + 4 && sb.y >= wc.y - 4 && sb.y + sb.height <= wc.y + wc.height + 4;
  record('scene tree: click selects a node and pans it into view', selected === 1 && !!inView, JSON.stringify(sb));
  await page.screenshot({ path: `${OUT}/pc-7-scene-tree.png` });
}
record('no console errors/warnings', logs.length === 0, JSON.stringify(logs.slice(0, 4)));
await browser.close();
