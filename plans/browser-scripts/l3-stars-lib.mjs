// Shared helpers for the layout-B browser checks (dev server :5233).
export const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
export const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-l3-real-stars/';
export const BASE = 'http://localhost:5234/giai-do.html';
export const IDS = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau', 'xuong-tong-hop'];
export const VIEWPORTS = { phone: { width: 844, height: 390 }, desk: { width: 1280, height: 720 } };

export async function launch() {
  return chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
}

/** Opens a fresh page with every level unlocked. `seen` = guides/intros already seen (false = fresh player). */
export async function openPage(browser, viewport, logs, tag) {
  const page = await browser.newPage({ viewport });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${tag}: ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`${tag}: pageerror ${e.message}`));
  await page.goto(BASE);
  return page;
}

export async function setSave(page, { seen }) {
  await page.evaluate(({ ids, seen }) => {
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(ids.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(seen ? ids.concat(ids.map((i) => 'intro:' + i)) : []));
  }, { ids: IDS, seen });
}

/** Opens level `no` (1-8) from the map by clicking its stop. */
export async function openLevel(page, no, opts = {}) {
  await page.goto(BASE + '#/map');
  await page.reload();
  await page.waitForSelector('.pz-stop', { timeout: 10000 });
  await page.waitForTimeout(600);
  await page.locator('.pz-stop').nth(no - 1).click();
  await page.waitForSelector('.pz-pip-hit', { timeout: 10000 });
  await page.waitForTimeout(opts.settle ?? 2200);
}

export const focusOf = (page) => page.evaluate(() => document.querySelector('.pz-screen')?.dataset.focus);

/** The level data (solution, tray, editable) read from the dev server's own module. */
export async function levelData(page, no) {
  return page.evaluate(async (n) => {
    const { PUZZLE_LEVELS } = await import('/src/puzzle/levels/index.ts');
    const l = PUZZLE_LEVELS.find((x) => x.order === n);
    return { id: l.id, tray: l.tray, editable: l.editable ?? [], solution: l.solution, baseIds: l.base.nodes.map((x) => x.id), timeLimit: l.timeLimit };
  }, no);
}

/** A point on empty board (no card, wire, knot, button, tray) where a drag of (dx, dy) stays inside the window. */
async function emptyPoint(page, dx, dy) {
  return page.evaluate(([dx, dy]) => {
    const W = innerWidth, H = innerHeight;
    const bad = '.wc-node, .wc-wire-hit, .pz-knot, button, .pz-bottom, .pz-pop, .pz-hud, .pz-stage, .pz-mascot, .pz-guide, .pz-task';
    for (let y = 120; y < H - 120; y += 17) for (let x = 40; x < W - 40; x += 23) {
      if (x + dx < 4 || x + dx > W - 4 || y + dy < 4 || y + dy > H - 4) continue;
      const el = document.elementFromPoint(x, y);
      if (el && el.closest('.pz-board-host') && !el.closest(bad)) return { x, y };
    }
    return null;
  }, [dx, dy]);
}

