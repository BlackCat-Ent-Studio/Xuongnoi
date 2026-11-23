// The two switches (display mode, theme): defaults on a clean profile, top-bar buttons, Xem menu entries, memory per device,
// and the coarse-pointer sizes. Needs the 5301 server.
import { launch, BASE, sleep } from './ui-c-lib.mjs';

const b = await launch();
let fails = 0;
const rec = (check, pass, detail = '') => { if (!pass) fails++; console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${detail}`); };
const attrs = (page) => page.evaluate(() => ({ theme: document.documentElement.dataset.theme, mode: document.documentElement.dataset.mode, saved: { theme: localStorage.getItem('xuong-noi:theme'), mode: localStorage.getItem('xuong-noi:ui-mode') } }));

async function fresh(opts) {
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 }, ...opts });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/`); await sleep(1800);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  return { ctx, page };
}

// 1. defaults follow the system; mode is "student"
for (const scheme of ['dark', 'light']) {
  const { ctx, page } = await fresh({ colorScheme: scheme });
  const a = await attrs(page);
  rec(`first open, system ${scheme}: theme follows it, mode is student, nothing saved yet`, a.theme === scheme && a.mode === 'student' && a.saved.theme === null && a.saved.mode === null, JSON.stringify(a));
  await ctx.close();
}

// 2. top-bar switches + memory
{
  const { ctx, page } = await fresh({ colorScheme: 'dark' });
  rec('segmented control shows Học sinh | Giáo viên', (await page.locator('.ui-mode .seg-opt').allInnerTexts()).join('|') === 'Học sinh|Giáo viên');
  rec('Học sinh is the checked one', (await page.locator('.ui-mode .seg-opt[aria-checked="true"]').innerText()) === 'Học sinh');
  await page.locator('[data-ui-mode="teacher"]').click(); await sleep(300);
  let a = await attrs(page);
  rec('Giáo viên button switches the mode and saves it', a.mode === 'teacher' && a.saved.mode === 'teacher', JSON.stringify(a));
  const rowH = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--row').trim());
  rec('mode changes the size tokens (port row 24px)', rowH === '24px', rowH);
  await page.locator('[data-act="theme"]').click(); await sleep(300);
  a = await attrs(page);
  rec('sun/moon button flips the theme and saves it', a.theme === 'light' && a.saved.theme === 'light', JSON.stringify(a));
  await page.reload(); await sleep(1800);
  a = await attrs(page);
  rec('after a reload both choices are still there', a.theme === 'light' && a.mode === 'teacher', JSON.stringify(a));
  rec('the segmented control shows the remembered mode', (await page.locator('.ui-mode .seg-opt[aria-checked="true"]').innerText()) === 'Giáo viên');

  // 3. menu Xem
  await page.locator('[data-menu="view"]').click(); await sleep(250);
  const items = await page.$$eval('.mb-menu .mb-item', (els) => els.map((e) => `${e.textContent.trim()}:${e.getAttribute('aria-checked')}`));
  rec('menu Xem lists Sáng / Tối / Học sinh / Giáo viên with the current ones ticked', ['Sáng:true', 'Tối:false', 'Học sinh:false', 'Giáo viên:true'].every((i) => items.includes(i)), items.join(' | '));
  await page.locator('.mb-menu .mb-item', { hasText: 'Tối' }).click(); await sleep(300);
  a = await attrs(page);
  rec('menu Xem > Tối switches the theme', a.theme === 'dark' && a.saved.theme === 'dark', JSON.stringify(a));
  await page.locator('[data-menu="view"]').click(); await sleep(250);
  await page.locator('.mb-menu .mb-item', { hasText: 'Học sinh' }).click(); await sleep(300);
  a = await attrs(page);
  rec('menu Xem > Học sinh switches the mode', a.mode === 'student' && a.saved.mode === 'student', JSON.stringify(a));
  await ctx.close();
}

// 4. a finger: every control and port row is 44px
{
  const { ctx, page } = await fresh({ colorScheme: 'light', hasTouch: true, isMobile: true, viewport: { width: 1024, height: 768 } });
  const coarse = await page.evaluate(() => matchMedia('(pointer: coarse)').matches);
  const toks = await page.evaluate(() => { const s = getComputedStyle(document.documentElement); return ['--row', '--ctl', '--hh'].map((v) => s.getPropertyValue(v).trim()).join(' '); });
  rec('coarse pointer is on in the touch context and raises row / control / header', coarse && toks === '44px 44px 52px', `${coarse} ${toks}`);
  await ctx.close();
}
console.log(`FAILS ${fails}`);
await b.close();
