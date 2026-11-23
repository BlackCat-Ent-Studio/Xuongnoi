// Screenshots of the factory asset preview page (opened from disk, like a double-click).
// usage: PW_ENTRY=<file URL of playwright index.mjs> node take-shots.mjs [group ...]
//   groups: agv arm parcel chute belt floor scene ui sheet extra closeup   (none = all; closeup = large single-view shots for checking details)
// The "parcel" group also takes one shot with the pack GLBs answered from disk (the app server is not started here),
// to check the model row; that shot is named parcel-glb-simulated-server.png.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const { chromium } = await import(process.env.PW_ENTRY ?? 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const pageUrl = pathToFileURL(path.join(here, '..', 'index.html')).href;
const OUT = path.join(here, '..', 'shots');
const PACK_DIR = path.join(here, '..', '..', '..', '..', 'app', 'public', 'models', 'mega-pack-world');
fs.mkdirSync(OUT, { recursive: true });
const want = process.argv.slice(2);
const on = (g) => (want.length === 0 && g !== 'closeup') || want.includes(g);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];

async function open(simulateServer = false) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  if (simulateServer) {
    await page.route('http://localhost:5173/models/mega-pack-world/**', async (route) => {
      const rel = decodeURIComponent(new URL(route.request().url()).pathname.replace('/models/mega-pack-world/', ''));
      const file = path.join(PACK_DIR, rel);
      if (!fs.existsSync(file)) return route.fulfill({ status: 404, body: 'not found' });
      await route.fulfill({ status: 200, body: fs.readFileSync(file), headers: { 'access-control-allow-origin': '*', 'content-type': file.endsWith('.webp') ? 'image/webp' : 'model/gltf-binary' } });
    });
  }
  await page.goto(pageUrl);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
  await page.waitForFunction(() => window.__glb && window.__glb.done, null, { timeout: 60000 });
  return { context, page };
}
async function shot(page, name, selector, wait = 1600) {
  const el = page.locator(selector).first();
  await el.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await sleep(wait);
  await el.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log('shot', name);
}
const set = (page, patch) => page.evaluate((p) => window.preview.set(p), patch);
const freeze = (page, t) => page.evaluate((x) => window.preview.freeze(x), t);
const cam = (page, sec, pos) => page.evaluate(([s, p]) => { const c = window.preview.sections[s]; c.cam.position.set(...p); c.cam.lookAt(c.tgt); }, [sec, pos]);

const { context, page } = await open(false);
await freeze(page, 0);

if (on('agv')) {
  const row = '#s-agv .looks';
  await set(page, { tray: 'flat', load: 'yes', color: 'cam' });
  await shot(page, 'agv-flat-loaded-cam', row);
  await set(page, { load: 'no' });
  await shot(page, 'agv-flat-empty-cam', row);
  await set(page, { tray: 'tilt', load: 'yes' });
  await freeze(page, 1.0);
  await shot(page, 'agv-tilt-lifting', row);
  await freeze(page, 1.85);
  await shot(page, 'agv-tilt-sliding', row);
  await freeze(page, 2.5);
  await shot(page, 'agv-tilt-falling', row);
  await freeze(page, 3.2);
  await shot(page, 'agv-tilt-dropped', row);
  await set(page, { load: 'no' });
  await shot(page, 'agv-tilt-empty', row);
  await freeze(page, 0);
  await set(page, { tray: 'flat', load: 'yes' });
  for (const c of ['do', 'xanh', 'xam']) {
    await set(page, { color: c });
    await shot(page, `agv-flat-loaded-${c}`, row, 1200);
  }
  await set(page, { color: 'cam', mat: 'smooth' });
  await shot(page, 'agv-flat-loaded-smooth', row);
  await set(page, { mat: 'toon' });
  // other angles: from behind-left low, and from the usual sim height
  await cam(page, 'agv', [-2.0, 0.7, -1.9]);
  await shot(page, 'agv-rear-low', row);
  await cam(page, 'agv', [0.6, 3.2, 0.9]);
  await shot(page, 'agv-top', row);
  await cam(page, 'agv', [2.9, 0.35, 0.3]);
  await shot(page, 'agv-front-low', row);
  await set(page, { tray: 'tilt' });
  await freeze(page, 1.85);
  await cam(page, 'agv', [2.9, 0.6, 0.6]);
  await shot(page, 'agv-tilt-front', row);
  await freeze(page, 0);
  await set(page, { tray: 'flat' });
  await cam(page, 'agv', [1.4, 1.05, 1.7]);
  await shot(page, 'agv-section', '#s-agv');
}

