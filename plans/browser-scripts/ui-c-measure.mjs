// Measures the editor in both display modes: card overlaps on every sample, wire ends vs port dots, smallest text,
// smallest hit areas. BASE=http://localhost:5302 measures the old editor (no mode switch there; one pass only).
// Usage: node ui-c-measure.mjs  (writes plans/reports/shots-ui-c-step1/measure-<label>.json)
import { launch, openEditor, sleep, BASE } from './ui-c-lib.mjs';
import fs from 'node:fs';

const OUT = 'D:/workspace/GameBuilder-ui-c/plans/reports/shots-ui-c-step1/';
const label = process.env.LABEL ?? 'new';
const theme = process.env.THEME ?? 'light';
const b = await launch();
const { page } = await openEditor(b, { theme, mode: 'student', width: 1440, height: 900 });

async function sampleLabels() {
  await page.locator('[data-menu="file"]').click(); await sleep(200);
  await page.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  const labels = await page.$$eval('.mb-sub .mb-item', (els) => els.map((e) => e.textContent.trim()));
  await page.keyboard.press('Escape'); await sleep(200);
  return labels;
}
async function open(labelText) {
  await page.locator('[data-menu="file"]').click(); await sleep(200);
  await page.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  await page.locator('.mb-sub .mb-item', { hasText: labelText }).first().click(); await sleep(1200);
}
async function setMode(mode) {
  if (BASE.endsWith('5302')) return;
  await page.locator(`[data-ui-mode="${mode}"]`).click(); await sleep(500);
}

