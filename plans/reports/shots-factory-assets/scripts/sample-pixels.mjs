// Pixel pictures of every shipped sample through the scene harness (app/tests/showcase/scene-harness.html).
// usage: PW_ENTRY=<file URL of playwright-core index.mjs> node sample-pixels.mjs <take|compare> <tag> [otherTag]
//   take <tag>            draws every sample at tick 0 and after 1, 60 and 300 ticks (env TICKS), writes <out>/<tag>/<sample>-t<ticks>.png
//   compare <a> <b>       compares the two sets pixel by pixel and prints a table (also writes compare-<a>-<b>.json)
// env: BASE (default http://localhost:5184), OUT (default ../pixel-compare next to this script)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PW_ENTRY ?? 'playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? path.join(here, '..', 'pixel-compare');
const BASE = process.env.BASE ?? 'http://localhost:5184';
const TICKS = (process.env.TICKS ?? '0,1,60,300').split(',').map(Number);
const [cmd, tagA, tagB] = process.argv.slice(2);

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1300, height: 820 }, deviceScaleFactor: 1 })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });

if (cmd === 'take') {
  const dir = path.join(OUT, tagA);
  fs.mkdirSync(dir, { recursive: true });
  await page.goto(`${BASE}/tests/showcase/scene-harness.html`);
  await page.waitForFunction(() => !!window.__harness, null, { timeout: 120000 });
  const samples = await page.evaluate(() => window.__harness.samples());
  for (const s of samples) {
    for (const ticks of TICKS) {
      // Twice, to show the picture does not depend on the run: both must be the same bytes.
      const shots = [];
      for (let k = 0; k < 2; k++) {
        await page.evaluate(([id, t]) => window.__harness.run({ sample: id, ticks: t, width: 1280, height: 800 }), [s.id, ticks]);
        await page.waitForLoadState('networkidle');
        await page.evaluate(() => window.__harness.redraw());
        shots.push(await page.evaluate(() => window.__harness.png()));
      }
      fs.writeFileSync(path.join(dir, `${s.id}-t${ticks}.png`), Buffer.from(shots[1].split(',')[1], 'base64'));
      console.log(`${s.id} t${ticks} ${s.mode} repeatable=${shots[0] === shots[1]}`);
    }
  }
} else if (cmd === 'compare') {
  await page.setContent('<canvas id=o></canvas>');
  const rows = [];
  const files = fs.readdirSync(path.join(OUT, tagA)).filter((f) => f.endsWith('.png')).sort();
  for (const f of files) {
    const a = fs.readFileSync(path.join(OUT, tagA, f));
    const bPath = path.join(OUT, tagB, f);
    if (!fs.existsSync(bPath)) { rows.push({ file: f, pixels: null, differing: 'missing' }); continue; }
    const b = fs.readFileSync(bPath);
    const res = await page.evaluate(async ([x, y]) => {
      const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
      const [ia, ib] = [await load(x), await load(y)];
      if (ia.width !== ib.width || ia.height !== ib.height) return { pixels: ia.width * ia.height, differing: -1, max: -1 };
      const px = (img) => { const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
      const [da, db] = [px(ia), px(ib)];
      let differing = 0, max = 0, colours = new Set();
      for (let i = 0; i < da.length; i += 4) {
        const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
        if (d > 0) differing++;
        if (d > max) max = d;
        if (i % 64 === 0) colours.add((da[i] << 16) | (da[i + 1] << 8) | da[i + 2]);
      }
      return { pixels: da.length / 4, differing, max, colours: colours.size };
    }, [a.toString('base64'), b.toString('base64')]);
    rows.push({ file: f, ...res });
  }
  console.log('| picture | pixels | differing | largest channel difference | distinct colours (not a blank frame) |');
  console.log('|---|---|---|---|---|');
  for (const r of rows) console.log(`| ${r.file} | ${r.pixels} | ${r.differing} | ${r.max} | ${r.colours} |`);
  fs.writeFileSync(path.join(OUT, `compare-${tagA}-${tagB}.json`), JSON.stringify(rows, null, 1));
  console.log('total differing pixels:', rows.reduce((n, r) => n + (typeof r.differing === 'number' ? Math.max(r.differing, 0) : 1), 0));
}
if (logs.length) console.log('page log:\n' + [...new Set(logs)].join('\n'));
await browser.close();
