import { launch, openPage, setSave, openLevel, levelData, solveBoard, shot, VIEWPORTS } from './l3-stars-lib.mjs';
const logs = [];
const b = await launch();
for (const [name, vp] of Object.entries(VIEWPORTS)) {
  for (const variant of ['won', 'stuck']) {
    const page = await openPage(b, vp, logs, name);
    await setSave(page, { seen: true });
    await openLevel(page, 3);
    const data = await levelData(page, 3);
    if (variant === 'stuck') data.solution = { ...data.solution, wires: data.solution.wires.filter((w) => w.id !== 'h2') };
    await solveBoard(page, data);
    await page.waitForTimeout(500);
    if (variant === 'won') await shot(page, `l3v3-built-${name}`);
    await page.locator('.pz-btn.run').first().click({ force: true });
    await page.waitForTimeout(variant === 'stuck' ? 5500 : 2500);
    await shot(page, `l3v3-${variant === 'stuck' ? 'stuck-star2' : 'run-mid'}-${name}`);
    if (variant === 'won') {
      await page.waitForSelector('.pz-win-card', { timeout: 60000 }).then(() => logs.push(`${name}: win card shown`)).catch(() => logs.push(`${name}: NO win card`));
      await page.waitForTimeout(800);
      await shot(page, `l3v3-won-${name}`);
    } else logs.push(`${name} stuck: win card ${await page.locator('.pz-win-card').count()}`);
    await page.close();
  }
}
console.log(logs.join('\n'));
await b.close();
