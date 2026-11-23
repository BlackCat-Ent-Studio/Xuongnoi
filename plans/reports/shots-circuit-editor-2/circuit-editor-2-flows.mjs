// Drives the second slice of the circuit editor on a dev server and takes the shots in this folder:
// bench ("Chạy thử máy này"), live values inside an entered copy, card ids, circuit files, colours, groups, starter circuits, scene tree.
// usage: PW_DIR=<folder with playwright-core installed> BASE=http://localhost:5182 node circuit-editor-2-flows.mjs [groups...]
// groups: bench live ids file colour group starters tree shots (none given = all)
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

process.on('uncaughtException', (e) => { console.log('CRASH', String(e.stack ?? e.message).slice(0, 600)); for (const p of problems.slice(0, 12)) console.log(p); process.exit(2); });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const problems = [];
let dialogs = 0;

/**
 * Builds the seed board inside the page from the app's own modules: the robot-square sample turned into a circuit "Xe AGV"
 * with 8 copies (the last one left unwired, so it stands still), plus a small circuit "Máy thử" that has every kind of pin
 * and one bench-only card.
 */
async function seed(page) {
  return page.evaluate(async () => {
    const io = await import('/src/io/index.ts');
    const nodes = await import('/src/nodes/index.ts');
    const model = await import('/src/editor/circuits/circuit-model.ts');
    const wiring = await import('/src/editor/circuits/circuit-wiring.ts');
    const save = await import('/src/io/save-format.ts');
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
    const at = { 'khi-bat-dau': [0, 60], 'hien-qd': [260, 360], 'hien-canh': [515, 360], san: [770, 360], 'hinh-mau': [1025, 360] };
    board.graph.nodes = board.graph.nodes.map((n) => (at[n.id] ? { ...n, pos: { x: at[n.id][0], y: at[n.id][1] } } : n.id === first ? { ...n, pos: { x: 260, y: 0 } } : n));
    const copies = [first];
    for (let i = 1; i < 8; i++) {
      const res = model.addInstance(board, [], made.circuitId, { x: 260 + (i % 4) * 255, y: Math.floor(i / 4) * 170 });
      if (!res.ok) throw new Error(res.reason);
      board = res.board;
      copies.push(res.nodeId);
      board.graph.nodes = board.graph.nodes.map((n) => (n.id === res.nodeId ? { ...n, params: { ...n.params, position: { x: (i % 4) * 6 - 9, y: 0, z: Math.floor(i / 4) * 6 + 5 } } } : n));
      if (i < 7) for (const p of inPins) {
        const c = wiring.connectIn(board, [], { node: 'khi-bat-dau', port: 'started' }, { node: res.nodeId, port: p.id });
        if (c.ok) board = c.board;
      }
    }
    board.graph.nodes = board.graph.nodes.map((n, i) => (n.kind === 'circuit' ? { ...n, params: { ...n.params, name: `Xe AGV ${board.graph.nodes.filter((m, j) => m.kind === 'circuit' && j <= i).length}` } } : n));
    // "Máy thử": one pin of every kind, one pin left unwired, and a bench-only number card that feeds "Số B".
    const node = (id, kind, params, x, y) => ({ id, kind, params, pos: { x, y } });
    board.circuits.push({
      id: 'cthu',
      name: 'Máy thử',
      graph: {
        nodes: [node('inv', 'not', {}, 0, 0), node('cmp', 'compare', { op: 'gt' }, 0, 150), node('five', 'const', { value: 5 }, -260, 260), node('wheel', 'motor', {}, 0, 330)],
        wires: [{ id: 'w1', from: { node: 'five', port: 'value' }, to: { node: 'cmp', port: 'b' } }],
      },
      pins: [
        { id: 'on', label: 'Bật', dir: 'in', type: 'bool', inner: { node: 'inv', port: 'in' } },
        { id: 'a', label: 'Số A', dir: 'in', type: 'number', inner: { node: 'cmp', port: 'a' } },
        { id: 'b', label: 'Số B', dir: 'in', type: 'number', inner: { node: 'cmp', port: 'b' } },
        { id: 'body', label: 'Thân', dir: 'in', type: 'object', inner: { node: 'wheel', port: 'body' } },
        { id: 'loose', label: 'Chưa dùng', dir: 'in', type: 'bool', inner: { node: '', port: '' } },
        { id: 'off', label: 'Đã tắt', dir: 'out', type: 'bool', inner: { node: 'inv', port: 'out' } },
        { id: 'bigger', label: 'A lớn hơn B', dir: 'out', type: 'bool', inner: { node: 'cmp', port: 'out' } },
      ],
      exposed: [{ id: 'e1', label: 'Tốc độ tối đa', inner: { node: 'wheel', param: 'maxRpm' } }],
      benchIds: ['five'],
    });
    const tester = model.addInstance(board, [], 'cthu', { x: 0, y: 420 });
    if (!tester.ok) throw new Error(tester.reason);
    board = tester.board;
    localStorage.setItem('xuong-noi:autosave', save.serializeBoard(board));
    return { first, copies, tester: tester.nodeId, circuit: made.circuitId, pins: pins.map((p) => `${p.dir}:${p.type}:${p.label}`) };
  });
}

