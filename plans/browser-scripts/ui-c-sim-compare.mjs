// Simulation close-ups while the samples run (7 s after Chạy), before (:5302) and after (:5301). Running is time-dependent, so these are for eyes, not for a pixel diff;
// the pixel-exact check is ui-c-sim-static-diff.mjs (edit-state view) and the puzzle compare (same renderer, 0 differing pixels).

import { launch, sleep } from './ui-c-lib.mjs';
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder-ui-c/plans/reports/shots-ui-c-step1/compare/';
fs.mkdirSync(OUT, { recursive: true });
const b = await launch();
const SAMPLES = ['Robot dò đường', 'Robot tránh vật cản', 'Tay máy tự gắp', 'Cửa tự động', 'Băng chuyền phân loại', 'Xe tự hành chở hàng'];

async function grab(port, tag, sample, i) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: port === 5301 ? 924 : 900 }, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript(() => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('xuong-noi:theme', 'light'); sessionStorage.setItem('s', '1'); } });
  await page.goto(`http://localhost:${port}/`); await sleep(2200);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  await page.locator('[data-menu="file"]').click(); await sleep(200);
  await page.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  await page.locator('.mb-sub .mb-item', { hasText: sample }).first().click(); await sleep(1500);
  await page.addStyleTag({ content: '.pip { left: 100px !important; top: 100px !important; right: auto !important; bottom: auto !important; } .cam-reset, .view-max { visibility: hidden !important; }' });
  await page.locator('[data-tut="play"]').click(); await sleep(7000);
  const file = `${OUT}${tag}-sim-${i}.png`;
  await page.locator('.pip-body').first().screenshot({ path: file, animations: 'disabled' });
  await ctx.close();
  return file;
}
const cmp = await b.newPage();
await cmp.setContent('<canvas></canvas>');
async function diff(fa, fb) {
  return cmp.evaluate(async ([a, c]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = [await load(a), await load(c)];
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: `DIFFERENT ${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
    const px = (img) => { const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const x = cv.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
    const [da, db] = [px(ia), px(ib)];
    const W = ia.width;
    let bad = 0, max = 0, total = 0;
    for (let i = 0; i < da.length; i += 4) {
      const p = i / 4;
      if (Math.floor(p / W) > 140 && (p % W) > 190) continue; // the "Về giữa" button
      total++;
      const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2]));
      if (d > 0) bad++;
      if (d > max) max = d;
    }
    return { size: `${W}x${ia.height}`, comparedPixels: total, differingPixels: bad, maxChannelDiff: max };
  }, [fs.readFileSync(fa).toString('base64'), fs.readFileSync(fb).toString('base64')]);
}
let i = 0;
for (const s of SAMPLES) {
  i++;
  const before = await grab(5302, 'before', s, i);
  const after = await grab(5301, 'after', s, i);
  console.log(s, JSON.stringify(await diff(before, after)));
}
await b.close();
