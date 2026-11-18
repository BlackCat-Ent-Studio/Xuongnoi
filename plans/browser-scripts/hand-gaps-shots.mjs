// Hand gaps ("Vật lý thật"): shoots (1) the auto-arm pick close-up (pads arriving, then holding), (2) a hand tilted 45 degrees touching a crate,
// (3) a fast joint meeting a 10 kg crate, (4) the gripper card with the new advanced param and outputs, (5) one frame of the arm / gripper / crate.
// Needs `npx vite --port 5302 --strictPort` in the worktree app/.   Boards for 2 and 3 come from tests/arm/zz-gen-boards.test.ts (saved next to the shots).
//   SCEN=pick | tilt | fast | card | look   FROM=17 TO=21 STEP=0.35   (shots go to plans/reports/shots-hand-gaps/)
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder-hand-gaps/plans/reports/shots-hand-gaps/';
fs.mkdirSync(OUT, { recursive: true });
const SCEN = process.env.SCEN ?? 'pick';
const FROM = Number(process.env.FROM ?? 17);
const TO = Number(process.env.TO ?? 21);
const STEP = Number(process.env.STEP ?? 0.35);
const BASE = 'http://localhost:5302';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe', args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
await p.goto(`${BASE}/`);
await sleep(2500);
await p.evaluate(() => localStorage.clear());
await p.reload();
await sleep(2500);
if (await p.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await p.locator('[data-tut="invite-no"]').click(); await sleep(300); }

const openFile = async (name) => {
  await p.locator('[data-menu="file"]').click(); await sleep(200);
  const [chooser] = await Promise.all([p.waitForEvent('filechooser'), p.locator('.mb-item', { hasText: 'Mở file' }).click()]);
  await chooser.setFiles(OUT + name);
  await sleep(1500);
};

if (SCEN === 'tilt') await openFile('tilted-hand.xuongnoi.json');
else if (SCEN === 'fast') await openFile('fast-joint.xuongnoi.json');
else if (SCEN === 'card') await openFile('gripper-card.xuongnoi.json');
else {
  await p.locator('[data-menu="file"]').click(); await sleep(200);
  await p.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  await p.locator('.mb-menu .mb-item', { hasText: 'Tay máy tự gắp' }).click(); await sleep(1500);
}

if (SCEN === 'card') {
  // Edit view: select the gripper card and open the advanced part of its properties.
  await p.mouse.click(318, 287);
  await sleep(600);
  await p.mouse.move(1130, 650); await p.mouse.wheel(0, 1400); await sleep(500);
  await p.locator('text=Nâng cao').first().click({ timeout: 3000 }).catch(() => {});
  await sleep(400);
  await p.mouse.move(1130, 650); await p.mouse.wheel(0, 1400); await sleep(500);
  await p.screenshot({ path: OUT + 'card-gripper-ports.png' });
  await p.mouse.move(1130, 650); await p.mouse.wheel(0, -700); await sleep(500);
  await p.mouse.click(1052, 723); await sleep(500);
  await p.mouse.move(1130, 650); await p.mouse.wheel(0, 250); await sleep(500);
  await p.screenshot({ path: OUT + 'card-gripper-params.png' });
  console.log('LOGS', JSON.stringify(logs.slice(0, 8)));
  await b.close();
  process.exit(0);
}

await p.locator('.wc-rail > button:nth-of-type(4)').click().catch(() => {}); await sleep(600);
await p.locator('.play .pbtn.primary').click();
await p.locator('button:has-text("Mô phỏng"):visible').first().click();
const t0 = Date.now();
if (SCEN === 'tilt' || SCEN === 'fast') {
  // zoom in on the machine (the board is small in the default view)
  const box = await p.locator('canvas').first().boundingBox();
  await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await p.mouse.wheel(0, -Number(process.env.WHEEL ?? 900));
  await sleep(300);
}
if (SCEN === 'pick') {
  // close-up from the side of the pick
  const box = await p.locator('canvas').first().boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy); await p.mouse.down({ button: 'right' }); await p.mouse.move(cx - 260, cy + 40, { steps: 8 }); await p.mouse.up({ button: 'right' });
  await p.mouse.move(cx, cy); await p.mouse.down(); await p.mouse.move(cx - 220, cy + 30, { steps: 8 }); await p.mouse.up();
  await p.mouse.wheel(0, -Number(process.env.WHEEL ?? 500));
}
let i = 0;
const to = SCEN === 'look' ? Number(process.env.TO ?? 19) : TO;
while ((Date.now() - t0) / 1000 < to) {
  const t = (Date.now() - t0) / 1000;
  if (t >= (SCEN === 'look' ? 18 : FROM)) await p.screenshot({ path: OUT + `${SCEN}-${String(i++).padStart(2, '0')}-w${t.toFixed(1)}s.png` });
  await sleep(STEP * 1000);
}
await p.locator('.play .pbtn.stop').click().catch(() => {});
console.log('LOGS', JSON.stringify(logs.slice(0, 8)));
await b.close();
