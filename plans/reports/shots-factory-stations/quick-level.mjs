// One quick shot of the factory level (light), with the floating game window made small, to judge the wires.
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const OUT = path.dirname(fileURLToPath(import.meta.url));
const PW_ROOT = path.join(os.homedir(), 'AppData', 'Local', 'Temp', 'claude', 'a12094c0c35d488c', '75fb5f30-1223-44d1-ba33-7a3950788f98', 'scratchpad', 'pw');
const { chromium } = await import(pathToFileURL(path.join(PW_ROOT, 'node_modules', 'playwright-core', 'index.mjs')).href);
const CHROME = path.join(os.homedir(), 'AppData', 'Local', 'ms-playwright', 'chromium-1248', 'chrome-win64', 'chrome.exe');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: CHROME, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const mode = process.argv[2] ?? 'teacher';
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } });
const page = await context.newPage();
await page.goto('http://localhost:5186');
await page.evaluate((m) => { localStorage.clear(); localStorage.setItem('xuong-noi:tutorial-seen', '1'); localStorage.setItem('xuong-noi:theme', 'light'); localStorage.setItem('xuong-noi:ui-mode', m); }, mode);
await page.goto('http://localhost:5186');
await page.waitForSelector('.wc');
await sleep(1200);
await page.locator('[data-menu="file"]').click(); await sleep(250);
await page.locator('.mb-item', { hasText: 'Bài mẫu' }).first().hover(); await sleep(350);
await page.locator('.mb-menu .mb-item', { hasText: 'Xưởng phân loại kiện hàng' }).first().click(); await sleep(1800);
await page.locator('select.tb-layout').selectOption({ label: 'Bố cục: Rộng bảng' }).catch(() => {}); await sleep(500);
await page.locator('.wc[tabindex]').focus();
await page.locator('.wc-rail button[title="Vừa màn hình"]').click(); await sleep(600);
await page.screenshot({ path: path.join(OUT, `1-factory-level-wide-${mode}-light.png`) });
await browser.close();
