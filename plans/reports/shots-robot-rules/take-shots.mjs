// Shots of the robot rules on the real app ("Vật lý thật" on): two robots driving at each other, and a robot whose tray
// (a link with "Bề rộng") tips a crate off. Needs the dev server of the robot-rules worktree:
//   cd D:/workspace/GameBuilder-robot-rules/app && npm run dev -- --port 5313 --strictPort
// usage: BASE=http://localhost:5313 node take-shots.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.BASE ??= 'http://localhost:5313';
const { launch, openEditor, sleep } = await import('../../browser-scripts/ui-c-lib.mjs');
const OUT = path.dirname(fileURLToPath(import.meta.url));
const browser = await launch();
const { page, logs } = await openEditor(browser, { theme: 'light', mode: 'student', width: 1600, height: 1000 });

const CH = { length: 1.2, width: 1, height: 0.3, mass: 5, friction: 0.8 };
const bot = (id, x, z, heading, col) => [
  { alias: id, kind: 'robot-body', x: 40, y: col * 260, params: { position: { x, y: 0.15, z }, heading, ...CH, showPush: 'yes' } },
  { alias: `${id}-ml`, kind: 'motor', x: 420, y: col * 260, params: { side: -0.45, maxRpm: 90, maxForce: 6 } },
  { alias: `${id}-mr`, kind: 'motor', x: 420, y: col * 260 + 120, params: { side: 0.45, maxRpm: 90, maxForce: 6 } },
  { alias: `${id}-p`, kind: 'const', x: 40, y: col * 260 + 150, params: { value: id === 'c' ? 0 : 0.7 } },
];
const botWires = (id) => [[id, 'self', `${id}-ml`, 'body'], [id, 'self', `${id}-mr`, 'body'], [`${id}-p`, 'value', `${id}-ml`, 'power'], [`${id}-p`, 'value', `${id}-mr`, 'power']];
const UP = 0.15 + 0.01 + 0.025;
const nodes = [
  { alias: 'floor', kind: 'block', x: 800, y: 0, params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 24, y: 1, z: 12 }, color: '#cbd5e1' } },
  ...bot('a', -4, -1.2, 0, 0),
  ...bot('b', 1, -1.2, 180, 1),
  ...bot('c', 0, 0.9, 0, 2),
  { alias: 'go', kind: 'on-start', x: 800, y: 200, params: {} },
  { alias: 'ang', kind: 'const', x: 800, y: 320, params: { value: 45 } },
  { alias: 'tilt', kind: 'joint', x: 1100, y: 200, params: { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 150, maxSpeed: 12, mount: { x: -0.6, y: UP, z: 0 }, solid: 'no' } },
  { alias: 'tray', kind: 'link', x: 1400, y: 200, params: { length: 0.6, thickness: 0.05, width: 0.6, solid: 'yes', mass: 1 } },
  { alias: 'crate', kind: 'item', x: 800, y: 480, params: { shape: 'crate', position: { x: -0.3, y: 0.36 + 0.2 + 0.005, z: 0.9 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 2, color: '#a16207' } },
];
const wires = [
  ...botWires('a'), ...botWires('b'), ...botWires('c'),
  ['c', 'self', 'tilt', 'base'], ['go', 'started', 'tilt', 'power'], ['ang', 'value', 'tilt', 'angle'], ['tilt', 'tip', 'tray', 'base'],
];

await page.evaluate(async (r) => {
  const io = await import('/src/io/index.ts');
  const arm = await import('/src/handbook/boards-robot-arm.ts');
  const board = arm.build('hai robot gặp nhau, khay nghiêng', 'Hai robot chạy vào nhau; robot thứ ba nghiêng khay đổ thùng.', r.nodes, r.wires, '3d');
  board.graph = { ...board.graph, settings: { ...(board.graph.settings ?? {}), realPhysics: true } };
  localStorage.setItem('xuong-noi:autosave', io.serializeBoard(board));
}, { nodes, wires });
await page.reload();
await sleep(2500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
await page.screenshot({ path: path.join(OUT, '0-board.png') });

await page.locator('.play .pbtn.primary').click();
await page.locator('button:has-text("Mô phỏng"):visible').first().click().catch(() => {});
const t0 = Date.now();
const box = await page.locator('canvas').first().boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.wheel(0, -Number(process.env.WHEEL ?? 420));
const marks = (process.env.AT ?? '0.6,2.0,2.6,3.0,3.4,3.8,4.4,6.0').split(',').map(Number);
for (const [i, at] of marks.entries()) {
  while ((Date.now() - t0) / 1000 < at) await sleep(20);
  const t = (Date.now() - t0) / 1000;
  await page.screenshot({ path: path.join(OUT, `play-${String(i + 1).padStart(2, '0')}-t${t.toFixed(1)}s.png`) });
  console.log('shot', i + 1, t.toFixed(2));
}
console.log('LOGS', JSON.stringify(logs.slice(0, 8)));
await browser.close();