async function open(theme, mode, { seeded = true, sample = null } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
  const page = await context.newPage();
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`[console ${theme}/${mode}] ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`[pageerror ${theme}/${mode}] ${e.message}`));
  page.on('dialog', (d) => { dialogs++; void d.dismiss(); });
  await page.goto(BASE);
  await page.evaluate(([t, m]) => { localStorage.clear(); localStorage.setItem('xuong-noi:tutorial-seen', '1'); localStorage.setItem('xuong-noi:theme', t); localStorage.setItem('xuong-noi:ui-mode', m); }, [theme, mode]);
  let info = null;
  if (seeded) info = await seed(page);
  if (sample) {
    await page.evaluate(async (id) => {
      const io = await import('/src/io/index.ts');
      const save = await import('/src/io/save-format.ts');
      (await import('/src/nodes/index.ts')).registerAllNodes();
      localStorage.setItem('xuong-noi:autosave', save.serializeBoard(structuredClone(io.listAllSamples().find((s) => s.id === id).board)));
    }, sample);
  }
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
const emptySpot = async (page) => { const b = await page.locator('.wc[tabindex]').boundingBox(); return { x: b.x + b.width - 30, y: b.y + 150 }; };
const clickEmpty = async (page) => { const p = await emptySpot(page); await page.mouse.click(p.x, p.y); await sleep(150); };
const card = (page, id) => page.locator(`.wc-node[data-id="${id}"]`);
const instCards = (page) => page.locator('.wc-node.wc-inst:not(.ck-static)');
const playKey = async (page) => { await page.evaluate(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))); await sleep(400); };
const isPlaying = (page) => page.evaluate(() => document.querySelector('.app').classList.contains('playing'));
const badges = (page) => page.locator('.wc-badge').allTextContents();
const openCopy = async (page, id) => { await card(page, id).locator('.wc-inst-open').click(); await sleep(450); };
const tag = (theme, mode) => `${mode === 'student' ? 'hoc-sinh' : 'giao-vien'}-${theme === 'light' ? 'xam-diu' : 'toi'}`;

// ======================= a: bench "Chạy thử máy này" =======================
if (on('bench')) {
  const { page, context, info } = await open('light', 'teacher');
  console.log('seed', JSON.stringify(info));
  const strip = page.locator('.ck-bench');
  check('a: no bench strip on the main board', !(await strip.isVisible()));
  await openCopy(page, info.first);
  const benchBtn = page.locator('.wc-ccrumb-bench');
  check('a: the path bar of an entered circuit has "Chạy thử máy này"', (await benchBtn.textContent()) === 'Chạy thử máy này');
  await benchBtn.click();
  await sleep(500);
  check('a: the strip opens under the board', await strip.isVisible(), await strip.locator('.ck-bench-title b').textContent());
  const geo = await page.evaluate(() => {
    const s = document.querySelector('.ck-bench').getBoundingClientRect();
    const c = document.querySelector('.wc[tabindex]').getBoundingClientRect();
    const p = document.querySelector('.pip')?.getBoundingClientRect();
    return { below: s.top >= c.bottom - 1, sameWidth: Math.abs(s.width - c.width) < 2, pipClear: !p || p.width === 0 || p.bottom <= s.top + 1 };
  });
  check('a: the strip is a band below the canvas, as wide as it, and the game window stays clear of it', geo.below && geo.sameWidth && geo.pipClear, JSON.stringify(geo));
  const inRows = strip.locator('.ck-bench-col.in .ck-bench-row');
  const outRows = strip.locator('.ck-bench-col.out .ck-bench-row');
  const wantIn = info.pins.filter((p) => p.startsWith('in:')).length;
  const wantOut = info.pins.filter((p) => p.startsWith('out:')).length;
  check('a: one row per pin of the circuit', (await inRows.count()) === wantIn && (await outRows.count()) === wantOut, `${await inRows.count()} in / ${await outRows.count()} out`);
  check('a: out pins show no value before the run', (await strip.locator('.ck-bench-out').allTextContents()).every((t) => t === '—'));
  await fit(page);
  await shot(page, 'flow-a1-bench-open-teacher-light');

  // run: only this machine runs, inputs off
  await strip.locator('[data-act="run"]').click();
  await sleep(1500);
  check('a: "Chạy thử" starts the run', await isPlaying(page));
  check('a: the note says the values are those of this circuit alone', (await page.locator('.wc-cnote-live[data-live="bench"]').count()) === 1);
  const outsOff = await strip.locator('.ck-bench-out').allTextContents();
  // switch every Đúng/Sai pin on by hand
  for (const sw of await strip.locator('.ck-bench-col.in .pn-switch').all()) await sw.click();
  await sleep(3500);
  const outsOn = await strip.locator('.ck-bench-out').allTextContents();
  check('a: switching the in pins on by hand makes the machine go (out pins change)', JSON.stringify(outsOff) !== JSON.stringify(outsOn), `${outsOff.join(' | ')}  ->  ${outsOn.join(' | ')}`);
  const live = (await badges(page)).filter((t) => /\d/.test(t) || t === 'Bật' || t === 'Tắt');
  check('a: wires inside show live values during the bench run', live.length > 0, `${live.length} badges with a value`);
  await shot(page, 'flow-a2-bench-running-teacher-light');
  check('a: the bench cannot be closed while it runs', await strip.locator('[data-act="exit"]').isDisabled());
  // reset restarts from the first tick with the inputs off again
  await strip.locator('[data-act="reset"]').click();
  await sleep(1200);
  const afterReset = await strip.locator('.ck-bench-col.in .pn-switch').evaluateAll((els) => els.map((e) => e.getAttribute('aria-checked')));
  check('a: "Đặt lại" switches the inputs off and keeps running from the start', afterReset.every((v) => v === 'false') && (await isPlaying(page)), afterReset.join(','));
  // Esc leaves the circuit: the bench run ends
  await strip.locator('[data-act="run"]').click();
  await sleep(400);
  check('a: "Dừng" stops the run', !(await isPlaying(page)));
  await strip.locator('[data-act="exit"]').click();
  await sleep(300);
  check('a: "Thoát bàn thử" closes the strip', !(await strip.isVisible()));
  const s1 = JSON.stringify(await saved(page));
  check('a: nothing of the bench is saved with the board', !s1.includes('@bench'));

  // the circuit with every kind of pin
  await page.keyboard.press('Escape');
  await sleep(300);
  await openCopy(page, info.tester);
  await page.locator('.wc-ccrumb-bench').click();
  await sleep(500);
  const row = (pin) => strip.locator(`.ck-bench-row[data-pin="${pin}"]`);
  check('a: a Đúng/Sai pin has a switch and a press button', (await row('on').locator('.pn-switch').count()) === 1 && (await row('on').locator('.ck-bench-press').count()) === 1);
  check('a: a Số pin has a stepper', (await row('a').locator('.pn-num input').count()) === 1);
  check('a: a pin fed by a bench card says so', (await row('b').textContent()).includes('Thẻ chạy thử'), await row('b').textContent());
  check('a: a Vật thể pin is marked "Cần nối ở bảng ngoài"', (await row('body').textContent()).includes('Cần nối ở bảng ngoài'));
  check('a: a pin not wired inside says so', (await row('loose').textContent()).includes('Chưa nối bên trong'));
  check('a: the bench card is marked on the canvas', (await card(page, 'five').locator('.wc-benchtag').count()) === 1);
  check('a: an opened setting shows the value the circuit holds, with a stepper', (await strip.locator('.ck-bench-row[data-exposed="e1"] .pn-num input').inputValue()) === '120');
  await strip.locator('[data-act="run"]').click();
  await sleep(700);
  const read = async (pin) => (await row(pin).locator('.ck-bench-out').textContent());
  check('a: running, input off: "Đã tắt" is on, "A lớn hơn B" is off (0 > 5)', (await read('off')) === 'Bật' && (await read('bigger')) === 'Tắt', `${await read('off')} / ${await read('bigger')}`);
  await row('on').locator('.pn-switch').click();
  const numBox = row('a').locator('.pn-num input');
  await numBox.fill('9');
  await numBox.dispatchEvent('input');
  await sleep(500);
  check('a: switch on and A = 9 typed while running: "Đã tắt" goes off, "A lớn hơn B" goes on (9 > 5)', (await read('off')) === 'Tắt' && (await read('bigger')) === 'Bật', `${await read('off')} / ${await read('bigger')}`);
  // press-and-hold
  await row('on').locator('.pn-switch').click();
  await sleep(300);
  const pressAt = await center(row('on').locator('.ck-bench-press'));
  await page.mouse.move(pressAt.x, pressAt.y);
  await page.mouse.down();
  await sleep(400);
  const held = await read('off');
  await page.mouse.up();
  await sleep(400);
  check('a: "Nhấn" is on only while held', held === 'Tắt' && (await read('off')) === 'Bật', `held ${held}, released ${await read('off')}`);
  const pinBadge = await badges(page);
  check('a: the wire of the hand-driven number pin shows 9 on the canvas', pinBadge.some((t) => t.startsWith('9')), pinBadge.join(' | '));
  await fit(page);
  await shot(page, 'flow-a3-bench-every-pin-kind-teacher-light');
  await page.keyboard.press('Escape');
  await sleep(400);
  check('a: leaving the circuit ends its bench run and closes the bench', !(await isPlaying(page)) && !(await strip.isVisible()));

  // bench card switch in the inspector
  await openCopy(page, info.tester);
  await card(page, 'inv').locator('.wc-head, .wc-title').first().click();
  await sleep(250);
  const benchSwitch = page.locator('.pn-props [data-bench="inv"]');
  check('a: a card inside a circuit has the "Chỉ để chạy thử" switch', (await benchSwitch.count()) === 1);
  await benchSwitch.click();
  await sleep(250);
  check('a: a card that holds a pin cannot become a bench card (says why)', (await benchSwitch.getAttribute('aria-checked')) === 'false' && (await page.locator('.toast, .tb-toast, [role="status"]').allTextContents()).join(' ').includes('chân'));
  await card(page, 'five').locator('.wc-head, .wc-title').first().click();
  await sleep(250);
  check('a: the bench card shows its switch on', (await page.locator('.pn-props [data-bench="five"]').getAttribute('aria-checked')) === 'true');
  await shot(page, 'flow-a4-bench-card-inspector-teacher-light');
  await context.close();
}

// ======================= b: live values inside an entered copy while the whole board runs =======================
if (on('live')) {
  const { page, context, info } = await open('light', 'teacher');
  const [first] = info.copies;
  const last = info.copies[7]; // left unwired by the seed: this machine never starts
  await playKey(page);
  await sleep(2500);
  check('b: the whole board is running', await isPlaying(page));
  await openCopy(page, first);
  const note = page.locator('.wc-cnote-live');
  check('b: the note names the copy whose values are shown', (await note.getAttribute('data-live')) === 'copy' && (await note.textContent()).includes('Xe AGV 1'), await note.textContent());
  await sleep(600);
  const inFirst = await badges(page);
  const pinsFirst = await page.locator('.wc-pin.in .wc-port-val, .wc-pin .wc-port-val').allTextContents();
  check('b: wires inside the entered copy carry values', inFirst.filter((t) => t !== '—' && t !== '').length >= 10, `${inFirst.filter((t) => t !== '—').length}/${inFirst.length} wires with a value`);
  check('b: the wire of an in pin shows what arrives from the board outside ("Đúng")', inFirst.includes('Đúng'), inFirst.slice(0, 12).join(' | '));
  const pills = await page.locator('.wc-node .wc-port-val').allTextContents();
  check('b: number ports inside show value pills', pills.length > 0, `${pills.length} pills, e.g. ${pills.slice(0, 4).join(' ')}`);
  await fit(page);
  await shot(page, 'flow-b1-live-inside-copy-1-teacher-light');
  await page.keyboard.press('Escape');
  await sleep(400);
  check('b: leaving a copy does not stop the board', await isPlaying(page));
  await openCopy(page, last);
  await sleep(600);
  const inLast = await badges(page);
  check('b: the note follows to the other copy', (await note.textContent()).includes('Xe AGV 8'), await note.textContent());
  const blank = (list) => list.filter((t) => t === '—').length;
  const differ = inFirst.map((t, i) => (t === inLast[i] ? null : `${t}≠${inLast[i]}`)).filter(Boolean);
  check('b: another copy of the same circuit shows its own values (its in pins have no wire outside, so nothing arrives)', differ.length > 0 && blank(inFirst) === 0 && blank(inLast) === 2, `${differ.length} wires differ, e.g. ${differ.slice(0, 6).join('  ')}; blank ${blank(inFirst)} vs ${blank(inLast)}`);
  await fit(page);
  await shot(page, 'flow-b2-live-inside-copy-8-teacher-light');
  check('b: the bench cannot be opened while the board runs', await page.locator('.wc-ccrumb-bench').isDisabled());
  // opened from the list: no copy was chosen, so no values, and the note says so
  await page.locator('.ck-pal-item[data-circuit="c1"] .ck-pal-tool[title="Mở ra sửa"]').click();
  await sleep(500);
  check('b: opened from the list, the note says no copy is chosen', (await note.getAttribute('data-live')) === 'no-copy', await note.textContent());
  check('b: and no wire pretends to have a value', (await badges(page)).every((t) => t === '—' || t === ''), (await badges(page)).slice(0, 6).join(' | '));
  await shot(page, 'flow-b3-live-no-copy-chosen-teacher-light');
  await page.keyboard.press('Escape');
  await playKey(page);
  check('b: stop', !(await isPlaying(page)));
  await context.close();
}

const toast = (page) => page.locator('.status').first().textContent();
const palItem = (page, id) => page.locator(`.ck-pal-item[data-circuit="${id}"]`);
const palNames = (page) => page.locator('.ck-pal-item .pn-item-text b').allTextContents();

// ======================= h: ids of new cards on a shipped board whose notes are named n1, n2... =======================
if (on('ids')) {
  const { page, context } = await open('light', 'teacher', { seeded: false, sample: 'robot-square' });
  const before = await saved(page);
  const noteIds = (before.notes ?? []).map((n) => n.id);
  const notesDrawn = await count(page, '.wc-note');
  const cardsDrawn = await count(page, '.wc-node');
  await page.locator('.dock-left [data-kind="const"]').first().click();
  await sleep(400);
  const after = await saved(page);
  const fresh = after.graph.nodes.filter((n) => !before.graph.nodes.some((m) => m.id === n.id)).map((n) => n.id);
  check('h: the shipped board has notes with card-like ids', noteIds.some((id) => /^n\d+$/.test(id)), noteIds.join(','));
  check('h: a piece added from the palette gets an id no note has', fresh.length === 1 && !noteIds.includes(fresh[0]), `new card ${fresh.join(',')}`);
  check('h: it is drawn as a card and every note is still a note', (await count(page, '.wc-node')) === cardsDrawn + 1 && (await count(page, '.wc-note')) === notesDrawn, `${await count(page, '.wc-node')} cards, ${await count(page, '.wc-note')} notes`);
  check('h: the new card is the selected card (its settings show)', (await page.locator('.pn-props .pn-iname').first().textContent()) === 'Số cố định');
  await shot(page, 'flow-h1-new-card-beside-notes-teacher-light');
  await context.close();
}

// ======================= c: one circuit as a file =======================
if (on('file')) {
  const { page, context, info } = await open('light', 'teacher');
  const [download] = await Promise.all([page.waitForEvent('download'), palItem(page, 'c1').locator('.ck-pal-tool[title="Xuất ra tệp"]').click()]);
  const file = path.join(OUT, 'xe-agv.bangmach.json');
  await download.saveAs(file);
  const text = JSON.parse(fs.readFileSync(file, 'utf8'));
  check('c: "Xuất ra tệp" downloads <tên>.bangmach.json with that circuit only', download.suggestedFilename() === 'Xe AGV.bangmach.json' && text.kind === 'xuongnoi-circuit' && text.circuits.length === 1 && text.circuits[0].name === 'Xe AGV', `${download.suggestedFilename()}, ${text.circuits.length} circuit(s)`);
  const pick = async () => {
    const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.ck-pal-new[data-act="import"]').click()]);
    await chooser.setFiles(file);
    await sleep(500);
  };
  // same name: asked in the page, nothing changes until a choice is made
  await pick();
  const ask = page.locator('.ck-pal-incoming');
  check('c: a file whose circuit name is taken is asked about in the palette (no browser dialog)', (await ask.count()) === 1 && dialogs === 0 && (await ask.textContent()).includes('Xe AGV'), (await ask.textContent()).slice(0, 110));
  check('c: nothing is added before the choice', (await palNames(page)).join('|') === 'Xe AGV|Máy thử');
  await page.locator('.dock-left .pn-items.ck-pal-items').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await shot(page, 'flow-c1-import-name-clash-asked-teacher-light');
  await ask.locator('[data-act="keep"]').click();
  await sleep(400);
  check('c: "Giữ cả hai" adds it under a numbered name', (await palNames(page)).join('|') === 'Xe AGV|Máy thử|Xe AGV 2', (await palNames(page)).join('|'));
  check('c: and says so', (await toast(page)).includes('Đã nhập bảng mạch "Xe AGV 2"'), await toast(page));
  const s1 = await saved(page);
  const added = s1.circuits.find((c) => c.name === 'Xe AGV 2');
  check('c: the imported circuit has the same inside as the exported one, under a new id', added && added.id !== info.circuit && JSON.stringify(added.graph) === JSON.stringify(s1.circuits[0].graph) && JSON.stringify(added.pins) === JSON.stringify(s1.circuits[0].pins));
  // place a copy of the imported circuit and run: 9 machines
  await palItem(page, added.id).press('Enter');
  await sleep(400);
  check('c: a copy of the imported circuit can be placed', (await instCards(page).count()) === 10, await instCards(page).count());
  // replace: change the board's circuit first (delete a pin), then bring the file back in its place
  await openCopy(page, info.first);
  const pinsBefore = await count(page, '.wc-pin[data-pin]');
  await page.locator('.wc-pin.out .wc-pin-tool[title="Xóa chân này"]').first().click();
  await sleep(300);
  await page.keyboard.press('Escape');
  await sleep(300);
  const wiresCut = (await saved(page)).graph.wires.length;
  await pick();
  await ask.locator('[data-act="replace"]').click();
  await sleep(500);
  const saidReplace = await toast(page);
  const s2 = await saved(page);
  const back = s2.circuits.find((c) => c.id === info.circuit);
  check('c: "Thay bảng mạch cũ" puts the file in the place of the old circuit: same id, all pins back, copies kept', back.pins.length === pinsBefore && s2.graph.nodes.filter((n) => n.kind === 'circuit' && n.params.circuit === info.circuit).length === 8, `${back.pins.length} pins, toast: ${saidReplace}`);
  check('c: wires that were on the board stay', s2.graph.wires.length === wiresCut, `${wiresCut} -> ${s2.graph.wires.length}`);
  await page.keyboard.press('Control+z');
  await sleep(300);
  check('c: one undo brings the old circuit back', (await saved(page)).circuits.find((c) => c.id === info.circuit).pins.length === pinsBefore - 1);
  // a board file is refused with a plain message
  const boardFile = path.join(OUT, 'not-a-circuit.json');
  fs.writeFileSync(boardFile, JSON.stringify(s2));
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.ck-pal-new[data-act="import"]').click()]);
  await chooser.setFiles(boardFile);
  await sleep(500);
  check('c: a whole-board file is refused with a message that says what it is', (await toast(page)).includes('không phải tệp bảng mạch'), await toast(page));
  fs.unlinkSync(boardFile);
  await context.close();

  // into another, empty board
  const second = await open('light', 'teacher', { seeded: false });
  const [chooser2] = await Promise.all([second.page.waitForEvent('filechooser'), second.page.locator('.ck-pal-new[data-act="import"]').click()]);
  await chooser2.setFiles(file);
  await sleep(500);
  check('c: the file opens in another board without any question', (await palNames(second.page)).join('|') === 'Xe AGV' && (await second.page.locator('.ck-pal-incoming').count()) === 0, (await palNames(second.page)).join('|'));
  await second.context.close();
}

// ======================= f: colour of a circuit =======================
if (on('colour')) {
  const { page, context, info } = await open('light', 'teacher');
  check('f: no colour dot before a colour is chosen', (await count(page, '.wc-node .wc-inst-col')) === 0);
  await palItem(page, 'c1').locator('.ck-pal-tool[title="Đổi màu"]').click();
  await sleep(200);
  await palItem(page, 'c1').locator('.pn-swatch[data-colour="#f27ad0"]').click();
  await sleep(300);
  check('f: picking a colour in the row puts the dot on every copy and in the list', (await count(page, '.wc-node .wc-inst-col')) === 8 && (await palItem(page, 'c1').locator('.ck-pal-ic .wc-inst-col').count()) === 1, await count(page, '.wc-node .wc-inst-col'));
  check('f: the colour is saved with the circuit', (await saved(page)).circuits[0].color === '#f27ad0');
  await fit(page);
  await shot(page, 'flow-f1-circuit-colour-row-picker-teacher-light');
  await palItem(page, 'c1').locator('.ck-pal-btn', { hasText: 'Xong' }).click();
  // the summary of an entered circuit has the same picker
  await openCopy(page, info.first);
  const summary = page.locator('.pn-props .ck-colour');
  check('f: the summary of the entered circuit shows the picker with the colour on', (await summary.locator('.pn-swatch.on').getAttribute('data-colour')) === '#f27ad0');
  await summary.locator('.pn-swatch[data-colour="#5aa9ff"]').click();
  await sleep(300);
  check('f: changing it there is saved too', (await saved(page)).circuits[0].color === '#5aa9ff');
  await shot(page, 'flow-f2-circuit-colour-summary-teacher-light');
  await summary.locator('.pn-swatch.none').click();
  await sleep(300);
  const s = await saved(page);
  check('f: "Màu mặc định" removes the colour from the file again', !('color' in s.circuits[0]));
  await page.keyboard.press('Control+z');
  await sleep(200);
  check('f: undo brings the colour back', (await saved(page)).circuits[0].color === '#5aa9ff');
  await context.close();
}

// ======================= e: "Chuyển nhóm thành bảng mạch" =======================
if (on('group')) {
  const { page, context } = await open('light', 'teacher', { seeded: false, sample: 'robot-square' });
  const before = await saved(page);
  // group two wired cards through the app's own "Gom nhóm"
  const pair = before.graph.wires.map((w) => [w.from.node, w.to.node]).find(([a, b]) => a !== b);
  await card(page, pair[0]).locator('.wc-head, .wc-title').first().click();
  await card(page, pair[1]).locator('.wc-head, .wc-title').first().click({ modifiers: ['Shift'] });
  await page.keyboard.press('Control+g');
  await sleep(500);
  const grouped = await saved(page);
  check('e: two cards are grouped (the starting point)', (grouped.graph.groups ?? []).length === 1, JSON.stringify((grouped.graph.groups ?? []).map((g) => g.nodeIds)));
  await page.locator('.wc-node.wc-group').first().click();
  await sleep(250);
  const btn = page.locator('.pn-props [data-act="group-to-circuit"]');
  check('e: the group inspector offers "Chuyển nhóm thành bảng mạch"', (await btn.textContent()) === 'Chuyển nhóm thành bảng mạch');
  await shot(page, 'flow-e1-group-inspector-teacher-light');
  await btn.click();
  await sleep(500);
  const said = await toast(page);
  const after = await saved(page);
  const circuit = after.circuits?.[0];
  check('e: the group is gone and a circuit with its two cards stands in its place', !after.graph.groups && circuit && circuit.graph.nodes.length === 2 && (await instCards(page).count()) === 1, `${circuit?.name}: ${circuit?.pins.length} pins`);
  check('e: it says what it did', said.includes('Đã chuyển nhóm thành bảng mạch') || said.includes('Đã gói thành bảng mạch'), said);
  const crossing = before.graph.wires.filter((w) => pair.includes(w.from.node) !== pair.includes(w.to.node));
  const inside = before.graph.wires.filter((w) => pair.includes(w.from.node) && pair.includes(w.to.node)).length;
  const onCopy = after.graph.wires.filter((w) => [w.from.node, w.to.node].some((id) => after.graph.nodes.find((n) => n.id === id)?.kind === 'circuit')).length;
  check('e: the wires inside the group moved into the circuit; every wire that left the group is still on the board, now on a pin', after.graph.wires.length === before.graph.wires.length - inside && onCopy === crossing.length && circuit.graph.wires.length === inside, `${crossing.length} crossing = ${onCopy} on the copy, ${inside} inside`);
  await fit(page);
  await shot(page, 'flow-e2-group-became-circuit-teacher-light');
  await playKey(page);
  await sleep(1500);
  check('e: the board still runs', (await isPlaying(page)) && problems.length === 0);
  await playKey(page);
  await page.keyboard.press('Control+z');
  await sleep(300);
  check('e: one undo brings the group back', ((await saved(page)).graph.groups ?? []).length === 1);
  await context.close();
}

// ======================= d: starter circuits =======================
if (on('starters')) {
  const { page, context } = await open('light', 'teacher', { seeded: false });
  const rows = page.locator('.ck-pal-starter');
  check('d: the palette group lists the starter circuits', (await rows.locator('b').allTextContents()).join('|') === 'Đèn nháy|Xe hai bánh tới mốc', (await rows.locator('b').allTextContents()).join('|'));
  await shot(page, 'flow-d1-starter-list-teacher-light');
  for (const row of await rows.all()) await row.locator('.ck-pal-btn').click();
  await sleep(400);
  check('d: "Thêm" puts them in the board', (await palNames(page)).join('|') === 'Đèn nháy|Xe hai bánh tới mốc', (await palNames(page)).join('|'));
  const s = await saved(page);
  const cart = s.circuits.find((c) => c.name === 'Xe hai bánh tới mốc');
  const lamp = s.circuits.find((c) => c.name === 'Đèn nháy');
  // the cart: place a copy, open it, try it alone
  await palItem(page, cart.id).press('Enter');
  await sleep(400);
  const copyId = (await saved(page)).graph.nodes.find((n) => n.kind === 'circuit').id;
  await openCopy(page, copyId);
  check('d: inside, the starter is made of ordinary pieces, two of them bench cards', (await count(page, '.wc-node:not(.wc-inst)')) === 6 && (await count(page, '.wc-benchtag')) === 2, `${await count(page, '.wc-node')} cards, ${await count(page, '.wc-benchtag')} bench`);
  await page.locator('.wc-ccrumb-bench').click();
  await sleep(500);
  const strip = page.locator('.ck-bench');
  const out = async (pin) => strip.locator(`.ck-bench-row[data-pin="${pin}"] .ck-bench-out`).textContent();
  check('d: on the bench the object pin is fed by the bench marker', (await strip.locator('.ck-bench-row[data-pin="p1"]').textContent()).includes('Thẻ chạy thử'));
  await fit(page);
  await shot(page, 'flow-d2-cart-inside-with-bench-teacher-light');
  await strip.locator('[data-act="run"]').click();
  await sleep(1200);
  const far = Number(await out('p4'));
  check('d: the cart waits while "Chạy" is off (5 m from the bench marker)', (await out('p3')) === 'Tắt' && Math.abs(far - 5) < 0.2, `Đã tới ${await out('p3')}, còn cách ${far}`);
  await strip.locator('.ck-bench-row[data-pin="p2"] .pn-switch').click();
  let arrived = false;
  for (let i = 0; i < 60 && !arrived; i++) { await sleep(500); arrived = (await out('p3')) === 'Bật'; }
  check('d: "Chạy" switched on: the cart drives to the marker and "Đã tới" comes on', arrived && Number(await out('p4')) < 0.2, `còn cách ${await out('p4')}`);
  await shot(page, 'flow-d3-cart-arrived-on-bench-teacher-light');
  await page.keyboard.press('Escape');
  await sleep(400);
  // the lamp
  await page.locator(`.ck-pal-item[data-circuit="${lamp.id}"] .ck-pal-tool[title="Mở ra sửa"]`).click();
  await sleep(400);
  await page.locator('.wc-ccrumb-bench').click();
  await sleep(400);
  await strip.locator('[data-act="run"]').click();
  await sleep(900);
  const dark = await out('p2');
  await strip.locator('.ck-bench-row[data-pin="p1"] .pn-switch').click();
  const seen = new Set();
  for (let i = 0; i < 16; i++) { await sleep(170); seen.add(await out('p2')); }
  check('d: "Đèn nháy" stays off until "Bật", then goes on and off', dark === 'Tắt' && seen.has('Bật') && seen.has('Tắt'), `before ${dark}, then ${[...seen].join('/')}`);
  await shot(page, 'flow-d4-blinker-on-bench-teacher-light');
  await strip.locator('[data-act="run"]').click();
  await context.close();
}

// ======================= i: scene tree, stage clicks and step run with cards inside copies =======================
if (on('tree')) {
  const { page, context, info } = await open('light', 'teacher');
  await page.locator('#tab-scene').click();
  await sleep(400);
  const rows = page.locator('.scene-tree-wrap [data-node-id]');
  const texts = await rows.allTextContents();
  const inside = texts.filter((t) => t.includes('›'));
  check('i: the scene tree lists the objects inside the copies, named by copy', inside.length >= 8 && inside.some((t) => t.includes('Xe AGV 3 ›')), `${texts.length} rows, ${inside.length} inside copies, e.g. ${inside.slice(0, 2).join(' | ')}`);
  await shot(page, 'flow-i1-scene-tree-names-copies-teacher-light');
  const row = rows.filter({ hasText: 'Xe AGV 3 ›' }).first();
  const rowId = await row.getAttribute('data-node-id');
  await row.click();
  await sleep(500);
  const crumbName = await page.locator('.wc-ccrumb .wc-crumb-name').inputValue();
  const noteText = await page.locator('.wc-cnote').textContent();
  check('i: a row of a copy opens that copy and selects the card inside', crumbName === 'Xe AGV' && noteText.includes('Xe AGV 3') && (await count(page, '.wc-node.selected')) === 1, `${rowId}: crumb ${crumbName}, selected ${await page.locator('.pn-props .pn-iname').first().textContent()}`);
  check('i: the row stays marked as the selection', (await row.getAttribute('aria-selected')) === 'true');
  await page.keyboard.press('Escape');
  await sleep(300);
  // selecting a copy marks every object inside it in the tree
  await card(page, info.copies[1]).locator('.wc-inst-head .wc-name').click();
  await sleep(300);
  const marked = await page.locator('.scene-tree-wrap [data-node-id][aria-selected="true"]').allTextContents();
  check('i: a selected copy marks its own objects in the tree', marked.length >= 1 && marked.every((t) => t.includes('Xe AGV 2 ›')), marked.join(' | '));

  // stage: click all over the game view; an object inside a copy selects that copy, nothing breaks
  await page.locator('#tab-game').click();
  await sleep(700);
  const box = await page.locator('.game-box canvas').first().boundingBox();
  let copyHits = 0;
  let cardHits = 0;
  for (let gy = 1; gy <= 9; gy++) {
    for (let gx = 1; gx <= 15; gx++) {
      await page.mouse.click(box.x + (box.width * gx) / 16, box.y + (box.height * gy) / 10);
      const head = await page.locator('.pn-props .ck-ihead .pn-icat').first().textContent({ timeout: 200 }).catch(() => null);
      if (head && head.startsWith('Bản sao')) copyHits++;
      else if ((await count(page, '.pn-props .pn-ihead')) > 0) cardHits++;
    }
  }
  check('i: clicks on the stage never break the page; an object of a copy selects the copy, a main-board object its own card', problems.length === 0 && copyHits > 0, `135 clicks: ${copyHits} on objects of copies, ${cardHits} on main-board objects`);
  await shot(page, 'flow-i2-stage-click-selects-copy-teacher-light');
  await page.locator('#tab-graph').click();
  await sleep(400);

  // step run inside an entered copy: it stops on a card of that copy
  // (The very first play of a "Vật lý thật" board loads the physics engine first, and a step run pressed as that first play
  // does not arm: that is so on the main board too. So the board is played once before the step run is tried.)
  await playKey(page);
  await sleep(1500);
  await playKey(page);
  await openCopy(page, info.first);
  await page.locator('.step-btn').click();
  let lit = 0;
  for (let i = 0; i < 40 && lit === 0; i++) { await sleep(250); lit = await count(page, '.wc-node.step-lit'); }
  check('i: "Từng bước" inside an entered copy stops on cards of that copy', lit > 0 && (await page.locator('.wc').first().evaluate((el) => el.classList.contains('step-on'))), `${lit} cards lit`);
  await shot(page, 'flow-i3-step-inside-copy-teacher-light');
  await page.keyboard.press('Escape');
  await sleep(300);
  await playKey(page);
  // and on the main board it stops on a pin of a copy or a plain card
  await page.locator('.step-btn').click();
  let stops = 0;
  for (let i = 0; i < 40 && stops === 0; i++) { await sleep(250); stops = await count(page, '.wc-node.step-lit'); }
  check('i: "Từng bước" on the main board still stops', stops > 0, `${stops} cards lit`);
  await playKey(page);
  check('i: no page errors through all of it', problems.length === 0, problems.slice(0, 2).join(' / '));
  await context.close();
}

// ======================= shots: both themes, both modes =======================
if (on('shots')) {
  for (const theme of ['light', 'dark']) {
    for (const mode of ['student', 'teacher']) {
      const { page, context, info } = await open(theme, mode);
      const t = tag(theme, mode);
      // 01 palette group with colours and starters
      await page.locator('.ck-pal-item[data-circuit="c1"] .ck-pal-tool[title="Đổi màu"]').click();
      await page.locator('.ck-pal-item[data-circuit="c1"] .pn-swatch[data-colour="#f27ad0"]').click();
      await sleep(250);
      await fit(page);
      await shot(page, `01-nhom-bang-mach-mau-va-mach-mau-${t}`);
      await page.locator('.ck-pal-item[data-circuit="c1"] .ck-pal-btn', { hasText: 'Xong' }).click();
      // 02 bench open, not running
      await openCopy(page, info.tester);
      await page.locator('.wc-ccrumb-bench').click();
      await sleep(500);
      await fit(page);
      await shot(page, `02-ban-thu-moi-loai-chan-${t}`);
      // 03 bench running with inputs set
      const strip = page.locator('.ck-bench');
      await strip.locator('[data-act="run"]').click();
      await sleep(500);
      await strip.locator('.ck-bench-row[data-pin="on"] .pn-switch').click();
      const num = strip.locator('.ck-bench-row[data-pin="a"] .pn-num input');
      await num.fill('9');
      await num.dispatchEvent('input');
      await sleep(700);
      await shot(page, `03-ban-thu-dang-chay-${t}`);
      // Esc typed in a number box belongs to the box; the board has to have the focus to leave the circuit.
      await page.locator('.wc[tabindex]').focus();
      await page.keyboard.press('Escape');
      await sleep(400);
      // 04 bench of the cart circuit running
      await openCopy(page, info.first);
      await page.locator('.wc-ccrumb-bench').click();
      await sleep(400);
      await strip.locator('[data-act="run"]').click();
      await sleep(400);
      for (const sw of await strip.locator('.ck-bench-col.in .pn-switch').all()) await sw.click();
      await sleep(2500);
      await fit(page);
      await shot(page, `04-ban-thu-xe-agv-dang-chay-${t}`);
      await page.keyboard.press('Escape');
      await sleep(400);
      // 05 whole board running, inside copy 3
      await playKey(page);
      await sleep(2000);
      await openCopy(page, info.copies[2]);
      await sleep(700);
      await fit(page);
      await shot(page, `05-dang-chay-ben-trong-xe-agv-3-${t}`);
      await page.keyboard.press('Escape');
      await playKey(page);
      // 06 close-up of the strip at 100%
      await openCopy(page, info.tester);
      await page.locator('.wc-ccrumb-bench').click();
      await sleep(400);
      const sb = await strip.boundingBox();
      await page.screenshot({ path: path.join(OUT, `06-can-canh-dai-ban-thu-${t}.png`), clip: { x: sb.x, y: sb.y - 120, width: sb.width, height: sb.height + 120 } });
      console.log('shot', `06-can-canh-dai-ban-thu-${t}`);
      check(`shots ${t}: no page problems`, problems.length === 0);
      await context.close();
    }
  }
}

/**
 * Value pills and wire badges against the texts they must not cover, measured on screen inside the open board:
 * every pill of a port against the label of its own row, and every wire badge against every port label and every other badge.
 * Returns what overlaps (by more than a pixel), with enough text to find it.
 */
const overlaps = (page) => page.evaluate(() => {
  const view = document.querySelector('.wc[tabindex]').getBoundingClientRect();
  const box = (el) => el.getBoundingClientRect();
  const shown = (r) => r.width > 0 && r.height > 0 && r.right > view.left && r.left < view.right && r.bottom > view.top && r.top < view.bottom;
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 1 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 1;
  /** The box of the text itself (a label element may be wider than its words). */
  const textBox = (el) => { const r = document.createRange(); r.selectNodeContents(el); return r.getBoundingClientRect(); };
  const out = { pills: 0, badges: 0, twoPills: [], pillOnLabel: [], pillOnDot: [], badgeOnLabel: [], badgeOnBadge: [], badgeOnPill: [] };
  const labels = [...document.querySelectorAll('.wc-nodes .wc-port .wc-pl, .wc-stubs .wc-pin-name')].map((el) => ({ el, r: el.matches('input') ? box(el) : textBox(el), text: el.value ?? el.textContent })).filter((l) => shown(l.r));
  for (const row of document.querySelectorAll('.wc-nodes .wc-port, .wc-stubs .wc-port')) {
    const pills = [...row.querySelectorAll('.wc-port-val')].filter((p) => shown(box(p)));
    out.pills += pills.length;
    const name = row.querySelector('.wc-pl');
    if (pills.length > 1) out.twoPills.push(`${name?.textContent}: ${pills.map((p) => p.textContent).join(' + ')}`);
    for (const p of pills) if (name && hit(box(p), textBox(name))) out.pillOnLabel.push(`${p.textContent} on "${name.textContent}"`);
    const dot = row.querySelector('.wc-dot');
    for (const p of pills) if (dot && hit(box(p), box(dot))) out.pillOnDot.push(`${p.textContent} on the dot of "${name?.textContent ?? row.closest('.wc-pin')?.querySelector('.wc-pin-name')?.value ?? '?'}"`);
  }
  const badges = [...document.querySelectorAll('.wc-badge')].map((el) => ({ el, r: box(el), text: el.textContent })).filter((b) => shown(b.r) && b.text !== '');
  out.badges = badges.length;
  out.wires = document.querySelectorAll('.wc-wire-g').length;
  out.allBadges = document.querySelectorAll('.wc-badge').length;
  for (const b of badges) {
    for (const l of labels) if (hit(b.r, l.r)) out.badgeOnLabel.push(`${b.text} on "${l.text}"`);
    for (const p of document.querySelectorAll('.wc-port-val')) if (shown(box(p)) && hit(b.r, box(p))) out.badgeOnPill.push(`${b.text} on pill ${p.textContent}`);
  }
  for (let i = 0; i < badges.length; i++) for (let j = i + 1; j < badges.length; j++) if (hit(badges[i].r, badges[j].r)) out.badgeOnBadge.push(`${badges[i].text} / ${badges[j].text}`);
  return out;
});
const clean = (o) => o.twoPills.length + o.pillOnLabel.length + o.pillOnDot.length + o.badgeOnLabel.length + o.badgeOnBadge.length + o.badgeOnPill.length === 0;
const tell = (o) => `${o.pills} pills and ${o.badges} badges on screen, ${o.allBadges} badges for ${o.wires} wires on the board; two pills: ${o.twoPills.slice(0, 3).join(' | ') || '-'}; pill on label: ${o.pillOnLabel.slice(0, 4).join(' | ') || '-'}; pill on dot: ${o.pillOnDot.slice(0, 3).join(' | ') || '-'}; badge on label: ${o.badgeOnLabel.slice(0, 4).join(' | ') || '-'}; badge on pill: ${o.badgeOnPill.slice(0, 3).join(' | ') || '-'}; badge on badge: ${o.badgeOnBadge.slice(0, 3).join(' | ') || '-'}`;

// ======================= values drawn inside an entered copy must not cover names or each other =======================
if (on('overlap')) {
  for (const [theme, mode] of [['light', 'teacher'], ['dark', 'student']]) {
    const { page, context, info } = await open(theme, mode);
    const t = tag(theme, mode);
    for (const zoomTo of ['fit', '100']) {
      // live copy: the whole board runs, copy 3 is entered
      await playKey(page);
      await sleep(1800);
      await openCopy(page, info.copies[2]);
      if (zoomTo === 'fit') await fit(page);
      else { await page.locator('.wc[tabindex]').focus(); await page.locator('.wc-rail button', { hasText: '%' }).first().click(); await sleep(300); }
      await sleep(900);
      const live = await overlaps(page);
      const zoom = (await page.locator('.wc-rail').textContent()).match(/\d+%/)?.[0] ?? '?';
      check(`overlap ${t}: live inside copy 3 at ${zoom}: one pill per port, no pill or wire badge on a port name, no badge on a badge`, live.pills > 0 && live.badges > 0 && clean(live), tell(live));
      await page.locator('.wc[tabindex]').focus();
      await page.keyboard.press('Escape');
      await sleep(300);
      await playKey(page);
      // bench of the same circuit
      await openCopy(page, info.first);
      await page.locator('.wc-ccrumb-bench').click();
      await sleep(400);
      const strip = page.locator('.ck-bench');
      await strip.locator('[data-act="run"]').click();
      await sleep(400);
      const off = strip.locator('.ck-bench-col.in .pn-switch[aria-checked="false"]');
      while ((await off.count()) > 0) await off.first().click();
      if (zoomTo === 'fit') await fit(page);
      else { await page.locator('.wc[tabindex]').focus(); await page.locator('.wc-rail button', { hasText: '%' }).first().click(); await sleep(300); }
      await sleep(1500);
      const bench = await overlaps(page);
      check(`overlap ${t}: bench run at ${zoom}: one pill per port, no pill or wire badge on a port name, no badge on a badge`, bench.pills > 0 && bench.badges > 0 && clean(bench), tell(bench));
      await page.locator('.wc[tabindex]').focus();
      await page.keyboard.press('Escape');
      await sleep(400);
    }
    // the circuit with number pins: the pin cards show no pill of their own, the wire badge carries the value
    await openCopy(page, info.tester);
    await page.locator('.wc-ccrumb-bench').click();
    await sleep(400);
    await page.locator('.ck-bench [data-act="run"]').click();
    await fit(page);
    await sleep(1200);
    const pins = await overlaps(page);
    check(`overlap ${t}: bench of the circuit with number pins: nothing on a pin's dot or name`, pins.badges > 0 && clean(pins), tell(pins));
    await page.locator('.wc[tabindex]').focus();
    await page.keyboard.press('Escape');
    await sleep(400);
    // the main board, running: the same rule for the blocks of copies and the plain cards
    await playKey(page);
    await sleep(1500);
    await fit(page);
    await sleep(600);
    const main = await overlaps(page);
    check(`overlap ${t}: main board running: the same rule`, clean(main), tell(main));
    await playKey(page);
    await context.close();
  }
}

await browser.close();
fs.writeFileSync(path.join(OUT, "flow-results.json"), JSON.stringify({ results, problems, dialogs }, null, 1));
const failed = results.filter((r) => !r.ok);
console.log(`
${results.length - failed.length}/${results.length} checks passed, ${problems.length} page problems, ${dialogs} dialogs`);
for (const p of problems.slice(0, 20)) console.log(p);
process.exit(failed.length > 0 || problems.length > 0 || dialogs > 0 ? 1 : 0);
