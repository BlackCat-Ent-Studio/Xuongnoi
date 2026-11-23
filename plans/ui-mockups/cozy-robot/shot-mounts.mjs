// Screenshots of robot-wheel.html: one per wheel-mount style, plus the run pose.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const dir = 'D:/workspace/GameBuilder/plans/ui-mockups/cozy-robot/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const logs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await p.goto('file:///' + dir + 'robot-wheel.html');
await p.waitForSelector('#tris:not(:empty)');
// a tiny click on the stage stops auto-rotate at the initial 3/4 angle
const box = await p.locator('#stage canvas').boundingBox();
await p.mouse.move(box.x + 20, box.y + 20); await p.mouse.down(); await p.mouse.up();
const clip = { x: 60, y: 110, width: 805, height: 590 };
for (const [m, label] of [['cang', 'A. Càng'], ['chanbun', 'B. Chắn'], ['vay', 'C. Váy'], ['none', 'Không']]) {
  await p.click(`#mounts button:has-text("${label}")`);
  await p.waitForTimeout(900);
  await p.screenshot({ path: dir + `shots-wheel/mount-${m}.png`, clip });
  console.log(m, await p.textContent('#tris'));
}
await p.click('#mounts button:has-text("B. Chắn")');
await p.click('button:has-text("Chạy")');
await p.waitForTimeout(1200);
await p.screenshot({ path: dir + 'shots-wheel/mount-chanbun-run.png', clip });
console.log(logs.join('\n') || 'no console errors');
await b.close();
