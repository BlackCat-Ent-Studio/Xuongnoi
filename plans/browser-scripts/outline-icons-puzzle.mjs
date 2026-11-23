// Card headers (icon + name, no thumbnail) and outline glow in the puzzle (dev server :5216).
import { launch, openPage, setSave, openLevel, shot, VIEWPORTS, OUT } from './outline-icons-lib.mjs';
const levels = (process.env.LEVELS ?? '1,2,7').split(',').map(Number);
const views = (process.env.VIEWS ?? 'phone,desk').split(',');
const logs = [];
const asserts = [];
const check = (name, ok, extra = '') => { asserts.push([name, ok]); console.log((ok ? 'PASS ' : 'FAIL ') + name + ' ' + extra); };
const browser = await launch();
for (const vp of views) {
  for (const no of levels) {
    const tag = `${vp}-L${no}`;
    const page = await openPage(browser, VIEWPORTS[vp], logs, tag);
    await setSave(page, { seen: true });
    await openLevel(page, no, { settle: 3000 });
    await page.locator('.pz-task-btn').click();
    await page.waitForTimeout(300);
    await shot(page, `${tag}-1-board`);
    const cards = await page.$$eval('.wc-node.pz-object', (els) => els.map((e) => ({ id: e.dataset.id, name: e.querySelector('.wc-name')?.textContent, img: e.querySelectorAll('img').length, icon: !!e.querySelector('.wc-tile svg'), tileW: Math.round(e.querySelector('.wc-tile').getBoundingClientRect().width) })));
    console.log(tag, JSON.stringify(cards));
    check(`${tag} object cards: icon, name, no img`, cards.length > 0 && cards.every((c) => c.img === 0 && c.icon && c.name), '');
    await page.locator('.pz-pip-hit').click();
    await page.waitForTimeout(1500);
    await shot(page, `${tag}-2-stage`);
    let n = 0;
    for (const c of cards) {
      const pt = await page.evaluate((i) => window.__pzScreenOf?.(i) ?? null, c.id);
      if (!pt) continue;
      await page.mouse.click(pt.x, pt.y);
      await page.waitForTimeout(900);
      const picked = await page.locator('.wc-node.pz-picked').getAttribute('data-id').catch(() => null);
      if (picked !== c.id) { console.log(tag, 'tap miss', c.name, picked); continue; }
      n++;
      await page.screenshot({ path: `${OUT}${tag}-glow-${n}-${c.name.replace(/[^a-zA-Z0-9]/g, '_')}.png`, timeout: 120000, clip: { x: Math.max(0, pt.x - 170), y: Math.max(0, pt.y - 150), width: 340, height: 230 } });
      if (n === 1) await shot(page, `${tag}-3-glow-full`);
      await page.mouse.click(pt.x, pt.y); // clears
      await page.waitForTimeout(250);
    }
    check(`${tag} glow shots`, n > 0, String(n));
    await page.close();
  }
}
await browser.close();
console.log(logs.length ? 'LOGS\n' + logs.join('\n') : 'no console errors/warnings');
const bad = asserts.filter(([, ok]) => !ok);
console.log(`${asserts.length - bad.length}/${asserts.length} passed`);
process.exit(bad.length ? 1 : 0);
