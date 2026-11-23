// A finger-sized editor (pointer: coarse): robot sample with a card selected, and the smallest hit area found.
import { launch, BASE, sleep, openSample, fit } from './ui-c-lib.mjs';
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder-ui-c/plans/reports/shots-ui-c-step1/';
fs.mkdirSync(OUT, { recursive: true });
const b = await launch();
for (const mode of ['student', 'teacher']) {
  const ctx = await b.newContext({ viewport: { width: 1024, height: 768 }, hasTouch: true, isMobile: true, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.addInitScript((m) => { if (!sessionStorage.getItem('s')) { localStorage.clear(); localStorage.setItem('xuong-noi:ui-mode', m); sessionStorage.setItem('s', '1'); } }, mode);
  await page.goto(`${BASE}/`); await sleep(2000);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  await openSample(page, 'Robot dò đường'); await fit(page);
  await page.locator('.wc-node-head').nth(3).tap().catch(() => {}); await sleep(500);
  await page.screenshot({ path: `${OUT}touch-light-${mode}-1024.png` });
  const small = await page.evaluate(() => {
    const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none'; };
    const out = {};
    for (const e of document.querySelectorAll('button, select, summary, [role=switch], [role=radio], .tab, .mb-item, .pn-item, .wc-port')) {
      if (!vis(e) || e.closest('.game-box')) continue;
      const r = e.getBoundingClientRect();
      let w = r.width, h = r.height;
      for (const ps of ['::before', '::after']) { const c = getComputedStyle(e, ps); if (c.content !== 'none' && c.position === 'absolute') { const cw = parseFloat(c.width), ch = parseFloat(c.height); w = Math.max(w, cw || 0); h = Math.max(h, ch || 0); } }
      const zoom = e.closest('.wc-world') ? parseFloat(getComputedStyle(document.querySelector('.wc-world')).transform.split('(')[1]) || 1 : 1;
      const m = Math.min(w, h) / zoom;
      if (m < 43.5) out[`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 30)}`] = `${Math.round(m)} (zoom ${zoom.toFixed(2)})`;
    }
    return out;
  });
  console.log(mode, 'hit areas under 44px:', JSON.stringify(small));
  await ctx.close();
}
await b.close();
