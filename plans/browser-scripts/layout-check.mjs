import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, SCRATCH, openSample } from './common.mjs';

const OUT = `${SCRATCH}/layout`;
mkdirSync(OUT, { recursive: true });
const { browser, page, logs } = await openBrowser();
const res = [];
const rec = (n, ok, d = '') => { res.push(`${ok ? 'PASS' : 'FAIL'} ${n} ${d}`); };
const box = async (sel) => page.locator(sel).first().boundingBox();
const cvs = async () => page.evaluate(() => { const c = document.querySelector('.game-box canvas'); return { w: c.width, h: c.height, cw: c.clientWidth, ch: c.clientHeight, dpr: devicePixelRatio }; });

await page.goto('http://localhost:5173/');
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1200);
const tutNo = page.locator('[data-tut="invite-no"]');
if (await tutNo.count()) await tutNo.click().catch(() => {});
await page.screenshot({ path: `${OUT}/00-before.png` });
const b0 = await box('.right-col');
const g0 = await box('.game-box');
rec('default right width 420', Math.abs(b0.width - 420) < 2, String(b0.width));
rec('default game height 300', Math.abs(g0.height - 300) < 2, String(g0.height));

// vertical drag left by 300
const v = await box('.splitter-vertical');
await page.mouse.move(v.x + 4, v.y + 200);
await page.mouse.down();
await page.mouse.move(v.x - 150, v.y + 200, { steps: 5 });
await page.mouse.move(v.x - 296, v.y + 200, { steps: 5 });
await page.mouse.up();
await sleep(300);
const b1 = await box('.right-col');
rec('vertical drag widens', b1.width > 700, String(b1.width));
// horizontal drag down 250
const hz = await box('.splitter-horizontal');
await page.mouse.move(hz.x + 100, hz.y + 4);
await page.mouse.down();
await page.mouse.move(hz.x + 100, hz.y + 254, { steps: 8 });
await page.mouse.up();
await sleep(300);
const g1 = await box('.game-box');
rec('horizontal drag taller', g1.height > 520, String(g1.height));
const c1 = await cvs();
rec('canvas matches box (not stretched)', c1.cw === Math.floor(g1.width) && c1.ch === Math.floor(g1.height) && Math.abs(c1.w - c1.cw * c1.dpr) <= 2, JSON.stringify(c1));
rec('no text selected', (await page.evaluate(() => getSelection().toString())) === '');
await page.screenshot({ path: `${OUT}/01-after-drag.png` });
const saved = await page.evaluate(() => localStorage.getItem('xuong-noi:layout'));
rec('saved', !!saved, saved);

// reload keeps
await page.reload();
await sleep(1200);
const b2 = await box('.right-col');
rec('reload keeps width', Math.abs(b2.width - b1.width) < 2, `${b2.width} vs ${b1.width}`);
const g2 = await box('.game-box');
rec('reload keeps height', Math.abs(g2.height - g1.height) < 2, `${g2.height} vs ${g1.height}`);

// min clamp: drag far
const v2 = await box('.splitter-vertical');
await page.mouse.move(v2.x + 4, v2.y + 200);
await page.mouse.down();
await page.mouse.move(0, v2.y + 200, { steps: 6 });
await page.mouse.up();
const cv = await box('.wc');
rec('canvas min 240', cv.width >= 239, String(cv.width));

// window shrink clamp
await page.setViewportSize({ width: 900, height: 600 });
await sleep(400);
const b3 = await box('.right-col'); const wc3 = await box('.wc'); const pr3 = await box('.props');
rec('shrink: canvas>=240', wc3.width >= 239, String(wc3.width));
rec('shrink: props>=120', pr3.height >= 119, String(pr3.height));
await page.setViewportSize({ width: 1440, height: 900 });
await sleep(400);

// dblclick reset
await page.locator('.splitter-vertical').dblclick();
await page.locator('.splitter-horizontal').dblclick();
await sleep(300);
const b4 = await box('.right-col'); const g4 = await box('.game-box');
rec('dblclick resets', Math.abs(b4.width - 420) < 2 && Math.abs(g4.height - 300) < 2, `${b4.width} ${g4.height}`);

// keyboard
await page.locator('.splitter-vertical').focus();
await page.keyboard.press('ArrowLeft');
await sleep(100);
const b5 = await box('.right-col');
rec('keyboard widens', Math.abs(b5.width - 436) < 2, String(b5.width));
await page.locator('.splitter-vertical').dblclick();

// maximize
await sleep(500);
const tb = await box('.topbar');
await page.locator('.view-max').click();
await sleep(500);
const gm = await box('.game-box');
rec('maximized covers area', gm.width > 1400 && gm.height > 900 - tb.height - 4 && Math.abs(gm.y - (tb.y + tb.height)) < 3, JSON.stringify(gm));
const cm = await cvs();
rec('maximized canvas crisp', cm.cw === Math.floor(gm.width) && cm.ch === Math.floor(gm.height), JSON.stringify(cm));
rec('max btn label', (await page.locator('.view-max').innerText()).includes('Thu nhỏ'));
await page.screenshot({ path: `${OUT}/02-maximized.png` });
// wheel zoom + pan still work: pan by drag, check no error
await page.mouse.move(gm.x + 300, gm.y + 300);
await page.mouse.down(); await page.mouse.move(gm.x + 380, gm.y + 320, { steps: 4 }); await page.mouse.up();
await page.mouse.wheel(0, -200);
await sleep(200);
await page.screenshot({ path: `${OUT}/03-max-pan-zoom.png` });
// Esc restore
await page.keyboard.press('Escape');
await sleep(400);
rec('Esc restores', (await box('.game-box')).height < 400);
await page.keyboard.press('KeyF');
await sleep(400);
rec('F maximizes', (await box('.game-box')).height > 700);
// F with typing ignored
await page.keyboard.press('KeyF'); await sleep(300);
await page.locator('.name-input').click();
await page.keyboard.type('fff');
rec('F in input ignored', (await box('.game-box')).height < 400 && (await page.locator('.name-input').inputValue()).endsWith('fff'));

// play keeps size
await page.locator('.name-input').blur();
await page.locator('.right-col .game-box').click({ position: { x: 5, y: 5 }, force: true }).catch(() => {});
const gBefore = await box('.game-box');
await page.locator('button.primary').first().click();
await sleep(1000);
const gPlay = await box('.game-box');
rec('Chơi keeps size', Math.abs(gBefore.height - gPlay.height) < 2 && Math.abs(gBefore.width - gPlay.width) < 2, `${gBefore.width}x${gBefore.height} -> ${gPlay.width}x${gPlay.height}`);
await page.screenshot({ path: `${OUT}/04-playing.png` });
await page.keyboard.press('KeyF'); await sleep(200);
rec('F ignored in play', (await box('.game-box')).height < 400);
await page.locator('.view-max').click(); await sleep(400);
rec('button works in play', (await box('.game-box')).height > 700);
await page.keyboard.press('Escape'); await sleep(300);
await page.locator('button.primary').first().click(); await sleep(500);

console.log(res.join('\n'));
console.log('LOGS', JSON.stringify(logs));
await browser.close();
