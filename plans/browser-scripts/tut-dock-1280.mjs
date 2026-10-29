import { openBrowser, sleep, record, shot, stepNo, clickNext, nodeCount } from './tut-common.mjs';
const { browser, page, logs } = await openBrowser();
await page.setViewportSize({ width: 1280, height: 720 });
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1500);
record('launchpad visible', await page.locator('.launchpad').isVisible(), '');
const lp = await page.locator('.launchpad-in').boundingBox();
const cv = await page.locator('.wc').boundingBox();
// The card is centred in the canvas minus the PiP column, and must clear both the PiP and the bottom-left corner.
const hits = (r, q) => q && r.x < q.x + q.width && r.x + r.width > q.x && r.y < q.y + q.height && r.y + r.height > q.y;
const pipBox = (await page.locator('.pip').isVisible()) ? await page.locator('.pip').boundingBox() : null;
const cornerBox = await page.locator('.wc-corner').boundingBox();
record('launchpad inside canvas', lp.x >= cv.x && lp.x + lp.width <= cv.x + cv.width && lp.y >= cv.y && lp.y + lp.height <= cv.y + cv.height, JSON.stringify({ lp, cv }));
record('launchpad clear of PiP', !hits(lp, pipBox), JSON.stringify({ lp, pipBox }));
record('launchpad clear of bottom-left corner', !hits(lp, cornerBox), JSON.stringify({ lp, cornerBox }));
await shot(page, '1280-launchpad');
record('left dock collapsed at 1280', await page.locator('.work.left-collapsed').count() === 1, '');
// samples inline
await page.locator('[data-launch="sample"]').click();
const samples = await page.locator('.lp-samples .lp-opt').count();
record('samples listed inline', samples > 0, String(samples));
await page.locator('.lp-samples .lp-opt').first().click();
await sleep(700);
record('sample loaded, launchpad gone', (await nodeCount(page)) > 0 && !(await page.locator('.launchpad').isVisible()), String(await nodeCount(page)));
// start lesson via top-bar menu while the left dock is collapsed
await page.locator('[data-tut="tutorial"]').click();
await page.locator('.tut-menu .menu-item[data-lesson="walk-jump"]').click();
await sleep(800);
record('lesson started', (await stepNo(page)) === 'Bước 1/12', await stepNo(page));
await clickNext(page);
record('left dock expanded for lesson', await page.locator('.work.left-collapsed').count() === 0, '');
record('palette item highlighted', await page.locator('.palette-item[data-kind="block"].tut-hl').count() === 1, '');
const item = await page.locator('.palette-item[data-kind="block"]').boundingBox();
const pal = await page.locator('.palette').boundingBox();
record('highlighted item inside palette viewport', item.y >= pal.y && item.y + item.height <= pal.y + pal.height, JSON.stringify({ item, pal }));
await shot(page, '1280-lesson');
const card = await page.locator('.ld-card').boundingBox();
for (const sel of ['.game-box', '.wc']) {
  const r = await page.locator(sel).boundingBox();
  const shown = await page.locator(sel).isVisible();
  const hit = shown && r && card.x < r.x + r.width && card.x + card.width > r.x && card.y < r.y + r.height && card.y + card.height > r.y;
  record(`card does not overlap ${sel}`, !hit, JSON.stringify({ card, r, shown }));
}
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(800);
const g = await page.locator('.game-box').boundingBox();
const c2 = await page.locator('.ld-card').boundingBox();
record('card does not overlap game while playing', !(c2.y < g.y + g.height && c2.y + c2.height > g.y), JSON.stringify({ c2, g }));
await shot(page, '1280-playing');
console.log('LOGS', JSON.stringify(logs));
record('no console errors', logs.length === 0, logs.join('||'));
await browser.close();
