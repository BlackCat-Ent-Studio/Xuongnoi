// Static (edit-state) game view of the robot sample, before (:5302) and after (:5301), plus an amplified difference image.
import { launch, sleep } from './ui-c-lib.mjs';
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder-ui-c/plans/reports/shots-ui-c-step1/compare/';
const b = await launch();
async function grab(port, tag) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: port === 5301 ? 924 : 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('xuong-noi:theme', 'light'); sessionStorage.setItem('s', '1'); } });
  await page.goto(`http://localhost:${port}/`); await sleep(2200);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  await page.locator('[data-menu="file"]').click(); await sleep(200);
  await page.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  await page.locator('.mb-sub .mb-item', { hasText: 'Robot dò đường' }).first().click(); await sleep(3000);
  await page.addStyleTag({ content: '.pip { left: 100px !important; top: 100px !important; right: auto !important; bottom: auto !important; } .cam-reset, .view-max { visibility: hidden !important; }' }); await sleep(800);
  const box = await page.locator('.pip-body').first().boundingBox();
  const file = `${OUT}${tag}-sim-static.png`;
  await page.locator('.pip-body').first().screenshot({ path: file, animations: 'disabled' });
  await ctx.close();
  return { file, box };
}
const a = await grab(5302, 'before');
const c = await grab(5301, 'after');
console.log('boxes', JSON.stringify(a.box), JSON.stringify(c.box));
const page = await b.newPage();
await page.setContent('<canvas id=o></canvas>');
const res = await page.evaluate(async ([x, y]) => {
  const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
  const [ia, ib] = [await load(x), await load(y)];
  const px = (img) => { const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height); };
  const [da, db] = [px(ia), px(ib)];
  const out = document.getElementById('o'); out.width = ia.width; out.height = ia.height;
  const og = out.getContext('2d'); const od = og.createImageData(ia.width, ia.height);
  const hist = { 0: 0, '1-3': 0, '4-15': 0, '16+': 0 };
  for (let i = 0; i < da.data.length; i += 4) {
    const d = Math.max(Math.abs(da.data[i] - db.data[i]), Math.abs(da.data[i + 1] - db.data[i + 1]), Math.abs(da.data[i + 2] - db.data[i + 2]));
    hist[d === 0 ? 0 : d <= 3 ? '1-3' : d <= 15 ? '4-15' : '16+']++;
    od.data[i] = od.data[i + 1] = od.data[i + 2] = Math.min(255, d * 8); od.data[i + 3] = 255;
  }
  og.putImageData(od, 0, 0);
  return { hist, png: out.toDataURL('image/png').split(',')[1] };
}, [fs.readFileSync(a.file).toString('base64'), fs.readFileSync(c.file).toString('base64')]);
fs.writeFileSync(`${OUT}diff-sim-static.png`, Buffer.from(res.png, 'base64'));
console.log(JSON.stringify(res.hist));
await b.close();
