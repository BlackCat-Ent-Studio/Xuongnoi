// Phone/desktop layout check: empty board, first + mid guide step per level, L7 solution wired. Asserts tray single row + bubble clear of spotlight.
// usage: node puzzle-phone-shots.mjs   (dev server on 5224)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-puzzle-phone/';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5224';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau'];
const VPS = [['phone', { width: 844, height: 390 }], ['desktop', { width: 1280, height: 720 }]];
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
let fails = 0;
const check = (ok, msg) => { if (!ok) { fails++; logs.push('FAIL ' + msg); } else logs.push('ok   ' + msg); };

async function open(viewport, idx, seen) {
  const id = ids[idx];
  const prior = ids.slice(0, idx);
  const p = await b.newPage({ viewport, deviceScaleFactor: 1 });
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  await p.goto(`${BASE}/giai-do.html`);
  await p.evaluate(([list, seenList]) => {
    localStorage.clear();
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(seenList));
  }, [prior, [...prior, ...ids.map((i) => 'intro:' + i), ...(seen ? [id] : [])]]);
  await p.goto('about:blank');
  await p.goto(`${BASE}/giai-do.html#/level/${id}`);
  await p.waitForTimeout(2500);
  if (await p.locator('.pz-task-body:visible').count()) await p.locator('button:has-text("Đề bài")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

async function checkTray(p, tag) {
  const r = await p.evaluate(() => {
    const chips = [...document.querySelectorAll('.pz-chip')];
    const tray = document.querySelector('.pz-tray');
    const tops = new Set(chips.map((c) => c.offsetTop));
    return { n: chips.length, rows: tops.size, ov: tray.scrollWidth > tray.clientWidth };
  });
  check(r.n === 0 || r.rows === 1, `${tag} tray single row (${r.n} chips, overflow-scroll ${r.ov})`);
}

async function checkBubble(p, tag) {
  // the ring slides for 0.35s (slow under software GL): wait until it rests
  let prev = '';
  for (let t = 0; t < 20; t++) {
    const cur = await p.evaluate(() => { const s = document.querySelector('.pz-spot'); return s ? JSON.stringify(s.getBoundingClientRect()) : ''; });
    if (cur === prev) break;
    prev = cur;
    await p.waitForTimeout(250);
  }
  const r = await p.evaluate(() => {
    const g = document.querySelector('.pz-guide');
    if (!g || !g.classList.contains('on')) return { skip: 'guide off' };
    const m = document.querySelector('.pz-mascot').getBoundingClientRect();
    const sp = document.querySelector('.pz-spot');
    const S = document.querySelector('.pz-screen').getBoundingClientRect();
    const inside = m.left >= S.left - 1 && m.top >= S.top - 1 && m.right <= S.right + 1 && m.bottom <= S.bottom + 1;
    if (g.classList.contains('no-target') || getComputedStyle(sp).display === 'none') return { skip: 'no target', inside };
    const s = sp.getBoundingClientRect();
    const hit = m.left < s.right && m.right > s.left && m.top < s.bottom && m.bottom > s.top;
    return { hit, inside };
  });
  if (r.skip) { check(r.inside !== false, `${tag} bubble inside screen (${r.skip})`); return; }
  check(!r.hit && r.inside, `${tag} bubble clear of spotlight, inside screen`);
}

for (const [name, vp] of VPS) {
  for (let i = 0; i < ids.length; i++) {
    const tag = `L${i + 1}-${name}`;
    let p = await open(vp, i, true);
    await p.screenshot({ path: `${out}${tag}-empty.png` });
    await checkTray(p, tag + ' empty');
    await p.close();
    p = await open(vp, i, false);
    await p.screenshot({ path: `${out}${tag}-guide-start.png` });
    await checkTray(p, tag + ' guide-start');
    await checkBubble(p, tag + ' guide-start');
    for (let k = 0; k < 6; k++) {
      const nxt = p.locator('.pz-next:visible');
      if (await nxt.count()) await nxt.first().click({ force: true });
      else await p.locator('.pz-chip:not(:disabled)').first().click({ force: true }).catch(() => {});
      await p.waitForTimeout(800);
      await checkBubble(p, `${tag} step${k + 1}`);
      if (k === 1 && (i === 0 || i === 6)) await p.screenshot({ path: `${out}${tag}-guide-mid.png` });
      if (k === 3) await p.screenshot({ path: `${out}${tag}-guide-step4.png` });
    }
    await p.close();
  }
}

// L7 solution wired
const SOL = { kinds: 7, map: { 's-route': 'p1', 's-eye': 'p2', 's-and': 'p3', 's-hands': 'p4', 's-goto': 'p5', 's-next': 'p6', 's-sum': 'p7' } };
const W = [
  ['robot', 'self', 's-route', 'self'], ['s-route', 'moveX', 's-sum', 'a'], ['s-sum', 'out', 'robot', 'moveX'],
  ['robot', 'self', 's-eye', 'who'], ['s-eye', 'match', 's-and', 'a'], ['s-route', 'atPoint', 's-and', 'b'],
  ['robot', 'self', 's-hands', 'character'], ['s-and', 'out', 's-hands', 'grab'], ['s-hands', 'holding', 's-route', 'stop'],
  ['slot-1', 'self', 's-next', 's1'], ['slot-2', 'self', 's-next', 's2'], ['slot-3', 'self', 's-next', 's3'],
  ['robot', 'self', 's-goto', 'self'], ['s-next', 'slot', 's-goto', 'target'], ['s-hands', 'holding', 's-goto', 'go'],
  ['s-goto', 'moveX', 's-sum', 'b'], ['s-goto', 'arrived', 's-hands', 'drop'],
];
for (const [name, vp] of VPS) {
  const p = await open(vp, 6, true);
  const chips = p.locator('.pz-chip');
  for (let i = 0; i < SOL.kinds; i++) { await chips.nth(i).click({ force: true }); await p.waitForTimeout(150); }
  await p.locator('.pz-param[data-node="p2"]').first().click({ force: true });
  await p.waitForTimeout(200);
  await p.locator('.pz-step').nth(1).click({ force: true });
  await p.waitForTimeout(200);
  await p.mouse.click(5, 5);
  const real = (id) => SOL.map[id] ?? id;
  const port = (n, pt, dir) => p.locator(`.wc-node[data-id="${real(n)}"] .wc-port[data-port="${pt}"][data-dir="${dir}"]`).first();
  let done = 0;
  for (const [a, ap, c, cp] of W) {
    const o = port(a, ap, 'out'); const t = port(c, cp, 'in');
    if (!(await o.count()) || !(await t.count())) { logs.push(`missing port ${a}.${ap} -> ${c}.${cp}`); continue; }
    await o.click({ force: true }); await p.waitForTimeout(80);
    await t.click({ force: true }); await p.waitForTimeout(80);
    done++;
  }
  logs.push(`L7-${name} wired ${done}/${W.length}`);
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${out}L7-${name}-built.png` });
  await checkTray(p, `L7-${name} built`);
  await p.close();
}
console.log(logs.join('\n'));
console.log(fails ? `${fails} FAILURES` : 'ALL CHECKS PASSED');
await b.close();
process.exit(fails ? 1 : 0);
