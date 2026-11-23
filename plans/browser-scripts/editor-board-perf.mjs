// Routing cost on synthetic boards of N cards (and-gates in a grid, 2 wires each) in the editor.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const PORT = process.env.PORT ?? 5242;
const QS = process.env.QS ?? '';
const sizes = (process.env.SIZES ?? '40,80,120,150').split(',').map(Number);

function board(n) {
  const cols = Math.ceil(Math.sqrt(n * 1.4));
  const nodes = [];
  const wires = [];
  for (let i = 0; i < n; i++) nodes.push({ id: `n${i}`, kind: 'and', params: {}, pos: { x: (i % cols) * 300, y: Math.floor(i / cols) * 170 } });
  let w = 0;
  for (let i = 0; i < n; i++) {
    if (i % cols !== cols - 1 && i + 1 < n) wires.push({ id: `w${w++}`, from: { node: `n${i}`, port: 'out' }, to: { node: `n${i + 1}`, port: 'a' } });
    if (i + cols + 1 < n) wires.push({ id: `w${w++}`, from: { node: `n${i}`, port: 'out' }, to: { node: `n${i + cols + 1}`, port: 'b' } });
  }
  return { format_version: 1, name: `perf${n}`, mode: '3d', graph: { nodes, wires, settings: { wireRule: true } } };
}

const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const logs = [];
page.on('pageerror', (e) => logs.push(e.message));
for (const n of sizes) {
  await page.goto(`http://localhost:${PORT}/${QS}`);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await sleep(1500);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) await page.locator('[data-tut="invite-no"]').click();
  await page.evaluate(() => { window.__rt = []; });
  await page.locator('[data-menu="file"]').click();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.locator('.mb-item', { hasText: 'Mở file' }).first().click()]);
  await fc.setFiles({ name: 'b.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(board(n))) });
  await sleep(2000);
  const info = await page.evaluate(() => ({ cards: document.querySelectorAll('.wc-node').length, wires: document.querySelectorAll('.wc-wire').length, routed: [...document.querySelectorAll('.wc-wire')].filter((p) => p.getAttribute('d').includes(' Q ')).length, rt: window.__rt ?? [] }));
  console.log(`N=${n}: cards=${info.cards} wires=${info.wires} routed=${info.routed} load routeWires=${JSON.stringify(info.rt)}`);
  // drag one card slowly across 2 neighbours (30 moves)
  await page.evaluate(() => { window.__rt = []; });
  const hb = await page.evaluate(() => {
    const heads = [...document.querySelectorAll('.wc-node .wc-node-head')];
    for (const h of heads) {
      const r = h.getBoundingClientRect();
      const x = r.x + 20; const y = r.y + r.height / 2;
      if (r.x > 500 && r.x < 900 && r.y > 250 && r.y < 600 && h.contains(document.elementFromPoint(x, y))) return { x: r.x, y: r.y };
    }
    return null;
  });
  if (!hb) { console.log('  no draggable card in the middle'); continue; }
  await page.evaluate(() => { window.__ft = []; let last = performance.now(); const loop = (t) => { window.__ft.push(t - last); last = t; window.__raf = requestAnimationFrame(loop); }; window.__raf = requestAnimationFrame(loop); });
  await page.mouse.move(hb.x + 30, hb.y + 10);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) await page.mouse.move(hb.x + 30 + i * 3, hb.y + 10 + i * 2);
  await sleep(200);
  const mid1 = await page.evaluate(() => window.__rt);
  const ft = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return window.__ft; });
  const srt = [...ft].sort((x, y) => x - y);
  console.log(`  drag frames: n=${ft.length} avg=${(ft.reduce((p, q) => p + q, 0) / ft.length).toFixed(1)}ms p95=${srt[Math.floor(srt.length * 0.95)].toFixed(1)} max=${srt[srt.length - 1].toFixed(1)}`);
  await page.mouse.up();
  await sleep(300);
  const all = await page.evaluate(() => window.__rt);
  const some = mid1.filter((r) => r[0] === 'some');
  const avg = (a) => (a.length ? (a.reduce((p, q) => p + q[2], 0) / a.length).toFixed(1) : '-');
  const max = (a) => (a.length ? Math.max(...a.map((q) => q[2])) : '-');
  console.log(`  drag: ${some.length} partial routes, wires/call=${some.length ? (some.reduce((p, q) => p + q[1], 0) / some.length).toFixed(1) : '-'} ms avg=${avg(some)} max=${max(some)}`);
  console.log(`  drop: ${JSON.stringify(all.filter((r) => r[0] === 'all'))}`);
  // pan
  await page.evaluate(() => { window.__ft = []; let last = performance.now(); const loop = (t) => { window.__ft.push(t - last); last = t; window.__raf = requestAnimationFrame(loop); }; window.__raf = requestAnimationFrame(loop); window.__rt = []; });
  await page.mouse.move(1300, 120);
  await page.mouse.down();
  for (let i = 1; i <= 30; i++) await page.mouse.move(1300 - i * 5, 120 + i * 3);
  await page.mouse.up();
  const pft = await page.evaluate(() => { cancelAnimationFrame(window.__raf); return { ft: window.__ft, rt: window.__rt }; });
  const ps = [...pft.ft].sort((x, y) => x - y);
  console.log(`  pan frames: n=${pft.ft.length} avg=${(pft.ft.reduce((p, q) => p + q, 0) / pft.ft.length).toFixed(1)}ms p95=${ps[Math.floor(ps.length * 0.95)].toFixed(1)} max=${ps[ps.length - 1].toFixed(1)}; routeWires calls during pan=${pft.rt.length}`);
}
console.log(logs.join('\n') || 'no page errors');
await browser.close();
