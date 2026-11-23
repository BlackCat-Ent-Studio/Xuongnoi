// Screenshots of index.html: each look in 3D + side view, every state for look A, plus a 2x2 contact sheet.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const DIR = 'D:/workspace/GameBuilder/plans/ui-mockups/robot-arm-style/';
const OUT = DIR + 'shots/';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1400, height: 860 } });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto('file:///' + DIR + 'index.html');
await p.waitForFunction(() => window.__api && window.__api.ready === true, null, { timeout: 60000 });
await p.evaluate(() => window.__api.freezeBlink(true));
const stage = p.locator('#stage');
const snap = async (name, patch) => {
  await p.evaluate((x) => window.__api.set(x), patch);
  await sleep(450);
  await stage.screenshot({ path: OUT + name + '.png' });
};
const ids = ['0', 'A', 'B', 'C'];
for (let i = 0; i < 4; i++) {
  await snap(`look${ids[i]}-3d-hold`, { look: i, view: '3d', state: 'hold' });
  await snap(`look${ids[i]}-side-hold`, { look: i, view: '2d', state: 'hold' });
}
for (const st of ['none', 'hold', 'slip', 'crush', 'overload']) {
  await snap(`lookA-3d-state-${st}`, { look: 1, view: '3d', state: st });
}
for (const st of ['crush', 'overload']) {
  await snap(`lookB-3d-state-${st}`, { look: 2, view: '3d', state: st });
  await snap(`lookC-3d-state-${st}`, { look: 3, view: '3d', state: st });
}
await p.screenshot({ path: OUT + 'page-full.png' });
console.log(JSON.stringify(await p.evaluate(() => window.__api.partTris())));
console.log('logs', JSON.stringify(logs));

// contact sheet: 4 looks (3D, state hold) in a grid
const imgs = ids.map((id) => 'data:image/png;base64,' + fs.readFileSync(OUT + `look${id}-3d-hold.png`).toString('base64'));
const q = await b.newPage({ viewport: { width: 1800, height: 1100 } });
await q.setContent(`<body style="margin:0;background:#17123a;display:grid;grid-template-columns:1fr 1fr;gap:6px">${imgs.map((s) => `<img src="${s}" style="width:100%;display:block">`).join('')}</body>`);
await sleep(300);
await q.screenshot({ path: DIR + 'contact-sheet.png', fullPage: true });
await b.close();
