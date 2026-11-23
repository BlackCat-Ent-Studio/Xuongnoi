// Robot drive check on :5251 (worktree GameBuilder-rbdrive): handbook try-board, play in 2D-top and 3D, properties panel.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-robot-drive/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5251';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto(`${BASE}/`);
await sleep(1500);
await p.evaluate(() => localStorage.clear());
await p.reload();
await sleep(1500);
if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }

// ---- handbook page of the motor + "Thử ngay" ----
await p.evaluate(() => document.dispatchEvent(new CustomEvent('handbook:open', { detail: 'motor' })));
await p.waitForSelector('.hb-modal', { state: 'visible' });
await sleep(500);
await p.screenshot({ path: OUT + '01-handbook-motor.png' });
await p.locator('[data-hb-action="try"]').click();
await sleep(1500);
await p.screenshot({ path: OUT + '02-try-board-motor.png' });

// ---- play in 2D-top: arrow up, then up + right ----
await p.locator('[data-tut="play"]').click();
await sleep(1500);
await p.mouse.click(1126, 398);
await sleep(800);
await p.keyboard.down('ArrowUp');
await sleep(1500);
await p.screenshot({ path: OUT + '03-2dtop-forward.png' });
await p.keyboard.down('ArrowRight');
await sleep(1800);
await p.screenshot({ path: OUT + '04-2dtop-turning.png' });
await p.keyboard.up('ArrowRight');
await p.keyboard.up('ArrowUp');
await p.keyboard.press('Escape');
await p.locator('.play .pbtn.stop').click();
await sleep(800);
await p.locator('button, [role=tab]', { hasText: 'Bảng nối' }).first().click();
await sleep(500);

// ---- properties panel: click the motor card, then the chassis card ----
const nodes = p.locator('.wc-node');
const n = await nodes.count();
for (let i = 0; i < n; i++) {
  const txt = (await nodes.nth(i).innerText()).replace(/\s+/g, ' ');
  if (txt.includes('Động cơ')) { await nodes.nth(i).locator('.wc-name').first().click(); break; }
}
await sleep(600);
await p.screenshot({ path: OUT + '05-props-motor.png' });
for (let i = 0; i < n; i++) {
  const txt = (await nodes.nth(i).innerText()).replace(/\s+/g, ' ');
  if (txt.includes('Thân robot')) { await nodes.nth(i).locator('.wc-name').first().click(); break; }
}
await sleep(600);
await p.screenshot({ path: OUT + '06-props-body.png' });

// ---- 3D: same board plus a floor, written to the autosave then reloaded ----
await p.evaluate(async () => {
  const hb = await import('/src/handbook/content-robot-drive.ts');
  const io = await import('/src/io/index.ts');
  const board = hb.HANDBOOK_ROBOT_DRIVE[1].tryBoard();
  board.mode = '3d';
  board.graph.nodes.push({ id: 'floor', kind: 'block', params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 20 }, color: '#65a30d' }, pos: { x: 40, y: 600 } });
  localStorage.setItem('xuong-noi:autosave', io.serializeBoard(board));
});
await p.reload();
await sleep(2000);
if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
await p.locator('[data-tut="play"]').click();
await sleep(1500);
await p.mouse.click(1126, 398);
await sleep(800);
await p.keyboard.down('ArrowUp');
await sleep(1500);
await p.keyboard.down('ArrowRight');
await sleep(1500);
await p.screenshot({ path: OUT + '07-3d-turning.png' });
await p.keyboard.up('ArrowRight');
await p.keyboard.up('ArrowUp');
await sleep(600);
await p.screenshot({ path: OUT + '08-3d-stopped.png' });
console.log('ERRORS', JSON.stringify(logs));
await b.close();
