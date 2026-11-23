// L5 (player builds 4 pieces, Đích 2) and L7: empty + built (real tray taps + port taps), a guide step, run frames.
// usage: node l5-l7-short-shots.mjs [runFrames] [pauseMs]   (dev server on 5227)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-l5-l7-short/';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5227';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau'];
const runFrames = Number(process.argv[2] ?? 8);
const pause = Number(process.argv[3] ?? 1500);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];

const LEVELS = {
  l5: {
    hash: '#/level/du-ba-thung',
    prior: ids.slice(0, 4),
    kinds: 4,
    map: { 's-find': 'p1', 's-go': 'p2', 's-next': 'p3', 's-hands': 'p4' },
    wires: [
      ['robot', 'self', 's-find', 'who'], ['slot-1', 'self', 's-find', 'i1'], ['slot-2', 'self', 's-find', 'i2'], ['slot-3', 'self', 's-find', 'i3'],
      ['s-find', 'item', 's-go', 'target'], ['robot', 'self', 's-go', 'self'],
      ['slot-1', 'self', 's-next', 's1'], ['slot-2', 'self', 's-next', 's2'], ['slot-3', 'self', 's-next', 's3'],
      ['s-next', 'slot', 's-go', 'target2'], ['robot', 'self', 's-hands', 'character'], ['s-hands', 'holding', 's-go', 'useTarget2'],
      ['s-go', 'arrived', 's-hands', 'grab'], ['s-go', 'moveX', 'robot', 'moveX'], ['s-go', 'moveY', 'robot', 'moveY'],
    ],
  },
  l7: {
    hash: '#/level/phan-loai-mau',
    prior: ids.slice(0, 6),
    kinds: 7,
    colour: 'p2',
    map: { 's-route': 'p1', 's-eye': 'p2', 's-and': 'p3', 's-hands': 'p4', 's-goto': 'p5', 's-next': 'p6', 's-sum': 'p7' },
    wires: [
      ['robot', 'self', 's-route', 'self'], ['s-route', 'moveX', 's-sum', 'a'], ['s-sum', 'out', 'robot', 'moveX'],
      ['robot', 'self', 's-eye', 'who'], ['s-eye', 'match', 's-and', 'a'], ['s-route', 'atPoint', 's-and', 'b'],
      ['robot', 'self', 's-hands', 'character'], ['s-and', 'out', 's-hands', 'grab'], ['s-hands', 'holding', 's-route', 'stop'],
      ['slot-1', 'self', 's-next', 's1'], ['slot-2', 'self', 's-next', 's2'], ['slot-3', 'self', 's-next', 's3'],
      ['robot', 'self', 's-goto', 'self'], ['s-next', 'slot', 's-goto', 'target'], ['s-hands', 'holding', 's-goto', 'go'],
      ['s-goto', 'moveX', 's-sum', 'b'], ['s-goto', 'arrived', 's-hands', 'drop'],
    ],
  },
};

async function open(viewport, cfg, id, seen) {
  const p = await b.newPage({ viewport, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.text().includes('[physics-watch]') || m.type() === 'error') logs.push(m.text()); });
  await p.goto(`${BASE}/giai-do.html`);
  await p.evaluate(([list, seenList]) => {
    localStorage.clear();
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(seenList));
  }, [cfg.prior, seen ? [...cfg.prior, ...cfg.prior.map((i) => 'intro:' + i), id] : [...cfg.prior, ...cfg.prior.map((i) => 'intro:' + i)]]);
  await p.goto('about:blank');
  await p.goto(`${BASE}/giai-do.html${cfg.hash}`);
  await p.waitForTimeout(3000);
  if (await p.locator('.pz-task-body:visible').count()) await p.locator('button:has-text("Đề bài")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

async function build(p, cfg) {
  const chips = p.locator('.pz-chip');
  for (let i = 0; i < cfg.kinds; i++) { await chips.nth(i).click({ force: true }); await p.waitForTimeout(150); }
  if (cfg.colour) {
    await p.locator(`.pz-param[data-node="${cfg.colour}"]`).first().click({ force: true });
    await p.waitForTimeout(200);
    await p.locator('.pz-step').nth(1).click({ force: true });
    await p.waitForTimeout(200);
    await p.mouse.click(5, 5);
  }
  const real = (id) => cfg.map[id] ?? id;
  const port = (node, pt, dir) => p.locator(`.wc-node[data-id="${real(node)}"] .wc-port[data-port="${pt}"][data-dir="${dir}"]`).first();
  let done = 0;
  for (const [a, ap, c, cp] of cfg.wires) {
    const o = port(a, ap, 'out');
    const t = port(c, cp, 'in');
    if (!(await o.count()) || !(await t.count())) { logs.push(`missing port ${a}.${ap} -> ${c}.${cp}`); continue; }
    await o.click({ force: true }); await p.waitForTimeout(80);
    await t.click({ force: true }); await p.waitForTimeout(80);
    done++;
  }
  logs.push(`wired ${done}/${cfg.wires.length}`);
}

for (const [key, cfg] of Object.entries(LEVELS)) {
  const id = cfg.hash.split('/').pop();
  for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
    const p = await open(vp, cfg, id, true);
    await p.screenshot({ path: `${out}${key}-empty-${name}.png` });
    await build(p, cfg);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}${key}-built-${name}.png` });
    if (name === 'phone') {
      await p.locator('.pz-btn.run').first().click({ force: true });
      const t0 = Date.now();
      for (let i = 0; i < runFrames; i++) {
        const focus = await p.evaluate(() => document.querySelector('[data-focus]')?.dataset.focus);
        if (focus === 'stage') await p.screenshot({ type: 'jpeg', quality: 70, path: `${out}${key}-run-${String(i).padStart(3, '0')}-real${((Date.now() - t0) / 1000).toFixed(1)}.jpg` });
        else logs.push(`${key} frame ${i}: focus ${focus}, skipped`);
        await p.waitForTimeout(pause);
      }
      await p.waitForSelector('.pz-win-card', { timeout: 90000 }).catch(() => logs.push(`${key}: no win card`));
      await p.screenshot({ path: `${out}${key}-win-card-phone.png` });
    }
    await p.close();
  }
  // first visit: mandatory guide, intro then one tray tap
  for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
    const p = await open(vp, cfg, id, false);
    await p.screenshot({ path: `${out}${key}-guide-start-${name}.png` });
    await p.locator('.pz-chip').first().click({ force: true }).catch(() => {});
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}${key}-guide-mid-${name}.png` });
    await p.close();
  }
}
console.log(logs.join('\n') || 'no page errors, no physics-watch warnings');
await b.close();
