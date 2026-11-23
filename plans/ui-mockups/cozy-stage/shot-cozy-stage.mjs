// Screenshots every scene of index.html: desktop 1280x720 (full page UI), phone 844x390 (bare stage), stage 370x390 (bare), plus prop kit.
// Usage: node shot-cozy-stage.mjs [quick]
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const dir = path.dirname(fileURLToPath(import.meta.url));
const base = pathToFileURL(path.join(dir, 'index.html')).href;
const out = path.join(dir, 'shots');
const extra = process.argv.slice(2).filter((a) => a.includes('=')).join('&');
const only = process.argv.slice(2).find((a) => a.startsWith('only='))?.slice(5);

const SHOTS = [
  { id: 'l2', t: 1.6, tag: 'a' }, { id: 'l2', t: 2.9 }, { id: 'l2', t: 5.2, tag: 'b' }, { id: 'l3', t: 4.6, tag: 'a' }, { id: 'l3', t: 5.3, tag: 'o' }, { id: 'l3', t: 7.4, tag: 'b' }, { id: 'l3', t: 9.8 }, { id: 'l3', t: 2, tag: 'w', extra: 'follow=0&zoom=0.6', deskOnly: true }, { id: 'l5', t: 3.6 }, { id: 'l5', t: 8.2, tag: 'b' }, { id: 'l5', t: 10.4, tag: 'c' }, { id: 'l5', t: 22, tag: 'd' },
  { id: 'l6', t: 3.3 }, { id: 'l7', t: 3.4 }, { id: 'l7', t: 1.0, tag: 'gap', extra: 'bridge=hide' },
  { id: 'l2', t: 1.6, tag: 'wide', extra: 'follow=0&zoom=0.6', deskOnly: true }, { id: 'l3', t: 2, tag: 'wide', extra: 'follow=0&zoom=0.6', deskOnly: true },
  { id: 'l5', t: 12, tag: 'wide', extra: 'follow=0&zoom=0.7', deskOnly: true }, { id: 'l6', t: 5, tag: 'wide', extra: 'follow=0&zoom=0.7', deskOnly: true }, { id: 'l7', t: 3.2, tag: 'wide', extra: 'follow=0&zoom=0.7', deskOnly: true },
  { id: 'kit', t: 0.6, tag: 'all' }, { id: 'kit', t: 0.5, tag: 'door', extra: 'item=door-open' }, { id: 'kit', t: 0.6, tag: 'btn', extra: 'item=button-down' },
];
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
async function shoot(name, w, h, url, full) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(`[${name}] ${m.type()}: ${m.text()}`); });
  page.on('pageerror', (e) => logs.push(`[${name}] pageerror: ${e.message}`));
  page.on('requestfailed', (r) => { if (!/fonts\.g/.test(r.url())) logs.push(`[${name}] requestfailed: ${r.url()}`); });
  await page.goto(url);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 90000 });
  await page.waitForTimeout(600);
  const info = await page.evaluate(() => ({ tris: window.__stage?.triTable }));
  await page.screenshot({ path: path.join(out, name + '.png'), fullPage: !!full });
  await page.close();
  return info;
}
let tris;
for (const s of SHOTS) {
  if (only && s.id !== only) continue;
  const tag = s.id + (s.tag ? '-' + s.tag : '');
  const q = (frame, bare) => `?scene=${s.id}&frame=${frame}&t=${s.t}${bare ? '&bare=1' : ''}${s.extra ? '&' + s.extra : ''}${extra ? '&' + extra : ''}`;
  tris = (await shoot(tag + '-desktop', 1280, 720, base + q('desktop', false))).tris;
  if (s.deskOnly) continue;
  await shoot(tag + '-phone', 844, 390, base + q('phone', true));
  await shoot(tag + '-stage', 370, 390, base + q('stage', true));
}
if (!only) { const p = await browser.newPage({ viewport: { width: 1280, height: 720 } }); p.on('pageerror', (e) => logs.push('pageerror: ' + e.message)); await p.goto(base + '?scene=l5&t=8&mask=1'); await p.waitForSelector('body[data-ready="1"]', { timeout: 90000 }); await p.waitForTimeout(500); await p.screenshot({ path: path.join(out, 'ui-default-mask.png') }); await p.close(); }
{ const p = await browser.newPage(); await p.goto(base + '?scene=l5&t=1'); await p.waitForSelector('body[data-ready="1"]', { timeout: 90000 }); console.log('breakdown', JSON.stringify(await p.evaluate(() => window.__stage.breakdown()))); await p.close(); }
console.log('triangles per scene', JSON.stringify(tris));
console.log(logs.join('\n') || 'no console errors');
await browser.close();
