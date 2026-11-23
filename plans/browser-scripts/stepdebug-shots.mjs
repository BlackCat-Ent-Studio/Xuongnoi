import { launch, openPage, setSave, openLevel, levelData, solveBoard, shot, VIEWPORTS } from './stepdebug-lib.mjs';
const logs = [];
const b = await launch();
const info = [];
for (const no of (process.env.LEVELS ?? '2,5').split(',').map(Number)) {
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    const tag = `l${no}-${name}`;
    const page = await openPage(b, vp, logs, tag);
    await setSave(page, { seen: true });
    await openLevel(page, no);
    const data = await levelData(page, no);
    await solveBoard(page, data);
    await page.waitForTimeout(400);
    // top bar fit
    const bar = await page.evaluate(() => {
      const r = (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.right)]; };
      return { badge: r('.pz-badge'), task: r('.pz-task-btn'), stars: r('.pz-stars'), gear: r('.pz-hud-gear'), step: r('.pz-step-btn'), run: r('.pz-btn.run'), W: innerWidth };
    });
    info.push(tag + ' ' + JSON.stringify(bar));
    await page.mouse.click(5, 5).catch(() => {});
    await page.evaluate(() => document.querySelector('.pz-task-btn')?.getAttribute('aria-expanded') === 'true' && document.querySelector('.pz-task-btn').click());
    await shot(page, `${tag}-1-topbar`);
    await page.locator('.pz-step-btn').click();
    await page.waitForSelector('.pz-step-btn:not([disabled])', { timeout: 15000 });
    await page.waitForTimeout(500);
    await shot(page, `${tag}-2-first-step`);
    const focus = await page.evaluate(() => document.querySelector('.pz-screen').dataset.focus);
    info.push(`${tag} focus=${focus} btn=${await page.locator('.pz-step-btn').textContent()}`);
    let steps = 1, midShot = false, clicks = 0;
    for (; steps < 200; steps++) {
      const won = await page.locator('.pz-win').count();
      if (won) break;
      const btn = page.locator('.pz-step-btn');
      const ready = await btn.isEnabled().catch(() => false);
      if (ready) {
        if (clicks === (no === 2 ? 1 : 3) && !midShot) { midShot = true; await page.waitForTimeout(300); await shot(page, `${tag}-3-later-step`); }
        await btn.click(); clicks++;
      }
      await page.waitForTimeout(ready ? 120 : 200);
    }
    await page.waitForTimeout(900);
    info.push(`${tag} steps=${steps} won=${await page.locator('.pz-win').count()}`);
    await shot(page, `${tag}-4-won`);
    await page.close();
  }
}
await b.close();
console.log(info.join('\n'));
console.log(logs.join('\n'));