/** Drags the empty board by (dx, dy) screen px (one pan). */
export async function panBoard(page, dx, dy) {
  const vp = page.viewportSize();
  dx = Math.max(-(vp.width - 80), Math.min(vp.width - 80, dx));
  dy = Math.max(-(vp.height - 240), Math.min(vp.height - 240, dy));
  const p = await emptyPoint(page, dx, dy);
  if (!p) throw new Error('no empty board point to pan from');
  await page.mouse.move(p.x, p.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(p.x + (dx * i) / 8, p.y + (dy * i) / 8);
  await page.mouse.up();
  await page.waitForTimeout(80);
}

/** Pans until the locator is on screen (inside the board and above the tray). */
export async function reveal(page, locator) {
  const vp = page.viewportSize();
  for (let i = 0; i < 8; i++) {
    const b = await locator.boundingBox();
    const tray = await page.locator('.pz-bottom').boundingBox();
    if (!b) return;
    const cx = b.x + b.width / 2, cy = b.y + b.height / 2;
    const hud = await page.locator('.pz-hud').boundingBox();
    const left = 30, right = vp.width - 30, top = (hud ? hud.y + hud.height : 110) + 24, bottom = (tray?.y ?? vp.height) - 30;
    const dx = cx < left ? left + 40 - cx : cx > right ? right - 40 - cx : 0;
    const dy = cy < top ? top + 40 - cy : cy > bottom ? bottom - 40 - cy : 0;
    if (!dx && !dy) return;
    await panBoard(page, dx, dy);
  }
}

async function clickCenter(page, locator) {
  await reveal(page, locator);
  const box = await locator.boundingBox();
  if (!box) throw new Error('no box for ' + locator);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/** Places the solution pieces, sets editable params and joins every wire, using real clicks. */
export async function solveBoard(page, data, opts = {}) {
  const placedIds = opts.placedIds ?? new Map(); // solution node id -> board node id
  const countByKind = new Map();
  for (const sol of opts.placedIds ? [] : data.solution.nodes) {
    const slot = data.tray.findIndex((t) => t.kind === sol.kind);
    if (slot < 0) throw new Error('no tray slot for ' + sol.kind);
    const before = await page.locator('.wc-node:not(.pz-locked)').count();
    await page.locator('.pz-tray .pz-chip').nth(slot).click();
    await page.waitForTimeout(160);
    const after = page.locator('.wc-node:not(.pz-locked)');
    if ((await after.count()) !== before + 1) throw new Error('piece not placed ' + sol.kind);
    placedIds.set(sol.id, await after.nth(before).getAttribute('data-id'));
    countByKind.set(sol.kind, (countByKind.get(sol.kind) ?? 0) + 1);
  }
  if (process.env.LOGMAP) console.log('MAP', JSON.stringify([...placedIds]));
  if (opts.piecesOnly) return placedIds;
  if (opts.paramsOnly) { await setParams(page, data, placedIds); return placedIds; }
  await setParams(page, data, placedIds);
  return wireUp(page, data, placedIds);
}

async function setParams(page, data, placedIds) {
  for (const sol of data.solution.nodes) {
    for (const ed of data.editable) {
      if (ed.kind !== sol.kind || sol.params[ed.paramId] === undefined) continue;
      const want = sol.params[ed.paramId];
      const id = placedIds.get(sol.id);
      const row = page.locator(`.pz-param[data-node="${id}"][data-param="${ed.paramId}"]`);
      if ((await row.count()) === 0) continue;
      await clickCenter(page, row);
      await page.waitForTimeout(120);
      const pop = page.locator('.pz-pop');
      if (typeof want === 'string') {
        await pop.locator(`.pz-pop-opt[data-value="${want}"]`).click();
      } else {
        for (let i = 0; i < 60; i++) {
          const cur = Number(await pop.locator('.pz-pop-num').textContent());
          if (cur === want) break;
          await pop.locator('.pz-step').nth(cur > want ? 0 : 1).click();
          await page.waitForTimeout(40);
        }
      }
      await page.waitForTimeout(100);
      // a tap on a tray chip area closes the popover without changing anything else
      const bb = await page.locator('.pz-board-host').boundingBox();
      await page.mouse.click(bb.x + bb.width * 0.46, bb.y + 40); // empty gap of the top bar: closes the editor
      await page.waitForTimeout(100);
    }
  }
}

export async function wireUp(page, data, placedIds) {
  const resolve = (id) => placedIds.get(id) ?? id;
  for (const w of data.solution.wires) {
    const from = page.locator(`.wc-node[data-id="${resolve(w.from.node)}"] .wc-port[data-dir="out"][data-port="${w.from.port}"] .wc-dot`);
    const to = page.locator(`.wc-node[data-id="${resolve(w.to.node)}"] .wc-port[data-dir="in"][data-port="${w.to.port}"] .wc-dot`);
    await clickCenter(page, from);
    await page.waitForTimeout(100);
    await clickCenter(page, to);
    await page.waitForTimeout(120);
    const msg = await page.locator('.pz-toast:not([hidden])').textContent().catch(() => '');
    if (msg && !/Đã nối/.test(msg)) console.log('WIRE WARNING', JSON.stringify(w), msg);
  }
  return placedIds;
}

export async function shot(page, name) {
  await page.screenshot({ path: OUT + name + '.png', timeout: 120000 });
}
