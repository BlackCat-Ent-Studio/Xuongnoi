// Free board (Xưởng Bot): every level at desktop 1280x720 and phone 844x390 on dev server :5233.
// open -> opening view numbers, pan (unbounded), wheel zoom (clamped), double-tap fit, solve through real clicks, run/stop swap.
// Shots: L5 and L7 opened + solved + zoomed in, L1 guide spotlight. usage: node puzzle-levels-freeboard.mjs [levels=1,2,3,4,5,6,7,8] [viewports=desk,phone]
import { launch, openPage, setSave, openLevel, levelData, solveBoard, shot, focusOf, panBoard, VIEWPORTS } from './freeboard-lib.mjs';

const levels = (process.argv[2] ?? '1,2,3,4,5,6,7,8').split(',').map(Number);
const tags = (process.argv[3] ?? 'desk,phone').split(',');
const logs = [];
const checks = [];
const ok = (name, cond, extra = '') => { checks.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); console.log(checks[checks.length - 1]); };
const browser = await launch();

/** Cards on the board: id, screen box, card scale. */
const cardsOf = (page) => page.evaluate(() => [...document.querySelectorAll('.pz-board .wc-node')].map((n) => {
  const r = n.getBoundingClientRect();
  const m = /scale\(([\d.]+)\)/.exec(n.style.transform);
  return { id: n.dataset.id, x: r.left, y: r.top, w: r.width, h: r.height, k: m ? Number(m[1]) : 1, locked: n.classList.contains('pz-locked') };
}));
const scaleOf = async (page) => (await cardsOf(page))[0]?.k ?? 0;

async function wheel(page, dy, at) {
  await page.mouse.move(at.x, at.y);
  await page.mouse.wheel(0, dy);
  await page.waitForTimeout(120);
}

async function emptySpot(page) {
  return page.evaluate(() => {
    const bad = '.wc-node, .wc-wire-hit, .pz-knot, button, .pz-bottom, .pz-pop, .pz-hud, .pz-stage, .pz-mascot, .pz-guide, .pz-task';
    for (let y = 130; y < innerHeight - 130; y += 13) for (let x = 40; x < innerWidth - 40; x += 19) {
      const el = document.elementFromPoint(x, y);
      if (el && el.closest('.pz-board-host') && !el.closest(bad)) return { x, y };
    }
    return null;
  });
}

