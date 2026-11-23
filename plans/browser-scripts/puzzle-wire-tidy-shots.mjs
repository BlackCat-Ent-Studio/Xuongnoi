// Puzzle board "tidy wires": levels 5 and 7 with the solution wired through the real UI.
// before / after "Sắp xếp gọn", focus, knot (double-click, drag, Ctrl+R), "Gom dây", guide mid-step, run frame. Crossing counts are measured on the DOM.
// usage: node puzzle-wire-tidy-shots.mjs [levels=5,7]   (dev server on 5231)
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
const out = 'D:/workspace/GameBuilder/plans/reports/shots-puzzle-wire-tidy/';
fs.mkdirSync(out, { recursive: true });
const BASE = 'http://localhost:5231';
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau', 'xuong-tong-hop'];
const levelsToDo = (process.argv[2] ?? '5,7').split(',').map(Number);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const counts = {};

const LEVELS = {
  5: {
    id: 'du-ba-thung',
    prior: ids.slice(0, 4),
    kinds: 5, // tray chips 0..4 -> p1..p5
    map: { 's-find': 'p1', 's-go': 'p2', 's-next': 'p3', 's-hands': 'p4', 's-start': 'p5' },
    wires: [
      ['robot', 'self', 's-find', 'who'], ['slot-1', 'self', 's-find', 'i1'], ['slot-2', 'self', 's-find', 'i2'], ['slot-3', 'self', 's-find', 'i3'],
      ['s-find', 'item', 's-go', 'target'], ['robot', 'self', 's-go', 'self'], ['slot-1', 'self', 's-next', 's1'], ['slot-2', 'self', 's-next', 's2'], ['slot-3', 'self', 's-next', 's3'],
      ['s-next', 'slot', 's-go', 'target2'], ['robot', 'self', 's-hands', 'character'], ['s-hands', 'holding', 's-go', 'useTarget2'], ['s-go', 'arrivedAt1', 's-hands', 'grab'],
      ['s-go', 'arrivedAt2', 's-hands', 'drop'], ['s-start', 'started', 's-go', 'go'],
      ['s-go', 'moveX', 'robot', 'moveX'], ['s-go', 'moveY', 'robot', 'moveY'],
    ],
    focusCard: 's-go',
  },
  7: {
    id: 'phan-loai-mau',
    prior: ids.slice(0, 6),
    kinds: 11,
    colour: 'p2',
    map: { 's-route': 'p1', 's-eye': 'p2', 's-and': 'p3', 's-hands': 'p4', 's-goto': 'p5', 's-next': 'p6', 's-sum': 'p7', 's-start': 'p8', 's-timer': 'p9', 's-cmp': 'p10', 's-or': 'p11' },
    wires: [
      ['robot', 'self', 's-route', 'self'], ['s-route', 'moveX', 's-sum', 'a'], ['s-sum', 'out', 'robot', 'moveX'],
      ['robot', 'self', 's-eye', 'who'], ['s-eye', 'match', 's-and', 'a'], ['s-route', 'halted', 's-and', 'b'],
      ['robot', 'self', 's-hands', 'character'], ['s-and', 'out', 's-hands', 'grab'], ['s-or', 'out', 's-route', 'stop'],
      ['slot-1', 'self', 's-next', 's1'], ['slot-2', 'self', 's-next', 's2'], ['slot-3', 'self', 's-next', 's3'],
      ['robot', 'self', 's-goto', 'self'], ['s-next', 'slot', 's-goto', 'target'], ['s-hands', 'holding', 's-goto', 'go'],
      ['s-goto', 'moveX', 's-sum', 'b'], ['s-goto', 'arrived', 's-hands', 'drop'],
      ['s-start', 'started', 's-route', 'on'], ['s-route', 'reached', 's-timer', 'reset'], ['s-start', 'started', 's-timer', 'run'],
      ['s-timer', 'left', 's-cmp', 'a'], ['s-cmp', 'out', 's-or', 'a'], ['s-hands', 'holding', 's-or', 'b'],
    ],
    focusCard: 's-and',
  },
};

