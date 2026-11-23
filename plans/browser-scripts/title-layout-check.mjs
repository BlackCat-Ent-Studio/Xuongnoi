// Title layout: shots at 4 viewports + overlap check of buttons, sign, bubble, tag and character silhouettes.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-title-fix/';
const base = 'http://localhost:5173/giai-do.html';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const hit = (a, c) => a.x < c.x + c.w && c.x < a.x + a.w && a.y < c.y + c.h && c.y < a.y + a.h;
let bad = 0;
for (const [tag, vp] of [['1920x900', [1920, 900]], ['1280x720', [1280, 720]], ['844x390', [844, 390]], ['1024x768', [1024, 768]]]) {
  const p = await b.newPage({ viewport: { width: vp[0], height: vp[1] } });
  const errs = [];
  p.on('pageerror', (e) => errs.push(e.message));
  await p.goto(base + '#/');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${out}${tag}.png` });
  const boxes = await p.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); const q = e.getBoundingClientRect(); return { x: q.x, y: q.y, w: q.width, h: q.height }; };
    return { play: r('.pz-play'), settings: r('.pz-settings-btn'), plank: r('.pz-plank'), bubble: r('.pz-cat-bubble'), tag: r('.pz-cat-tag') };
  });
  // character silhouettes: hide everything but the canvas, screenshot transparent, scan alpha columns
  await p.evaluate(() => {
    for (const s of ['.pz-ui', '.pz-bg-scene', '.pz-bench']) document.querySelector(s).style.visibility = 'hidden';
    document.querySelector('.pz-frame').style.cssText += ';background:transparent;box-shadow:none';
    for (const e of [document.documentElement, document.body, document.getElementById('app')]) if (e) e.style.setProperty('background', 'transparent', 'important');
    const st = document.createElement('style'); st.textContent = '*{background-image:none!important} .pz-frame::before,.pz-frame::after,body::before,body::after{display:none!important}'; document.head.append(st);
  });
  const clip = await p.locator('.pz-frame').boundingBox();
  await p.addStyleTag({ content: '*{animation:none!important}' });
  const png = await p.screenshot({ clip });
  await p.evaluate(() => { document.querySelector('.pz-char-canvas').style.display = 'none'; });
  const png2 = await p.screenshot({ clip });
  await p.evaluate(() => { document.querySelector('.pz-char-canvas').style.display = ''; });
  const sil = await p.evaluate(async ([b64, b64b]) => {
    const load = async (t) => createImageBitmap(await (await fetch('data:image/png;base64,' + t)).blob());
    const img = await load(b64); const img2 = await load(b64b);
    const c2 = new OffscreenCanvas(img.width, img.height); const x2 = c2.getContext('2d'); x2.drawImage(img2, 0, 0); const d2 = x2.getImageData(0, 0, img.width, img.height).data;
    const c = new OffscreenCanvas(img.width, img.height);
    const x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, img.width, img.height).data;
    const on = (xx, y) => { const i = (y * img.width + xx) * 4; return Math.abs(d[i] - d2[i]) + Math.abs(d[i + 1] - d2[i + 1]) + Math.abs(d[i + 2] - d2[i + 2]) > 60; };
    const cols = new Array(img.width).fill(false);
    for (let y = 0; y < img.height; y++) for (let xx = 0; xx < img.width; xx++) if (on(xx, y)) cols[xx] = true;
    const runs = [];
    let s = -1, gap = 0, last = 0;
    const g = img.width * 0.012;
    for (let xx = 0; xx < img.width; xx++) {
      if (cols[xx]) { if (s < 0) s = xx; gap = 0; last = xx; }
      else if (s >= 0 && ++gap > g) { runs.push([s, last]); s = -1; }
    }
    if (s >= 0) runs.push([s, last]);
    const res = [];
    for (const [a, z] of runs) {
      let y0 = img.height, y1 = 0;
      for (let y = 0; y < img.height; y++) for (let xx = a; xx <= z; xx++) if (on(xx, y)) { if (y < y0) y0 = y; if (y > y1) y1 = y; }
      res.push({ x: a, y: y0, w: z - a + 1, h: y1 - y0 + 1 });
    }
    return { w: img.width, h: img.height, res };
  }, [png.toString('base64'), png2.toString('base64')]);
  const cb = clip;
  const chars = sil.res.map((q) => ({ x: q.x * cb.width / sil.w + cb.x, y: q.y * cb.height / sil.h + cb.y, w: q.w * cb.width / sil.w, h: q.h * cb.height / sil.h }));
  const names = Object.keys(boxes);
  const pairs = [];
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) if (hit(boxes[names[i]], boxes[names[j]])) pairs.push(`${names[i]}x${names[j]}`);
  chars.forEach((c, i) => names.forEach((n) => { if (hit(c, boxes[n])) pairs.push(`char${i}x${n}`); }));
  for (let i = 0; i < chars.length; i++) for (let j = i + 1; j < chars.length; j++) if (hit(chars[i], chars[j])) pairs.push(`char${i}xchar${j}`);
  console.log(tag, 'silhouettes:', chars.length, 'overlaps:', pairs.length ? pairs.join(',') : 'none', 'errs:', errs.length);
  if (chars.length !== 3 || pairs.length) { bad++; console.log(JSON.stringify({ boxes, chars })); }
  await p.close();
}
await b.close();
process.exit(bad ? 1 : 0);