if (on('arm')) {
  const row = '#s-arm .looks';
  await set(page, { grip: 'open', j1: 62, j2: -95 });
  await shot(page, 'arm-open', row);
  await set(page, { grip: 'hold' });
  await shot(page, 'arm-grip', row);
  await set(page, { j1: 100, j2: -35 });
  await shot(page, 'arm-grip-stretched', row);
  await set(page, { j1: 30, j2: -120, grip: 'open' });
  await shot(page, 'arm-open-folded', row);
  await set(page, { j1: 62, j2: -95, grip: 'hold' });
  await cam(page, 'arm', [0.6, 1.2, 4.2]);
  await shot(page, 'arm-grip-from-side', row);
  await cam(page, 'arm', [0.6, 4.6, 1.4]);
  await shot(page, 'arm-grip-from-top', row);
  await cam(page, 'arm', [-2.2, 1.3, -3.4]);
  await shot(page, 'arm-grip-from-back', row);
  await cam(page, 'arm', [2.1, 1.55, 3.05]);
  await set(page, { mat: 'smooth' });
  await shot(page, 'arm-grip-smooth', row);
  await set(page, { mat: 'toon', grip: 'open' });
}

if (on('parcel')) {
  await shot(page, 'parcel-fallback-no-server', '#s-parcel');
  const sim = await open(true);
  await shot(sim.page, 'parcel-glb-simulated-server', '#s-parcel', 3500);
  console.log('glb loaded (simulated server):', JSON.stringify(await sim.page.evaluate(() => ({ loaded: window.__glb.loaded, failed: window.__glb.failed }))));
  await sim.context.close();
  console.log('glb loaded (real, no interception):', JSON.stringify(await page.evaluate(() => ({ loaded: window.__glb.loaded, failed: window.__glb.failed }))));
}

if (on('chute')) {
  const row = '#s-chute .looks';
  await set(page, { num: '1' });
  await shot(page, 'chute-num1', row);
  await set(page, { num: '6' });
  await shot(page, 'chute-num6', row);
  await cam(page, 'chute', [0.8, 4.6, 2.2]);
  await shot(page, 'chute-from-above', row);
  await cam(page, 'chute', [3.6, 0.5, 2.0]);
  await shot(page, 'chute-from-side', row);
  await cam(page, 'chute', [2.3, 1.9, 3.1]);
  await set(page, { num: '1' });
}

if (on('belt')) {
  const row = '#s-belt .looks';
  await freeze(page, 0.6);
  await shot(page, 'belt-idle', row);
  // find a time when a parcel is under the gate (gate at x = 0.2 L): step the clock until the lamp turns green
  await freeze(page, 4.0);
  await shot(page, 'belt-t4', row);
  await freeze(page, 4.55);
  await shot(page, 'belt-t4_55', row);
  await cam(page, 'belt', [4.2, 1.0, 0.6]);
  await shot(page, 'belt-from-end', row);
  await cam(page, 'belt', [1.9, 1.8, 3.1]);
  await freeze(page, 0);
}

if (on('floor')) {
  await shot(page, 'floor-markers', '#s-floor .looks');
  await cam(page, 'floor', [0.2, 9, 1.5]);
  await shot(page, 'floor-markers-top', '#s-floor .looks');
  await cam(page, 'floor', [2.9, 5.2, 5.2]);
}

if (on('scene')) {
  const v = '#v-scene';
  await freeze(page, 1.85);
  await set(page, { agv: 'A', arm: 'A', chute: '1', belt: '1', floor: '1', color: 'cam' });
  await shot(page, 'scene-A-A-1-1-1-cam', v, 2500);
  await set(page, { agv: 'B', arm: 'C', chute: '2', belt: '1', floor: '2', color: 'xanh' });
  await shot(page, 'scene-B-C-2-1-2-xanh', v, 2500);
  await set(page, { agv: 'C', arm: 'B', chute: '2', belt: '2', floor: '2', color: 'do' });
  await shot(page, 'scene-C-B-2-2-2-do', v, 2500);
  await cam(page, 'scene', [0.4, 2.4, 7.0]);
  await shot(page, 'scene-C-B-2-2-2-do-low-front', v, 2500);
  await cam(page, 'scene', [-2.2, 2.2, -5.2]);
  await set(page, { agv: 'A', arm: 'A', chute: '1', belt: '1', floor: '1', color: 'xam' });
  await shot(page, 'scene-A-A-1-1-1-xam-from-back', v, 2500);
  await cam(page, 'scene', [4.0, 5.4, 6.6]);
  await shot(page, 'scene-section', '#s-scene', 2000);
  await freeze(page, 0);
}

/** One view blown up to 1000 x 680 (the page layout is restored afterwards). */
async function closeup(page, name, viewId, sec, pos, wait = 1800) {
  await page.evaluate((id) => { const e = document.getElementById(id); e.dataset.old = e.style.cssText; for (const o of document.querySelectorAll('.view')) if (o !== e) o.style.visibility = 'hidden', o.dataset.h = o.style.height, o.style.height = '0px'; e.style.cssText = 'position:fixed;left:0;top:0;width:1000px;height:680px;z-index:4'; document.querySelector('header').style.display = 'none'; }, viewId);
  if (pos) await cam(page, sec, pos);
  await sleep(wait);
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip: { x: 0, y: 0, width: 1000, height: 680 } });
  await page.evaluate((id) => { const e = document.getElementById(id); for (const o of document.querySelectorAll('.view')) if (o !== e) o.style.visibility = '', o.style.height = o.dataset.h; e.style.cssText = e.dataset.old; document.querySelector('header').style.display = ''; }, viewId);
  console.log('shot', name);
}

