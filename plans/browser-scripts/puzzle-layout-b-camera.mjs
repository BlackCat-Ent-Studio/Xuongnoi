// Layout B: stage camera (pan / zoom / pinch / double tap / buttons), swap back, lose toast. usage: node puzzle-layout-b-camera.mjs <phone|desk>
import { launch, openPage, setSave, openLevel, shot, focusOf, VIEWPORTS } from './layout-b-lib.mjs';

const tag = process.argv[2] ?? 'phone';
const logs = [];
const checks = [];
const ok = (name, cond, extra = '') => { checks.push(`${cond ? 'PASS' : 'FAIL'} ${name} ${extra}`); };
const browser = await launch();
const page = await openPage(browser, VIEWPORTS[tag], logs, tag);
await setSave(page, { seen: true });
await openLevel(page, 2);

const chip = async () => page.evaluate(() => {
  const c = document.querySelector('.pz-zoomchip');
  return c && !c.hidden ? c.textContent : null;
});
const stageBox = async () => page.locator('.pz-stage').boundingBox();

await page.click('.pz-pip-hit');
await page.waitForTimeout(900);
ok('tap corner stage -> stage full', (await focusOf(page)) === 'stage');
ok('chip hidden at default', (await chip()) === null);
await shot(page, `${tag}-cam-0-fit`);
const bb = await stageBox();
const cx = bb.x + bb.width / 2;
const cy = bb.y + bb.height * 0.55;

// wheel zoom in
await page.mouse.move(cx, cy);
for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, -300); await page.waitForTimeout(80); }
await page.waitForTimeout(300);
const z1 = await chip();
ok('wheel zoom shows chip > 1', z1 !== null && parseFloat(z1) > 1.5, z1 ?? '');
await shot(page, `${tag}-cam-1-wheel`);

// drag pan
await page.mouse.move(cx, cy);
await page.mouse.down();
await page.mouse.move(cx + 160, cy - 30, { steps: 8 });
await page.mouse.up();
await page.waitForTimeout(300);
await shot(page, `${tag}-cam-2-pan`);

// drag hard to the edge (clamp)
for (let i = 0; i < 4; i++) {
  await page.mouse.move(cx - 100, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 380, cy + 150, { steps: 6 });
  await page.mouse.up();
}
await page.waitForTimeout(300);
await shot(page, `${tag}-cam-3-clamp-edge`);

// ctrl+wheel (trackpad pinch)
await page.keyboard.down('Control');
await page.mouse.move(cx, cy);
for (let i = 0; i < 6; i++) { await page.mouse.wheel(0, -40); await page.waitForTimeout(60); }
await page.keyboard.up('Control');
const z2 = await chip();
ok('ctrl+wheel zoomed more', z2 !== null && parseFloat(z2) >= parseFloat(z1), `${z1} -> ${z2}`);
for (let i = 0; i < 30; i++) { await page.mouse.wheel(0, 400); await page.waitForTimeout(30); } // zoom way out
await page.waitForTimeout(300);
const z3 = await chip();
ok('zoom out stops at the fit (chip gone or 1.0x)', z3 === null || parseFloat(z3) <= 1.05, String(z3));

// buttons
await page.getByRole('button', { name: 'Phóng to', exact: true }).click();
await page.getByRole('button', { name: 'Phóng to', exact: true }).click();
await page.waitForTimeout(200);
const z4 = await chip();
ok('+ button x2 zooms', z4 !== null && parseFloat(z4) > 1.8, String(z4));
await shot(page, `${tag}-cam-4-plus-buttons`);
await page.getByRole('button', { name: 'Thu nhỏ', exact: true }).click();
await page.waitForTimeout(200);
const z5 = await chip();
ok('- button zooms out', parseFloat(z5 ?? '1') < parseFloat(z4), `${z4} -> ${z5}`);
await page.getByRole('button', { name: 'Về khung vừa', exact: true }).click();
await page.waitForTimeout(400);
ok('reset button -> chip gone', (await chip()) === null);

// real touch: pinch + double tap through CDP
const cdp = await page.context().newCDPSession(page);
const touch = async (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((p, i) => ({ x: p.x, y: p.y, id: i + 1 })) });
const a = { x: cx - 40, y: cy }; const b2 = { x: cx + 40, y: cy };
await touch('touchStart', [a, b2]);
for (let i = 1; i <= 8; i++) { await touch('touchMove', [{ x: a.x - i * 12, y: a.y }, { x: b2.x + i * 12, y: b2.y }]); await page.waitForTimeout(40); }
await touch('touchEnd', []);
await page.waitForTimeout(300);
const zp = await chip();
ok('two-finger pinch zooms', zp !== null && parseFloat(zp) > 1.5, String(zp));
await shot(page, `${tag}-cam-5-pinch`);
// one-finger drag
await touch('touchStart', [{ x: cx, y: cy }]);
for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: cx - i * 25, y: cy + i * 6 }]); await page.waitForTimeout(30); }
await touch('touchEnd', []);
await page.waitForTimeout(300);
await shot(page, `${tag}-cam-6-touch-pan`);
// double tap
for (let i = 0; i < 2; i++) { await touch('touchStart', [{ x: cx, y: cy }]); await page.waitForTimeout(40); await touch('touchEnd', []); await page.waitForTimeout(90); }
await page.waitForTimeout(500);
ok('double tap resets', (await chip()) === null, String(await chip()));

// swap back with the shrink button, again with a tap on the corner board
await page.getByRole('button', { name: 'Thu sân lại, xem bảng nối' }).click();
await page.waitForTimeout(700);
ok('shrink button -> board', (await focusOf(page)) === 'board');
await shot(page, `${tag}-cam-7-back-to-board`);
await page.click('.pz-pip-hit'); await page.waitForTimeout(700);
ok('open again', (await focusOf(page)) === 'stage');
await page.click('.pz-pip-hit'); await page.waitForTimeout(700);
ok('tap corner board -> board', (await focusOf(page)) === 'board');

// hint while the stage is the big view: board must come forward
await page.click('.pz-pip-hit'); await page.waitForTimeout(700);
await page.locator('.pz-hint-btn').click();
await page.waitForTimeout(900);
ok('? from stage view swaps to board', (await focusOf(page)) === 'board');
await shot(page, `${tag}-cam-8-hint-from-stage`);

// lose: empty board, run, wait for the time limit (level 1 is the shortest)
await openLevel(page, 1);
await page.locator('.pz-btn.run').click();
await page.waitForTimeout(600);
ok('run -> stage', (await focusOf(page)) === 'stage');
await page.getByRole('button', { name: 'Phóng to', exact: true }).click();
await page.waitForTimeout(200);
ok('camera zoom works while running', (await chip()) !== null, String(await chip()));
await page.waitForSelector('.pz-toast:not([hidden])', { timeout: 120000 });
await page.waitForTimeout(500);
await shot(page, `${tag}-lose-toast`);
ok('lose toast visible on stage view', (await page.locator('.pz-toast').textContent())?.length > 3);
await page.waitForTimeout(2600);
ok('after lose -> board', (await focusOf(page)) === 'board');
await shot(page, `${tag}-lose-after`);

console.log(checks.join('\n'));
console.log(logs.slice(0, 20).join('\n') || 'no console errors');
await browser.close();
