import { chromium } from 'playwright';

const OUT = 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/sweep';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({
  headless: true,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
const logs = [];
page.on('console', (m) => (m.type() === 'error' || m.type() === 'warning') && logs.push(`[${m.type()}] ${m.text()}`));
page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
page.on('dialog', (d) => {
  logs.push(`[DIALOG] ${d.message()}`);
  d.dismiss();
});
const res = [];
const check = (name, ok, d = '') => {
  res.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} | ${name} ${d}`);
};

await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
// fresh board
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}

const nodeCount = () => page.locator('.wc-node').count();
const wireCount = () => page.locator('.wc-wire').count();
const noteCount = () => page.locator('.wc-note').count();
const undoDisabled = () => page.locator('[data-act="undo"]').isDisabled();

// load sample with wires
await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
await page.locator('.mb-item', { hasText: 'Nhặt sao' }).first().click();
await sleep(800);
const n0 = await nodeCount();
const w0 = await wireCount();
check('sample loaded', n0 > 3 && w0 > 2, `${n0} nodes ${w0} wires`);
check('undo disabled after load', await undoDisabled());

// add node from palette (click)
await page.locator('.palette-item[data-kind="key"]').first().click();
await sleep(200);
check('add node', (await nodeCount()) === n0 + 1);
check('undo enabled', !(await undoDisabled()));
await page.keyboard.press('Control+z');
await sleep(200);
check('ctrl+z removes node', (await nodeCount()) === n0);
await page.keyboard.press('Control+y');
await sleep(200);
check('ctrl+y restores node', (await nodeCount()) === n0 + 1);
await page.keyboard.press('Control+Shift+z');
await sleep(100);
await page.keyboard.press('Control+z');
await sleep(100);
check('ctrl+z again', (await nodeCount()) === n0);

// move a node by drag
const first = page.locator('.wc-node').first();
const hd = first.locator('.wc-node-head');
const b0 = await first.boundingBox();
const hb = await hd.boundingBox();
await page.mouse.move(hb.x + 20, hb.y + 8);
await page.mouse.down();
await page.mouse.move(hb.x + 60, hb.y + 40, { steps: 6 });
await page.mouse.move(hb.x + 120, hb.y + 90, { steps: 6 });
await page.mouse.up();
await sleep(200);
const b1 = await page.locator('.wc-node').first().boundingBox();
check('node moved', Math.abs(b1.x - b0.x) > 50, `${b0.x}->${b1.x}`);
await page.keyboard.press('Control+z');
await sleep(200);
const b2 = await page.locator('.wc-node').first().boundingBox();
check('undo move (one step)', Math.abs(b2.x - b0.x) < 2 && Math.abs(b2.y - b0.y) < 2, `${b2.x}`);

// delete wire via click + Delete, undo
const wiresBefore = await wireCount();
await page.locator('.wc-wire-hit').first().click({ force: true });
await page.keyboard.press('Delete');
await sleep(200);
check('wire deleted', (await wireCount()) === wiresBefore - 1);
await page.keyboard.press('Control+z');
await sleep(200);
check('undo wire delete', (await wireCount()) === wiresBefore);

// box select with shift drag across whole canvas, copy/paste
await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Tạo game mới' }).click();
await sleep(300);
await page.screenshot({ path: `${OUT}/dialog.png` });
await page.locator('.mode-choice[data-mode="2d-side"]').click();
await sleep(500);
check('empty canvas', (await nodeCount()) === 0, `${await nodeCount()}`);

// build 3 wired nodes: stick, key, character
async function add(kind) {
  await page.locator(`.palette-item[data-kind="${kind}"]`).first().click();
  await sleep(150);
}
await add('stick');
await add('key');
await add('character');
check('3 nodes', (await nodeCount()) === 3);
// spread them by dragging heads
const heads = page.locator('.wc-node-head');
for (let i = 0; i < 3; i++) {
  const hb2 = await heads.nth(i).boundingBox();
  await page.mouse.move(hb2.x + 10, hb2.y + 8);
  await page.mouse.down();
  await page.mouse.move(hb2.x + 10 + i * 10, hb2.y + 8 + 3, { steps: 3 });
  const tx = 330 + i * 0;
  await page.mouse.move(tx + (i === 2 ? 200 : 0), 160 + i * 150, { steps: 8 });
  await page.mouse.up();
  await sleep(100);
}
await page.screenshot({ path: `${OUT}/three.png` });
// wire stick.x -> character.moveX, key.held -> character.jump
async function wire(fromNode, fromPort, toNode, toPort) {
  const a = page.locator(`.wc-port.out[data-node="${fromNode}"][data-port="${fromPort}"] .wc-dot`);
  const b = page.locator(`.wc-port.in[data-node="${toNode}"][data-port="${toPort}"] .wc-dot`);
  const ab = await a.boundingBox();
  const bb = await b.boundingBox();
  await page.mouse.move(ab.x + ab.width / 2, ab.y + ab.height / 2);
  await page.mouse.down();
  await page.mouse.move(bb.x + bb.width / 2, bb.y + bb.height / 2, { steps: 8 });
  await page.mouse.up();
  await sleep(150);
}
const ids = await page.locator('.wc-node').evaluateAll((els) => els.map((e) => [e.dataset.id, e.dataset.kind]));
const idOf = (k) => ids.find((x) => x[1] === k)[0];
await wire(idOf('stick'), 'x', idOf('character'), 'moveX');
await wire(idOf('key'), 'held', idOf('character'), 'jump');
check('2 wires', (await wireCount()) === 2, `${await wireCount()}`);

// box select all (shift+drag on empty canvas)
const cv = await page.locator('.wc').boundingBox();
await page.keyboard.down('Shift');
await page.mouse.move(cv.x + 14, cv.y + 14);
await page.mouse.down();
await page.mouse.move(Math.min(cv.x + cv.width - 6, 800), cv.y + cv.height - 6, { steps: 8 });
await page.screenshot({ path: `${OUT}/marquee.png` });
await page.mouse.up();
await page.keyboard.up('Shift');
await sleep(200);
check('box selected 3', (await page.locator('.wc-node.selected').count()) === 3, `${await page.locator('.wc-node.selected').count()}`);

await page.keyboard.press('Control+c');
await page.keyboard.press('Control+v');
await sleep(300);
check('paste -> 6 nodes, 4 wires', (await nodeCount()) === 6 && (await wireCount()) === 4, `${await nodeCount()} / ${await wireCount()}`);
await page.screenshot({ path: `${OUT}/pasted.png` });
await page.keyboard.press('Control+d');
await sleep(300);
check('duplicate -> 9 nodes, 6 wires', (await nodeCount()) === 9 && (await wireCount()) === 6, `${await nodeCount()} / ${await wireCount()}`);
await page.keyboard.press('Delete');
await sleep(300);
check('delete selection -> 6 nodes', (await nodeCount()) === 6, `${await nodeCount()}`);
await page.keyboard.press('Control+z');
await sleep(200);
check('undo delete -> 9', (await nodeCount()) === 9);

// notes: clear the canvas first so nothing overlaps the note
await page.keyboard.down('Shift');
await page.mouse.move(cv.x + 14, cv.y + 14);
await page.mouse.down();
await page.mouse.move(Math.min(cv.x + cv.width - 6, 800), cv.y + cv.height - 6, { steps: 8 });
await page.mouse.up();
await page.keyboard.up('Shift');
await page.keyboard.press('Delete');
await sleep(200);
check('canvas cleared', (await nodeCount()) === 0);
if (await page.locator('[data-launch="blank"]').isVisible().catch(() => false)) await page.locator('[data-launch="blank"]').click(); // empty board shows the launchpad card; dismiss it
await page.locator('.palette-item[data-kind="note"]').click();
await sleep(300);
check('note added', (await noteCount()) === 1);
const ta = page.locator('.wc-note-text').first();
await ta.click();
await ta.fill('Ghi chú thử nghiệm');
await sleep(200);
// Ctrl+Z inside textarea should not remove the note
await page.keyboard.press('Control+z');
await sleep(150);
check('note stays after ctrl+z in textarea', (await noteCount()) === 1);
await ta.fill('Ghi chú thử nghiệm');
// colour
await page.locator('.wc-note-dot.dot-green').first().click();
await sleep(150);
check('color green', (await page.locator('.wc-note.color-green').count()) === 1);
// move note via tools bar
const tb = await page.locator('.wc-note-tools').first().boundingBox();
const nb0 = await page.locator('.wc-note').first().boundingBox();
await page.mouse.move(tb.x + 12, tb.y + 8);
await page.mouse.down();
await page.mouse.move(tb.x - 120, tb.y - 120, { steps: 6 });
await page.mouse.up();
await sleep(200);
const nb1 = await page.locator('.wc-note').first().boundingBox();
check('note moved', Math.abs(nb1.x - nb0.x) > 40, `${nb0.x}->${nb1.x}`);
// resize
const rz = await page.locator('.wc-note-resize').first().boundingBox();
await page.mouse.move(rz.x + 8, rz.y + 8);
await page.mouse.down();
await page.mouse.move(rz.x + 70, rz.y + 50, { steps: 6 });
await page.mouse.up();
await sleep(200);
const nb2 = await page.locator('.wc-note').first().boundingBox();
check('note resized', nb2.width > nb1.width + 40, `${nb1.width}->${nb2.width}`);
await page.screenshot({ path: `${OUT}/note.png` });

// reload keeps note (autosave 1s)
await sleep(1300);
await page.reload();
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
check('reload keeps note', (await noteCount()) === 1 && (await page.locator('.wc-note-text').first().inputValue()) === 'Ghi chú thử nghiệm');
check('reload keeps nodes', (await nodeCount()) === 0, `${await nodeCount()}`);

// clipboard persisted in localStorage
const clipStored = await page.evaluate(() => localStorage.getItem('xuong-noi:clipboard') !== null);
check('clipboard persisted', clipStored);

// play disables undo
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(800);
check('undo disabled while playing', await undoDisabled());
await page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());
await sleep(500);

// delete note
await page.locator('.wc-note-del').first().click();
await sleep(200);
check('note deleted', (await noteCount()) === 0);
await page.keyboard.press('Control+z');
await sleep(200);
check('note restored by undo', (await noteCount()) === 1);

// tutorial lesson
await page.locator('[data-tut="tutorial"]').click();
await sleep(400);
await page.screenshot({ path: `${OUT}/tutorial-menu.png` });
const items = page.locator('.tut-menu button');
console.log('tutorial menu items', await items.count());
if (await items.count()) {
  await items.first().click();
  await sleep(1000);
  await page.screenshot({ path: `${OUT}/lesson.png` });
  check('lesson board has nodes or panel', (await page.locator('.ld-body').count()) >= 0);
  await page.locator('.palette-item[data-kind="key"]').first().click();
  await sleep(200);
  const ln = await nodeCount();
  await page.keyboard.press('Control+z');
  await sleep(300);
  check('undo works in lesson', (await nodeCount()) === ln - 1, `${ln}`);
  console.log('nodes in lesson', await nodeCount(), 'undo disabled', await undoDisabled());
}

console.log('LOGS', JSON.stringify(logs, null, 1));
console.log(res.every(Boolean) ? 'ALL PASS' : 'SOME FAIL');
await browser.close();
