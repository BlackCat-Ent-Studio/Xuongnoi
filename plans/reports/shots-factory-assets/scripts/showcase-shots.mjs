// Pictures of the factory showcase board (app/tests/showcase/factory-showcase-board.ts) through the scene harness.
// usage: PW_ENTRY=<file URL of playwright-core index.mjs> node showcase-shots.mjs [name ...]
// env: BASE (default http://localhost:5184). Output: the folder above this script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PW_ENTRY ?? 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..');
const BASE = process.env.BASE ?? 'http://localhost:5184';
const want = process.argv.slice(2);

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1 })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
await page.goto(`${BASE}/tests/showcase/scene-harness.html`);
await page.waitForFunction(() => !!window.__harness, null, { timeout: 120000 });
const S = await page.evaluate(() => window.__harness.spots);

const cam = (spot, off, lift = 0.25, shadow = 4) => ({ pos: [spot.x + off[0], off[1], spot.z + off[2]], target: [spot.x, lift, spot.z], shadow });
// [file name, showcase options, ticks, camera, size]
const SHOTS = [
  ['overview', {}, 120, { pos: [0.5, 7.5, 9.5], target: [0.5, 0.2, 0], fov: 40, shadow: 9 }],
  ['overview-classic-looks', { classic: true }, 120, { pos: [0.5, 7.5, 9.5], target: [0.5, 0.2, 0], fov: 40, shadow: 9 }],
  ['agv-rear-hinge-flat', {}, 120, cam(S.agvRear, [1.4, 1.05, 1.7], 0.22)],
  ['agv-rear-hinge-flat-from-back', {}, 120, cam(S.agvRear, [-1.5, 0.9, 1.5], 0.22)],
  ['agv-rear-hinge-tilted', { tilt: 20 }, 50, cam(S.agvRear, [-1.5, 1.0, 1.6], 0.25)],
  ['agv-side-hinge-flat', {}, 120, cam(S.agvSide, [1.4, 1.05, 1.7], 0.22)],
  ['agv-side-hinge-tilted', { tilt: 30 }, 40, cam(S.agvSide, [1.4, 1.05, 1.7], 0.25)],
  ['agv-side-hinge-tilted-empty', { tilt: 34 }, 300, cam(S.agvSide, [1.4, 1.05, 1.7], 0.25)],
  ['agv-top', {}, 120, cam(S.agvSide, [0.01, 3.2, 0.02], 0.2)],
  ['arm-open', {}, 60, { pos: [S.arm.x + 1.6, 1.55, S.arm.z + 3.05], target: [S.arm.x + 0.5, 0.72, S.arm.z], shadow: 4 }],
  ['arm-closed', { gripperClosed: true }, 120, { pos: [S.arm.x + 1.6, 1.55, S.arm.z + 3.05], target: [S.arm.x + 0.5, 0.72, S.arm.z], shadow: 4 }],
  ['arm-gripper-open-close-up', {}, 60, { pos: [S.arm.x + 2.3, 1.2, S.arm.z + 1.3], target: [S.arm.x + 1.25, 0.55, S.arm.z], shadow: 4 }],
  ['arm-gripper-closed-close-up', { gripperClosed: true }, 120, { pos: [S.arm.x + 2.3, 1.2, S.arm.z + 1.3], target: [S.arm.x + 1.25, 0.55, S.arm.z], shadow: 4 }],
  ['parcels', {}, 120, { pos: [S.parcels.x, 2.2, S.parcels.z + 4.4], target: [S.parcels.x, 0.2, S.parcels.z], shadow: 5 }],
  ['parcels-from-above', {}, 120, { pos: [S.parcels.x, 4.6, S.parcels.z + 1.6], target: [S.parcels.x, 0.1, S.parcels.z], shadow: 5 }],
  ['chute', {}, 60, { pos: [S.chute.x + 2.3, 2.65, S.chute.z + 3.1], target: [S.chute.x, 1.1, S.chute.z], shadow: 4 }],
  ['chute-from-side', {}, 60, { pos: [S.chute.x + 3.6, 0.9, S.chute.z + 0.6], target: [S.chute.x, 0.7, S.chute.z], shadow: 4 }],
  ['belt-idle-lamp', {}, 30, { pos: [S.belt.x + 1.9, 1.8, S.belt.z + 3.1], target: [S.belt.x, 0.5, S.belt.z], shadow: 4 }],
  ['belt-lamp-on', { gateLamp: '#45e07a' }, 150, { pos: [S.belt.x + 1.9, 1.8, S.belt.z + 3.1], target: [S.belt.x, 0.5, S.belt.z], shadow: 4 }],
  ['floor-markers', {}, 60, { pos: [S.markers.x + 2.6, 4.2, S.markers.z + 4.6], target: [S.markers.x + 1, 0, S.markers.z], shadow: 5 }],
];
const MODES = [['side-view', '2d-side'], ['top-view', '2d-top']];

for (const [name, options, ticks, camera] of SHOTS) {
  if (want.length && !want.includes(name)) continue;
  const res = await page.evaluate(([o, t, c]) => window.__harness.showcase(o, { ticks: t, camera: c, width: 1000, height: 680, grid: false }), [options, ticks, camera]);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.__harness.redraw());
  const png = await page.evaluate(() => window.__harness.png());
  const info = await page.evaluate(() => window.__harness.info());
  fs.writeFileSync(path.join(OUT, `showcase-${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
  console.log(`showcase-${name}  entities=${res.entities}  last pass: calls=${info.calls} triangles=${info.triangles}`);
}
for (const [name, mode] of MODES) {
  if (want.length && !want.includes(name)) continue;
  await page.evaluate(([m]) => window.__harness.showcase({}, { ticks: 60, mode: m, width: 1280, height: 800, grid: false }), [mode]);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.__harness.redraw());
  const png = await page.evaluate(() => window.__harness.png());
  fs.writeFileSync(path.join(OUT, `showcase-${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
  console.log(`showcase-${name}`);
}
if (logs.length) console.log('page log:\n' + [...new Set(logs)].join('\n'));
await browser.close();