async function open(lv, viewport, { seen }) {
  const cfg = LEVELS[lv];
  const p = await b.newPage({ viewport, deviceScaleFactor: 1 });
  const shot = p.screenshot.bind(p);
  p.screenshot = async (o) => { for (let i = 0; ; i++) { try { return await shot({ timeout: 60000, ...o }); } catch (e) { if (i >= 2) throw e; logs.push('screenshot retry ' + (o?.path ?? '')); } } };
  p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  p.on('console', (m) => { if (m.text().includes('[physics-watch]') || m.type() === 'error') logs.push(m.text()); });
  await p.goto(`${BASE}/giai-do.html`);
  await p.evaluate(([list, seenList]) => {
    localStorage.clear();
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(seenList));
  }, [cfg.prior, seen ? [...cfg.prior, ...cfg.prior.map((i) => 'intro:' + i), cfg.id] : [...cfg.prior, ...cfg.prior.map((i) => 'intro:' + i)]]);
  await p.goto('about:blank');
  await p.goto(`${BASE}/giai-do.html#/level/${cfg.id}`);
  await p.waitForTimeout(3000);
  if (await p.locator('.pz-task-body:visible').count()) await p.locator('button:has-text("Đề bài")').first().click({ force: true }).catch(() => {});
  await p.waitForTimeout(400);
  return p;
}

/** Clicks a spot of the board that has nothing on it (a click on a wire would take the wire off). */
async function clickEmpty(p) {
  const pt = await p.evaluate(() => {
    const board = document.querySelector('.pz-board');
    const r = board.getBoundingClientRect();
    for (let y = r.top + 90; y < r.bottom - 90; y += 12) for (let x = r.left + 12; x < r.right - 12; x += 12) if (document.elementFromPoint(x, y) === board) return { x, y };
    return null;
  });
  if (pt) await p.mouse.click(pt.x, pt.y); else { logs.push('no empty spot to click'); const v = p.viewportSize(); await p.mouse.click(Math.round(v.width * 0.03), Math.round(v.height * 0.5)); }
}

async function build(p, lv) {
  const cfg = LEVELS[lv];
  const chips = p.locator('.pz-chip');
  for (let i = 0; i < cfg.kinds; i++) { await chips.nth(i).click({ force: true }); await p.waitForTimeout(150); }
  if (cfg.colour) {
    await p.locator(`.pz-param[data-node="${cfg.colour}"]`).first().click({ force: true });
    await p.waitForTimeout(200);
    await p.locator('.pz-step').nth(1).click({ force: true });
    await p.waitForTimeout(200);
  }
  await clickEmpty(p);
  const real = (id) => cfg.map[id] ?? id;
  const port = (node, port, dir) => p.locator(`.wc-node[data-id="${real(node)}"] .wc-port[data-port="${port}"][data-dir="${dir}"]`).first();
  let done = 0;
  for (const [a, ap, c, cp] of cfg.wires) {
    const o = port(a, ap, 'out'); const t = port(c, cp, 'in');
    if (!(await o.count()) || !(await t.count())) { logs.push(`L${lv} missing port ${a}.${ap} -> ${c}.${cp}`); continue; }
    await o.click({ force: true }); await p.waitForTimeout(70);
    await t.click({ force: true }); await p.waitForTimeout(70);
    done++;
  }
  logs.push(`L${lv} wired ${done}/${cfg.wires.length}`);
  await p.waitForTimeout(500);
}

