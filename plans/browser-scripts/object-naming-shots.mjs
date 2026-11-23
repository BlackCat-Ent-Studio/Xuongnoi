// Object naming check: puzzle levels 1,2,7 + editor sample + palette search "Hop" (dev server PORT, default 5218).
import { launch, VIEWPORTS } from './outline-icons-lib.mjs';
const PORT = process.env.PORT ?? '5218';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-object-naming/';
const BASE = `http://localhost:${PORT}/giai-do.html`;
const EDIT = `http://localhost:${PORT}/`;
const IDS = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau', 'xuong-tong-hop'];
const KINDS = ['block', 'character', 'item', 'vehicle'];
const logs = [];
const res = [];
const check = (n, ok, x = '') => { res.push(ok); console.log((ok ? 'PASS ' : 'FAIL ') + n + ' ' + x); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const readCards = (page) => page.$$eval('.wc-node', (els, kinds) => els.filter((e) => kinds.includes(e.dataset.kind)).map((e) => ({ kind: e.dataset.kind, title: e.querySelector('.wc-name')?.textContent, sub: e.querySelector('.wc-sub')?.textContent, self: e.querySelector('.wc-port.out[data-port="self"] .wc-pl')?.textContent })), KINDS);
const browser = await launch();
for (const vp of ['phone', 'desk']) {
  for (const no of [1, 2, 7]) {
    const tag = `${vp}-L${no}`;
    const page = await browser.newPage({ viewport: VIEWPORTS[vp] });
    page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${tag}: ${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => logs.push(`${tag}: pageerror ${e.message}`));
    await page.goto(BASE);
    await page.evaluate((ids) => {
      localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(ids.map((i) => [i, { stars: 1 }]))));
      localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(ids.concat(ids.map((i) => 'intro:' + i))));
    }, IDS);
    await page.goto(BASE + '#/map');
    await page.reload();
    await page.waitForSelector('.pz-stop', { timeout: 10000 });
    await sleep(600);
    await page.locator('.pz-stop').nth(no - 1).click();
    await page.waitForSelector('.pz-pip-hit', { timeout: 10000 });
    await sleep(3000);
    await page.locator('.pz-task-btn').click();
    await sleep(300);
    await page.screenshot({ path: `${OUT}${tag}-board.png`, timeout: 120000 });
    const cards = await readCards(page);
    console.log(tag, JSON.stringify(cards));
    check(`${tag} object cards: kind on top`, cards.length > 0 && cards.every((c) => ['Vật thể', 'Nhân vật', 'Đồ vật', 'Xe'].includes(c.title)));
    check(`${tag} has instance name line`, cards.some((c) => c.sub && !/^(Object|Character|Item|Vehicle)$/.test(c.sub)));
    await page.close();
  }
}
for (const vp of ['phone', 'desk']) {
  const page = await browser.newPage({ viewport: VIEWPORTS[vp] });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`${vp}-ed: ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`${vp}-ed: pageerror ${e.message}`));
  await page.goto(EDIT);
  await page.evaluate(async () => {
    const io = await import('/src/io/index.ts');
    const s = io.listSamples().find((x) => x.id === 'platform-bot');
    localStorage.clear();
    localStorage.setItem('xuong-noi:autosave', io.serializeBoard(s.board));
  });
  await page.reload();
  await sleep(2500);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  await page.screenshot({ path: `${OUT}${vp}-editor-board.png`, timeout: 120000 });
  const cards = await readCards(page);
  console.log(vp, 'editor', JSON.stringify(cards));
  check(`${vp} editor block card says Vật thể`, cards.some((c) => c.kind === 'block') && cards.filter((c) => c.kind === 'block').every((c) => c.title === 'Vật thể'));
  await page.locator('#tab-palette').click().catch(() => {});
  await sleep(400);
  const inp = page.locator('.pn-search-input').first();
  await inp.fill('Hộp');
  await sleep(500);
  const found = await page.$$eval('.pn-item', (els) => els.filter((e) => e.offsetParent).map((e) => e.getAttribute('data-kind') + ':' + e.textContent.trim().slice(0, 30)));
  console.log(vp, 'search Hộp ->', JSON.stringify(found));
  check(`${vp} search Hộp finds block`, found.some((f) => f.startsWith('block:')));
  await page.screenshot({ path: `${OUT}${vp}-editor-palette-search-hop.png`, timeout: 120000 });
  await page.close();
}
await browser.close();
console.log(logs.length ? 'LOGS\n' + logs.join('\n') : 'no console errors/warnings');
console.log(`${res.filter(Boolean).length}/${res.length} passed`);
