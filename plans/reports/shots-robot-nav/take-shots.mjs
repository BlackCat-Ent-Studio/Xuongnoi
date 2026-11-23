// Shots of the robot navigation pieces on the real editor (Học sinh mode, light theme).
// Needs the dev server of the nav worktree: `npx vite --port 5183 --strictPort` in app/.
// usage: node take-shots.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.BASE ??= 'http://localhost:5183';
const { launch, openEditor, sleep } = await import('../../browser-scripts/ui-c-lib.mjs');
const OUT = path.dirname(fileURLToPath(import.meta.url));
const browser = await launch();

async function dismiss(page) {
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
}

/** Stores a board built by the app's own modules as the autosave and reloads the editor on it. */
async function openBoard(page, recipe) {
  await page.evaluate(async (r) => {
    const io = await import('/src/io/index.ts');
    const nav = await import('/src/handbook/boards-robot-nav.ts');
    const arm = await import('/src/handbook/boards-robot-arm.ts');
    const board = r.named ? nav[r.named]() : arm.build(r.label, r.note, r.nodes, r.wires, '3d');
    if (r.real) board.graph = { ...board.graph, settings: { ...(board.graph.settings ?? {}), realPhysics: true } };
    localStorage.setItem('xuong-noi:autosave', io.serializeBoard(board));
  }, recipe);
  await page.reload();
  await sleep(2500);
  await dismiss(page);
}

const card = (page, kind) => page.locator(`.wc-node[data-kind="${kind}"]`).first();
async function clipped(page, kind) {
  return card(page, kind).evaluate((el) => [...el.querySelectorAll('*')].filter((e) => e.children.length === 0 && e.textContent.trim() && e.textContent.trim() !== '?' && e.scrollWidth > e.clientWidth + 1).map((e) => e.textContent.trim()));
}
async function play(page, name, marks, wheel = 0) {
  await page.locator('.play .pbtn.primary').click();
  await page.locator('button:has-text("Mô phỏng"):visible').first().click().catch(() => {});
  const t0 = Date.now();
  if (wheel !== 0) {
    const box = await page.locator('canvas').first().boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, -wheel);
  }
  for (const at of marks) {
    while ((Date.now() - t0) / 1000 < at) await sleep(20);
    await page.screenshot({ path: path.join(OUT, `${name}-t${at.toFixed(1)}s.png`) });
    console.log('shot', name, at);
  }
}

const { page, logs } = await openEditor(browser, { theme: 'light', mode: 'student', width: 1700, height: 1000 });

// 1. The four cards on the try board of "Tìm mốc sàn" (all four kinds are on it).
await openBoard(page, { named: 'tryFloorMarkerFind' });
await page.screenshot({ path: path.join(OUT, '1-cards-board.png') });
for (const kind of ['robot-goto', 'floor-marker', 'floor-marker-sensor', 'floor-marker-find']) {
  await card(page, kind).scrollIntoViewIfNeeded().catch(() => {});
  await sleep(200);
  await card(page, kind).screenshot({ path: path.join(OUT, `1-card-${kind}.png`) });
  console.log('card', kind, JSON.stringify(await clipped(page, kind)));
}
// The driver selected, so the panel shows its settings.
await card(page, 'robot-goto').locator('.wc-node-head').click();
await sleep(500);
await page.screenshot({ path: path.join(OUT, '1-goto-selected-panel.png') });

// 2. The same try board playing (top view).
await play(page, '2-top-play', [1.5, 4.0, 9.0]);

// 3. A robot driving between markers in 3D, real physics on.
const at = (x, z, y = 0.5) => ({ x, y, z });
const nodes = [
  { alias: 'floor', kind: 'block', x: 20, y: 20, params: { position: at(0, 0, 0), size: { x: 22, y: 1, z: 14 }, color: '#d6d3d1' } },
  { alias: 'start', kind: 'on-start', x: 20, y: 220 },
  { alias: 'm1', kind: 'floor-marker', x: 20, y: 380, params: { number: 1, position: at(-5, -3) } },
  { alias: 'm2', kind: 'floor-marker', x: 20, y: 600, params: { number: 2, position: at(4, -3) } },
  { alias: 'm3', kind: 'floor-marker', x: 20, y: 820, params: { number: 3, position: at(4, 3), color: '#22c55e' } },
  { alias: 'step', kind: 'counter', x: 320, y: 380, params: { start: 1, target: 99 } },
  { alias: 'find', kind: 'floor-marker-find', x: 620, y: 420 },
  { alias: 'body', kind: 'robot-body', x: 320, y: 20, params: { position: at(-5, 3, 0.65), heading: -90 } },
  { alias: 'drive', kind: 'robot-goto', x: 920, y: 20 },
  { alias: 'left', kind: 'motor', x: 1220, y: 20, params: { side: -0.4 } },
  { alias: 'right', kind: 'motor', x: 1220, y: 240, params: { side: 0.4 } },
];
const wires = [
  ['body', 'self', 'left', 'body'], ['body', 'self', 'right', 'body'], ['body', 'self', 'drive', 'robot'],
  ['drive', 'arrivedPulse', 'step', 'up'], ['step', 'value', 'find', 'number'], ['find', 'marker', 'drive', 'target'], ['find', 'found', 'drive', 'go'],
  ['drive', 'left', 'left', 'power'], ['drive', 'right', 'right', 'power'],
];
await openBoard(page, { label: 'robot đi qua ba mốc', note: 'Robot đi lần lượt qua mốc 1, 2, 3.', nodes, wires, real: true });
await page.screenshot({ path: path.join(OUT, '3-3d-board.png') });
await play(page, '3-3d-play', [1.0, 4.0, 7.0, 10.0, 13.0, 22.0], Number(process.env.WHEEL ?? -500));

console.log('LOGS', JSON.stringify(logs.slice(0, 8)));
await browser.close();
