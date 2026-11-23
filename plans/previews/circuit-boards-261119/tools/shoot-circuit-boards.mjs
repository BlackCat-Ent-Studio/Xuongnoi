// Screenshots every state of the circuit-board preview and audits contrast, hit areas and page overflow.
// Run with node from a folder where the "playwright" package resolves (the package is looked up from the current folder).
import { createRequire } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const { chromium } = createRequire(process.cwd() + '/')('playwright');
const here = path.dirname(fileURLToPath(import.meta.url));
const PAGE = pathToFileURL(path.join(here, '..', 'index.html')).href;
const OUT = path.join(here, '..', 'shots');
fs.mkdirSync(OUT, { recursive: true });

// CHROME=<path to chrome.exe> picks an already installed browser when the package's own one is missing.
const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
const errs = [], report = [];
const requests = [];

async function open(w, h) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on('pageerror', (e) => errs.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('request', (r) => { if (!r.url().startsWith('file:')) requests.push(r.url()); });
  await page.goto(PAGE);
  await page.waitForTimeout(200);
  return page;
}

/** Contrast of every visible text against the surface under it, smallest hit areas, and horizontal overflow. */
const audit = (page) => page.evaluate(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1; const cx = cv.getContext('2d', { willReadFrequently: true });
  const rgba = (c) => { cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#000'; cx.fillStyle = c; cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data; return [d[0], d[1], d[2], d[3] / 255]; };
  const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
  const over = (top, under) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3]));
  const bgOf = (el) => { const stack = []; for (let e = el; e; e = e.parentElement) { const c = rgba(getComputedStyle(e).backgroundColor); if (c[3] > 0) { stack.push(c); if (c[3] >= 0.999) break; } } let base = [255, 255, 255]; for (let i = stack.length - 1; i >= 0; i--) base = over(stack[i], base); return base; };
  const bad = []; let min = 99, minAt = '', n = 0;
  document.querySelectorAll('#app *').forEach((el) => {
    if (el.closest('svg') || el.closest(':disabled')) return;
    const txt = [...el.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).join(' ').trim();
    const isInput = el.tagName === 'INPUT';
    if (!txt && !isInput) return;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return;
    const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none') return;
    const bg = bgOf(el), fgc = rgba(st.color), fg = over(fgc, bg);
    const a = lum(fg), b = lum(bg), ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    n++;
    const label = `${(txt || el.value).slice(0, 28)} <${el.className || el.tagName}>`;
    if (ratio < min) { min = ratio; minAt = label; }
    if (ratio < 4.5) bad.push(`${ratio.toFixed(2)} ${label}`);
  });
  const small = [];
  document.querySelectorAll('#app button:not(:disabled), #app input').forEach((el) => {
    const r = { w: el.offsetWidth, h: el.offsetHeight }; if (!r.w) return;
    const af = getComputedStyle(el, '::after'); let w = r.w, h = r.h;
    if (af.content !== 'none' && af.position === 'absolute') { w = Math.max(w, parseFloat(af.width) || 0); h = Math.max(h, parseFloat(af.height) || 0); }
    if (Math.min(w, h) < 33.5) small.push(`${Math.round(w)}x${Math.round(h)} ${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 20)} <${el.className}>`);
  });
  const se = document.scrollingElement;
  const surfaces = new Set(); document.querySelectorAll('#app *').forEach((el) => { const c = getComputedStyle(el).backgroundColor; if (c === 'rgb(255, 255, 255)') surfaces.add(el.className || el.tagName); });
  return { texts: n, min: +min.toFixed(2), minAt, bad: [...new Set(bad)], small: [...new Set(small)], hscroll: se.scrollWidth > window.innerWidth, pureWhite: [...surfaces], zoom: document.querySelector('#zoomt')?.textContent };
});

