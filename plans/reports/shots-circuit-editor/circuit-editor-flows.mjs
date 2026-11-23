// Drives the circuit editor (flows a-g) on a dev server and takes the shots in this folder.
// usage: PW_DIR=<folder with playwright-core installed> BASE=http://localhost:5182 node circuit-editor-flows.mjs [flows] [shots]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Playwright is not installed in app/. Either give PW_ENTRY (file URL of its index.mjs), or PW_DIR: a folder where
// `npm install playwright-core` was run; it is then resolved from there the normal way.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
const entry = process.env.PW_ENTRY ?? (process.env.PW_DIR ? pathToFileURL(createRequire(path.join(process.env.PW_DIR, 'package.json')).resolve('playwright-core')).href : 'playwright');
const pw = await import(entry);
const chromium = pw.chromium ?? pw.default.chromium;
const BASE = process.env.BASE ?? 'http://localhost:5182';
const OUT = path.dirname(fileURLToPath(import.meta.url));
const want = process.argv.slice(2);
const on = (g) => want.length === 0 || want.includes(g);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail: String(detail) });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail !== '' ? `  [${detail}]` : ''}`);
};

process.on('uncaughtException', (e) => { console.log('CRASH', String(e.message).slice(0, 200)); for (const p of problems.slice(0, 12)) console.log(p); process.exit(2); });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const problems = [];
let dialogs = 0;

/** Builds the seed board inside the page from the app's own modules: the robot-square sample turned into a circuit "Xe AGV" with 8 copies. */
async function seed(page) {
  return page.evaluate(async () => {
    const io = await import('/src/io/index.ts');
    const nodes = await import('/src/nodes/index.ts');
    const model = await import('/src/editor/circuits/circuit-model.ts');
    const wiring = await import('/src/editor/circuits/circuit-wiring.ts');
    nodes.registerAllNodes();
    let board = structuredClone(io.listAllSamples().find((s) => s.id === 'robot-square').board);
    board.name = 'Xưởng thử bảng mạch';
    const outside = new Set(['san', 'hinh-mau', 'khi-bat-dau', 'hien-qd', 'hien-canh']);
    const ids = new Set(board.graph.nodes.filter((n) => !outside.has(n.id)).map((n) => n.id));
    const made = model.createCircuitFromSelection(board, [], ids, 'Xe AGV');
    if (!made.ok) throw new Error(made.reason);
    board = made.board;
    const first = made.instanceId;
    const pins = board.circuits[0].pins;
    const inPins = pins.filter((p) => p.dir === 'in');
    // Lay the main board out by hand: sources left, the copies in two columns, displays right.
    const at = { 'khi-bat-dau': [0, 60], 'hien-qd': [260, 360], 'hien-canh': [515, 360], san: [770, 360], 'hinh-mau': [1025, 360] };
    board.graph.nodes = board.graph.nodes.map((n) => (at[n.id] ? { ...n, pos: { x: at[n.id][0], y: at[n.id][1] } } : n.id === first ? { ...n, pos: { x: 260, y: 0 } } : n));
    for (let i = 1; i < 8; i++) {
      const res = model.addInstance(board, [], made.circuitId, { x: 260 + (i % 4) * 255, y: Math.floor(i / 4) * 170 });
      if (!res.ok) throw new Error(res.reason);
      board = res.board;
      board.graph.nodes = board.graph.nodes.map((n) => (n.id === res.nodeId ? { ...n, params: { ...n.params, position: { x: (i % 4) * 6 - 9, y: 0, z: Math.floor(i / 4) * 6 + 5 } } } : n));
      // The last copy is left unwired, for the wire-drag check.
      if (i < 7) for (const p of inPins) {
        const c = wiring.connectIn(board, [], { node: 'khi-bat-dau', port: 'started' }, { node: res.nodeId, port: p.id });
        if (c.ok) board = c.board;
      }
    }
    board.graph.nodes = board.graph.nodes.map((n, i) => (n.kind === 'circuit' ? { ...n, params: { ...n.params, name: `Xe AGV ${board.graph.nodes.filter((m, j) => m.kind === 'circuit' && j <= i).length}` } } : n));
    localStorage.setItem('xuong-noi:autosave', io.serializeBoard ? io.serializeBoard(board) : (await import('/src/io/save-format.ts')).serializeBoard(board));
    return { first, circuit: made.circuitId, pins: pins.map((p) => `${p.dir}:${p.label}`) };
  });
}

async function open(theme, mode, { seeded = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[console ${theme}/${mode}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[pageerror ${theme}/${mode}] ${e.message}`));
  page.on('dialog', (d) => { dialogs++; void d.dismiss(); });
  await page.goto(BASE);
  await page.evaluate(([t, m]) => { localStorage.clear(); localStorage.setItem('xuong-noi:tutorial-seen', '1'); localStorage.setItem('xuong-noi:theme', t); localStorage.setItem('xuong-noi:ui-mode', m); }, [theme, mode]);
  let info = null;
  if (seeded) info = await seed(page);
  await page.goto(BASE);
  await page.waitForSelector('.wc');
  await sleep(900);
  return { context, page, info };
}