/** In page: overlaps between cards (stored positions) and wire-end error against the port dots. */
const measureBoard = () => page.evaluate(() => {
  const cards = [...document.querySelectorAll('.wc-nodes > .wc-node, .wc-node')].map((e) => ({ id: e.dataset.id, x: e.offsetLeft, y: e.offsetTop, w: e.offsetWidth, h: e.offsetHeight }));
  let overlaps = 0;
  const pairs = [];
  for (let i = 0; i < cards.length; i++) for (let j = i + 1; j < cards.length; j++) {
    const a = cards[i], c = cards[j];
    const ow = Math.min(a.x + a.w, c.x + c.w) - Math.max(a.x, c.x);
    const oh = Math.min(a.y + a.h, c.y + c.h) - Math.max(a.y, c.y);
    if (ow > 2 && oh > 2) { overlaps++; if (pairs.length < 3) pairs.push(`${a.id}/${c.id} ${Math.round(ow)}x${Math.round(oh)}`); }
  }
  // wire ends vs dots
  let worst = 0, checked = 0;
  const wires = [...document.querySelectorAll('.wc-wire:not(.step-wire)')];
  const dots = [...document.querySelectorAll('.wc-port .wc-dot')].map((d) => { const r = d.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  for (const p of wires) {
    const len = p.getTotalLength();
    const m = p.getScreenCTM();
    if (!m || len === 0) continue;
    const ends = [0, len].map((t) => { const pt = p.getPointAtLength(t); return { x: m.a * pt.x + m.c * pt.y + m.e, y: m.b * pt.x + m.d * pt.y + m.f }; });
    for (const e of ends) {
      const d = Math.min(...dots.map((q) => Math.hypot(q.x - e.x, q.y - e.y)));
      worst = Math.max(worst, d); checked++;
    }
  }
  const sizes = cards.map((c) => c.h);
  return { cards: cards.length, overlaps, pairs, wireEnds: checked, worstEndErrorPx: Math.round(worst * 10) / 10, avgCardH: Math.round(sizes.reduce((s, v) => s + v, 0) / Math.max(1, sizes.length)), zoom: getComputedStyle(document.querySelector('.wc-world')).transform };
});

/** Smallest text and smallest hit areas among visible elements. */
const measureUi = () => page.evaluate(() => {
  const vis = (e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && s.display !== 'none' && +s.opacity > 0.05; };
  const textNodesOf = (e) => [...e.childNodes].filter((n) => n.nodeType === 3 && n.textContent.trim().length > 0);
  let minFont = 99, minEl = '';
  const smallText = {};
  for (const e of document.querySelectorAll('body *')) {
    if (e.closest('.game-box, canvas, svg')) continue;
    if (!textNodesOf(e).length || !vis(e)) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    const zoomed = e.closest('.wc-world'); // text on the board scales with the board zoom
    if (zoomed) continue;
    if (fs < minFont) { minFont = fs; minEl = `${e.tagName.toLowerCase()}.${e.className}`.slice(0, 60) + ' "' + e.textContent.trim().slice(0, 20) + '"'; }
    if (fs < 12) smallText[`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)}`] = fs;
  }
  const sel = 'button, select, input:not([type=hidden]), summary, [role=switch], [role=radio], .tab, .mb-item, a[href], .pn-item, .wc-port';
  let minHit = 999, minHitEl = '';
  const small = {};
  for (const e of document.querySelectorAll(sel)) {
    if (!vis(e) || e.closest('.game-box')) continue;
    if (e.tagName === 'INPUT' && e.closest('label')) continue; // the label around it is the target
    const r = e.getBoundingClientRect();
    let w = r.width, h = r.height;
    const z = e.closest('.wc-world') ? parseFloat(getComputedStyle(document.querySelector('.wc-world')).transform.split('(')[1]) || 1 : 1;
    if (e.closest('.wc-world')) { w = r.width; h = r.height; } // rows are measured at their on-screen size
    for (const ps of ['::before', '::after']) {
      const c = getComputedStyle(e, ps);
      if (c.content !== 'none' && c.position === 'absolute') { const cw = parseFloat(c.width), ch = parseFloat(c.height); w = Math.max(w, cw || 0); h = Math.max(h, ch || 0); }
    }
    const m = Math.min(w, h) / (e.closest('.wc-world') ? z : 1);
    if (m < minHit) { minHit = m; minHitEl = `${e.tagName.toLowerCase()}.${String(e.className).slice(0, 40)} ${Math.round(w)}x${Math.round(h)}`; }
    if (m < (document.documentElement.dataset.mode === 'teacher' ? 24 : 28) - 0.01) small[`${e.tagName.toLowerCase()}.${String(e.className).slice(0, 36)}`] = Math.round(m);
  }
  return { minFont, minEl, textBelow12: smallText, minHit: Math.round(minHit * 10) / 10, minHitEl, hitBelow24: small };
});

const labels = await sampleLabels();
console.log('samples:', labels.join(' | '));
const result = { label, theme, samples: {}, ui: {} };
for (const mode of BASE.endsWith('5302') ? ['old'] : ['student', 'teacher']) {
  await setMode(mode);
  const perSample = {};
  for (const s of labels) {
    await open(s);
    perSample[s] = await measureBoard();
    if (s === 'Robot dò đường' || labels.indexOf(s) === 0) {
      await page.locator('.wc-rail button[aria-label*="Vừa"], .wc-rail button[title*="Vừa"]').first().click().catch(() => {});
      await page.locator('.wc-pct').click().catch(() => {}); await sleep(300);
      await page.locator('.wc-node-head').first().click().catch(() => {}); await sleep(300);
      result.ui[mode] = await measureUi();
    }
  }
  result.samples[mode] = perSample;
}
fs.writeFileSync(`${OUT}measure-${label}-${theme}.json`, JSON.stringify(result, null, 1));
for (const [mode, rows] of Object.entries(result.samples)) {
  console.log(`== ${mode}`);
  for (const [s, r] of Object.entries(rows)) console.log(`${s.padEnd(34)} cards ${String(r.cards).padStart(3)}  overlaps ${String(r.overlaps).padStart(3)}  avgH ${r.avgCardH}  wireEnds ${r.wireEnds} worstErr ${r.worstEndErrorPx}px ${r.pairs.join('; ')}`);
}
console.log('UI', JSON.stringify(result.ui));
await b.close();
