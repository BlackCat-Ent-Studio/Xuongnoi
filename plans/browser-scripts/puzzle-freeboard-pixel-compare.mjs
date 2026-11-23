// Pixel compare of one locked card and the tray at zoom 1: main (:5234) vs free board (:5233). Same viewport, same level.
// usage: node puzzle-freeboard-pixel-compare.mjs
import { launch } from './freeboard-lib.mjs';

const IDS = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau'];
const browser = await launch();

async function grab(port, no, vp) {
  const page = await browser.newPage({ viewport: vp, deviceScaleFactor: 1 });
  const base = `http://localhost:${port}/giai-do.html`;
  await page.goto(base);
  await page.evaluate((ids) => {
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(ids.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(ids.concat(ids.map((i) => 'intro:' + i))));
  }, IDS);
  await page.goto(base + '#/map');
  await page.reload();
  await page.waitForSelector('.pz-stop');
  await page.waitForTimeout(500);
  await page.locator('.pz-stop').nth(no - 1).click();
  await page.waitForSelector('.pz-pip-hit');
  await page.waitForTimeout(2500);
  // Overlays that can cover a card or sit behind a translucent tray are hidden while the elements are captured.
  await page.addStyleTag({ content: '.pz-task, .pz-hud, .pz-mascot, .pz-guide { visibility: hidden !important; }' });
  const cards = page.locator('.pz-board .wc-node.pz-locked');
  const n = await cards.count();
  const out = { k: await cards.first().evaluate((el) => /scale\(([\d.]+)\)/.exec(el.style.transform)?.[1]), cards: {} };
  const inView = async (loc) => { const b = await loc.boundingBox(); const tray = await page.locator('.pz-bottom').boundingBox(); return !!b && b.x >= 0 && b.y >= 0 && b.x + b.width <= vp.width && b.y + b.height <= (tray?.y ?? vp.height); };
  for (let i = 0; i < n && Object.keys(out.cards).length < 3; i++) {
    const c = cards.nth(i);
    if (await inView(c)) out.cards[await c.getAttribute('data-id')] = (await c.screenshot()).toString('base64');
  }
  // Each tray chip on its own (the strip between chips is translucent over whatever card is behind it).
  out.chips = [];
  for (const chip of await page.locator('.pz-tray .pz-chip-wrap').all()) out.chips.push((await chip.screenshot()).toString('base64'));
  await page.close();
  return out;
}

const cmpPage = await browser.newPage();
await cmpPage.setContent('<canvas id=c></canvas>');
async function diff(a, b, inset) {
  return cmpPage.evaluate(async ([a, b, inset]) => {
    const load = (s) => new Promise((res) => { const i = new Image(); i.onload = () => res(i); i.src = 'data:image/png;base64,' + s; });
    const [ia, ib] = [await load(a), await load(b)];
    if (ia.width !== ib.width || ia.height !== ib.height) return { size: `${ia.width}x${ia.height} vs ${ib.width}x${ib.height}` };
    const px = (img) => { const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); return x.getImageData(0, 0, img.width, img.height).data; };
    const [da, db] = [px(ia), px(ib)];
    let bad = 0, total = 0, max = 0;
    for (let y = inset; y < ia.height - inset; y++) for (let x = inset; x < ia.width - inset; x++) {
      const k = (y * ia.width + x) * 4;
      const d = Math.max(Math.abs(da[k] - db[k]), Math.abs(da[k + 1] - db[k + 1]), Math.abs(da[k + 2] - db[k + 2]), Math.abs(da[k + 3] - db[k + 3]));
      total++; if (d > 0) bad++; if (d > max) max = d;
    }
    return { size: `${ia.width}x${ia.height}`, differing: bad, of: total, maxChannelDiff: max };
  }, [a, b, inset]);
}

for (const [tag, vp, levels] of [['desk', { width: 1280, height: 720 }, [1, 2, 5]], ['phone', { width: 844, height: 390 }, [1, 5]]]) {
  for (const no of levels) {
    const before = await grab(5234, no, vp);
    const after = await grab(5233, no, vp);
    console.log(`${tag} L${no}: card scale main=${before.k} free=${after.k}`);
    for (const id of Object.keys(before.cards)) {
      if (!after.cards[id]) continue;
      console.log(`  card ${id} whole`, JSON.stringify(await diff(before.cards[id], after.cards[id], 0)), ' interior(6px)', JSON.stringify(await diff(before.cards[id], after.cards[id], 6)));
    }
    const chipDiffs = [];
    for (let i = 0; i < before.chips.length; i++) chipDiffs.push((await diff(before.chips[i], after.chips[i], 0)).differing ?? 'size');
    console.log('  tray chips differing pixels per chip:', JSON.stringify(chipDiffs));
  }
}
await browser.close();
