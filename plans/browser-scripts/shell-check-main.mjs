// Game shell check on :5201 — title, settings, map (fresh / some / all), level, win, unlock, end; two viewports.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-shell-main/';
const base = 'http://localhost:5173/giai-do.html';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'cau-nhap-nhay', 'xuong-tong-hop'];
const only = process.argv[2];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const prog = (n, stars = 3) => JSON.stringify(Object.fromEntries(ids.slice(0, n).map((i) => [i, { stars }])));

for (const [tag, vp] of [['desk', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
  if (only && only !== tag) continue;
  const p = await b.newPage({ viewport: vp });
  p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${tag}: ${m.type()} ${m.text()}`); });
  p.on('pageerror', (e) => logs.push(`${tag} pageerror: ${e.message}`));
  const shot = (name) => p.screenshot({ path: `${out}${tag}-${name}.png` });
  const setStore = async (n, seen = true) => {
    await p.evaluate(([progress, seenList]) => {
      localStorage.setItem('xuongnoi.puzzle.progress', progress);
      localStorage.setItem('xuongnoi.puzzle.guideSeen', seenList);
    }, [prog(n), JSON.stringify(seen ? [...ids, ...ids.map((i) => 'intro:' + i)] : [])]);
  };

  // fresh title
  await p.goto(base);
  await p.evaluate(() => localStorage.clear());
  await p.goto(base);
  await p.waitForTimeout(2200);
  await shot('1-title');
  await p.waitForTimeout(3300); // a wave
  await shot('1b-title-wave');
  await p.click('.pz-settings-btn');
  await p.waitForTimeout(500);
  await shot('2-settings');
  await p.click('.pz-set-reset');
  await p.waitForTimeout(300);
  await shot('2b-settings-confirm');
  await p.click('.pz-set-confirm .pz-btn.ghost');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);
  // play -> fresh map
  await p.click('.pz-play', { force: true });
  await p.waitForTimeout(900);
  await shot('3-map-fresh');

  // some progress
  await setStore(3);
  await p.goto(base + '#/map');
  await p.reload();
  await p.waitForTimeout(1500);
  await shot('4-map-3done');
  // all done
  await setStore(8);
  await p.reload();
  await p.waitForTimeout(1500);
  await shot('5-map-all');
  await p.goto(base + '#/end');
  await p.waitForTimeout(1300);
  await shot('6-end-a');
  await p.waitForTimeout(1200);
  await shot('6-end-b');
  console.log(tag, 'end hash', await p.evaluate(() => location.hash));

  // level 1 fresh (guide seen) + settings from the HUD gear
  await setStore(0);
  await p.goto(base + '#/level/bot-dau-tien');
  await p.reload();
  await p.waitForTimeout(2500);
  console.log(tag, 'reload hash', await p.evaluate(() => location.hash));
  await shot('7-level');
  await p.click('.pz-hud-gear');
  await p.waitForTimeout(500);
  await shot('8-level-settings');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(200);
  // solve level 1
  await p.locator('.pz-chip', { hasText: 'Đi tới' }).click();
  await p.waitForTimeout(300);
  const nodeId = await p.evaluate(() => document.querySelector('.wc-node[data-kind="go-to"]')?.getAttribute('data-id') ?? '');
  const port = (node, id, dir) => p.locator(`.wc-port[data-node="${node}"][data-port="${id}"][data-dir="${dir}"]`).first();
  for (const [a, b2] of [[['bot', 'self', 'out'], [nodeId, 'self', 'in']], [['flag', 'self', 'out'], [nodeId, 'target', 'in']], [[nodeId, 'moveX', 'out'], ['bot', 'moveX', 'in']]]) {
    await port(...a).click({ force: true });
    await port(...b2).click({ force: true });
    await p.waitForTimeout(150);
  }
  await shot('9-level-solved-wires');
  await p.locator('.pz-btn.run').click({ force: true });
  await p.waitForTimeout(3000);
  await shot('9b-running');
  await p.waitForSelector('.pz-win', { timeout: 20000 });
  await p.waitForTimeout(500);
  await shot('10-win-a');
  await p.waitForTimeout(1500);
  await shot('10-win-b');
  // back to the map: level 2 unlocks with an animation
  await p.locator('.pz-win-row .pz-btn', { hasText: 'Bản đồ' }).click();
  await p.waitForTimeout(500);
  await shot('11-map-unlock-a');
  await p.waitForTimeout(800);
  await shot('11-map-unlock-b');
  await p.waitForTimeout(1200);
  await shot('11-map-unlock-c');
  // Esc / back chain
  await p.click('.pz-map-back');
  await p.waitForTimeout(800);
  console.log(tag, 'after back', await p.evaluate(() => location.hash));
  await p.close();
}
console.log(logs.slice(0, 30).join('\n') || 'no console errors');
await b.close();
