import {
  openBrowser, sleep, record, shot, stepNo, panelInfo, dragKind, wire, nodeOf, selectNode, setNumber, setSelect,
  clickNext, startLesson, hlCount, nodeCount,
} from './tut-common.mjs';

const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1500);

const overlaps = async (label) => {
  const card = await page.locator('.ld-card').boundingBox();
  const game = await page.locator('.game-box').boundingBox();
  const gameShown = await page.locator('.game-box').isVisible();
  if (!card || !game || !gameShown) return;
  const hit = card.x < game.x + game.width && card.x + card.width > game.x && card.y < game.y + game.height && card.y + card.height > game.y;
  record(`no overlap card/game: ${label}`, !hit, JSON.stringify({ card, game }));
};

// ---- launchpad on the empty board ----
record('launchpad visible on empty board', await page.locator('.launchpad').isVisible(), '');
await shot(page, '00-launchpad');
await page.locator('[data-launch="learn"]').click();
await sleep(700);
record('Học từ đầu starts lesson 1', (await stepNo(page)) === 'Bước 1/12', await stepNo(page));
record('lessons tab is the open bottom tab', (await page.locator('#tab-lessons').getAttribute('aria-selected')) === 'true', '');
record('launchpad hidden during lesson', !(await page.locator('.launchpad').isVisible()), '');
record('step card visible in dock', await page.locator('.ld-card').isVisible(), '');
await shot(page, '01-l1-intro');

async function expectStep(label, expected, total = 12) {
  const got = await stepNo(page);
  record(label, got === `Bước ${expected}/${total}`, `${got} | ${(await panelInfo(page)).title}`);
}

// ---------- lesson 1 ----------
await clickNext(page);
await expectStep('L1 floor step', 2);
record('L1 palette item highlighted', (await page.locator('.palette-item[data-kind="block"].tut-hl').count()) === 1, '');
// Hide the item behind a search, then "Chỉ cho tôi" must reveal it.
await page.locator('.pn-search-input').fill('zzzz');
await sleep(150);
record('palette item hidden by search', (await page.locator('.palette-item[data-kind="block"]').count()) === 0, '');
await page.locator('.ld [data-tut="show"]').click();
await sleep(300);
record('Chỉ cho tôi clears search and highlights', (await page.locator('.palette-item[data-kind="block"].tut-hl').count()) === 1, '');
await shot(page, '02-l1-add-floor');
await dragKind(page, 'block', 60, 50);
await expectStep('L1 after block -> size', 3);
record('L1 size row highlighted', (await page.locator('.prop-row[data-param="size"].tut-hl').count()) === 1, '');
await setNumber(page, 'size', 20, 0);
await expectStep('L1 size 20 -> hero', 4);
await dragKind(page, 'character', 330, 50);
await expectStep('L1 hero -> play', 5);
record('L1 play button highlighted', (await page.locator('[data-tut="play"].tut-hl').count()) === 1, '');
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(600);
await expectStep('L1 playing -> back to edit', 6);
await overlaps('l1 playing');
await shot(page, '03-l1-playing');
record('L1 stop button highlighted while playing', (await page.locator('.pbtn.stop.tut-hl').count()) === 1, '');
await page.locator('.pbtn.stop').click();
await sleep(500);
await expectStep('L1 edit -> stick', 7);
await dragKind(page, 'stick', 60, 260);
await expectStep('L1 stick -> wire', 8);
record('L1 wire step highlights 2 ports', (await hlCount(page)) === 2, String(await hlCount(page)));
await wire(page, nodeOf('stick'), 'x', nodeOf('character'), 'moveX');
await expectStep('L1 wired stick -> key', 9);
await dragKind(page, 'key', 60, 380);
await expectStep('L1 key -> wire key', 10);
await wire(page, nodeOf('key'), 'held', nodeOf('character'), 'jump');
await expectStep('L1 wired key -> play', 11);
// Back / forward buttons
await page.locator('.ld [data-tut="back"]').click();
await sleep(200);
await expectStep('L1 Quay lại goes to 10', 10);
await page.locator('.ld [data-tut="next"]').click();
await sleep(300);
await expectStep('L1 Bước tiếp returns to 11', 11);
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(500);
await expectStep('L1 playing -> done', 12);
await overlaps('l1 last step playing');
await page.keyboard.down('ArrowRight');
await sleep(600);
await page.keyboard.up('ArrowRight');
await shot(page, '05-l1-done');
const nextText = await page.locator('.ld [data-tut="next"]').innerText();
record('L1 last button says Hoàn thành', nextText === 'Hoàn thành', nextText);
await clickNext(page);
record('L1 card back to idle', !(await page.locator('.ld-body').isVisible()), '');
record('L1 board restored to empty', (await nodeCount(page)) === 0, String(await nodeCount(page)));
record('launchpad back after lesson on empty board', await page.locator('.launchpad').isVisible(), '');
record('lesson 1 tick shown', (await page.locator('.ld-item.done[data-lesson="walk-jump"]').count()) === 1, '');
await shot(page, '06-l1-restored');

