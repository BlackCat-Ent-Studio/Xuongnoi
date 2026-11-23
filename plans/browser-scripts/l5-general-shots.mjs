// L5 (robot circuit is visible locked cards): board desktop + phone, guide step, run frames.
// usage: node l5-general-shots.mjs [runFrames] [pauseMs]   (dev server on 5225)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-l5-general/';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5225';
const prior = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua'];
const runFrames = Number(process.argv[2] ?? 8);
const pause = Number(process.argv[3] ?? 2000);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];

async function open(viewport, { seen, closeTask = true } = {}) {
  const p = await b.newPage({ viewport, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.text().includes('[physics-watch]') || m.type() === 'error') logs.push(m.text()); });
  await p.goto(`${BASE}/giai-do.html`);
  await p.evaluate(([list, seenList]) => {
    localStorage.clear();
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(seenList));
  }, [prior, seen ? [...prior, ...prior.map((i) => 'intro:' + i), 'du-ba-thung', 'intro:du-ba-thung'] : [...prior, ...prior.map((i) => 'intro:' + i)]]);
  await p.goto('about:blank');
  await p.goto(`${BASE}/giai-do.html#/level/du-ba-thung`);
  await p.waitForTimeout(3000);
  if (closeTask && (await p.locator('.pz-task-body:visible').count())) await p.locator('button:has-text("Đề bài")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

const W = [
  ['p1', 'count', 'p2', 'a'],
  ['need', 'value', 'p2', 'b'],
  ['p2', 'out', 'end', 'win'],
];

async function build(p) {
  const chips = p.locator('.pz-chip');
  logs.push(`tray chips: ${await chips.count()}`);
  for (let i = 0; i < 2; i++) { await chips.nth(i).click({ force: true }); await p.waitForTimeout(200); }
  let done = 0;
  for (const [a, ap, c, cp] of W) {
    const o = p.locator(`.wc-node[data-id="${a}"] .wc-port[data-port="${ap}"][data-dir="out"]`).first();
    const t = p.locator(`.wc-node[data-id="${c}"] .wc-port[data-port="${cp}"][data-dir="in"]`).first();
    if (!(await o.count()) || !(await t.count())) { logs.push(`missing port ${a}.${ap} -> ${c}.${cp}`); continue; }
    await o.click({ force: true }); await p.waitForTimeout(100);
    await t.click({ force: true }); await p.waitForTimeout(100);
    done++;
  }
  logs.push(`wired ${done}/${W.length}`);
}

for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
  const p = await open(vp, { seen: true });
  await p.screenshot({ path: `${out}board-${name}.png` });
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
    await p.waitForSelector('.pz-win-card', { timeout: 120000 }).catch(() => logs.push('no win card'));
    await p.screenshot({ path: `${out}win-card-phone.png` });
  }
  await p.close();
}

for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
  const p = await open(vp, { seen: false });
  await p.screenshot({ path: `${out}guide-start-${name}.png` });
  await p.locator('.pz-chip').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(600);
  await p.screenshot({ path: `${out}guide-mid-${name}.png` });
  await p.close();
}
console.log(logs.join('\n') || 'no page errors, no physics-watch warnings');
await b.close();
