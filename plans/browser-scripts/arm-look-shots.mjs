// Arm look port check on :5276: sample "Tay máy gắp thùng" (holding, slipped, crushed, overloaded) in side and 3D views,
// piston handbook try-board, sample "Robot dò đường". Shots go to plans/reports/shots-arm-look/.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-arm-look/';
fs.mkdirSync(OUT, { recursive: true });
const BASE = 'http://localhost:5276';
const ONLY = process.env.ONLY ?? 'all';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: Number(process.env.DPR ?? 1) });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });

async function fresh() {
  await p.goto(`${BASE}/`);
  await sleep(1500);
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await sleep(1500);
  if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }
}
async function openSample(label) {
  await p.locator('[data-menu="file"]').click(); await sleep(200);
  await p.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  await p.locator('.mb-item', { hasText: label }).first().click();
  await sleep(900);
}
const stage = () => p.locator('.game-box, #stage, canvas').first();
async function shot(name) { await p.screenshot({ path: OUT + name + '.png' }); }
async function setMode(m) { await p.locator(`.seg-opt[data-mode="${m}"]`).click(); await sleep(600); }
async function hold(key, ms) { await p.keyboard.down(key); await sleep(ms); await p.keyboard.up(key); }
async function press(key, n = 1) { for (let i = 0; i < n; i++) { await p.keyboard.press(key); await sleep(120); } }

await fresh();
const crop = { x: 243, y: 73, width: 910, height: 576 };
async function zshot(name) { await p.screenshot({ path: OUT + name + '.png', clip: crop }); }
async function tap(key, n = 1) { for (let i = 0; i < n; i++) { await p.keyboard.down(key); await sleep(70); await p.keyboard.up(key); await sleep(130); } }
async function playSample(label, mode) {
  await fresh();
  await openSample(label);
  if (mode === '3d') await setMode('3d');
  await p.getByRole('button', { name: /Chơi/ }).first().click();
  await sleep(500);
  await p.locator('button, [role=tab]', { hasText: 'Màn chơi' }).first().click();
  await sleep(1500);
}
async function zoom(n, x = 700, y = 380) { await p.mouse.move(x, y); for (let i = 0; i < n; i++) { await p.mouse.wheel(0, -300); await sleep(100); } await sleep(400); }
const SCEN = {
  // counts as in tests/arm/robot-arm-sample.test.ts: shoulder 8 / elbow 4 at the start
  start: async () => {},
  slip: async () => { await tap('KeyS', 2); await tap('KeyA', 2); await sleep(2500); await p.keyboard.down('Space'); await sleep(600); await p.keyboard.down('KeyW'); await sleep(250); await p.keyboard.up('KeyW'); await sleep(250); await p.keyboard.down('KeyW'); await sleep(250); await p.keyboard.up('KeyW'); await sleep(2000); },
  hold: async () => { await tap('KeyS', 2); await tap('KeyA', 2); await sleep(2500); await tap('ArrowUp', 1); await p.keyboard.down('Space'); await sleep(600); await tap('KeyW', 2); await sleep(2500); },
  crush: async () => { await tap('KeyS', 4); await tap('KeyD', 3); await sleep(2500); await tap('ArrowUp', 3); await p.keyboard.down('Space'); await sleep(1500); },
  overload: async () => { await tap('KeyS', 2); await tap('KeyD', 0); await sleep(2500); await tap('ArrowUp', 5); await p.keyboard.down('Space'); await sleep(600); await tap('KeyW', 3); await sleep(2500); },
};
if (ONLY === 'all' || ONLY === 'arm') {
  for (const mode of ['side', '3d']) {
    for (const name of Object.keys(SCEN)) {
      if (process.env.SCEN && process.env.SCEN !== name) continue;
      await playSample('Tay máy gắp thùng', mode);
      await zoom(3);
      await SCEN[name]();
      await zshot(`arm-${mode}-${name}`);
    }
  }
}
if (ONLY === 'all' || ONLY === 'piston') {
  await fresh();
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('handbook:open', { detail: 'linear-actuator' })));
  await p.waitForSelector('.hb-modal', { state: 'visible' });
  await sleep(500);
  await p.locator('[data-hb-action="try"]').click();
  await sleep(1200);
  await p.locator('.play .pbtn.primary').click();
  await sleep(800);
  await p.locator('button, [role=tab]', { hasText: 'Màn chơi' }).first().click().catch(() => {});
  await sleep(1500);
  for (let i = 0; i < 5; i++) { await shot(`piston-0${i + 1}`); await sleep(450); }
}
if (ONLY === 'all' || ONLY === 'robot') {
  for (const mode of ['2d-top', '3d']) {
    await fresh();
    await openSample('Robot dò đường');
    if (mode === '3d') await setMode('3d');
    await p.getByRole('button', { name: /Chơi/ }).first().click();
    await sleep(500);
    await p.locator('button, [role=tab]', { hasText: 'Màn chơi' }).first().click();
    await sleep(3500);
    await shot(`robot-${mode}`);
    if (mode === '3d') await p.screenshot({ path: OUT + 'robot-3d-crop.png', clip: { x: 600, y: 490, width: 180, height: 130 } });
  }
}
console.log('logs', JSON.stringify(logs));
await b.close();