async function shot(page, name, note = '') {
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  const a = await audit(page);
  report.push({ name, note, ...a });
  console.log(`${name} | min ${a.min} (${a.minAt}) | bad ${a.bad.length} | small ${a.small.length} | hscroll ${a.hscroll} | ${a.zoom}`);
}
const seg = (page, label) => page.locator('.seg button', { hasText: label }).first().click();
const dbl = (page, id) => page.locator(`.world [data-id="${id}"] .nm`).dblclick();

/* ---------- 1366 x 768 ---------- */
let p = await open(1366, 768);
await shot(p, '01-tang4-xuong-kieu-b-1366', 'Factory board, look B, Học sinh, Xám dịu');
await seg(p, 'A · Bo mạch'); await shot(p, '02-tang4-xuong-kieu-a-1366', 'Look A');
await seg(p, 'C · Chip gọn'); await shot(p, '03-tang4-xuong-kieu-c-1366', 'Look C');
await seg(p, 'B · Thẻ thiết bị');
await p.locator('.world [data-id="agv3"] .nm').click(); await shot(p, '04-cai-dat-ban-sao-xe-agv-3', 'Instance settings');
await p.locator('.swc').nth(3).click(); await p.locator('.world [data-id="agv3"] .nm').click();
await p.locator('button[aria-label="Tăng Tốc độ"]').click(); await shot(p, '05-cai-dat-ban-sao-da-doi', 'Instance settings after editing colour and speed');
await p.locator('.tab', { hasText: 'Thư viện' }).click(); await shot(p, '06-thu-vien-bang-mach', 'Library tab');
await p.locator('.tab', { hasText: 'Cài đặt' }).click();
await p.locator('[data-act="run"]').click(); await p.waitForTimeout(1500); await shot(p, '07-xuong-dang-chay', 'Running: dashes on wires, status lights');
await p.locator('.world [data-id="agv3"] .mb-open').click(); await p.waitForTimeout(600); await shot(p, '08-dang-chay-ben-trong-xe-agv-3', 'Running, inside copy Xe AGV 3');
await p.keyboard.press('Escape'); await p.locator('[data-act="run"]').click();
await dbl(p, 'tn'); await shot(p, '09-tang3-tram-nap', 'Level 3');
await p.locator('.world [data-id="tm"] .mb-open').click(); await shot(p, '10-tang2-tay-may', 'Level 2');
await dbl(p, 'k1'); await shot(p, '11-tang1-linh-kien-khop-vai', 'Level 1');
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
await dbl(p, 'agv3'); await shot(p, '12-tang2-xe-agv', 'Level 2, AGV circuit');
await p.locator('.pin-name').first().fill('Đi tới cửa'); await p.locator('[data-act="pinadd"][data-d="out"]').click(); await p.keyboard.type('Hết pin'); await shot(p, '13-sua-chan-doi-ten-va-them', 'Pin edit: rename + add; side panel shows the outside block');
await p.keyboard.press('Enter'); await p.locator('.back').click(); await shot(p, '14-xuong-sau-khi-sua-chan', 'Parent blocks after the pin edit');
// put the circuit back the way it was, so the later shots show the original pins
await dbl(p, 'agv3'); await p.locator('.pin.out [data-act="pindel"]').last().click(); await p.locator('.pin-name').first().fill('Cửa đích'); await p.locator('.back').click();
await p.locator('.world [data-id="agv3"] .nm').click(); await p.locator('[data-act="openbench"]').click();
await p.locator('button[aria-label="Tăng"]').first().click({ clickCount: 4, delay: 60 }); await p.waitForTimeout(2600); await shot(p, '15-ban-thu-bo-cuc-cot-trai', 'Bench layout 1 (AGV)');
await seg(p, 'Dải bên dưới'); await p.locator('button[aria-label="Tăng"]').first().click({ clickCount: 2, delay: 60 }); await p.waitForTimeout(2600); await shot(p, '16-ban-thu-bo-cuc-dai-duoi', 'Bench layout 2 (AGV)');
await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
await dbl(p, 'tn'); await dbl(p, 'tm'); await p.locator('[data-act="bench"]').click(); await p.locator('[data-act="bsw"]').click(); await p.waitForTimeout(1500); await shot(p, '17-ban-thu-tay-may', 'Bench, Tay máy mid-move');
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.keyboard.press('Escape');
await seg(p, 'Giáo viên'); await shot(p, '18-giao-vien-xuong', 'Giáo viên mode, factory');
await dbl(p, 'agv3'); await shot(p, '19-giao-vien-xe-agv', 'Giáo viên mode, AGV circuit');
await p.keyboard.press('Escape'); await seg(p, 'Học sinh');
await seg(p, 'Tối'); await shot(p, '20-toi-xuong-kieu-b', 'Dark, look B');
await seg(p, 'A · Bo mạch'); await shot(p, '21-toi-xuong-kieu-a', 'Dark, look A');
await seg(p, 'C · Chip gọn'); await p.locator('[data-act="run"]').click(); await p.waitForTimeout(1500); await shot(p, '22-toi-xuong-kieu-c-dang-chay', 'Dark, look C, running');
await p.locator('.world [data-id="agv3"] .mb-open').click(); await shot(p, '23-toi-ben-trong-xe-agv-3', 'Dark, inside AGV 3, running');
await p.locator('[data-act="bench"]').click(); await p.locator('button[aria-label="Tăng"]').first().click({ clickCount: 3, delay: 60 }); await p.waitForTimeout(2600); await shot(p, '24-toi-ban-thu', 'Dark bench');
await p.keyboard.press('Escape'); await p.keyboard.press('Escape'); await p.locator('.tab', { hasText: 'Thư viện' }).click(); await shot(p, '25-toi-thu-vien', 'Dark library');
await p.close();