const saved = (page) => page.evaluate(async () => {
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true }));
  await new Promise((r) => setTimeout(r, 150));
  return JSON.parse(localStorage.getItem('xuong-noi:autosave'));
});
const count = (page, sel) => page.locator(sel).count();
const shot = async (page, name) => { await sleep(350); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('shot', name); };
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
async function drag(page, from, to) {
  const a = await center(from);
  const b = await center(to);
  await page.mouse.move(a.x, a.y);
  await page.mouse.down();
  await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 6 });
  await page.mouse.move(b.x, b.y, { steps: 6 });
  await sleep(60);
  await page.mouse.up();
  await sleep(250);
}
const fit = async (page) => { await page.locator('.wc[tabindex]').focus(); await page.locator('.wc-rail button[title="Vừa màn hình"]').click(); await sleep(300); };
const emptySpot = async (page) => { const b = await page.locator('.wc[tabindex]').boundingBox(); return { x: b.x + b.width - 30, y: b.y + 120 }; };
const clickEmpty = async (page) => { const p = await emptySpot(page); await page.mouse.click(p.x, p.y); await sleep(150); };
const card = (page, id) => page.locator(`.wc-node[data-id="${id}"]`);
const instCards = (page) => page.locator('.wc-node.wc-inst:not(.ck-static)');

