import { reveal, launch, openPage, setSave, openLevel, levelData, solveBoard, shot, VIEWPORTS } from './stepdebug-lib.mjs';
const logs = [];
const b = await launch();
// The pause we want: the fired pin sits on this card.
const WANT = { 3: /^Chạm nhau/, 2: /^Công tắc nhớ/ };
for (const no of [3, 2]) {
  for (const [name, vp] of Object.entries(VIEWPORTS)) {
    const tag = `v2-l${no}-${name}`;
    const page = await openPage(b, vp, logs, tag);
    await setSave(page, { seen: true });
    await openLevel(page, no);
    const data = await levelData(page, no);
    await solveBoard(page, data);
    await page.evaluate(() => document.querySelector('.pz-task-btn')?.getAttribute('aria-expanded') === 'true' && document.querySelector('.pz-task-btn').click());
    await page.locator('.pz-step-btn').click();
    let got = false, n = 0;
    for (let i = 0; i < 400 && !got; i++) {
      if (await page.locator('.pz-win').count()) break;
      const btn = page.locator('.pz-step-btn');
      if (!(await btn.isEnabled().catch(() => false))) { await page.waitForTimeout(150); continue; }
      n++;
      await page.waitForTimeout(250);
      const fired = await page.evaluate(() => [...document.querySelectorAll('.pz-fired-pin')].map((d) => (d.closest('.wc-node')?.innerText.split('\n')[0] ?? '') + ':' + (d.closest('.wc-port')?.innerText ?? '').trim()));
      if (fired.some((f) => WANT[no].test(f))) {
        console.log(tag, 'pause', n, JSON.stringify(fired));
        await page.mouse.move(vp.width - 40, Math.round(vp.height * 0.55));
        await page.mouse.wheel(0, 300);
        await page.waitForTimeout(300);
        await reveal(page, page.locator('.wc-node', { hasText: no === 3 ? 'Chạm nhau' : 'Công tắc nhớ' }).locator('.pz-fired-pin').first());
        await page.waitForTimeout(300);
        await shot(page, tag);
        await page.locator('.pz-pip-hit').click();
        await page.waitForTimeout(900);
        await shot(page, `${tag}-stage`);
        got = true;
        break;
      }
      await btn.click();
      await page.waitForTimeout(100);
    }
    if (!got) console.log(tag, 'NOT FOUND after', n);
    await page.close();
  }
}
await b.close();
console.log(logs.join('\n'));
