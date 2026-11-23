// L7 (player builds the whole circuit): empty board, mid-guide, solution built through the real UI (tray taps + port taps), run frames, map, ending.
// usage: node l7-self-build-shots.mjs [runFrames] [pauseMs]   (dev server on 5223)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-l7-self/';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5223';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau', 'xuong-tong-hop'];
const prior = ids.slice(0, 6);
const runFrames = Number(process.argv[2] ?? 8);
const pause = Number(process.argv[3] ?? 1500);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];

async function open(viewport, { seen, progress = prior, hash = '#/level/phan-loai-mau', closeTask = true } = {}) {
  const p = await b.newPage({ viewport, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.text().includes('[physics-watch]') || m.type() === 'error') logs.push(m.text()); });
  await p.goto(`${BASE}/giai-do.html`);
  await p.evaluate(([list, seenList]) => {
    localStorage.clear();
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(seenList));
  }, [progress, seen ? [...prior, ...prior.map((i) => 'intro:' + i), 'phan-loai-mau'] : [...prior, ...prior.map((i) => 'intro:' + i)]]);
  await p.goto('about:blank');
  await p.goto(`${BASE}/giai-do.html${hash}`);
  await p.waitForTimeout(3000);
  if (closeTask && (await p.locator('.pz-task-body:visible').count())) await p.locator('button:has-text("Đề bài")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

const SOL = {
  kinds: ['route-follow', 'color-sensor', 'and', 'carry', 'go-to', 'next-free-slot', 'math'],
  // solution ids -> placed ids (p1..p7 in tray order)
  map: { 's-route': 'p1', 's-eye': 'p2', 's-and': 'p3', 's-hands': 'p4', 's-goto': 'p5', 's-next': 'p6', 's-sum': 'p7' },
};
const W = [
  ['robot', 'self', 's-route', 'self'], ['s-route', 'moveX', 's-sum', 'a'], ['s-sum', 'out', 'robot', 'moveX'],
  ['robot', 'self', 's-eye', 'who'], ['s-eye', 'match', 's-and', 'a'], ['s-route', 'atPoint', 's-and', 'b'],
  ['robot', 'self', 's-hands', 'character'], ['s-and', 'out', 's-hands', 'grab'], ['s-hands', 'holding', 's-route', 'stop'],
  ['slot-1', 'self', 's-next', 's1'], ['slot-2', 'self', 's-next', 's2'], ['slot-3', 'self', 's-next', 's3'],
  ['robot', 'self', 's-goto', 'self'], ['s-next', 'slot', 's-goto', 'target'], ['s-hands', 'holding', 's-goto', 'go'],
  ['s-goto', 'moveX', 's-sum', 'b'], ['s-goto', 'arrived', 's-hands', 'drop'],
];

async function build(p) {
  const chips = p.locator('.pz-chip');
  for (let i = 0; i < SOL.kinds.length; i++) { await chips.nth(i).click({ force: true }); await p.waitForTimeout(150); }
  // the colour sensor starts on red (1): set it to blue (2) like the guide asks
  await p.locator('.pz-param[data-node="p2"]').first().click({ force: true });
  await p.waitForTimeout(200);
  await p.locator('.pz-step').nth(1).click({ force: true });
  await p.waitForTimeout(200);
  await p.locator('.pz-param[data-node="p2"] .pz-param-val').first().textContent().then((t) => logs.push(`colour value: ${t}`));
  await p.mouse.click(5, 5);
  const real = (id) => SOL.map[id] ?? id;
  const port = (node, port, dir) => p.locator(`.wc-node[data-id="${real(node)}"] .wc-port[data-port="${port}"][data-dir="${dir}"]`).first();
  let done = 0;
  for (const [a, ap, c, cp] of W) {
    const o = port(a, ap, 'out');
    const t = port(c, cp, 'in');
    if (!(await o.count()) || !(await t.count())) { logs.push(`missing port ${a}.${ap} -> ${c}.${cp}`); continue; }
    await o.click({ force: true }); await p.waitForTimeout(80);
    await t.click({ force: true }); await p.waitForTimeout(80);
    done++;
  }
  logs.push(`wired ${done}/${W.length}`);
}

for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
  const p = await open(vp, { seen: true });
  await p.screenshot({ path: `${out}empty-${name}.png` });
  await build(p);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}built-${name}.png` });
  if (name === 'phone') {
    await p.locator('.pz-btn.run').first().click({ force: true });
    const t0 = Date.now();
    for (let i = 0; i < runFrames; i++) {
      const focus = await p.evaluate(() => document.querySelector('[data-focus]')?.dataset.focus);
      if (focus === 'stage') await p.screenshot({ type: 'jpeg', quality: 70, path: `${out}run-${String(i).padStart(3, '0')}-real${((Date.now() - t0) / 1000).toFixed(1)}.jpg` });
      else logs.push(`frame ${i}: focus ${focus}, skipped`);
      await p.waitForTimeout(pause);
    }
    await p.waitForSelector('.pz-win-card', { timeout: 60000 }).catch(() => logs.push('no win card'));
    await p.screenshot({ path: `${out}win-card-phone.png` });
    await p.locator('.pz-win-card .pz-btn.run').first().click({ force: true }).catch(() => logs.push('no next button'));
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `${out}ending-phone.png` });
    logs.push('url after win: ' + p.url());
  }
  await p.close();
}

// mid-guide: first visit, then one tray tap
for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
  const p = await open(vp, { seen: false });
  await p.screenshot({ path: `${out}guide-start-${name}.png` });
  await p.locator('.pz-chip').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}guide-mid-${name}.png` });
  await p.close();
}

// map with seven levels (all solved; the saved game also lists the retired level 8)
{
  const p = await open({ width: 844, height: 390 }, { seen: true, progress: ids, hash: '#/map' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}map-7-levels.png` });
  await p.close();
}
console.log(logs.join('\n') || 'no page errors, no physics-watch warnings');
await b.close();
