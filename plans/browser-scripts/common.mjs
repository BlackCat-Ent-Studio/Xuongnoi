import { chromium } from 'playwright';

export const SCRATCH = 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad';
export const SHOTS = `${SCRATCH}/shots`;
export const URL = 'http://localhost:5173/';

export async function openBrowser() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'],
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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

export async function openSample(page, id) {
  await page.locator('button', { hasText: 'Mở ▾' }).click();
  await page.locator(`[data-sample="${id}"]`).click();
  await sleep(700);
}

export async function gameText(page) {
  return page.locator('.game-box').innerText();
}

export async function badges(page) {
  return page.locator('.wc-badge').allInnerTexts();
}

export const results = [];
export function record(check, pass, detail) {
  results.push({ check, pass, detail });
  console.log(`${pass ? 'PASS' : 'FAIL'} | ${check} | ${detail}`);
}
