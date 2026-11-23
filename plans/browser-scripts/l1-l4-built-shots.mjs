// L1-L4 (player builds the circuit): per level empty board, built board (through real tray taps + port taps), one guide step, a run frame; desktop + phone.
// usage: node l1-l4-built-shots.mjs [levelNumber|all]   (dev server on 5228)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-l1-l4/';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5228';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua'];
const only = process.argv[2] ?? 'all';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];

// tray taps (chip index, times) in placement order -> placed ids p1.. ; wires use placed ids directly
const LEVELS = {
  1: {
    id: 'bot-dau-tien', taps: [[0, 1]],
    wires: [['bot', 'self', 'p1', 'self'], ['flag', 'self', 'p1', 'target'], ['p1', 'moveX', 'bot', 'moveX']],
  },
  2: {
    id: 'cua-kho', taps: [[0, 1], [1, 1], [2, 1]],
    wires: [['bot', 'self', 'p1', 'self'], ['flag', 'self', 'p1', 'target'], ['p1', 'moveX', 'bot', 'moveX'], ['bot', 'self', 'p2', 'a'], ['button', 'self', 'p2', 'b'], ['p2', 'touching', 'p3', 'set'], ['p3', 'on', 'door', 'hiddenWhile']],
  },
  3: {
    id: 'nhat-sao', taps: [[0, 1], [1, 1]], setTarget: 'p2',
    wires: [['cat', 'self', 'p1', 'self'], ['p1', 'moveX', 'cat', 'moveX'], ['p1', 'reached', 'p2', 'up'], ['p2', 'reached', 'gate', 'hiddenWhile']],
  },
  4: {
    id: 'hai-nut-mot-cua', taps: [[0, 2], [1, 1], [2, 1]],
    // p1 = go-to for A, p2 = go-to for B, p3 = touch, p4 = or
    wires: [['bot-a', 'self', 'p1', 'self'], ['flag', 'self', 'p1', 'target'], ['p1', 'moveX', 'bot-a', 'moveX'], ['bot-b', 'self', 'p2', 'self'], ['button-b', 'self', 'p2', 'target'], ['p2', 'moveX', 'bot-b', 'moveX'], ['p2', 'arrived', 'p1', 'go'], ['bot-a', 'self', 'p3', 'a'], ['button-a', 'self', 'p3', 'b'], ['p3', 'touching', 'p4', 'a'], ['p2', 'arrived', 'p4', 'b'], ['p4', 'out', 'door', 'hiddenWhile']],
  },
};

async function open(viewport, lvl, { seen }) {
  const p = await b.newPage({ viewport, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.text().includes('[physics-watch]') || m.type() === 'error') logs.push(m.text()); });
  await p.goto(`${BASE}/giai-do.html`);
  await p.evaluate(([list, seenList]) => {
    localStorage.clear();
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(seenList));
  }, [ids, seen ? [...ids, ...ids.map((i) => 'intro:' + i)] : []]);
  await p.goto('about:blank');
  await p.goto(`${BASE}/giai-do.html#/level/${lvl.id}`);
  await p.waitForTimeout(3000);
  if (await p.locator('.pz-task-body:visible').count()) await p.locator('button:has-text("Đề bài")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

async function build(p, lvl) {
  const chips = p.locator('.pz-chip');
  for (const [idx, times] of lvl.taps) for (let k = 0; k < times; k++) { await chips.nth(idx).click({ force: true }); await p.waitForTimeout(150); }
  const port = (node, port, dir) => p.locator(`.wc-node[data-id="${node}"] .wc-port[data-port="${port}"][data-dir="${dir}"]`).first();
  let done = 0;
  for (const [a, ap, c, cp] of lvl.wires) {
    const o = port(a, ap, 'out');
    const t = port(c, cp, 'in');
    if (!(await o.count()) || !(await t.count())) { logs.push(`${lvl.id}: missing port ${a}.${ap} -> ${c}.${cp}`); continue; }
    await o.click({ force: true }); await p.waitForTimeout(80);
    await t.click({ force: true }); await p.waitForTimeout(80);
    done++;
  }
  if (lvl.setTarget) {
    await p.locator(`.pz-param[data-node="${lvl.setTarget}"]`).first().click({ force: true });
    await p.waitForTimeout(200);
    for (let k = 0; k < 2; k++) { await p.locator('.pz-step').nth(0).click({ force: true }); await p.waitForTimeout(150); }
    await p.locator(`.pz-param[data-node="${lvl.setTarget}"] .pz-param-val`).first().textContent().then((t) => logs.push(`L${lvl.id} target value: ${t}`));
    await p.mouse.click(5, 5);
  }
  const drawn = await p.locator('path.wc-wire:not(.pz-wire-locked)').count();
  logs.push(`${lvl.id}: clicked ${done}/${lvl.wires.length}, wires drawn (player): ${drawn}`);
}

for (const [n, lvl] of Object.entries(LEVELS)) {
  if (only !== 'all' && only !== n) continue;
  for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
    const p = await open(vp, lvl, { seen: true });
    await p.screenshot({ path: `${out}l${n}-empty-${name}.png` });
    await build(p, lvl);
    await p.waitForTimeout(500);
    await p.screenshot({ path: `${out}l${n}-built-${name}.png` });
    if (name === 'phone') {
      await p.locator('.pz-btn.run').first().click({ force: true });
      const t0 = Date.now();
      for (let i = 0; i < 4; i++) {
        await p.waitForTimeout(1200);
        const focus = await p.evaluate(() => document.querySelector('[data-focus]')?.dataset.focus);
        if (focus === 'stage') await p.screenshot({ type: 'jpeg', quality: 70, path: `${out}l${n}-run-${i}-real${((Date.now() - t0) / 1000).toFixed(1)}.jpg` });
        else logs.push(`L${n} frame ${i}: focus ${focus}, skipped`);
      }
      await p.waitForSelector('.pz-win-card', { timeout: 60000 }).then(() => logs.push(`L${n}: win card shown`)).catch(() => logs.push(`L${n}: NO win card`));
      await p.screenshot({ path: `${out}l${n}-win-card-phone.png` });
    }
    await p.close();
  }
  // first visit: the guide opens by itself (levels 1, 2, 4) or one "?" step (level 3)
  for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
    const p = await open(vp, lvl, { seen: false });
    await p.screenshot({ path: `${out}l${n}-guide-start-${name}.png` });
    await p.locator('.pz-chip').first().click({ force: true }).catch(() => {});
    await p.waitForTimeout(600);
    await p.screenshot({ path: `${out}l${n}-guide-mid-${name}.png` });
    await p.close();
  }
}
console.log(logs.join('\n') || 'no page errors, no physics-watch warnings');
await b.close();
