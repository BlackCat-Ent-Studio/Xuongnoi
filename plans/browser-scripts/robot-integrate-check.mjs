// Robot integrate check on :5255: sample "Robot dò đường" (2d-top and 3d variant), board wiring, lessons menu.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-robot-integrate/';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto('http://localhost:5255/');
await sleep(1500);
await p.evaluate(() => localStorage.clear());
await p.reload();
await sleep(1500);
if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }

// lessons menu
await p.locator('[data-tut="tutorial"]').click();
await sleep(500);
await p.evaluate(() => { const h = [...document.querySelectorAll('*')].find((e) => e.children.length === 0 && (e.textContent || '').trim() === 'Robot'); h?.scrollIntoView({ block: 'start' }); });
await sleep(300);
await p.screenshot({ path: OUT + '01-lessons-menu.png' });
const robotItems = await p.evaluate(() => [...document.querySelectorAll('.menu-item[data-lesson]')].map((e) => e.getAttribute('data-lesson') + ':' + (e.textContent || '').trim().slice(0, 50)).filter((t) => /robot|line|pid/i.test(t)));
console.log('lesson items', JSON.stringify(robotItems));
const heads = await p.evaluate(() => [...document.querySelectorAll('*')].filter((e) => e.children.length === 0 && /^(Robot|Rô-bốt)$/.test((e.textContent || '').trim())).map((e) => e.textContent));
console.log('chapter headings', JSON.stringify(heads));
await p.keyboard.press('Escape');
await p.mouse.click(700, 450);
await sleep(300);

async function openSample() {
  await p.locator('[data-menu="file"]').click();
  await p.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await p.locator('.mb-item', { hasText: 'Robot dò đường' }).first().click();
  await sleep(1200);
}
await openSample();
await p.screenshot({ path: OUT + '02-board-wiring.png' });
console.log('hint visible', await p.evaluate(() => document.body.innerText.includes('Chưa có mảnh ghép Nhân vật')));
await p.locator('[data-tut="play"]').click();
await sleep(1500);
await p.locator('button, [role=tab]', { hasText: 'Màn chơi' }).first().click();
await sleep(9000);
await p.screenshot({ path: OUT + '03-play-2dtop.png' });
await sleep(7000);
await p.screenshot({ path: OUT + '04-play-2dtop-later.png' });
await p.locator('.play .pbtn.stop').click().catch(() => {});

// 3D variant: the same board plus a floor, loaded through the autosave slot
const raw = JSON.parse(fs.readFileSync('D:/workspace/GameBuilder-rbint/app/src/samples/robot-line-follow.json', 'utf8'));
raw.mode = '3d';
raw.graph.nodes.push({ id: 'san', kind: 'block', params: { position: { x: 0, y: 0, z: 0 }, size: { x: 24, y: 1, z: 16 }, color: '#d6d3d1' }, pos: { x: 40, y: 1240 } });
raw.graph.nodes.find((n) => n.id === 'than').params.position.y = 0.8;
raw.graph.nodes.find((n) => n.id === 'may-quay').params.view = 'tilted';
raw.graph.nodes.find((n) => n.id === 'may-quay').params.zoom = 1;
await p.addInitScript((j) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('xuong-noi:autosave', j); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(raw));
await p.reload();
await sleep(1800);
await p.screenshot({ path: OUT + '05-3d-after-reload.png' });
await p.locator('[data-tut="play"]').click();
await sleep(1500);
await p.locator('button, [role=tab]', { hasText: 'Màn chơi' }).first().click();
await sleep(9000);
await p.screenshot({ path: OUT + '06-play-3d.png' });
await sleep(7000);
await p.screenshot({ path: OUT + '07-play-3d-later.png' });
console.log('LOGS', JSON.stringify(logs));
await b.close();
