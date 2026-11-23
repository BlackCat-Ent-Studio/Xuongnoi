// Plays the first two lessons through in the editor (default look: Học sinh) and checks, at every step, that the
// highlighted element ("tut-hl") is the one the step is about and sits fully on screen.
// Usage: THEME=light MODE=student node ui-c-tutorial.mjs   (needs the 5301 server)
import { launch, openEditor, sleep } from './ui-c-lib.mjs';
import fs from 'node:fs';

const OUT = 'D:/workspace/GameBuilder-ui-c/plans/reports/shots-ui-c-step1/tutorial/';
fs.mkdirSync(OUT, { recursive: true });
const theme = process.env.THEME ?? 'light';
const mode = process.env.MODE ?? 'student';
const b = await launch();
// The lesson boards need room for several tall cards in Học sinh, so the window is bigger than the screenshots' 1440x900.
const { page, logs } = await openEditor(b, { theme, mode, width: Number(process.env.W ?? 1700), height: Number(process.env.H ?? 1100) });
let fails = 0;
const rec = (check, pass, detail = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${detail}`); };
const shot = (n) => page.screenshot({ path: `${OUT}${theme}-${mode}-${n}.png` });

const stepNo = async () => {
  const aria = (await page.locator('.ld-steps').getAttribute('aria-label').catch(() => null)) ?? '';
  const m = /Bước (\d+) trên (\d+)/.exec(aria);
  return m ? { n: Number(m[1]), of: Number(m[2]) } : { n: 0, of: 0 };
};
async function expectStep(label, n, of) {
  const s = await stepNo();
  rec(label, s.n === n && s.of === of, `at ${s.n}/${s.of}`);
}
/** What the step highlights, and whether it is whole on screen. */
async function hl() {
  return page.$$eval('.tut-hl', (els) => els.map((e) => {
    const r = e.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    const target = e.dataset.kind ?? e.dataset.param ?? e.dataset.tut ?? (e.className || e.tagName).toString().split(' ')[0];
    return { target, port: e.dataset.port ?? null, onScreen: r.width > 0 && r.height > 0 && r.left >= -1 && r.top >= -1 && r.right <= vw + 1 && r.bottom <= vh + 1, w: Math.round(r.width), h: Math.round(r.height) };
  }));
}
async function expectHl(label, want, count = 1) {
  const got = await hl();
  const ok = got.length === count && got.every((g) => g.onScreen) && (want === null || got.some((g) => g.target === want));
  rec(label, ok, JSON.stringify(got));
}
async function dragKind(kind, dx, dy) {
  const item = page.locator(`.palette-item[data-kind="${kind}"]`);
  await item.scrollIntoViewIfNeeded();
  const ib = await item.boundingBox();
  const cb = await page.locator('.wc').boundingBox();
  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await page.mouse.down();
  await page.mouse.move(ib.x + ib.width / 2 + 30, ib.y + ib.height / 2 + 10, { steps: 3 });
  await page.mouse.move(cb.x + dx, cb.y + dy, { steps: 6 });
  await page.mouse.up();
  await sleep(250);
}
async function wire(fromNode, fromPort, toNode, toPort) {
  const a = await page.locator(`${fromNode} .wc-port[data-port="${fromPort}"][data-dir="out"] .wc-dot`).first().boundingBox();
  const c = await page.locator(`${toNode} .wc-port[data-port="${toPort}"][data-dir="in"] .wc-dot`).first().boundingBox();
  if (!a || !c) throw new Error(`port missing ${fromNode}.${fromPort} -> ${toNode}.${toPort}`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(c.x + c.width / 2 - 20, c.y + c.height / 2, { steps: 8 });
  await page.mouse.move(c.x + c.width / 2, c.y + c.height / 2, { steps: 3 });
  await page.mouse.up();
  await sleep(250);
}
const node = (kind) => `.wc-node[data-kind="${kind}"]`;
const next = async () => { await page.locator('.ld [data-tut="next"]').click(); await sleep(300); };
const setNumber = async (param, value, axis = 0) => { await page.locator(`.prop-row[data-param="${param}"] input`).nth(axis).fill(String(value)); await sleep(200); };
const setSelect = async (param, value) => { await page.locator(`.prop-row[data-param="${param}"] select`).selectOption(value); await sleep(200); };
const togglePlay = () => page.evaluate(() => (document.querySelector('.app.playing') ? document.querySelector('.pbtn.stop') : document.querySelector('[data-tut="play"]')).click());

// ---------- lesson 1 ----------
await page.locator('[data-launch="learn"]').click(); await sleep(800);
await expectStep('L1 intro', 1, 12);
await shot('l1-01-intro');
await next();
await expectStep('L1 floor', 2, 12);
await expectHl('L1 palette item "Vật thể" highlighted', 'block');
await shot('l1-02-palette');
await dragKind('block', 60, 50);
await expectStep('L1 size', 3, 12);
await expectHl('L1 size row highlighted', 'size');
await shot('l1-03-size');
await setNumber('size', 20, 0);
await expectStep('L1 hero', 4, 12);
await dragKind('character', 330, 50);
await expectStep('L1 play', 5, 12);
await expectHl('L1 play button highlighted', 'play');
await shot('l1-05-play');
await togglePlay(); await sleep(700);
await expectStep('L1 running', 6, 12);
await expectHl('L1 stop button highlighted', null);
await page.locator('.pbtn.stop').click(); await sleep(500);
await expectStep('L1 back to editing', 7, 12);
await dragKind('stick', 60, 260);
await expectStep('L1 wire stick', 8, 12);
await expectHl('L1 wire step marks both ports', null, 2);
await shot('l1-08-wire-ports');
await wire(node('stick'), 'x', node('character'), 'moveX');
await expectStep('L1 key', 9, 12);
await dragKind('key', 60, 380);
await expectStep('L1 wire key', 10, 12);
await expectHl('L1 wire key marks both ports', null, 2);
await wire(node('key'), 'held', node('character'), 'jump');
await expectStep('L1 play again', 11, 12);
await togglePlay(); await sleep(600);
await expectStep('L1 done', 12, 12);
await shot('l1-12-done');
await next();
rec('L1 panel closed after finish', !(await page.locator('.ld-body').isVisible()));

// ---------- lesson 2 ----------
await page.locator('#tab-lessons').click();
await page.locator('.ld-item[data-lesson="collect-stars"]').click(); await sleep(700);
await expectStep('L2 intro', 1, 14);
await shot('l2-01-intro');
await next();
await expectStep('L2 add star', 2, 14);
await expectHl('L2 palette item highlighted', 'block');
await dragKind('block', 560, 420);
await expectStep('L2 type', 3, 14);
await expectHl('L2 type row highlighted', 'type');
await shot('l2-03-type');
await setSelect('type', 'pickup');
await expectStep('L2 position', 4, 14);
await setNumber('position', 4, 0);
await setNumber('position', 1, 1);
await expectStep('L2 touch card', 5, 14);
await dragKind('touch', 900, 120);
await expectStep('L2 wire a', 6, 14);
await expectHl('L2 wire a marks both ports', null, 2);
await shot('l2-06-wire-a');
await wire(node('character'), 'self', node('touch'), 'a');
await expectStep('L2 wire b', 7, 14);
const blocks = page.locator('.wc-node[data-kind="block"]');
const star = `.wc-node[data-id="${await blocks.nth((await blocks.count()) - 1).getAttribute('data-id')}"]`;
await wire(star, 'self', node('touch'), 'b');
await expectStep('L2 hide', 8, 14);
await wire(node('touch'), 'touching', star, 'hide');
await expectStep('L2 counter', 9, 14);
await dragKind('counter', 700, 90);
await expectStep('L2 wire count', 10, 14);
await wire(node('touch'), 'began', node('counter'), 'up');
await expectStep('L2 show number', 11, 14);
await dragKind('show-number', 1000, 90);
await expectStep('L2 wire show', 12, 14);
await shot('l2-12-wire-show');
await wire(node('counter'), 'value', node('show-number'), 'value');
await expectStep('L2 play', 13, 14);
await expectHl('L2 play button highlighted', 'play');
await togglePlay(); await sleep(600);
await expectStep('L2 done', 14, 14);
await shot('l2-14-done');
console.log(`FAILS ${fails}`, JSON.stringify(logs.slice(0, 5)));
await b.close();
