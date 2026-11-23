// Layout B: forced guides (levels 1 and 5, fresh player), a new-piece intro (level 3) and "?" steps. usage: node puzzle-layout-b-guide.mjs <phone|desk>
import { launch, openPage, setSave, openLevel, levelData, solveBoard, shot, focusOf, VIEWPORTS } from './layout-b-lib.mjs';

const tag = process.argv[2] ?? 'phone';
const logs = [];
const checks = [];
const ok = (name, cond, extra = '') => { checks.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const browser = await launch();
const page = await openPage(browser, VIEWPORTS[tag], logs, tag);
const guideOn = () => page.evaluate(() => document.querySelector('.pz-guide')?.classList.contains('on') ?? false);

for (const no of [1, 5]) {
  await setSave(page, { seen: false });
  await openLevel(page, no, { settle: 3000 });
  ok(`L${no} guide leads on first visit`, await guideOn());
  ok(`L${no} skip hidden (mandatory)`, await page.locator('.pz-skip').isHidden());
  await shot(page, `${tag}-guide-L${no}-1-intro`);
  // tapping the corner stage must not leave the board while the guide leads
  await page.click('.pz-pip-hit');
  await page.waitForTimeout(700);
  ok(`L${no} corner tap ignored while guide leads`, (await focusOf(page)) === 'board');
  const next = page.locator('.pz-next');
  if (await next.isVisible()) { await next.click(); await page.waitForTimeout(700); }
  await shot(page, `${tag}-guide-L${no}-2-first-step`);
  const data = await levelData(page, no);
  const placed = await solveBoard(page, data, { piecesOnly: true });
  await page.waitForTimeout(700);
  await shot(page, `${tag}-guide-L${no}-3-wire-step`);
  await solveBoard(page, data, { placedIds: placed });
  await page.waitForTimeout(700);
  await shot(page, `${tag}-guide-L${no}-4-run-step`);
  await page.locator('.pz-btn.run').click();
  await page.waitForTimeout(800);
  ok(`L${no} run -> stage`, (await focusOf(page)) === 'stage');
  await page.waitForSelector('.pz-win', { timeout: 150000 });
  await page.waitForTimeout(1500);
  await shot(page, `${tag}-guide-L${no}-5-win`);
}

// a new-piece intro on a level that has no guide (level 3), then "?" from the stage view
await setSave(page, { seen: false });
await page.evaluate(() => localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(['bot-dau-tien', 'du-ba-thung'])));
await openLevel(page, 3, { settle: 1500 });
await shot(page, `${tag}-intro-L3-1-tip`);
await page.waitForTimeout(18000);
await page.click('.pz-pip-hit');
await page.waitForTimeout(700);
ok('L3 stage big before "?"', (await focusOf(page)) === 'stage');
await page.locator('.pz-hint-btn').click();
await page.waitForTimeout(1200);
ok('L3 "?" brings the board forward', (await focusOf(page)) === 'board');
await shot(page, `${tag}-hint-L3-from-stage`);
// "?" on a param step / wire step: place the pieces first then hint
const data3 = await levelData(page, 3);
await solveBoard(page, data3, { piecesOnly: true });
await page.waitForTimeout(8500);
await page.locator('.pz-hint-btn').click();
await page.waitForTimeout(1200);
await shot(page, `${tag}-hint-L3-wire-step`);

console.log(checks.join('\n'));
console.log(logs.slice(0, 20).join('\n') || 'no console errors');
await browser.close();