// ======================= flows (Giáo viên, light) =======================
if (on('flows')) {
  const { page, context, info } = await open('light', 'teacher');
  console.log('seed', JSON.stringify(info));

  // ---- b: blocks on the board ----
  check('b: 8 copies drawn as device cards', (await instCards(page).count()) === 8, await instCards(page).count());
  check('b: a copy shows its pins as ports', (await card(page, info.first).locator('.wc-port').count()) === info.pins.length, info.pins.join(', '));
  const wiresBefore = await count(page, '.wc-wire-g');
  // wire from "Khi bắt đầu · Đã bắt đầu" to the first copy's first input pin (real drag)
  await fit(page);
  const inRow = instCards(page).last().locator('.wc-port.in').first();
  await drag(page, card(page, 'khi-bat-dau').locator('.wc-port[data-port="started"] .wc-dot'), inRow.locator('.wc-dot'));
  check('b: dragging a wire onto a pin of a copy adds the wire', (await count(page, '.wc-wire-g')) === wiresBefore + 1, `${wiresBefore} -> ${await count(page, '.wc-wire-g')}`);
  // wire from an output pin of the copy to a plain card
  const outRows = card(page, info.first).locator('.wc-port.out');
  await drag(page, outRows.first().locator('.wc-dot'), card(page, 'hien-qd').locator('.wc-port.in .wc-dot'));
  const s1 = await saved(page);
  check('b: a wire from a pin of a copy to a plain card is saved', s1.graph.wires.some((w) => w.from.node === info.first && w.to.node === 'hien-qd'), s1.graph.wires.length);
  // wrong type is refused with a message
  const numRow = card(page, info.first).locator('.wc-port.out[data-type="number"]').first();
  const boolIn = card(page, info.first).locator('.wc-port.in[data-type="bool"]').first();
  const w2 = await count(page, '.wc-wire-g');
  if ((await numRow.count()) && (await boolIn.count())) {
    const other = instCards(page).nth(1).locator('.wc-port.in[data-type="bool"]').first();
    await drag(page, numRow.locator('.wc-dot'), other.locator('.wc-dot'));
    check('b: a wire of the wrong type is refused', (await count(page, '.wc-wire-g')) === w2);
  }
  await shot(page, 'flow-b1-board-8-copies-teacher-light');

  // ---- f: instance inspector ----
  await card(page, info.first).locator('.wc-inst-head .wc-name').click();
  await sleep(200);
  check('f: selecting a copy shows its inspector', (await page.locator('.pn-props .ck-ihead').count()) === 1, await page.locator('.pn-props .pn-icat').first().textContent());
  const nameBox = page.locator('.pn-props .pn-sec input.pn-text').first();
  await nameBox.fill('Xe đầu đàn');
  await sleep(200);
  check('f: the name typed in the inspector shows on the block', (await card(page, info.first).locator('.wc-name').textContent()) === 'Xe đầu đàn');
  const posX = page.locator('.pn-props [data-param="position"] input').first();
  await posX.fill('12');
  await posX.dispatchEvent('input');
  const head = page.locator('.pn-props [data-param="heading"] input').first();
  await head.fill('90');
  await head.dispatchEvent('input');
  const s2 = await saved(page);
  const firstNode = s2.graph.nodes.find((n) => n.id === info.first);
  check('f: position and heading of the copy are saved', firstNode.params.position.x === 12 && firstNode.params.heading === 90 && firstNode.params.name === 'Xe đầu đàn', JSON.stringify(firstNode.params));
  await shot(page, 'flow-f1-instance-inspector-teacher-light');

  // ---- b: stack ----
  await page.locator('.pn-props button', { hasText: 'Xếp chồng 8 máy' }).click();
  await sleep(300);
  check('b: stacking draws one block "×8"', (await instCards(page).count()) === 1 && (await page.locator('.wc-inst-count').textContent()) === '×8', await instCards(page).count());
  check('b: stacked block keeps the wires of its copies drawn', (await count(page, '.wc-wire-g')) >= 9, await count(page, '.wc-wire-g'));
  const s3 = await saved(page);
  check('b: the stack is saved with the board', JSON.stringify(s3.graph.stacks) === JSON.stringify([info.circuit]));
  await fit(page);
  await shot(page, 'flow-b2-stacked-x8-teacher-light');
  // drag the stack: every copy moves by the same amount
  const before = s3.graph.nodes.filter((n) => n.kind === 'circuit').map((n) => n.pos);
  const sc = await center(page.locator('.wc-inst-stack .wc-name'));
  await page.mouse.move(sc.x, sc.y); await page.mouse.down(); await page.mouse.move(sc.x + 40, sc.y + 30, { steps: 5 }); await page.mouse.up(); await sleep(250);
  const s4 = await saved(page);
  const after = s4.graph.nodes.filter((n) => n.kind === 'circuit').map((n) => n.pos);
  const dx = after[0].x - before[0].x;
  check('b: dragging the stacked block moves all 8 copies together', dx !== 0 && after.every((p, i) => p.x - before[i].x === dx), `dx ${dx}`);
  await page.keyboard.press('Control+z');
  await sleep(200);
  await page.locator('.wc-inst-stack .wc-name').click();
  await sleep(200);
  await shot(page, 'flow-b3-stack-inspector-teacher-light');
  await page.locator('.wc-inst-count').click();
  await sleep(300);
  check('b: the "×8" button spreads the stack again', (await instCards(page).count()) === 8);
  await fit(page);

  // ---- a: enter / leave ----
  await card(page, info.first).locator('.wc-inst-head .wc-name').dblclick();
  await sleep(500);
  check('a: double-click enters the circuit (path bar shows)', await page.locator('.wc-ccrumb').isVisible(), await page.locator('.wc-ccrumb').innerText());
  check('a: the note says how many copies an edit changes', (await page.locator('.wc-cnote').innerText()).includes('8 bản sao'), await page.locator('.wc-cnote').innerText());
  check('a: pin cards stand at the edges', (await count(page, '.wc-pin.in')) + (await count(page, '.wc-pin.out')) === info.pins.length, `${await count(page, '.wc-pin.in')} in, ${await count(page, '.wc-pin.out')} out`);
  check('a: the pins are wired to inner cards', (await count(page, '.wc-wire-g')) >= info.pins.length, await count(page, '.wc-wire-g'));
  await shot(page, 'flow-a1-inside-circuit-teacher-light');
  await page.locator('.wc[tabindex]').focus();
  await page.keyboard.press('Escape');
  await sleep(400);
  check('a: Esc goes back out', !(await page.locator('.wc-ccrumb').isVisible()) && (await instCards(page).count()) === 8);
  await card(page, info.first).locator('.wc-inst-open').click();
  await sleep(400);
  check('a: the "Mở" button enters too', await page.locator('.wc-ccrumb').isVisible());

  // ---- c: pins ----
  const pinsIn = await count(page, '.wc-pin.in');
  await page.locator('.wc-pin-col.in .wc-pin-add').click();
  await sleep(300);
  check('c: "Thêm chân vào" adds an unwired pin card', (await count(page, '.wc-pin.in')) === pinsIn + 1 && (await page.locator('.wc-pin.in').last().locator('.wc-pin-type').textContent()) === 'Chưa nối');
  const newPin = page.locator('.wc-pin.in').last();
  await newPin.locator('.wc-pin-name').fill('Tốc độ đặt');
  await newPin.locator('.wc-pin-name').press('Enter');
  await sleep(250);
  check('c: renaming a pin sticks', (await page.locator('.wc-pin.in').last().locator('.wc-pin-name').inputValue()) === 'Tốc độ đặt');
  // wire it to a free number input of an inner card (Bộ đếm · Lượng cộng thêm)
  const freeNumber = card(page, 'dem-canh').locator('.wc-port.in[data-port="addAmount"]');
  const target = await freeNumber.evaluate((r) => `${r.dataset.node}.${r.dataset.port}`);
  await drag(page, page.locator('.wc-pin.in').last().locator('.wc-pin-port .wc-dot'), freeNumber.locator('.wc-dot'));
  check('c: wiring the pin to an inner number port makes it a number pin', (await page.locator('.wc-pin.in').last().locator('.wc-pin-type').textContent()) === 'Số', target);
  await page.locator('.wc-pin.in').last().locator('.wc-pin-tool').first().click();
  await sleep(250);
  const order = await page.locator('.wc-pin.in .wc-pin-name').evaluateAll((els) => els.map((e) => e.value));
  check('c: the up arrow reorders the pin', order.indexOf('Tốc độ đặt') === order.length - 2, order.join(' | '));
  await shot(page, 'flow-c1-pin-added-wired-teacher-light');

  // expose a setting of an inner card
  await card(page, 'c-canh').locator('.wc-node-head .wc-name').click();
  await sleep(250);
  const sw = page.locator('.pn-props .ck-expose .pn-switch').first();
  check('c: an inner card offers "Mở ra ngoài"', (await sw.count()) === 1);
  await sw.click();
  await sleep(300);
  check('c: the opened setting appears as a "Thông số mở" card', (await count(page, '.wc-pin.param')) === 1, await page.locator('.wc-pin.param').innerText().catch(() => ''));
  await page.locator('.wc-pin.param .wc-pin-name').fill('Cạnh hình vuông');
  await page.locator('.wc-pin.param .wc-pin-name').press('Enter');
  await sleep(250);
  await shot(page, 'flow-c2-exposed-setting-teacher-light');
  await clickEmpty(page);
  await shot(page, 'flow-c3-circuit-summary-teacher-light');

  // back out: every copy shows the new pin, and the inspector has the exposed value
  await page.locator('.wc-ccrumb .wc-crumb-back').click();
  await sleep(400);
  const labels = await instCards(page).evaluateAll((cards) => cards.map((c) => [...c.querySelectorAll('.wc-port.in .wc-pl')].map((e) => e.textContent).join('|')));
  check('a: an edit inside changed every copy (all 8 show the new pin)', labels.length === 8 && labels.every((l) => l.includes('Tốc độ đặt')), labels[1]);
  await instCards(page).nth(2).locator('.wc-name').click();
  await sleep(250);
  const exposedRow = page.locator('.pn-props [data-param^="value:"]');
  check('c: the exposed setting shows on a copy with its own value box', (await exposedRow.count()) === 1 && (await exposedRow.locator('.pn-label').textContent()) === 'Cạnh hình vuông');
  const ownBox = exposedRow.locator('input').first();
  const inherited = await ownBox.inputValue();
  await ownBox.fill('3');
  await ownBox.dispatchEvent('input');
  const s5 = await saved(page);
  const withOwn = s5.graph.nodes.filter((n) => n.kind === 'circuit' && Object.keys(n.params).some((k) => k.startsWith('value:')));
  check('c: only that copy holds the value', withOwn.length === 1 && Object.entries(withOwn[0].params).some(([k, v]) => k.startsWith('value:') && v === 3), `circuit value ${inherited}`);
  await shot(page, 'flow-c4-own-value-on-copy-teacher-light');

  // delete the pin again (it has no outside wires), from inside
  await instCards(page).first().locator('.wc-inst-open').click();
  await sleep(400);
  const idx = (await page.locator('.wc-pin.in .wc-pin-name').evaluateAll((els) => els.map((e) => e.value))).indexOf('Tốc độ đặt');
  await page.locator('.wc-pin.in').nth(idx).locator('.wc-pin-tool').last().click();
  await sleep(300);
  check('c: deleting a pin removes its card', (await count(page, '.wc-pin.in')) === pinsIn);
  await page.keyboard.press('Control+z');
  await sleep(300);
  check('g: undo brings the pin back', (await count(page, '.wc-pin.in')) === pinsIn + 1);
  await page.keyboard.press('Control+y');
  await sleep(300);
  check('g: redo removes it again', (await count(page, '.wc-pin.in')) === pinsIn);

  // copy / paste inside the circuit
  await card(page, 'c-canh').locator('.wc-node-head .wc-name').click();
  const innerBefore = await count(page, '.wc-node');
  await page.locator('.wc[tabindex]').focus();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await sleep(350);
  check('g: copy and paste of a card inside a circuit', (await count(page, '.wc-node')) === innerBefore + 1);
  await page.keyboard.press('Control+z');
  await sleep(250);
  await page.locator('.wc-ccrumb .wc-crumb-root').first().click();
  await sleep(400);
  check('a: the first crumb goes back to the main board', !(await page.locator('.wc-ccrumb').isVisible()));

  // ---- g: copy / paste a copy on the board, undo ----
  await instCards(page).nth(3).locator('.wc-name').click();
  await page.locator('.wc[tabindex]').focus();
  await page.keyboard.press('Control+c');
  await page.keyboard.press('Control+v');
  await sleep(350);
  check('g: copy and paste of a copy on the board gives a ninth', (await instCards(page).count()) === 9);
  await page.keyboard.press('Control+z');
  await sleep(300);
  check('g: undo takes the pasted copy away', (await instCards(page).count()) === 8);

  // ---- d: palette group ----
  const item = page.locator(`.ck-pal-item[data-circuit="${info.circuit}"]`);
  check('d: the palette lists the circuit under "Bảng mạch" with its count', (await item.count()) === 1 && (await item.locator('.ck-pal-count').textContent()) === '×8', await page.locator('.ck-pal-head').innerText());
  const canvasBox = await page.locator('.wc[tabindex]').boundingBox();
  const ic = await center(item.locator('.pn-item-text b'));
  await page.mouse.move(ic.x, ic.y); await page.mouse.down();
  await page.mouse.move(ic.x + 60, ic.y + 10, { steps: 4 });
  await page.mouse.move(canvasBox.x + canvasBox.width * 0.72, canvasBox.y + canvasBox.height * 0.7, { steps: 8 });
  await page.mouse.up(); await sleep(400);
  check('d: dragging the circuit onto the board places a ninth copy', (await instCards(page).count()) === 9 && (await item.locator('.ck-pal-count').textContent()) === '×9');
  await item.locator('.ck-pal-tool[title="Đổi tên"]').click();
  await page.locator('.ck-pal-name').fill('Xe tự hành');
  await page.locator('.ck-pal-name').press('Enter');
  await sleep(300);
  check('d: rename in the palette', (await item.locator('.pn-item-text b').textContent()) === 'Xe tự hành');
  await item.locator('.ck-pal-tool[title^="Nhân bản"]').click();
  await sleep(300);
  check('d: duplicate makes a second circuit with no copies', (await count(page, '.ck-pal-item')) === 2 && (await page.locator('.ck-pal-item').nth(1).locator('.ck-pal-count').textContent()) === '×0');
  await shot(page, 'flow-d1-palette-group-teacher-light');
  await page.locator('.ck-pal-item').nth(1).locator('.ck-pal-tool.danger').click();
  await sleep(300);
  check('d: a circuit without copies is deleted at once', (await count(page, '.ck-pal-item')) === 1);
  await item.locator('.ck-pal-tool.danger').click();
  await sleep(300);
  check('d: deleting a circuit that has copies asks in the row itself', (await page.locator('.ck-pal-ask').innerText()).includes('9 bản sao') && (await count(page, '.ck-pal-item')) === 1, await page.locator('.ck-pal-ask').innerText());
  await shot(page, 'flow-d2-delete-asks-in-page-teacher-light');
  await page.locator('.ck-pal-btn', { hasText: 'Thôi' }).click();
  await sleep(200);
  check('d: "Thôi" keeps everything', (await instCards(page).count()) === 9 && (await count(page, '.ck-pal-ask')) === 0);
  await item.locator('.ck-pal-tool.danger').click();
  await page.locator('.ck-pal-btn.danger').click();
  await sleep(400);
  check('d: "Xóa hết" removes the circuit and its copies', (await instCards(page).count()) === 0 && (await count(page, '.ck-pal-item')) === 0);
  await page.locator('.wc[tabindex]').focus();
  await page.keyboard.press('Control+z');
  await sleep(400);
  check('g: one undo brings the circuit and its 9 copies back', (await instCards(page).count()) === 9 && (await count(page, '.ck-pal-item')) === 1);
  check('d: no browser dialog was ever opened', dialogs === 0, dialogs);

  // ---- e: circuit from the selected cards ----
  await page.keyboard.down('Shift');
  await card(page, 'hien-qd').locator('.wc-node-head .wc-name').click();
  await card(page, 'hien-canh').locator('.wc-node-head .wc-name').click();
  await page.keyboard.up('Shift');
  await sleep(250);
  await shot(page, 'flow-e1-two-cards-selected-teacher-light');
  const plainBefore = await count(page, '.wc-node:not(.wc-inst)');
  await page.locator('.pn-props button', { hasText: 'Tạo bảng mạch' }).click();
  await sleep(500);
  const s6 = await saved(page);
  const fresh = s6.circuits.at(-1);
  check('e: the two cards became one circuit with a copy in their place', (await count(page, '.wc-node:not(.wc-inst)')) === plainBefore - 2 && s6.circuits.length === 2 && fresh.graph.nodes.length === 2, fresh.name);
  check('e: the wires that crossed became pins', fresh.pins.length >= 1 && fresh.pins.every((p) => p.dir === 'in'), fresh.pins.map((p) => p.label).join(', '));
  await shot(page, 'flow-e2-circuit-from-selection-teacher-light');

  // ---- g: issues list, save / load ----
  await page.locator(`.ck-pal-item[data-circuit="${fresh.id}"] .ck-pal-tool[title="Mở ra sửa"]`).click();
  await sleep(400);
  await page.locator('.wc-pin-col.out .wc-pin-add').click();
  await sleep(300);
  const issueText = await page.locator('.cs-issues').innerText();
  check('g: an unfinished pin is listed under "Việc cần sửa" in plain words', issueText.includes('chưa nối vào mảnh ghép nào ở bên trong'), issueText.split('\n').filter((l) => l.includes('Bảng mạch')).join(' / '));
  await shot(page, 'flow-g1-issue-list-teacher-light');
  const s7 = await saved(page);
  await page.goto(BASE);
  await page.waitForSelector('.wc');
  await sleep(900);
  const s8 = await saved(page);
  check('g: the board comes back the same after a reload', JSON.stringify(s8) === JSON.stringify(s7) && (await instCards(page).count()) === s7.graph.nodes.filter((n) => n.kind === 'circuit').length, `${s8.circuits.length} circuits, ${s8.graph.nodes.length} cards`);
  check('g: after the reload the list still names the unfinished pin', (await page.locator('.cs-issues').innerText()).includes('chưa nối vào mảnh ghép nào'));

  // ---- running ----
  await fit(page);
  await page.keyboard.press('Control+Enter');
  await sleep(2500);
  const led = await page.locator('.wc-inst .wc-led.on').count();
  const badges = await page.locator('.wc-badge').evaluateAll((els) => els.map((e) => e.textContent).filter((t) => t && t !== '—'));
  check('running: the copies show "Đang chạy" and wires on their pins carry live values', led >= 8 && badges.length > 0, `${led} lights, badges ${badges.slice(0, 6).join(' ')}`);
  await shot(page, 'flow-run1-running-teacher-light');
  await page.keyboard.press('Control+Enter');
  await sleep(500);
  await context.close();
}

