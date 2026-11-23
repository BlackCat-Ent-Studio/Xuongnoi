// (1) Wire current in motion: two frames 300 ms apart while a sample runs; dashes and spark must have moved.
// (2) Side-by-side images preview vs app (card close-up, wired board), light and dark, in compare-preview/.
import { launch, openEditor, openSample, fit, sleep } from './ui-c-lib.mjs';
import fs from 'node:fs';

const OUT = 'D:/workspace/GameBuilder-ui-c/plans/reports/shots-ui-c-step1/compare-preview/';
const PV = 'D:/workspace/GameBuilder/plans/previews/ui-redesign-261118/shots/';
fs.mkdirSync(OUT, { recursive: true });
const b = await launch();

// ---- motion ----
{
  const { page, ctx } = await openEditor(b, { theme: 'light', mode: 'student', width: 1440, height: 900 });
  await openSample(page, 'Băng chuyền phân loại'); await fit(page);
  await page.locator('[data-tut="play"]').click(); await sleep(3500);
  const snap = () => page.evaluate(() => {
    const flows = [...document.querySelectorAll('.wc-wire-flow')];
    const sparks = [...document.querySelectorAll('.wc-spark')].map((c) => `${c.getAttribute('cx')},${c.getAttribute('cy')}`);
    return { flows: flows.length, dashOffsets: flows.slice(0, 5).map((f) => getComputedStyle(f).strokeDashoffset), sparks, pills: document.querySelectorAll('.wc-port-val').length, cases: document.querySelectorAll('.wc-wire-case').length };
  });
  const clip = { x: 240, y: 96, width: 640, height: 420 };
  const a = await snap(); await page.screenshot({ path: `${OUT}motion-frame-1.png`, clip });
  await sleep(250);
  const c = await snap(); await page.screenshot({ path: `${OUT}motion-frame-2.png`, clip });
  console.log('frame1', JSON.stringify(a)); console.log('frame2', JSON.stringify(c));
  console.log('dashes moved:', JSON.stringify(a.dashOffsets) !== JSON.stringify(c.dashOffsets), '| spark moved or changed:', JSON.stringify(a.sparks) !== JSON.stringify(c.sparks));
  const cmp = await ctx.newPage(); await cmp.setContent('<canvas></canvas>');
  const diff = await cmp.evaluate(async ([x, y]) => {
    const load = (s) => new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = [await load(x), await load(y)];
    const px = (img) => { const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const g = cv.getContext('2d'); g.drawImage(img, 0, 0); return g.getImageData(0, 0, img.width, img.height).data; };
    const [da, db] = [px(ia), px(ib)]; let n = 0; for (let i = 0; i < da.length; i += 4) if (Math.abs(da[i] - db[i]) + Math.abs(da[i + 1] - db[i + 1]) + Math.abs(da[i + 2] - db[i + 2]) > 30) n++; return n;
  }, [fs.readFileSync(`${OUT}motion-frame-1.png`).toString('base64'), fs.readFileSync(`${OUT}motion-frame-2.png`).toString('base64')]);
  console.log('pixels that changed between the two frames:', diff);
  await ctx.close();
}

// ---- app shots for the side-by-side ----
const pair = {};
for (const theme of ['light', 'dark']) {
  const { page, ctx } = await openEditor(b, { theme, mode: 'student', width: 1440, height: 900 });
  await openSample(page, 'Robot dò đường');
  await page.locator('.wc-pct').click(); await sleep(300);
  await page.locator('[data-tut="play"]').click(); await sleep(3000);
  const card = page.locator('.wc-node[data-kind="motor"], .wc-node').nth(3);
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await card.screenshot({ path: `${OUT}app-${theme}-card.png` }).catch(() => {});
  await page.screenshot({ path: `${OUT}app-${theme}-board.png`, clip: { x: 240, y: 96, width: 920, height: 560 } });
  await ctx.close();
  pair[theme] = true;
}
const page = await b.newPage({ viewport: { width: 1900, height: 700 } });
for (const theme of ['light', 'dark']) {
  const img = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
  const pvBoard = `${PV}c-${theme}-hs-1-editor-1440.png`;
  await page.setContent(`<body style="margin:0;background:#888;font:14px sans-serif;color:#fff"><div style="display:flex;gap:8px"><div><div>PREVIEW (C, ${theme}, Học sinh)</div><div style="width:930px;height:560px;overflow:hidden;position:relative"><img src="${img(pvBoard)}" style="position:absolute;left:-80px;top:-100px"></div></div><div><div>APP (${theme}, Học sinh, running)</div><img src="${img(`${OUT}app-${theme}-board.png`)}" width="920"></div></div></body>`);
  await page.screenshot({ path: `${OUT}side-by-side-${theme}-board.png` });
  const pvCard = `${PV}c-${theme === 'light' ? 'light' : 'dark'}-2-card-closeup-both-modes.png`;
  await page.setContent(`<body style="margin:0;background:#888;font:14px sans-serif;color:#fff"><div style="display:flex;gap:24px;align-items:flex-start"><div><div>PREVIEW cards</div><div style="width:1000px;height:600px;overflow:hidden;position:relative"><img src="${img(pvCard)}" style="position:absolute;left:0;top:0"></div></div><div><div>APP card</div><img src="${img(`${OUT}app-${theme}-card.png`)}"></div></div></body>`);
  await page.screenshot({ path: `${OUT}side-by-side-${theme}-card.png` });
}
await b.close();
