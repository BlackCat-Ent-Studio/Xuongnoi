import {
  openBrowser, sleep, record, shot, stepNo, panelInfo, dragKind, nodeOf, selectNode, setNumber, setSelect,
  clickNext, startLesson, hlCount, nodeCount,
} from 'file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/tut-common.mjs';


import { dot as _dot } from 'file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/tut-common.mjs';
let wireNo = 0;
async function wire(page, fromNode, fromPort, toNode, toPort) {
  wireNo++;
  const a = await _dot(page, fromNode, fromPort, 'out');
  const b = await _dot(page, toNode, toPort, 'in');
  const hit = (p) => page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.className && e.className.baseVal !== undefined ? e.className.baseVal : e.className) + '|' + (e.closest('.wc-node')?.dataset.kind ?? '') + '|' + (e.closest('.wc-port')?.dataset.port ?? '') : null; }, [p.x + p.width / 2, p.y + p.height / 2]);
  const geo = () => page.evaluate(() => { const w = document.querySelector('.wc'); const f = (s) => { const e = document.querySelector(s); return e ? [e.scrollTop, e.scrollLeft] : null; }; return { wcScroll: [w.scrollTop, w.scrollLeft], world: document.querySelector('.wc-world').style.transform, doc: [document.scrollingElement.scrollTop, document.scrollingElement.scrollLeft], wcRect: (({x,y,width,height}) => [x,y,width,height].map(Math.round))(w.getBoundingClientRect()), active: document.activeElement?.className || document.activeElement?.tagName }; });
  const g0 = await geo();
  const ha = await hit(a), hb = await hit(b);
  const before = await page.locator('.wc-wire').count();
  await page.evaluate(() => { window.__ev = []; if (!window.__evInstalled) { window.__evInstalled = true; for (const t of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture']) window.addEventListener(t, (e) => { if (t !== 'pointermove' || window.__ev.length < 40) window.__ev.push(t + ':' + Math.round(e.clientX) + ',' + Math.round(e.clientY) + ':' + ((e.target.className && e.target.className.baseVal === undefined ? e.target.className : e.target.tagName) || '')); }, true); } });
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2, { steps: 8 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 3 });
  const hb2 = await hit(b);
  await page.mouse.up();
  await sleep(200);
  const after = await page.locator('.wc-wire').count();
  if (after !== before + 1) {
    const ev = await page.evaluate(() => window.__ev);
    console.log('WIREFAIL #' + wireNo, 'GEO0', JSON.stringify(g0), 'GEO1', JSON.stringify(await geo()), `${fromPort}->${toPort}`, JSON.stringify({ a, b, ha, hb, hb2, before, after, ev: ev.slice(0, 6).concat(ev.slice(-6)) }));
    await page.screenshot({ path: 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/l14/wirefail-' + wireNo + '.png' });
  }
}

const { browser, page, logs } = await openBrowser();
const URL = 'http://localhost:5194/';
await page.goto(URL);
await sleep(1200);

// ---- first launch invite ----
const inviteVisible = await page.locator('.tut-invite').isVisible();
record('first launch invite visible', inviteVisible, '');
await shot(page, '00-invite');

// make a recognisable user board
await page.locator('.name-input').fill('Game rieng cua toi');
await dragKind(page, 'block', 80, 80);
await sleep(300);
const userNodes = await nodeCount(page);
record('user board has 1 node', userNodes === 1, String(userNodes));

await page.locator('[data-tut="invite-yes"]').click();
await sleep(600);
record('invite closes + lesson 1 starts', (await stepNo(page)) === 'Bước 1/12', await stepNo(page));
record('lesson board is empty', (await nodeCount(page)) === 0, String(await nodeCount(page)));
record('name shows lesson board', (await page.locator('.name-input').inputValue()).startsWith('Bài 1'), await page.locator('.name-input').inputValue());
await shot(page, '01-l1-intro');

async function expectStep(label, expected) {
  const got = await stepNo(page);
  record(label, got === `Bước ${expected}/12`, `${got} | ${(await panelInfo(page)).title}`);
}

// ---------- lesson 1 ----------
await clickNext(page);
await expectStep('L1 floor step', 2);
record('L1 palette item highlighted', (await page.locator('.palette-item[data-kind="block"].tut-hl').count()) === 1, '');
await shot(page, '02-l1-add-floor');
await dragKind(page, 'block', 60, 50);
await expectStep('L1 after block -> size', 3);
record('L1 size row highlighted', (await page.locator('.prop-row[data-param="size"].tut-hl').count()) === 1, '');
await setNumber(page, 'size', 20, 0);
await expectStep('L1 size 20 -> hero', 4);
await dragKind(page, 'character', 330, 50);
await expectStep('L1 hero -> play', 5);
record('L1 play button highlighted', (await page.locator('[data-tut="play"].tut-hl').count()) === 1, '');
await page.locator('[data-tut="play"]').click();
await sleep(600);
await expectStep('L1 playing -> back to edit', 6);
await shot(page, '03-l1-playing');
await page.locator('[data-tut="play"]').click();
await sleep(500);
await expectStep('L1 edit -> stick', 7);
await dragKind(page, 'stick', 60, 260);
await expectStep('L1 stick -> wire', 8);
const hl = await hlCount(page);
record('L1 wire step highlights 2 ports', hl === 2, String(hl));
await shot(page, '04-l1-wire-stick');
await wire(page, nodeOf('stick'), 'x', nodeOf('character'), 'moveX');
await expectStep('L1 wired stick -> key', 9);
await dragKind(page, 'key', 60, 460);
await expectStep('L1 key -> wire key', 10);
await wire(page, nodeOf('key'), 'held', nodeOf('character'), 'jump');
await expectStep('L1 wired key -> play', 11);
await page.locator('[data-tut="play"]').click();
await sleep(500);
await expectStep('L1 playing -> done', 12);
await page.keyboard.down('ArrowRight');
await sleep(600);
await page.keyboard.up('ArrowRight');
await page.keyboard.down('Space');
await sleep(300);
await page.keyboard.up('Space');
await shot(page, '05-l1-done');
const nextText = await page.locator('.tut-panel [data-tut="next"]').innerText();
record('L1 last button says Hoàn thành', nextText === 'Hoàn thành', nextText);
await clickNext(page);
record('L1 panel closed after finish', !(await page.locator('.tut-panel').isVisible()), '');
record('L1 board restored (name)', (await page.locator('.name-input').inputValue()) === 'Game rieng cua toi', await page.locator('.name-input').inputValue());
record('L1 board restored (1 node)', (await nodeCount(page)) === 1, String(await nodeCount(page)));
record('L1 not playing after finish', (await page.locator('[data-tut="play"]').innerText()) === 'Chơi', '');
await shot(page, '06-l1-restored');
const status = await page.locator('.status').innerText();
record('finish status message', status.includes('Đã xong') || status.includes('đã xong'), status);

// ---------- lesson 2 ----------
await page.locator('[data-tut="tutorial"]').click();
await shot(page, '07-menu-with-done');
const doneMarks = await page.locator('.tut-done').count();
record('menu shows done mark for lesson 1', doneMarks === 1, String(doneMarks));
await page.locator('[data-lesson="collect-stars"]').click();
await sleep(600);
const L2 = async (label, n) => {
  const got = await stepNo(page);
  record(label, got === `Bước ${n}/14`, `${got} | ${(await panelInfo(page)).title}`);
};
await L2('L2 intro', 1);
record('L2 base has 4 nodes', (await nodeCount(page)) === 4, String(await nodeCount(page)));
await shot(page, '08-l2-intro');
// Thoát mid-lesson
await clickNext(page);
await L2('L2 add star', 2);
await page.locator('.tut-exit').click();
await sleep(500);
record('L2 exit hides panel', !(await page.locator('.tut-panel').isVisible()), '');
record('L2 exit restores user board', (await page.locator('.name-input').inputValue()) === 'Game rieng cua toi' && (await nodeCount(page)) === 1, '');
// restart
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
await page.locator('[data-tut="play"]').click();
await sleep(500);
await L2('L2 playing -> done', 14);
// Hold right until the score shows (the lesson editor can run slowly in headless): up to 10 s, and report how long it took.
await page.keyboard.down('ArrowRight');
const holdStart = Date.now();
let hud = '';
while (Date.now() - holdStart < 10000) {
  hud = await page.locator('.game-box').innerText();
  if (/Điểm: 1/.test(hud)) break;
  await sleep(100);
}
await page.keyboard.up('ArrowRight');
const holdMs = Date.now() - holdStart;
await sleep(300);
await shot(page, '10-l2-collected');
record('L2 HUD shows score 1', /Điểm: 1/.test(hud), `${JSON.stringify(hud)} after ${holdMs} ms`);
await clickNext(page);
record('L2 finished, board restored', (await page.locator('.name-input').inputValue()) === 'Game rieng cua toi' && (await nodeCount(page)) === 1, '');

// ---------- lesson 3 ----------
await startLesson(page, 'win-lose');
const L3 = async (label, n) => {
  const got = await stepNo(page);
  record(label, got === `Bước ${n}/14`, `${got} | ${(await panelInfo(page)).title}`);
};
await L3('L3 intro', 1);
record('L3 base has 8 nodes', (await nodeCount(page)) === 8, String(await nodeCount(page)));
await shot(page, '11-l3-intro');
await clickNext(page);
await L3('L3 goal', 2);
await selectNode(page, 'counter');
await shot(page, '12-l3-goal');
await setNumber(page, 'target', 1);
await L3('L3 goal set -> add end', 3);
await dragKind(page, 'win-lose', 600, 60);
await L3('L3 end -> wire win', 4);
await wire(page, nodeOf('counter'), 'reached', nodeOf('win-lose'), 'win');
await L3('L3 wired win -> compare', 5);
await dragKind(page, 'compare', 600, 280);
await L3('L3 compare -> wire height', 6);
await wire(page, nodeOf('character'), 'y', nodeOf('compare'), 'a');
await L3('L3 height -> op', 7);
await setSelect(page, 'op', 'lt');
await L3('L3 op -> const', 8);
await dragKind(page, 'const', 600, 500);
await L3('L3 const -> value', 9);
await setNumber(page, 'value', -5);
await L3('L3 value -> wire limit', 10);
await wire(page, nodeOf('const'), 'value', nodeOf('compare'), 'b');
await L3('L3 limit -> wire lose', 11);
await wire(page, nodeOf('compare'), 'out', nodeOf('win-lose'), 'lose');
await L3('L3 lose -> play', 12);
await shot(page, '13-l3-wired');
await page.locator('[data-tut="play"]').click();
await sleep(500);
await L3('L3 playing -> win step', 13);
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 30 && (await stepNo(page)) === "Bước 13/14"; i++) await sleep(250);
await page.keyboard.up('ArrowRight');
await sleep(500);
await L3('L3 won -> done', 14);
await shot(page, '14-l3-won');
await clickNext(page);
record('L3 finished, board restored', (await page.locator('.name-input').inputValue()) === 'Game rieng cua toi' && (await nodeCount(page)) === 1, '');
const doneAll = await (async () => {
  await page.locator('[data-tut="tutorial"]').click();
  return page.locator('.tut-done').count();
})();
record('menu shows 3 done marks', doneAll === 3, String(doneAll));
await shot(page, '15-menu-all-done');

// autosave never took a lesson board
await sleep(1500);
const autosave = await page.evaluate(() => localStorage.getItem('xuong-noi:autosave') ?? '');
record('autosave holds user board, not a lesson', autosave.includes('Game rieng cua toi') && !autosave.includes('Bài '), autosave.slice(0, 80).replace(/\s+/g, ' '));
const stash = await page.evaluate(() => localStorage.getItem('xuong-noi:tutorial-stash'));
record('stash cleared', stash === null, String(stash));

console.log('LOGS:', JSON.stringify(logs));
record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