// ---------- user board, then lesson 3 ----------
await page.locator('[data-launch="blank"]').click();
record('Tự làm dismisses launchpad', !(await page.locator('.launchpad').isVisible()), '');
await page.locator('.name-input').fill('Game rieng cua toi');
await dragKind(page, 'block', 80, 80);
await sleep(300);
record('user board has 1 node', (await nodeCount(page)) === 1, String(await nodeCount(page)));

await startLesson(page, 'win-lose');
const fit = async () => { await page.locator('.wc-corner [aria-label="Vừa màn hình"]').click(); await sleep(250); };
const L3 = (label, n) => expectStep(label, n, 14);
await L3('L3 intro', 1);
record('L3 base has 8 nodes', (await nodeCount(page)) === 8, String(await nodeCount(page)));
await clickNext(page);
await L3('L3 goal', 2);
await selectNode(page, 'counter');
await setNumber(page, 'target', 1);
await L3('L3 goal set -> add end', 3);
await dragKind(page, 'win-lose', 600, 60);
await L3('L3 end -> wire win', 4);
await fit();
await wire(page, nodeOf('counter'), 'reached', nodeOf('win-lose'), 'win');
await L3('L3 wired win -> compare', 5);
await dragKind(page, 'compare', 600, 280);
await L3('L3 compare -> wire height', 6);
await fit();
await wire(page, nodeOf('character'), 'y', nodeOf('compare'), 'a');
await L3('L3 height -> op', 7);
await setSelect(page, 'op', 'lt');
await L3('L3 op -> const', 8);
await dragKind(page, 'const', 30, 400);
await L3('L3 const -> value', 9);
await setNumber(page, 'value', -5);
await L3('L3 value -> wire limit', 10);
await shot(page, 'l3-pre-limit');
await fit();
await wire(page, nodeOf('const'), 'value', nodeOf('compare'), 'b');
await shot(page, 'l3-post-limit');
await L3('L3 limit -> wire lose', 11);
await shot(page, 'l3-pre-lose');
await fit();
await wire(page, nodeOf('compare'), 'out', nodeOf('win-lose'), 'lose');
await L3('L3 lose -> play', 12);
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(500);
await L3('L3 playing -> win step', 13);
await overlaps('l3 playing');
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 30 && (await stepNo(page)) === 'Bước 13/14'; i++) await sleep(250);
await page.keyboard.up('ArrowRight');
await sleep(500);
await L3('L3 won -> done', 14);
await shot(page, '14-l3-won');
await clickNext(page);
record('L3 finished, board restored', (await page.locator('.name-input').inputValue()) === 'Game rieng cua toi' && (await nodeCount(page)) === 1, '');
record('2 lesson ticks', (await page.locator('.ld-item.done').count()) === 2, String(await page.locator('.ld-item.done').count()));

await sleep(1500);
const autosave = await page.evaluate(() => localStorage.getItem('xuong-noi:autosave') ?? '');
record('autosave holds user board', autosave.includes('Game rieng cua toi') && !autosave.includes('Bài '), autosave.slice(0, 60));

console.log('LOGS:', JSON.stringify(logs));
record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
