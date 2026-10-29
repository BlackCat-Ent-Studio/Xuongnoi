import {
  openBrowser, sleep, record, shot, stepNo, panelInfo, dragKind, wire, nodeOf, selectNode, setNumber, setSelect,
  clickNext, startLesson, hlCount, nodeCount,
} from './tut-common.mjs';

const { browser, page, logs } = await openBrowser();
const URL = `http://localhost:${process.env.PORT ?? 5173}/`;
await page.goto(URL);
await sleep(1200);

// ---- first launch invite ----
const inviteVisible = await page.locator('.tut-invite').isVisible();
record('first launch invite visible', inviteVisible, '');
await shot(page, '00-invite');


await page.locator('[data-tut="invite-yes"]').click().catch(()=>{});
await sleep(400);
await page.locator('.ld-exit').click().catch(()=>{});
await sleep(300);
const L2 = async (label, n) => {
  const got = await stepNo(page);
  record(label, got === `Bước ${n}/14`, `${got} | ${(await panelInfo(page)).title}`);
};
await startLesson(page, 'collect-stars');
await L2('L2 restart intro', 1);
await clickNext(page);
await dragKind(page, 'block', 560, 420);
await L2('L2 star -> type', 3);
await setSelect(page, 'type', 'pickup');
await L2('L2 type -> place', 4);
await setNumber(page, 'position', 4, 0);
await setNumber(page, 'position', 1, 1);
await L2('L2 placed -> touch', 5);
await dragKind(page, 'touch', 560, 620);
await L2('L2 touch -> wire a', 6);
const touchNode = nodeOf('touch');
await wire(page, nodeOf('character'), 'self', touchNode, 'a');
await L2('L2 wired a -> wire b', 7);
// star is the 2nd block node in DOM (pickup); find by index of block nodes
const blocks = page.locator('.wc-node[data-kind="block"]');
const bcount = await blocks.count();
let starIdx = -1;
for (let i = 0; i < bcount; i++) {
  const id = await blocks.nth(i).getAttribute('data-id');
  if (id === 'n5' || i === bcount - 1) starIdx = i; // last one = the one just added
}
const starSel = `.wc-node[data-id="${await blocks.nth(starIdx).getAttribute("data-id")}"]`;
await wire(page, starSel, 'self', touchNode, 'b');
await L2('L2 wired b -> hide', 8);
await shot(page, '09-l2-hide-step');
await wire(page, touchNode, 'touching', starSel, 'hide');
await L2('L2 hide -> counter', 9);
await dragKind(page, 'counter', 500, 520);
await L2('L2 counter -> wire count', 10);
await wire(page, touchNode, 'began', nodeOf('counter'), 'up');
await L2('L2 count -> show', 11);
await dragKind(page, 'show-number', 500, 640);
await L2('L2 show -> wire show', 12);
await wire(page, nodeOf('counter'), 'value', nodeOf('show-number'), 'value');
await L2('L2 wired show -> play', 13);
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(500);
await L2('L2 playing -> done', 14);
const fps = await page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 1500) requestAnimationFrame(f); else res(n / 1.5); }; requestAnimationFrame(f); }));
console.log('fps in lesson-2 play', fps);
await page.keyboard.down('ArrowRight');
const t0=Date.now(); let got=-1;
for (let k=0;k<60;k++){ await sleep(100); const h=await page.locator('.game-box').innerText(); if(/Điểm: 1/.test(h)){got=Date.now()-t0;break;} }
console.log('time-to-score ms', got);
await page.keyboard.up('ArrowRight');
await browser.close();
