// Pictures of the factory-look AGV tipping a carton off to the side, and of the open-frame belt with its side walls,
// through the scene harness of the chassis worktree (app/tests/showcase/scene-harness.html).
// usage: PW_ENTRY=<file URL of a module exporting chromium> node side-dump-shots.mjs
// env: BASE (default http://localhost:5185). Output: the folder above this script.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PW_ENTRY ?? 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(here, '..');
const BASE = process.env.BASE ?? 'http://localhost:5185';

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 900 }, deviceScaleFactor: 1 })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.text()); });
await page.goto(`${BASE}/tests/showcase/scene-harness.html`);
await page.waitForFunction(() => !!window.__harness, null, { timeout: 120000 });
const S = await page.evaluate(() => window.__harness.spots);

const cam = (spot, off, lift = 0.25, shadow = 4) => ({ pos: [spot.x + off[0], off[1], spot.z + off[2]], target: [spot.x, lift, spot.z], shadow });
// [file name, showcase options, ticks, camera]
const SHOTS = [
  ['side-dump-0-level', {}, 60, cam(S.agvSide, [1.6, 1.15, 2.0], 0.22)],
  ['side-dump-1-tipping', { tilt: 35 }, 22, cam(S.agvSide, [1.6, 1.15, 2.0], 0.22)],
  ['side-dump-2-sliding', { tilt: 35 }, 48, cam(S.agvSide, [1.6, 1.15, 2.0], 0.22)],
  ['side-dump-3-falling', { tilt: 35 }, 62, cam(S.agvSide, [1.6, 1.15, 2.0], 0.22)],
  ['side-dump-4-landed', { tilt: 35 }, 240, cam(S.agvSide, [1.6, 1.15, 2.0], 0.22)],
  ['side-dump-4-landed-from-above', { tilt: 35 }, 240, cam(S.agvSide, [0.01, 3.4, 0.4], 0.2)],
  ['belt-frame-with-walls', {}, 150, { pos: [S.belt.x + 1.9, 1.8, S.belt.z + 3.1], target: [S.belt.x, 0.5, S.belt.z], shadow: 4 }],
  ['belt-frame-with-walls-end-on', {}, 150, { pos: [S.belt.x + 2.6, 1.0, S.belt.z + 0.5], target: [S.belt.x, 0.55, S.belt.z], shadow: 4 }],
];

for (const [name, options, ticks, camera] of SHOTS) {
  const res = await page.evaluate(([o, t, c]) => window.__harness.showcase(o, { ticks: t, camera: c, width: 1000, height: 680, grid: false }), [options, ticks, camera]);
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => window.__harness.redraw());
  const png = await page.evaluate(() => window.__harness.png());
  fs.writeFileSync(path.join(OUT, `${name}.png`), Buffer.from(png.split(',')[1], 'base64'));
  const parcels = await page.evaluate(() => window.__harness.entities().filter((e) => e.ownerNodeId === 'a2-parcel' || e.ownerNodeId === 'a2-body' || e.ownerNodeId === 'belt-p1' || (e.ownerNodeId === 'belt')).map((e) => `${e.ownerNodeId} (${e.position.x.toFixed(2)}, ${e.position.y.toFixed(2)}, ${e.position.z.toFixed(2)}) ${e.size.x.toFixed(2)}x${e.size.y.toFixed(2)}x${e.size.z.toFixed(2)}`));
  console.log(`${name}  entities=${res.entities}\n  ${parcels.join('\n  ')}`);
}
if (logs.length) console.log('page log:\n' + [...new Set(logs)].join('\n'));
await browser.close();