// ======================= Học sinh: view-only until "Sửa mạch" =======================
if (on('flows')) {
  const { page, context, info } = await open('light', 'student');
  await card(page, info.first).locator('.wc-inst-head .wc-name').dblclick();
  await sleep(500);
  const note = await page.locator('.wc-cnote').innerText();
  check('Học sinh: a circuit opens view-only with a "Sửa mạch" button', note.includes('Đang chỉ xem') && (await page.locator('.wc-cnote-edit').count()) === 1 && (await count(page, '.wc-pin-add')) === 0, note);
  const pos0 = await card(page, 'c-canh').boundingBox();
  const c0 = await center(card(page, 'c-canh').locator('.wc-node-head .wc-name'));
  await page.mouse.move(c0.x, c0.y); await page.mouse.down(); await page.mouse.move(c0.x + 60, c0.y + 40, { steps: 5 }); await page.mouse.up(); await sleep(250);
  const pos1 = await card(page, 'c-canh').boundingBox();
  check('Học sinh: a locked circuit does not let a card be dragged', Math.abs(pos1.x - pos0.x) < 1 && Math.abs(pos1.y - pos0.y) < 1);
  check('Học sinh: the inspector says it is view-only and greys its controls', (await page.locator('.pn-props .ck-note').innerText()).includes('Sửa mạch') && (await page.locator('.pn-props input:not(:disabled)').count()) === 0);
  await shot(page, 'flow-s1-student-view-only-light');
  await page.locator('.wc-cnote-edit').click();
  await sleep(400);
  check('Học sinh: "Sửa mạch" unlocks editing', (await count(page, '.wc-pin-add')) === 2 && !(await page.locator('.wc-cnote').innerText()).includes('Đang chỉ xem'));
  await shot(page, 'flow-s2-student-editing-light');
  await context.close();
}