/* ---------- 1920 x 1080 ---------- */
p = await open(1920, 1080);
await shot(p, '30-xuong-kieu-b-1920', 'Factory 1920');
await seg(p, 'A · Bo mạch'); await shot(p, '31-xuong-kieu-a-1920', 'Look A 1920');
await seg(p, 'C · Chip gọn'); await shot(p, '32-xuong-kieu-c-1920', 'Look C 1920');
await seg(p, 'A · Bo mạch'); await dbl(p, 'tn'); await shot(p, '33-tram-nap-kieu-a-1920', 'Level 3, look A');
await seg(p, 'C · Chip gọn'); await shot(p, '34-tram-nap-kieu-c-1920', 'Level 3, look C');
await p.keyboard.press('Escape'); await dbl(p, 'agv3'); await p.locator('[data-act="bench"]').click(); await p.locator('button[aria-label="Tăng"]').first().click({ clickCount: 5, delay: 60 }); await p.waitForTimeout(3000); await shot(p, '35-ban-thu-cot-trai-1920', 'Bench layout 1, 1920');
await seg(p, 'Dải bên dưới'); await p.waitForTimeout(300); await shot(p, '36-ban-thu-dai-duoi-1920', 'Bench layout 2, 1920');
await p.close();

await browser.close();
fs.writeFileSync(path.join(OUT, 'audit.json'), JSON.stringify({ errors: errs, externalRequests: requests, states: report }, null, 1));
console.log('page errors:', JSON.stringify(errs));
console.log('non-file requests:', JSON.stringify(requests));
const allBad = [...new Set(report.flatMap((r) => r.bad.map((b) => b)))]; console.log('contrast below 4.5:', JSON.stringify(allBad, null, 1));
const allSmall = [...new Set(report.filter((r) => !/giao-vien/.test(r.name)).flatMap((r) => r.small))]; console.log('hit areas under 34 (Học sinh states):', JSON.stringify(allSmall, null, 1));
console.log('pure white surfaces:', JSON.stringify([...new Set(report.flatMap((r) => r.pureWhite))]));
console.log('lowest contrast overall:', Math.min(...report.map((r) => r.min)));
