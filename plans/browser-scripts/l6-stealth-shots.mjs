// L6 "Lẻn qua mắt lính gác": empty board, hint step, solution built through the real UI (tray taps + port taps), run frames, win, a decoy loss.
// usage: node l6-stealth-shots.mjs [runFrames] [pauseMs]   (dev server on 5226)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-l6-stealth/';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5226';
const prior = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung'];
const runFrames = Number(process.argv[2] ?? 24);
const pause = Number(process.argv[3] ?? 800);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];

async function open(viewport, hash = '#/level/ne-linh-gac', seen = true) {
  const p = await b.newPage({ viewport, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.text().includes('[physics-watch]') || m.type() === 'error') logs.push(m.text()); });
  await p.goto(`${BASE}/giai-do.html`);
  await p.evaluate(([list, seenGuide]) => {
    localStorage.clear();
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify([...list, ...list.map((i) => 'intro:' + i), ...(seenGuide ? ['ne-linh-gac'] : [])]));
  }, [prior, seen]);
  await p.goto('about:blank');
  await p.goto(`${BASE}/giai-do.html${hash}`);
  await p.waitForTimeout(3000);
  if (await p.locator('.pz-task-body:visible').count()) await p.locator('button:has-text("Đề bài")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

// tray order: route-follow, sight-forecast, compare, math, const, distance, not   (placed ids p1.. in click order)
const BRAIN = [['hero', 'self', 'p1', 'self'], ['p1', 'moveX', 'hero', 'moveX'], ['p1', 'moveY', 'hero', 'moveY'], ['guard', 'self', 'p2', 'viewer'], ['hero', 'self', 'p2', 'target']];
const ANSWERS = {
  solution: {
    chips: [0, 1, 2, 3, 4],
    wires: [...BRAIN, ['p2', 'window', 'p3', 'a'], ['p2', 'need', 'p4', 'a'], ['p5', 'value', 'p4', 'b'], ['p4', 'out', 'p3', 'b'], ['p3', 'out', 'p1', 'go']],
  },
  decoy: {
    chips: [0, 1, 5, 6],
    wires: [...BRAIN, ['hero', 'self', 'p3', 'a'], ['guard', 'self', 'p3', 'b'], ['p3', 'within', 'p4', 'in'], ['p4', 'out', 'p1', 'go']],
  },
};

async function build(p, which) {
  const { chips, wires } = ANSWERS[which];
  const tray = p.locator('.pz-chip');
  for (const c of chips) { await tray.nth(c).click({ force: true }); await p.waitForTimeout(150); }
  await p.mouse.click(5, 5);
  const port = (node, port, dir) => p.locator(`.wc-node[data-id="${node}"] .wc-port[data-port="${port}"][data-dir="${dir}"]`).first();
  let done = 0;
  for (const [a, ap, c, cp] of wires) {
    const o = port(a, ap, 'out');
    const t = port(c, cp, 'in');
    if (!(await o.count()) || !(await t.count())) { logs.push(`missing port ${a}.${ap} -> ${c}.${cp}`); continue; }
    await o.click({ force: true }); await p.waitForTimeout(80);
    await t.click({ force: true }); await p.waitForTimeout(80);
    done++;
  }
  logs.push(`${which}: wired ${done}/${wires.length}`);
}

async function runAndShoot(p, name, frames) {
  await p.locator('.pz-btn.run').first().click({ force: true });
  await p.waitForTimeout(800);
  for (let k = 0; k < 5; k++) { await p.locator('.pz-cam button').nth(1).click({ force: true, timeout: 5000 }).catch(() => logs.push('no zoom-out button')); await p.waitForTimeout(150); }
  const t0 = Date.now();
  for (let i = 0; i < frames; i++) {
    const done = await p.locator('.pz-win-card').count();
    const focus = await p.evaluate(() => document.querySelector('[data-focus]')?.dataset.focus);
    if (focus === 'stage' || focus === undefined) {
      const file = `${out}${name}-${String(i).padStart(3, '0')}-real${((Date.now() - t0) / 1000).toFixed(1)}.jpg`;
      await p.screenshot({ timeout: 90000, type: 'jpeg', quality: 60, path: file }).catch((e) => logs.push('shot failed: ' + String(e.message).split('\n')[0]));
    }
    if (done) break;
    await p.waitForTimeout(pause);
  }
}

for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
  const p = await open(vp);
  await p.screenshot({ path: `${out}board-${name}.png` });
  await p.close();
  const g = await open(vp, '#/level/ne-linh-gac', false);
  await g.screenshot({ path: `${out}guide-start-${name}.png` });
  await g.locator('.pz-chip').first().click({ force: true }).catch(() => {});
  await g.waitForTimeout(800);
  await g.screenshot({ path: `${out}guide-mid-${name}.png` });
  await g.close();
}

// the answer built through the real UI, then run (desktop: stage and board together)
{
  const p = await open({ width: 1280, height: 720 });
  await build(p, 'solution');
  await p.waitForTimeout(400);
  await p.screenshot({ path: `${out}built-desktop.png` });
  await runAndShoot(p, 'win-desktop', runFrames);
  await p.waitForSelector('.pz-win-card', { timeout: 90000 }).catch(() => logs.push('no win card (desktop)'));
  await p.screenshot({ path: `${out}win-card-desktop.png` });
  await p.close();
}
{
  const p = await open({ width: 844, height: 390 });
  await build(p, 'solution');
  await p.screenshot({ path: `${out}built-phone.png` });
  await runAndShoot(p, 'win-phone', runFrames);
  await p.waitForSelector('.pz-win-card', { timeout: 90000 }).catch(() => logs.push('no win card (phone)'));
  await p.screenshot({ path: `${out}win-card-phone.png` });
  await p.close();
}
// a decoy loss (the old "Đo khoảng cách" answer)
{
  const p = await open({ width: 1280, height: 720 });
  await build(p, 'decoy');
  await p.screenshot({ path: `${out}decoy-built-desktop.png` });
  await runAndShoot(p, 'decoy', 14);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${out}decoy-lose-desktop.png` });
  await p.close();
}
console.log(logs.join('\n') || 'no page errors, no physics-watch warnings');
await b.close();
