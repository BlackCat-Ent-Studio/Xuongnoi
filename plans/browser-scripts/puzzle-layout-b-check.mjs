// Layout B check on :5207. usage: node puzzle-layout-b-check.mjs <phone|desk> <levels e.g. 1,2,3> [skipwin]
// Per level: board-full, hint step, solved board, swapped running (early + mid), win overlay, retry back to board.
import { launch, openPage, setSave, openLevel, levelData, solveBoard, shot, focusOf, VIEWPORTS } from './layout-b-lib.mjs';

const [tag = 'phone', levelsArg = '1,2,3,4,5,6,7,8', flag = ''] = process.argv.slice(2);
const levels = levelsArg.split(',').map(Number);
const logs = [];
const results = [];
const browser = await launch();
const page = await openPage(browser, VIEWPORTS[tag], logs, tag);
await setSave(page, { seen: true });

for (const no of levels) {
  const t0 = Date.now();
  const name = (s) => `${tag}-L${no}-${s}`;
  const row = { level: no };
  await openLevel(page, no);
  row.focus0 = await focusOf(page);
  await shot(page, name('1-board'));
  // hint
  await page.locator('.pz-hint-btn').click();
  await page.waitForTimeout(900);
  await shot(page, name('2-hint'));
  const data = await levelData(page, no);
  await solveBoard(page, data);
  await page.waitForTimeout(500);
  await shot(page, name('3-solved'));
  if (flag === 'skipwin') { results.push(row); continue; }
  await page.locator('.pz-btn.run').click();
  await page.waitForTimeout(700);
  row.focusRunning = await focusOf(page);
  await shot(page, name('4-run-early'));
  await page.waitForTimeout(2500);
  await shot(page, name('5-run-mid'));
  try {
    await page.waitForSelector('.pz-win', { timeout: 150000 });
    row.win = true;
    await page.waitForTimeout(1800);
    await shot(page, name('6-win'));
    await page.locator('.pz-win .pz-btn.ghost').first().click();
    await page.waitForTimeout(1200);
    row.focusAfterRetry = await focusOf(page);
    await shot(page, name('7-after-retry'));
  } catch (e) {
    row.win = false;
    await shot(page, name('6-NOWIN'));
  }
  row.secs = Math.round((Date.now() - t0) / 1000);
  results.push(row);
  console.log(JSON.stringify(row));
}
console.log(JSON.stringify(results));
console.log(logs.slice(0, 30).join('\n') || 'no console errors');
await browser.close();
