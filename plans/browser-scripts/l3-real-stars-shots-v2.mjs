import { launch, openPage, setSave, openLevel, levelData, solveBoard, shot, VIEWPORTS } from './l3-stars-lib.mjs';
const logs = [];
const b = await launch();
for (const [name, vp] of Object.entries(VIEWPORTS)) {
  const page = await openPage(b, vp, logs, name);
  await setSave(page, { seen: true });
  await openLevel(page, 3);
  await shot(page, `l3v2-empty-${name}`);
  const data = await levelData(page, 3);
  await solveBoard(page, data);
  await page.waitForTimeout(500);
  await shot(page, `l3v2-built-${name}`);
  await page.locator('.pz-btn.run').first().click({ force: true });
  await page.waitForTimeout(2500);
  await shot(page, `l3v2-run-mid-${name}`);
  await page.waitForSelector('.pz-win-card', { timeout: 60000 }).then(() => logs.push(`${name}: win card shown`)).catch(() => logs.push(`${name}: NO win card`));
  await shot(page, `l3v2-won-${name}`);
  await page.close();
}
console.log(logs.join('\n'));
await b.close();