// ======================= shots: both themes x both modes =======================
if (on('shots')) {
  for (const theme of ['light', 'dark']) {
    for (const mode of ['student', 'teacher']) {
      const tag = `${mode === 'student' ? 'hoc-sinh' : 'giao-vien'}-${theme === 'light' ? 'xam-diu' : 'toi'}`;
      const { page, context, info } = await open(theme, mode);
      await fit(page);
      await shot(page, `01-bang-chinh-8-ban-sao-${tag}`);
      await card(page, info.first).locator('.wc-inst-head .wc-name').click();
      await sleep(250);
      await shot(page, `02-chon-ban-sao-thuoc-tinh-${tag}`);
      await page.locator('.pn-props button', { hasText: 'Xếp chồng 8 máy' }).click();
      await sleep(300);
      await fit(page);
      await shot(page, `03-xep-chong-x8-${tag}`);
      await page.locator('.wc-inst-count').click();
      await sleep(300);
      await card(page, info.first).locator('.wc-inst-open').click();
      await sleep(500);
      if (mode === 'student') {
        await shot(page, `04a-trong-mach-chi-xem-${tag}`);
        await page.locator('.wc-cnote-edit').click();
        await sleep(400);
      }
      await page.locator('.wc-pin-col.in .wc-pin-add').click();
      await sleep(250);
      await card(page, 'c-canh').locator('.wc-node-head .wc-name').click();
      await sleep(250);
      await page.locator('.pn-props .ck-expose .pn-switch').first().click();
      await sleep(300);
      await fit(page);
      await shot(page, `04-trong-mach-chan-va-thong-so-mo-${tag}`);
      await clickEmpty(page);
      await shot(page, `05-trong-mach-tom-tat-${tag}`);
      // close-ups at 100% zoom: one block, one pin column
      await page.locator('.wc-ccrumb .wc-crumb-back').click();
      await sleep(400);
      await page.locator('.wc-rail .wc-pct').click();
      await sleep(300);
      await shot(page, `06-can-canh-100-${tag}`);
      await context.close();
    }
  }
}

await browser.close();
const failed = results.filter((r) => !r.ok);
fs.writeFileSync(path.join(OUT, 'flow-results.json'), JSON.stringify({ at: new Date().toISOString(), results, problems, dialogs }, null, 2));
console.log(`\n${results.length - failed.length}/${results.length} checks passed; page errors: ${problems.length}; dialogs: ${dialogs}`);
for (const p of problems.slice(0, 20)) console.log(p);
if (failed.length > 0) process.exitCode = 1;
