import { openBrowser, record, sleep, URL, SHOTS } from './common.mjs';

const { browser, page, logs } = await openBrowser();

const nodeIdByHead = (label) =>
  page.evaluate((label) => {
    const n = [...document.querySelectorAll('.wc-node')].find((x) => x.querySelector('.wc-node-head')?.textContent === label);
    return n ? n.dataset.id : null;
  }, label);

const dot = async (label, port, dir) => {
  const id = await nodeIdByHead(label);
  if (!id) throw new Error(`no node ${label}`);
  return page.locator(`.wc-node[data-id="${id}"] .wc-port[data-port="${port}"][data-dir="${dir}"] .wc-dot`);
};

const center = async (loc) => {
  const b = await loc.boundingBox();
  if (!b) throw new Error('no bounding box');
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

async function paletteDrag(label, tx, ty) {
  const item = page.locator('.palette-item', { hasText: label });
  const s = await center(item);
  await page.mouse.move(s.x, s.y);
  await page.mouse.down();
  await page.mouse.move(s.x + 20, s.y + 10, { steps: 4 });
  await page.mouse.move(tx, ty, { steps: 12 });
  await page.mouse.up();
  await sleep(250);
}

/** Drag wire from an out port to an in port, optionally pausing over the target to capture hover state. */
async function wireDrag(fromLoc, toLoc, onHover) {
  const a = await center(fromLoc);
  const b = await center(toLoc);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move(a.x + 30, a.y, { steps: 3 });
  await page.mouse.move(b.x, b.y, { steps: 15 });
  await sleep(120);
  const hover = onHover ? await onHover() : null;
  await page.mouse.up();
  await sleep(200);
  return hover;
}

const hoverState = () =>
  page.evaluate(() => ({
    ok: document.querySelectorAll('.wc-port.ok').length,
    bad: document.querySelectorAll('.wc-port.bad').length,
    tip: (() => {
      const t = document.querySelector('.wc-tip');
      return t && !t.hidden ? t.textContent : null;
    })(),
  }));

const wireCount = () => page.evaluate(() => document.querySelectorAll('path.wc-wire:not(.wc-wire-temp)').length);
const statusText = () => page.locator('.status').innerText();

try {
  await page.goto(URL, { waitUntil: 'load' });
  await page.waitForSelector('.topbar', { timeout: 15000 });
  await sleep(600);
  const cb = await page.locator('.wc').boundingBox();
  const at = (fx, fy) => ({ x: cb.x + cb.width * fx, y: cb.y + cb.height * fy });

  // Palette drag-add
  const p1 = at(0.12, 0.2);
  await paletteDrag('Cần điều khiển', p1.x, p1.y);
  const p2 = at(0.5, 0.2);
  await paletteDrag('Nhân vật', p2.x, p2.y);
  const p3 = at(0.12, 0.6);
  await paletteDrag('Phím bấm', p3.x, p3.y);
  const p4 = at(0.5, 0.6);
  await paletteDrag('Cần điều khiển', p4.x, p4.y);
  const nodeCount = await page.locator('.wc-node').count();
  record('4 palette drag adds nodes', nodeCount === 4, `nodes=${nodeCount}`);
  await page.screenshot({ path: `${SHOTS}/40-nodes-placed.png` });

  // Stick.x -> character.moveX (number -> number, expect ok)
  const stickX = await dot('Cần điều khiển', 'x', 'out');
  const moveX = await dot('Nhân vật', 'moveX', 'in');
  const wcBefore = await wireCount();
  const hoverOk = await wireDrag(stickX, moveX, async () => {
    const st = await hoverState();
    await page.screenshot({ path: `${SHOTS}/41-wire-hover-ok.png` });
    return st;
  });
  const wcAfter = await wireCount();
  record('4 stick.x -> character.moveX accepted', wcAfter === wcBefore + 1 && hoverOk.ok >= 1, `wires ${wcBefore}->${wcAfter}, hover=${JSON.stringify(hoverOk)}`);

  // Key.held (bool) -> character.moveX (number): expect rejection with red Vietnamese reason
  const keyHeld = await dot('Phím bấm', 'held', 'out');
  const wcBefore2 = await wireCount();
  const hoverBad = await wireDrag(keyHeld, moveX, async () => {
    const st = await hoverState();
    await page.screenshot({ path: `${SHOTS}/42-wire-hover-bad-type.png` });
    return st;
  });
  const wcAfter2 = await wireCount();
  const st = await statusText();
  const statusCls = await page.locator('.status').getAttribute('class');
  record(
    '4 bool -> number rejected w/ red Vietnamese reason',
    wcAfter2 === wcBefore2 && hoverBad.bad >= 1 && (hoverBad.tip ?? '').includes('Khác loại dây') && st.includes('Khác loại dây') && statusCls.includes('error'),
    `wires ${wcBefore2}->${wcAfter2}; hover=${JSON.stringify(hoverBad)}; status=${JSON.stringify(st)} cls=${statusCls}`,
  );
  await page.screenshot({ path: `${SHOTS}/43-after-rejected-wire.png` });

  // Key.held -> character.jump (bool -> bool) accepted
  const jump = await dot('Nhân vật', 'jump', 'in');
  const wcBefore3 = await wireCount();
  await wireDrag(keyHeld, jump, null);
  record('4 key.held -> character.jump accepted (bool->bool)', (await wireCount()) === wcBefore3 + 1, `wires=${await wireCount()}`);

  // Second wire into moveX (input already taken) -> reason input-taken
  const stickY = await dot('Cần điều khiển', 'y', 'out');
  const wcBefore4 = await wireCount();
  const hoverTaken = await wireDrag(stickY, moveX, () => hoverState());
  record(
    '4 second wire into taken input rejected',
    (await wireCount()) === wcBefore4 && (hoverTaken.tip ?? '').includes('đã có dây'),
    `hover=${JSON.stringify(hoverTaken)}`,
  );

  // Out -> out (wrong direction)
  const constOut = await dot('Nhân vật', 'self', 'out');
  const wcBefore5 = await wireCount();
  const hoverDir = await wireDrag(stickY, constOut, () => hoverState());
  record(
    '4 out->out rejected (wrong direction reason)',
    (await wireCount()) === wcBefore5 && (hoverDir.tip ?? '').includes('cổng ra'),
    `hover=${JSON.stringify(hoverDir)}`,
  );

  // Play: stick x wire carries value; hold ArrowLeft and check the badge
  await page.locator('#btn-play').click();
  await sleep(800);
  await page.keyboard.down('ArrowLeft');
  await sleep(500);
  const badgesPlay = await page.locator('.wc-badge').allInnerTexts();
  await page.screenshot({ path: `${SHOTS}/44-play-wire-badges.png` });
  await page.keyboard.up('ArrowLeft');
  record('4 play shows live wire badges (stick.x -1.00 while ArrowLeft)', badgesPlay.includes('-1.00'), `badges=${JSON.stringify(badgesPlay)}`);
  await page.locator('#btn-play').click();
  await sleep(500);

  // Select a wire -> properties show it; Delete removes wire
  const wireBefore = await wireCount();
  const hit = page.locator('path.wc-wire-hit').first();
  const hb = await hit.boundingBox();
  if (hb) {
    await page.mouse.click(hb.x + hb.width / 2, hb.y + hb.height / 2);
    await sleep(200);
    const propsText = await page.locator('.props').innerText();
    record('4 click wire selects it (props show "Dây nối")', propsText.includes('Dây nối'), propsText.slice(0, 100).replace(/\n/g, ' | '));
    await page.keyboard.press('Delete');
    await sleep(200);
    record('4 Delete removes selected wire', (await wireCount()) === wireBefore - 1, `wires ${wireBefore}->${await wireCount()}`);
  } else {
    record('4 wire hit area found', false, 'no wire hit path');
  }

  record('4 console errors during wiring', logs.length === 0, logs.join(' || ') || 'none');
} catch (e) {
  record('RUN ERROR', false, String(e && e.stack ? e.stack : e));
  await page.screenshot({ path: `${SHOTS}/error-run4.png` }).catch(() => {});
} finally {
  console.log('LOGS:', JSON.stringify(logs, null, 1));
  await browser.close();
}
