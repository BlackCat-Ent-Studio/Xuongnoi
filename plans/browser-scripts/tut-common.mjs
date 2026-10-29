import { openBrowser, sleep, record, SCRATCH } from './common.mjs';
export { openBrowser, sleep, record };
export const SHOTS = `${SCRATCH}/tutorial`;

export async function shot(page, name) {
  await page.screenshot({ path: `${SHOTS}/${name}.png` });
}

export async function panelInfo(page) {
  const vis = await page.locator('.ld-body').isVisible();
  if (!vis) return { visible: false };
  // aria-label is "Bước n trên N"; keep the old "Bước n/N" shape for the scripts.
  const aria = (await page.locator('.ld-steps').getAttribute('aria-label')) ?? '';
  const m = /Bước (\d+) trên (\d+)/.exec(aria);
  return {
    visible: true,
    progress: m ? `Bước ${m[1]}/${m[2]}` : aria,
    title: await page.locator('.ld-title').innerText(),
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
  await page.locator('.ld [data-tut="next"]').click();
  await sleep(200);
}

export async function startLesson(page, lessonId) {
  // Lessons start from the list in the bottom dock (Bài học tab).
  await page.locator('#tab-lessons').click();
  await page.locator(`.ld-item[data-lesson="${lessonId}"]`).click();
  await sleep(500);
}

export async function hlCount(page) {
  return page.locator('.tut-hl').count();
}

export async function nodeCount(page) {
  return page.locator('.wc-node').count();
}
