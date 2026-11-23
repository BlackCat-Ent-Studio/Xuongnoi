// Screenshots of the local preview file. Run after build-preview.mjs. ONLY=a,b,c limits directions; QUICK=1 shoots only the editor frames.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
import fs from 'node:fs';
const ROOT = 'D:/workspace/GameBuilder/plans/previews/ui-redesign-261118/';
const OUT = ROOT + 'shots/';
fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe' });
const p = await b.newPage({ viewport: { width: 1600, height: 1000 } });
const logs = [];
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
const url = (q) => 'file:///' + ROOT + 'index.html?' + q;
const metrics = {};
const dirs = process.env.ONLY ? process.env.ONLY.split(',') : ['a', 'b', 'c'];
const quick = !!process.env.QUICK;
// Layout faults inside the mocks: cut-off text without an ellipsis rule, rows wider than their bar, cards that overlap or leave the board.
const audit = () => {
  const bad = [];
  document.querySelectorAll('.ed').forEach((ed) => {
    const k = ed.getBoundingClientRect().width / ed.offsetWidth, tag = '@' + ed.offsetWidth + ' ';
    ed.querySelectorAll('*').forEach((e) => {
      if (e.closest('svg') || !e.offsetParent || e.children.length) return;
      const cs = getComputedStyle(e);
      if (e.scrollWidth > e.clientWidth + 1 && cs.overflow !== 'visible' && cs.textOverflow !== 'ellipsis') bad.push(tag + 'cut text: ' + e.className + ': ' + e.textContent.slice(0, 30));
    });
    [...ed.children].forEach((c) => { if (c.scrollWidth > ed.clientWidth + 1 || c.offsetWidth > ed.clientWidth + 1) bad.push(tag + 'frame content wider than frame: ' + c.className + ' ' + c.scrollWidth); });
    ed.querySelectorAll('.ph-sheet, .tabbar, .ph-learn').forEach((c) => { if (c.scrollWidth > c.clientWidth + 1) bad.push(tag + 'phone row too wide: ' + c.className); });
    ed.querySelectorAll('.tb').forEach((row) => { const w = [...row.children].reduce((a, c) => a + c.getBoundingClientRect().width / k, 0); if (w + 20 > row.clientWidth) bad.push(tag + 'top bar too wide by ' + Math.round(w + 20 - row.clientWidth)); });
    ed.querySelectorAll('.tb, .strip, .tabs, .simh, .pz-tray:not([style]), .i-head, .acts').forEach((row) => {
      const rr = row.getBoundingClientRect(); let prev = null;
      [...row.children].forEach((c) => { const r = c.getBoundingClientRect(); if (!r.width) return; if (r.right > rr.right + 1) bad.push(tag + 'row overflow: ' + row.className + ' <- ' + c.className + ' by ' + Math.round((r.right - rr.right) / k)); if (prev && r.left < prev.right - 1) bad.push(tag + 'row overlap: ' + row.className + ' <- ' + c.className); prev = r; });
    });
    ed.querySelectorAll('.col').forEach((c) => { if (c.scrollHeight > c.clientHeight + 1) bad.push(tag + 'column too tall: ' + (c.scrollHeight - c.clientHeight) + 'px ' + c.firstElementChild.className); });
    ed.querySelectorAll('.dk > div').forEach((c) => { if (c.scrollHeight > c.clientHeight + 1) bad.push(tag + 'dock cell too tall: ' + (c.scrollHeight - c.clientHeight)); });
    ed.querySelectorAll('.board').forEach((bd) => {
      const br = bd.getBoundingClientRect(), cards = [...bd.querySelectorAll('.nd')].map((n) => n.getBoundingClientRect()), ovs = [...bd.querySelectorAll('.ov, .guide')].map((n) => n.getBoundingClientRect());
      const hit = (a, c) => a.left < c.right - 1 && c.left < a.right - 1 && a.top < c.bottom - 1 && c.top < a.bottom - 1;
      cards.forEach((a, i) => { if (ed.offsetWidth > 400 && (a.bottom > br.bottom + 1 || a.right > br.right + 1)) bad.push(tag + 'card leaves board #' + i + ' by ' + Math.round(Math.max(a.bottom - br.bottom, a.right - br.right) / k)); cards.forEach((c, j) => { if (j > i && hit(a, c)) bad.push(tag + 'cards overlap ' + i + '/' + j); }); ovs.forEach((o, j) => { if (hit(a, o)) bad.push(tag + 'overlay ' + j + ' covers card ' + i); }); });
      ovs.forEach((a, i) => ovs.forEach((c, j) => { if (j > i && hit(a, c)) bad.push(tag + 'overlays overlap ' + i + '/' + j); }));
    });
  });
  return bad;
};
for (const d of dirs) {
  for (const th of ['light', 'dark']) {
    for (const mode of ['hs', 'gv']) {
      const key = `${d}-${th}-${mode}`;
      await p.goto(url(`dir=${d}&th=${th}&mode=${mode}`));
      await p.waitForTimeout(600);
      await p.addStyleTag({ content: '.pv-top{position:static!important}' }); // the sticky strip must not land inside tall element shots
      metrics[key] = await p.evaluate(() => window.__metrics);
      metrics[key].faults = await p.evaluate(audit);
      await p.locator('#fit-full').screenshot({ path: OUT + `${key}-1-editor-1440.png` });
      if (quick) continue;
      if (mode === 'hs') {
        await p.locator('#anat').screenshot({ path: OUT + `${d}-${th}-2-card-closeup-both-modes.png` });
        await p.locator('#fit-pz').screenshot({ path: OUT + `${d}-${th}-3-puzzle-level.png` });
        await p.locator('#fit-tab').screenshot({ path: OUT + `${d}-${th}-5-tablet.png` });
        await p.locator('#fit-ph').screenshot({ path: OUT + `${d}-${th}-6-phone.png` });
        await p.locator('#sec-tok').screenshot({ path: OUT + `${d}-${th}-7-tokens.png` });
      }
      if (mode === 'hs' && th === 'light') {
        await p.locator('#fit-pzl').screenshot({ path: OUT + `${d}-${th}-4-puzzle-list.png` });
        await p.locator('#sec-class').screenshot({ path: OUT + `${d}-8-classroom.png` });
      }
    }
  }
}
if (!process.env.ONLY && !quick) {
  await p.goto(url('dir=a&cur=off'));
  await p.waitForTimeout(400);
  await p.locator('#fit-full').screenshot({ path: OUT + 'x-a-current-off.png' });
  await p.goto(url('dir=a&cmp=before'));
  await p.waitForTimeout(400);
  await p.locator('#fit-full').screenshot({ path: OUT + 'x-before-real-screenshot.png' });
  await p.goto(url('dir=c'));
  await p.waitForTimeout(400);
  await p.screenshot({ path: OUT + 'x-page-top-with-switcher.png' });
  await p.locator('#sec-mode').screenshot({ path: OUT + 'x-mode-differences.png' });
}
fs.writeFileSync(OUT + 'metrics.json', JSON.stringify(metrics, null, 1));
for (const [k, m] of Object.entries(metrics)) console.log(k, JSON.stringify({ d: m.desktop, t: m.tablet, p: m.phone, z: m.puzzle, minText: m.minText, cvd: m.cvdCatsPorts, faults: m.faults }));
console.log('LOGS', JSON.stringify(logs.slice(0, 8)));
await b.close();
