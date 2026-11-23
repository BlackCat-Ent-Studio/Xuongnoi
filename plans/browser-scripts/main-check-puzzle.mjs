// Object cards + two-way highlight in the puzzle (dev server :5214).
import { launch, openPage, setSave, openLevel, focusOf, shot, VIEWPORTS } from './main-check-lib.mjs';

const levels = (process.env.LEVELS ?? '2,5,7').split(',').map(Number);
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
    await page.locator('.pz-task-btn').click(); // closes the task text that sits over the cards
    await page.waitForTimeout(300);
    await shot(page, `${tag}-1-board`);

    // titles: object cards show own name, no generic kind word
    const cards = await page.$$eval('.wc-node.pz-object', (els) => els.map((e) => ({ id: e.dataset.id, kind: e.dataset.kind, name: e.querySelector('.wc-name')?.textContent, subs: e.querySelectorAll('.wc-sub').length, img: !!e.querySelector('.pz-thumb-img'), h: Math.round(e.getBoundingClientRect().height), headH: Math.round(e.querySelector('.wc-node-head').getBoundingClientRect().height) })));
    console.log(tag, JSON.stringify(cards));
    if (cards.length === 0) {
      // levels whose objects are all hidden scenery (level 5) have no object card: nothing may break
      check(`${tag} no object cards, board still fine`, (await page.locator('.wc-node').count()) > 0);
      await page.locator('.pz-pip-hit').click();
      await page.waitForTimeout(1500);
      await page.mouse.click(640, 400);
      await page.waitForTimeout(400);
      check(`${tag} stage tap with no cards lights nothing`, (await page.locator('.wc-node.pz-picked').count()) === 0);
      await shot(page, `${tag}-3-stage-big`);
      await page.close();
      continue;
    }
    check(`${tag} has object cards`, cards.length > 0);
    check(`${tag} no generic kind subtitle`, cards.every((c) => c.subs === 0 && !['Hộp', 'Đồ vật', 'Nhân vật'].includes(c.name)));
    check(`${tag} thumbnails drawn`, cards.every((c) => c.img), JSON.stringify(cards.filter((c) => !c.img).map((c) => c.id)));
    const logic = await page.$$eval('.wc-node:not(.pz-object)', (els) => els.map((e) => e.querySelector('.wc-name')?.textContent));
    console.log(tag, 'logic cards', JSON.stringify(logic));

    // card -> object: tap the first object card header
    const first = cards.find((c) => c.kind === 'character') ?? cards[0];
    const head = page.locator(`.wc-node[data-id="${first.id}"] .wc-node-head`);
    const hb = await head.boundingBox();
    await page.mouse.click(hb.x + hb.width * 0.45, hb.y + hb.height / 2);
    await page.waitForTimeout(500);
    check(`${tag} card picked`, await page.locator(`.wc-node[data-id="${first.id}"].pz-picked`).count() === 1);
    await shot(page, `${tag}-2-card-picked-stage-pip`);
    // second tap lets go
    await page.mouse.click(hb.x + hb.width * 0.45, hb.y + hb.height / 2);
    await page.waitForTimeout(300);
    check(`${tag} second tap clears`, await page.locator('.wc-node.pz-picked').count() === 0);

    // logic card: no pick
    const logicCard = page.locator('.wc-node:not(.pz-object) .wc-node-head').first();
    if (await logicCard.count()) {
      const lb = await logicCard.boundingBox();
      await page.mouse.click(lb.x + lb.width * 0.4, lb.y + lb.height / 2);
      await page.waitForTimeout(200);
      check(`${tag} logic card not picked`, await page.locator('.wc-node.pz-picked').count() === 0);
    }

    // object -> card: swap to the stage, tap the object, the card pulses in the mini board
    const pip = page.locator('.pz-pip-hit');
    await pip.click();
    await page.waitForTimeout(1500);
    check(`${tag} stage big`, (await focusOf(page)) === 'stage');
    await shot(page, `${tag}-3-stage-big`);
    const box0 = await page.locator('.pz-stage').boundingBox();
    // tap every object on the stage at its projected centre; each one must light its own card
    const ids = cards.map((c) => c.id);
    let shotDone = false;
    for (const id of ids) {
      const pt = await page.evaluate((i) => window.__pzScreenOf?.(i) ?? null, id);
      if (!pt) { console.log(tag, 'no screen point for', id); continue; }
      await page.mouse.click(pt.x, pt.y);
      await page.waitForTimeout(350);
      const picked = await page.locator('.wc-node.pz-picked').getAttribute('data-id').catch(() => null);
      // floors and things hidden behind others may not pick themselves: only report
      console.log(tag, 'tap', id, '->', picked);
      if (picked === id && !shotDone) {
        shotDone = true;
        await page.waitForTimeout(700);
        await shot(page, `${tag}-4-object-tapped-card-pulse`);
        // same spot again clears
        await page.waitForTimeout(400);
        await page.mouse.click(pt.x, pt.y);
        await page.waitForTimeout(300);
        check(`${tag} second stage tap clears`, await page.locator('.wc-node.pz-picked').count() === 0);
      }
      await page.waitForTimeout(350);
    }
    check(`${tag} tapping an object on the stage lights its card`, shotDone);
    // empty space lets go
    await page.mouse.click(box0.x + box0.width * 0.5, box0.y + box0.height * 0.5);
    await page.waitForTimeout(300);
    check(`${tag} focus stayed on stage`, (await focusOf(page)) === 'stage');
    await page.close();
  }
}
await browser.close();
console.log(logs.length ? 'LOGS\n' + logs.join('\n') : 'no console errors/warnings');
const bad = asserts.filter(([, ok]) => !ok);
console.log(`${asserts.length - bad.length}/${asserts.length} passed`);
process.exit(bad.length ? 1 : 0);
