// Auto-sense check on :5261: robot + front sensor driving to a wall (3D), and a robot carrying a crate while turning.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const SCR = 'C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-auto-sense/';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];

async function session(boardFile, tag) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  p.on('pageerror', (e) => logs.push(`${tag} pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') logs.push(`${tag} ${m.text()}`); });
  const json = fs.readFileSync(SCR + boardFile, 'utf8');
  await p.addInitScript((j) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('xuong-noi:autosave', j); sessionStorage.setItem('seeded', '1'); } }, json);
  await p.goto('http://localhost:5261/');
  await sleep(2000);
  if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  await p.screenshot({ path: OUT + `${tag}-1-board.png` });
  await p.locator('[data-tut="play"]').click();
  await sleep(1500);
  await p.locator('button, [role=tab]', { hasText: 'Màn chơi' }).first().click();
  return p;
}

const a = await session('board-wall.json', 'wall');
await sleep(4000);
await a.screenshot({ path: OUT + 'wall-2-driving.png' });
await sleep(9000);
await a.screenshot({ path: OUT + 'wall-3-stopped.png' });
await a.close();

const c = await session('board-crate.json', 'crate');
await sleep(6000);
await c.screenshot({ path: OUT + 'crate-2-turning.png' });
await sleep(6000);
await c.screenshot({ path: OUT + 'crate-3-later.png' });
console.log('LOGS', JSON.stringify(logs));
await b.close();