for (const tag of tags) {
  const vp = VIEWPORTS[tag];
  const page = await openPage(browser, vp, logs, tag);
  for (const no of levels) {
    const name = `${tag}-L${no}`;
    try {
      await setSave(page, { seen: true });
      await openLevel(page, no, { settle: 2500 });
      const cards = await cardsOf(page);
      const k0 = cards[0]?.k ?? 0;
      ok(`${name} opened with cards`, cards.length > 0, `n=${cards.length} k=${k0.toFixed(2)}`);
      ok(`${name} open zoom in [0.70,1]`, k0 >= 0.699 && k0 <= 1.001);
      const box = (await page.locator('.pz-board-host').boundingBox());
      const minX = Math.min(...cards.map((c) => c.x)), minY = Math.min(...cards.map((c) => c.y));
      ok(`${name} first cards on screen`, minX >= -1 && minY >= 40 && minX < vp.width, `minX=${minX.toFixed(0)} minY=${minY.toFixed(0)}`);
      const overlapPairs = cards.filter((a, i) => cards.some((b, j) => j > i && a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1)).length;
      ok(`${name} no overlapping cards`, overlapPairs === 0, `pairs=${overlapPairs}`);
      if (no === 5 || no === 7) await shot(page, `${name}-1-opened`);

      // pan: drag empty board; cards follow 1:1; no bound (3 big drags push everything off screen)
      const before = (await cardsOf(page))[0];
      await panBoard(page, -120, -40);
      const after = (await cardsOf(page))[0];
      ok(`${name} pan moves cards 1:1`, Math.abs(after.x - before.x + 120) < 2 && Math.abs(after.y - before.y + 40) < 2, `dx=${(after.x - before.x).toFixed(0)} dy=${(after.y - before.y).toFixed(0)}`);
      for (let i = 0; i < 4; i++) await panBoard(page, -(vp.width - 90), 0);
      const far = (await cardsOf(page)).every((c) => c.x + c.w < 0);
      ok(`${name} pan unbounded (all cards off screen)`, far);
      // double-tap on empty board brings everything back with the opening rule
      const spot = await emptySpot(page);
      await page.mouse.click(spot.x, spot.y);
      await page.mouse.click(spot.x, spot.y);
      await page.waitForTimeout(700);
      const fit = await cardsOf(page);
      ok(`${name} double-tap fit`, Math.abs(fit[0].x - before.x) < 3 && Math.abs(fit[0].y - before.y) < 3 && Math.abs(fit[0].k - k0) < 0.01, `k=${fit[0].k.toFixed(2)}`);
      // wheel zoom around the pointer, clamped
      const sp = await emptySpot(page);
      for (let i = 0; i < 14; i++) await wheel(page, -400, sp);
      const kMax = await scaleOf(page);
      ok(`${name} zoom max 1.6`, Math.abs(kMax - 1.6) < 0.01, `k=${kMax.toFixed(2)}`);
      for (let i = 0; i < 30; i++) await wheel(page, 400, sp);
      const kMin = await scaleOf(page);
      ok(`${name} zoom min 0.25`, Math.abs(kMin - 0.25) < 0.01, `k=${kMin.toFixed(2)}`);
      const sp2 = await emptySpot(page);
      await page.mouse.click(sp2.x, sp2.y);
      await page.mouse.click(sp2.x, sp2.y);
      await page.waitForTimeout(700);
      ok(`${name} fit after zoom`, Math.abs((await scaleOf(page)) - k0) < 0.01);

      // solve through real clicks (pans where a pin is off screen)
      const data = await levelData(page, no);
      const placed = await solveBoard(page, data, { piecesOnly: true });
      const nPlaced = await page.locator('.wc-node:not(.pz-locked)').count();
      ok(`${name} tray drops add cards`, nPlaced === data.solution.nodes.length, `n=${nPlaced}`);
      await solveBoard(page, data, { placedIds: placed });
      const wires = await page.locator('.pz-wire').count();
      ok(`${name} wires drawn`, wires >= data.solution.wires.length, `n=${wires}`);
      const all = await cardsOf(page);
      const newOnes = all.filter((c) => !c.locked);
      const overlap2 = all.filter((a, i) => all.some((b, j) => j > i && a.x < b.x + b.w - 1 && a.x + a.w > b.x + 1 && a.y < b.y + b.h - 1 && a.y + a.h > b.y + 1)).length;
      ok(`${name} placed cards do not overlap`, overlap2 === 0, `pairs=${overlap2} new=${newOnes.length}`);
      await page.mouse.click(sp2.x, sp2.y);
      await page.mouse.click(sp2.x, sp2.y);
      await page.waitForTimeout(700);
      if (no === 5 || no === 7) {
        await shot(page, `${name}-2-solved-fit`);
        const z = await emptySpot(page);
        for (let i = 0; i < 4; i++) await wheel(page, -300, z);
        await page.waitForTimeout(300);
        await shot(page, `${name}-3-solved-zoomin`);
        const z2 = await emptySpot(page);
        await page.mouse.click(z2.x, z2.y);
        await page.mouse.click(z2.x, z2.y);
        await page.waitForTimeout(700);
      }

      // run / stop: the board goes to the corner as is; stopping brings the same view back
      const preRun = await cardsOf(page);
      await page.locator('.pz-btn.run').click();
      await page.waitForTimeout(1500);
      ok(`${name} run -> stage`, (await focusOf(page)) === 'stage');
      if (no === 5 || no === 7) await shot(page, `${name}-4-running`);
      await panBoard(page, -60, 0).catch(() => {});
      await page.locator('.pz-btn.run').click();
      await page.waitForTimeout(1200);
      ok(`${name} stop -> board`, (await focusOf(page)) === 'board');
      const postRun = await cardsOf(page);
      ok(`${name} view kept after stop`, preRun.length === postRun.length && Math.abs(preRun[0].x - postRun[0].x) < 2 && Math.abs(preRun[0].k - postRun[0].k) < 0.01);
    } catch (e) {
      ok(`${name} script`, false, String(e.message).split('\n')[0]);
      await shot(page, `${name}-error`).catch(() => {});
    }
  }

  if (levels.includes(1)) {
    // L1 guide: fresh player; spotlight + hand + ghost wire, with the wire step's pin
    await setSave(page, { seen: false });
    await openLevel(page, 1, { settle: 3000 });
    ok(`${tag} L1 guide leads`, await page.evaluate(() => document.querySelector('.pz-guide')?.classList.contains('on') ?? false));
    const next = page.locator('.pz-next');
    if (await next.isVisible()) { await next.click(); await page.waitForTimeout(700); }
    await shot(page, `${tag}-L1-guide-1-first-step`);
    const data = await levelData(page, 1);
    const placed = await solveBoard(page, data, { piecesOnly: true });
    await page.waitForTimeout(900);
    await shot(page, `${tag}-L1-guide-2-wire-step`);
    // pan the whole board away: the guide must bring its target back into view on its next refresh
    for (let i = 0; i < 3; i++) await panBoard(page, -(vp.width - 90), 0);
    await page.waitForTimeout(300);
    await page.locator('.pz-hint-btn').click({ force: true }).catch(() => {});
    await page.waitForTimeout(1200);
    const spot = await page.evaluate(() => {
      const r = document.querySelector('.pz-spot')?.getBoundingClientRect();
      return r ? { x: r.left, y: r.top, w: r.width, h: r.height } : null;
    });
    const inWin = spot && spot.x + spot.w > 0 && spot.x < innerWidthOf(vp) && spot.y + spot.h > 0 && spot.y < vp.height;
    ok(`${tag} L1 hint spotlight on screen after the board was panned away`, !!inWin, JSON.stringify(spot));
    await shot(page, `${tag}-L1-guide-3-panned-hint`);
    void placed;
  }
  await page.close();
}

function innerWidthOf(v) { return v.width; }
const fails = checks.filter((c) => c.startsWith('FAIL'));
console.log(`\n${checks.length - fails.length}/${checks.length} checks passed`);
console.log(fails.join('\n'));
console.log(logs.slice(0, 20).join('\n') || 'no console errors');
await browser.close();
