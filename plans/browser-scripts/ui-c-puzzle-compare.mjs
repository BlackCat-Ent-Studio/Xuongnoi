// Puzzle ("Xưởng Bot") and simulation close-up, before (:5302, old code) and after (:5301, new code), with a pixel diff.
// Needs both servers: new in app/ on 5301, old (git archive of the base commit) on 5302.
import { launch, sleep } from './ui-c-lib.mjs';
import fs from 'node:fs';

const OUT = 'D:/workspace/GameBuilder-ui-c/plans/reports/shots-ui-c-step1/compare/';
fs.mkdirSync(OUT, { recursive: true });
const IDS = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau'];
const b = await launch();

async function puzzleShot(port, tag, levelNo, vp) {
  const ctx = await b.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const base = `http://localhost:${port}/giai-do.html`;
  await page.goto(base);
  await page.evaluate((ids) => {
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(ids.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(ids.concat(ids.map((i) => 'intro:' + i))));
  }, IDS);
  await page.goto(base + '#/map');
  await page.reload();
  await page.waitForSelector('.pz-stop');
  await sleep(600);
  await page.screenshot({ path: `${OUT}${tag}-puzzle-map.png`, animations: 'disabled' });
  await page.locator('.pz-stop').nth(levelNo - 1).click();
  await page.waitForSelector('.pz-pip-hit');
  await sleep(2500);
  await page.addStyleTag({ content: '.pz-mascot, .pz-guide { visibility: hidden !important; }' });
  await sleep(200);
  const file = `${OUT}${tag}-puzzle-level${levelNo}.png`;
  await page.screenshot({ path: file, animations: 'disabled' });
  const rules = await page.evaluate(() => ({ dataTheme: document.documentElement.getAttribute('data-theme'), dataMode: document.documentElement.getAttribute('data-mode'), cardBg: getComputedStyle(document.querySelector('.wc-node')).backgroundColor, headBg: getComputedStyle(document.querySelector('.wc-node-head')).backgroundColor, wireCase: document.querySelectorAll('.wc-wire-case').length }));
  await ctx.close();
  return { file, rules };
}

const cmp = await b.newPage();
await cmp.setContent('<canvas id=c></canvas>');
async function diff(fa, fb) {
  const a = fs.readFileSync(fa).toString('base64');
  const c = fs.readFileSync(fb).toString('base64');
  return cmp.evaluate(async ([a, c]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = [await load(a), await load(c)];
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: 'DIFFERENT SIZE' };
    const px = (img) => { const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const x = cv.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
    const [da, db] = [px(ia), px(ib)];
    let bad = 0, max = 0;
    for (let i = 0; i < da.length; i += 4) { const d = Math.max(Math.abs(da[i] - db[i]), Math.abs(da[i + 1] - db[i + 1]), Math.abs(da[i + 2] - db[i + 2])); if (d > 0) bad++; if (d > max) max = d; }
    return { size: `${ia.width}x${ia.height}`, differingPixels: bad, of: da.length / 4, maxChannelDiff: max };
  }, [a, c]);
}

for (const [no, vp] of [[1, { width: 1280, height: 720 }], [5, { width: 1280, height: 720 }], [1, { width: 844, height: 390 }]]) {
  const before = await puzzleShot(5302, `before-${vp.width}`, no, vp);
  const after = await puzzleShot(5301, `after-${vp.width}`, no, vp);
  console.log(`puzzle level ${no} ${vp.width}x${vp.height}`, JSON.stringify(await diff(before.file, after.file)), 'before', JSON.stringify(before.rules), 'after', JSON.stringify(after.rules));
}
await b.close();
