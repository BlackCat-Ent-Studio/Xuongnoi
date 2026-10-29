import { openBrowser, sleep, nodeOf, dragKind, wire, selectNode, setNumber, setSelect, clickNext, startLesson, stepNo } from 'file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/tut-common.mjs';
const N = +process.argv[2] || 8, RATE = +process.argv[3] || 1;
let fails = 0;
for (let k = 0; k < N; k++) {
  const { browser, page, logs } = await openBrowser();
  const cdp = await page.context().newCDPSession(page);
  if (RATE > 1) await cdp.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await page.goto('http://localhost:5194/');
  await sleep(1200);
  await page.locator('[data-tut="invite-no"]').click().catch(() => {});
  await startLesson(page, 'win-lose');
  await clickNext(page);
  await selectNode(page, 'counter');
  await setNumber(page, 'target', 1);
  await dragKind(page, 'win-lose', 600, 60);
  await wire(page, nodeOf('counter'), 'reached', nodeOf('win-lose'), 'win');
  await dragKind(page, 'compare', 600, 280);
  await wire(page, nodeOf('character'), 'y', nodeOf('compare'), 'a');
  await setSelect(page, 'op', 'lt');
  await dragKind(page, 'const', 600, 500);
  await setNumber(page, 'value', -5);
  await page.evaluate(() => { window.__ev = []; for (const t of ['pointerdown','pointerup','pointercancel','lostpointercapture']) window.addEventListener(t, (e) => window.__ev.push(t + ':' + (e.target.className||e.target.tagName)), true); });
  console.log('RECTS', JSON.stringify(await page.evaluate(() => { const r = (s) => { const e = document.querySelector(s); if(!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.x),Math.round(b.y),Math.round(b.width),Math.round(b.height)]; }; return { wc: r('.wc'), panel: r('.tut-panel'), constDot: r('.wc-node[data-kind=const] .wc-dot'), cmpB: r('.wc-node[data-kind=compare] .wc-port[data-port=b] .wc-dot'), constNode: r('.wc-node[data-kind=const]'), cmp: r('.wc-node[data-kind=compare]') }; })));await page.screenshot({path:'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/l14/probe.png'});
const before = await page.locator('.wc-wire').count();
  await wire(page, nodeOf('const'), 'value', nodeOf('compare'), 'b');
  const after = await page.locator('.wc-wire').count();
  const st = await stepNo(page);
  const ok = after === before + 1;
  if (!ok) { fails++; console.log('FAIL iter', k, before, after, st, JSON.stringify(await page.evaluate(() => window.__ev)), await page.locator('.toast, .status').allInnerTexts().catch(()=>[])); await page.screenshot({ path: 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/l14/stress-fail-' + k + '.png' }); }
  await browser.close();
}
console.log('rate', RATE, 'fails', fails, '/', N);