if (want.includes('closeup')) {
  await set(page, { tray: 'flat', load: 'yes', color: 'cam', grip: 'hold', j1: 62, j2: -95 });
  for (const k of ['A', 'B', 'C']) {
    await set(page, { tray: 'flat' });
    await freeze(page, 0);
    await closeup(page, `closeup-agv-${k}-front`, `v-agv-${k}`, 'agv', [1.25, 0.75, 1.15]);
    await closeup(page, `closeup-agv-${k}-rear`, `v-agv-${k}`, 'agv', [-1.3, 0.6, -1.2]);
    await set(page, { tray: 'tilt' });
    await freeze(page, 1.85);
    await closeup(page, `closeup-agv-${k}-tilt`, `v-agv-${k}`, 'agv', [1.5, 0.55, 0.9]);
  }
  await freeze(page, 0);
  await set(page, { tray: 'flat' });
  await cam(page, 'agv', [1.4, 1.05, 1.7]);
  for (const k of ['A', 'B', 'C']) {
    await closeup(page, `closeup-arm-${k}-side`, `v-arm-${k}`, 'arm', [1.3, 1.3, 3.0]);
    await closeup(page, `closeup-arm-${k}-gripper`, `v-arm-${k}`, 'arm', [2.6, 1.7, 1.3]);
  }
  await cam(page, 'arm', [2.1, 1.55, 3.05]);
  await set(page, { grip: 'open' });
}

if (on('ui')) {
  // the real controls, the way the owner uses them: buttons, slider, drag to orbit, wheel to zoom, copy
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.click('#s-agv button.pick[data-val="B"]');
  await page.click('#s-agv button[data-key="color"][data-val="xanh"]');
  await page.click('#s-agv button[data-key="tray"][data-val="tilt"]');
  await page.locator('#j1').fill('90');
  const camPos = () => page.evaluate(() => { const c = window.preview.sections.agv; return { x: c.cam.position.x, z: c.cam.position.z, d: c.cam.position.distanceTo(c.tgt) }; });
  const before = await camPos();
  const view = page.locator('#v-agv-A');
  await view.evaluate((e) => e.scrollIntoView({ block: 'center' }));
  const bb = await view.boundingBox();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2 + 120, bb.y + bb.height / 2 + 10, { steps: 6 });
  await page.mouse.up();
  const dragged = await camPos();
  await page.mouse.wheel(0, -400);
  await sleep(300);
  const zoomed = await camPos();
  await context.grantPermissions(['clipboard-read', 'clipboard-write']).catch(() => {});
  await page.locator('#copy').evaluate((e) => e.scrollIntoView({ block: 'center' }));
  await page.click('#copy');
  await sleep(300);
  console.log('ui: state', JSON.stringify(await page.evaluate(() => window.preview.state)));
  console.log('ui: orbit moved', Math.abs(dragged.x - before.x) > 0.05, '| zoom', before.d.toFixed(2), '->', zoomed.d.toFixed(2));
  console.log('ui: copied note =', await page.textContent('#copied'), '| clipboard =', await page.evaluate(() => navigator.clipboard.readText()).catch((e) => 'unreadable: ' + e.message));
  await shot(page, 'ui-after-clicks-scene-section', '#s-scene', 2000);
  await set(page, { agv: 'A', color: 'cam', tray: 'flat', j1: 62 });
  await cam(page, 'agv', [1.4, 1.05, 1.7]);
}

if (on('sheet')) {
  const rows = [['Xe AGV – khay phẳng, có hàng', 'agv-flat-loaded-cam'], ['Xe AGV – khay phẳng, không hàng', 'agv-flat-empty-cam'], ['Xe AGV – khay nghiêng, kiện đang trượt', 'agv-tilt-sliding'], ['Tay máy – mở', 'arm-open'], ['Tay máy – kẹp kiện', 'arm-grip']];
  const html = `<html><body style="margin:0;padding:14px;background:#e6e8eb;font:700 22px 'Segoe UI',Arial,sans-serif;color:#22252b;width:1208px">${rows.map(([t, f]) => `<div style="margin:6px 0 4px">${t}</div><img src="${f}.png" style="display:block;width:1208px">`).join('')}</body></html>`;
  const tmp = path.join(OUT, '_sheet.html');
  fs.writeFileSync(tmp, html);
  const sp = await context.newPage();
  await sp.setViewportSize({ width: 1236, height: 900 });
  await sp.goto(pathToFileURL(tmp).href);
  await sp.waitForLoadState('load');
  await sleep(500);
  await sp.screenshot({ path: path.join(OUT, 'contact-sheet-agv-arm.png'), fullPage: true });
  await sp.close();
  fs.unlinkSync(tmp);
  console.log('shot contact-sheet-agv-arm');
}

if (on('extra')) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(1500);
  await page.screenshot({ path: path.join(OUT, 'page-top.png') });
  console.log('choice line:', await page.inputValue('#line'));
  console.log('triangles:', JSON.stringify(await page.evaluate(() => window.__tris)));
}

console.log(logs.length ? logs.join('\n') : 'no console errors');
await context.close();
await browser.close();