/** Crossing numbers measured on the drawn wires and cards: wire x wire (wires sharing a pin skipped), wire x card, plus cards overlapping each other. */
async function measure(p) {
  return p.evaluate(() => {
    const world = document.querySelector('.wc-world').getBoundingClientRect();
    const cards = [...document.querySelectorAll('.wc-node')].map((n) => { const r = n.getBoundingClientRect(); return { id: n.dataset.id, x: r.left - world.left, y: r.top - world.top, w: r.width, h: r.height }; });
    const wires = [...document.querySelectorAll('.pz-wire .wc-wire')].map((path) => {
      const len = path.getTotalLength(); const n = Math.max(2, Math.ceil(len / 4)); const pts = [];
      for (let i = 0; i <= n; i++) { const q = path.getPointAtLength((len * i) / n); pts.push({ x: q.x, y: q.y }); }
      return { pts, id: path.parentElement.querySelector('.wc-wire-hit')?.dataset.wire };
    });
    const cross = (p1, p2, q1, q2) => { const rx = p2.x - p1.x, ry = p2.y - p1.y, sx = q2.x - q1.x, sy = q2.y - q1.y, d = rx * sy - ry * sx; if (Math.abs(d) < 1e-9) return false; const t = ((q1.x - p1.x) * sy - (q1.y - p1.y) * sx) / d, u = ((q1.x - p1.x) * ry - (q1.y - p1.y) * rx) / d; return t >= 0 && t < 1 && u >= 0 && u < 1; };
    const same = (a, b) => Math.hypot(a.x - b.x, a.y - b.y) < 1.5;
    let ww = 0, wc = 0; const through = [];
    for (let i = 0; i < wires.length; i++) {
      const A = wires[i];
      for (let j = i + 1; j < wires.length; j++) {
        const B = wires[j];
        if (same(A.pts[0], B.pts[0]) || same(A.pts[A.pts.length - 1], B.pts[B.pts.length - 1])) continue;
        for (let a = 1; a < A.pts.length; a++) for (let c = 1; c < B.pts.length; c++) if (cross(A.pts[a - 1], A.pts[a], B.pts[c - 1], B.pts[c])) ww++;
      }
      for (const c of cards) if (A.pts.some((q) => q.x > c.x + 2 && q.x < c.x + c.w - 2 && q.y > c.y + 2 && q.y < c.y + c.h - 2)) { wc++; through.push(`${A.id}->${c.id}`); }
    }
    let overlap = 0;
    for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) { const a = cards[i], b = cards[j]; if (a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y) overlap++; }
    const sh = document.querySelector('.pz-board').getBoundingClientRect();
    return { wires: wires.length, ww, wc, total: ww + wc, through, overlap, cards: cards.length, knots: document.querySelectorAll('.pz-knot').length, shared: document.querySelectorAll('.pz-knot.shared').length };
  });
}

/** A point on a wire (client px) near t of its length where the wire itself is what a click would hit. */
async function wirePoint(p, id, t = 0.5) {
  return p.evaluate(([wid, tt]) => {
    const hit = document.querySelector(`.wc-wire-hit[data-wire="${wid}"]`);
    const path = hit.parentElement.querySelector('.wc-wire');
    const world = document.querySelector('.wc-world').getBoundingClientRect();
    const len = path.getTotalLength();
    for (const d of [0, 0.05, -0.05, 0.1, -0.1, 0.15, -0.15, 0.2, -0.2, 0.25, -0.25, 0.3, -0.3]) {
      const q = path.getPointAtLength(len * Math.min(0.95, Math.max(0.05, tt + d)));
      const x = world.left + q.x, y = world.top + q.y;
      if (document.elementFromPoint(x, y) === hit) return { x, y };
    }
    return null;
  }, [id, t]);
}

