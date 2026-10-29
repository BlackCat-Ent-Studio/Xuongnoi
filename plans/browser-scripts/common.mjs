import { chromium } from 'playwright';

export const SCRATCH = process.env.SCRATCH ?? 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad';
export const SHOTS = `${SCRATCH}/shots`;
export const URL = `http://localhost:${process.env.PORT ?? 5173}/`;

export async function openBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const [vw, vh] = (process.env.VP ?? '1440x900').split('x').map(Number); // e.g. VP=1920x1200 for long lessons with far-away drop targets
  const context = await browser.newContext({ viewport: { width: vw, height: vh } });
  const page = await context.newPage();
  const logs = [];
  page.on('console', (m) => {
    if (m.type() === 'error' || m.type() === 'warning') logs.push(`[${m.type()}] ${m.text()}`);
  });
  page.on('pageerror', (e) => logs.push(`[pageerror] ${e.message}`));
  page.on('dialog', (d) => {
    logs.push(`[DIALOG-DISMISSED] ${d.message()}`);
    d.dismiss();
  });
  return { browser, context, page, logs };
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function openSample(page, label) {
  // Tệp menu -> sample entry by its visible label (or a RegExp).
  await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await page.locator('.mb-item', { hasText: label }).first().click();
  await sleep(700);
}

export async function gameText(page) {
  return page.locator('.game-box').innerText();
}

export async function badges(page) {
  return page.locator('.wc-badge, .gn-badge').allInnerTexts();
}

export const results = [];
export function record(check, pass, detail) {
  results.push({ check, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${detail}`);
}
