import { openBrowser, sleep, record, SCRATCH } from './common.mjs';
export { openBrowser, sleep, record };
export const SHOTS = `${SCRATCH}/tutorial`;

export async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

export async function panelInfo(page) {
  const vis = await page.locator('.tut-panel').isVisible();
  if (!vis) return { visible: false };
  return {
    visible: true,
    progress: await page.locator('.tut-progress').innerText(),
    title: await page.locator('.tut-title').innerText(),
  };
}

export async function stepNo(page) {
  const i = await panelInfo(page);
  return i.visible ? i.progress : 'hidden';
}

/** Press-drag a palette item onto the canvas at an offset from the canvas top-left. */
export async function dragKind(page, kind, dx, dy) {
  const item = page.locator(`.palette-item[data-kind="${kind}"]`);
  await item.scrollIntoViewIfNeeded();
  const ib = await item.boundingBox();
  const cb = await page.locator('.wc').boundingBox();
  await page.mouse.move(ib.x + ib.width / 2, ib.y + ib.height / 2);
  await page.mouse.down();
  await page.mouse.move(ib.x + ib.width / 2 + 30, ib.y + ib.height / 2 + 10, { steps: 3 });
  await page.mouse.move(cb.x + dx, cb.y + dy, { steps: 6 });
  await page.mouse.up();
  await sleep(150);
}

export async function dot(page, nodeSel, port, dir) {
  const loc = page.locator(`${nodeSel} .wc-port[data-port="${port}"][data-dir="${dir}"] .wc-dot`);
  return loc.first().boundingBox();
}

export async function wire(page, fromNode, fromPort, toNode, toPort) {
  const a = await dot(page, fromNode, fromPort, 'out');
  const b = await dot(page, toNode, toPort, 'in');
  if (!a || !b) throw new Error(`port missing ${fromNode}.${fromPort} -> ${toNode}.${toPort}`);
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(b.x + b.width / 2 - 20, b.y + b.height / 2, { steps: 8 });
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 3 });
  await page.mouse.up();
  await sleep(200);
}

export const nodeOf = (kind) => `.wc-node[data-kind="${kind}"]`;

/** Select a node by clicking its header, so the properties panel shows it. */
export async function selectNode(page, kind, nth = 0) {
  await page.locator(`.wc-node[data-kind="${kind}"] .wc-node-head`).nth(nth).click();
  await sleep(150);
}

export async function setNumber(page, param, value, axis = 0) {
  const input = page.locator(`.prop-row[data-param="${param}"] input`).nth(axis);
  await input.fill(String(value));
  await sleep(150);
}

export async function setSelect(page, param, value) {
  await page.locator(`.prop-row[data-param="${param}"] select`).selectOption(value);
  await sleep(150);
}

export async function clickNext(page) {
  await page.locator('.tut-panel [data-tut="next"]').click();
  await sleep(200);
}

export async function startLesson(page, lessonId) {
  await page.locator('[data-tut="tutorial"]').click();
  await page.locator(`[data-lesson="${lessonId}"]`).click();
  await sleep(500);
}

export async function hlCount(page) {
  return page.locator('.tut-hl').count();
}

export async function nodeCount(page) {
  return page.locator('.wc-node').count();
}