for (const lv of levelsToDo) {
  for (const [name, vp] of [['desktop', { width: 1280, height: 720 }], ['phone', { width: 844, height: 390 }]]) {
    const tag = `l${lv}-${name}`;
    const p = await open(lv, vp, { seen: true });
    await build(p, lv);
    const c = (counts[tag] = {});
    c.before = await measure(p);
    await p.screenshot({ path: `${out}${tag}-1-before.png` });

    // Sắp xếp gọn
    await p.locator('.pz-tool', { hasText: 'Sắp xếp gọn' }).click({ force: true });
    await p.waitForTimeout(250);
    await p.screenshot({ path: `${out}${tag}-2-moving.png` });
    await p.waitForTimeout(1400);
    c.after = await measure(p);
    await p.screenshot({ path: `${out}${tag}-3-after.png` });

    // focus: tap a card header, then empty space
    await p.locator(`.wc-node[data-id="${LEVELS[lv].map[LEVELS[lv].focusCard]}"] .wc-node-head`).click({ force: true });
    await p.waitForTimeout(500);
    c.focus = await p.evaluate(() => ({ lit: document.querySelectorAll('.pz-wire.pz-lit').length, faded: document.querySelectorAll('.wc-node.pz-faded').length, focusing: document.querySelector('.pz-board').classList.contains('pz-focusing') }));
    await p.screenshot({ path: `${out}${tag}-4-focus.png` });
    await clickEmpty(p);
    await p.waitForTimeout(400);
    c.focusCleared = await p.evaluate(() => document.querySelector('.pz-board').classList.contains('pz-focusing'));

    // knot: double-click a wire, drag the knot, Ctrl+R on another wire
    const byLength = await p.evaluate(() => [...document.querySelectorAll('.wc-wire-hit')].filter((h) => !h.dataset.locked).map((h) => [h.dataset.wire, h.getTotalLength()]).sort((x, y) => y[1] - x[1]).map((x) => x[0]));
    let wid = null; let pt = null;
    for (const id of byLength) { pt = await wirePoint(p, id, 0.5); if (pt) { wid = id; break; } }
    if (!pt) logs.push(`${tag}: no clickable point on any wire`);
    else await p.mouse.dblclick(pt.x, pt.y);
    await p.waitForTimeout(500);
    c.knotAfterDouble = await p.locator('.pz-knot').count();
    if (c.knotAfterDouble) {
      const k = p.locator('.pz-knot').first();
      const kb = await k.boundingBox();
      await p.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2);
      await p.mouse.down();
      await p.mouse.move(kb.x + kb.width / 2 + 30, kb.y + kb.height / 2 + 36, { steps: 6 });
      await p.mouse.up();
      await p.waitForTimeout(500);
      c.knotAfterDrag = await measure(p);
    }
    await p.screenshot({ path: `${out}${tag}-5-knot.png` });
    // Ctrl+R on another wire
    let q = null;
    for (const id of byLength) { if (id === wid) continue; q = await wirePoint(p, id, 0.4); if (q) break; }
    if (q) {
      await p.mouse.move(q.x, q.y);
      await p.waitForTimeout(150);
      await p.keyboard.press('Control+r');
      await p.waitForTimeout(400);
      c.knotsAfterCtrlR = await p.locator('.pz-knot').count();
    }
    // double-click a knot removes it
    if (c.knotAfterDouble) {
      const k = p.locator('.pz-knot').first();
      const kb = await k.boundingBox();
      const before = await p.locator('.pz-knot').count();
      await p.mouse.dblclick(kb.x + kb.width / 2, kb.y + kb.height / 2);
      await p.waitForTimeout(400);
      c.knotsAfterRemove = [before, await p.locator('.pz-knot').count()];
    }

    // Gom dây (clean the knots first by tidying again)
    await p.locator('.pz-tool', { hasText: 'Sắp xếp gọn' }).click({ force: true });
    await p.waitForTimeout(1500);
    // branching: a knot on one wire of robot.self, then another wire of the same pin dragged onto it
    {
      const idsOfPin = LEVELS[lv].wires.map((w, i) => [w, 'pw' + (i + 1)]).filter(([w]) => w[0] === 'robot' && w[1] === 'self').map(([, id]) => id);
      const [wa, wb] = idsOfPin;
      const pa = await wirePoint(p, wa, 0.5);
      if (pa) {
        await p.mouse.dblclick(pa.x, pa.y);
        await p.waitForTimeout(400);
        const kb = await p.locator('.pz-knot').first().boundingBox();
        let pb = null;
        for (const id of idsOfPin.slice(1)) { pb = await wirePoint(p, id, 0.6); if (pb) break; }
        if (kb && pb) {
          await p.mouse.move(pb.x, pb.y);
          await p.mouse.down();
          await p.mouse.move(pb.x + (kb.x + kb.width / 2 - pb.x) / 2, pb.y + (kb.y + kb.height / 2 - pb.y) / 2, { steps: 5 });
          await p.mouse.move(kb.x + kb.width / 2, kb.y + kb.height / 2, { steps: 5 });
          await p.mouse.up();
          await p.waitForTimeout(500);
        }
        c.branch = { knots: await p.locator('.pz-knot').count(), shared: await p.locator('.pz-knot.shared').count() };
        await p.screenshot({ path: `${out}${tag}-5b-branch.png` });
      } else logs.push(tag + ': no point for branch test');
    }
    await p.locator('.pz-tool', { hasText: 'Sắp xếp gọn' }).click({ force: true });
    await p.waitForTimeout(1500);
    await p.locator('.pz-tool', { hasText: 'Gom dây' }).click({ force: true });
    await p.waitForTimeout(500);
    c.gom = await measure(p);
    await p.screenshot({ path: `${out}${tag}-6-gom.png` });

    // wiring still works with the new pins: pick an output pin and look at the highlighted inputs
    await p.locator(`.wc-node[data-id="robot"] .wc-port[data-dir="out"]`).first().click({ force: true });
    await p.waitForTimeout(300);
    c.pickOk = await p.locator('.wc-port.ok').count();
    await p.screenshot({ path: `${out}${tag}-7-picked-pin.png` });
    await clickEmpty(p);

    // zoom/fit: wheel zoom in, then the fit button
    await p.mouse.move(vp.width / 2, vp.height / 2);
    await p.mouse.wheel(0, -400);
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${out}${tag}-8-zoomed.png` });
    await p.locator('.pz-tool').nth(2).click({ force: true });
    await p.waitForTimeout(700);
    c.afterFit = await measure(p);

    // run frame
    await p.locator('.pz-btn.run').first().click({ force: true });
    await p.waitForTimeout(2200);
    await p.screenshot({ path: `${out}${tag}-9-run-stage.png` });
    await p.locator('.pz-pip-hit').click({ force: true }).catch(() => {});
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${out}${tag}-9-run-board.png` });
    await p.close();

    // guide mid-step (first visit)
    const g = await open(lv, vp, { seen: false });
    await g.locator('.pz-chip').first().click({ force: true }).catch(() => {});
    await g.waitForTimeout(900);
    await g.screenshot({ path: `${out}${tag}-0-guide-mid.png` });
    await g.close();

    // "?" hint on a wire step: ring, hand and the dotted ghost wire on the new pin positions
    const hpage = await open(lv, vp, { seen: true });
    const hchips = hpage.locator('.pz-chip');
    for (let i = 0; i < LEVELS[lv].kinds; i++) { await hchips.nth(i).click({ force: true }); await hpage.waitForTimeout(120); }
    if (LEVELS[lv].colour) { await hpage.locator(`.pz-param[data-node="${LEVELS[lv].colour}"]`).first().click({ force: true }); await hpage.waitForTimeout(150); await hpage.locator('.pz-step').nth(1).click({ force: true }); await clickEmpty(hpage); }
    await hpage.locator('.pz-hint-btn').click({ force: true });
    await hpage.waitForTimeout(900);
    await hpage.screenshot({ path: `${out}${tag}-0-hint-ghost.png` });
    await hpage.close();
  }
}
fs.writeFileSync(`${out}counts.json`, JSON.stringify(counts, null, 1));
console.log(logs.join('\n') || 'no page errors');
console.log(JSON.stringify(Object.fromEntries(Object.entries(counts).map(([k, v]) => [k, { before: [v.before?.total, v.before?.ww, v.before?.wc], after: [v.after?.total, v.after?.ww, v.after?.wc, 'ovl', v.after?.overlap], gom: [v.gom?.total, v.gom?.shared], branch: v.branch, knots: [v.knotAfterDouble, v.knotsAfterCtrlR, v.knotsAfterRemove], focus: v.focus, cleared: v.focusCleared, pickOk: v.pickOk }])), null, 1));
await b.close();
