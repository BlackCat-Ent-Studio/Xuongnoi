// Shared helpers for the "Sân khấu mô phỏng" step-1 browser scripts. Needs `npx vite --port 5301 --strictPort` in app/.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
export const { chromium } = await import(pw);
export const BASE = process.env.BASE ?? 'http://localhost:5301';
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const CHROME = 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe';

export async function launch(extra = {}) {
  return chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'], ...extra });
}

/** New page with a clean profile and the given look saved in localStorage (theme: light|dark, mode: student|teacher). */
export async function openEditor(browser, { theme = 'light', mode = 'student', width = 1440, height = 900, hash = '', pointer = 'fine' } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, colorScheme: theme, hasTouch: pointer === 'coarse', isMobile: false });
  const page = await ctx.newPage();
  const logs = [];
  page.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
  await page.addInitScript(([t, m]) => {
    if (!sessionStorage.getItem('__seeded')) {
      localStorage.clear();
      localStorage.setItem('xuong-noi:theme', t);
      localStorage.setItem('xuong-noi:ui-mode', m);
      sessionStorage.setItem('__seeded', '1');
    }
  }, [theme, mode]);
  await page.goto(`${BASE}/${hash}`);
  await sleep(2200);
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
  return { page, ctx, logs };
}

export async function openSample(page, label) {
  await page.locator('[data-menu="file"]').click(); await sleep(200);
  await page.locator('.mb-item', { hasText: 'Bài mẫu' }).hover(); await sleep(300);
  await page.locator('.mb-menu .mb-item', { hasText: label }).first().click(); await sleep(1400);
}

export async function fit(page) {
  await page.locator('.wc-rail button[aria-label*="Vừa"], .wc-rail button[title*="Vừa"]').first().click().catch(() => {});
  await sleep(500);
}
