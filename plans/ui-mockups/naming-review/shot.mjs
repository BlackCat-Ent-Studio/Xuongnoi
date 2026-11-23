// Screenshots of index.html: full page at 1280 wide, the card section, and a phone-width card row.
// playwright-core is imported by absolute path (it is installed under D:\workspace\webbug, not in this repo).
import { pathToFileURL } from 'node:url';
import { mkdirSync } from 'node:fs';

const { chromium } = await import(pathToFileURL('D:/workspace/webbug/node_modules/playwright-core/index.mjs').href);
const HERE = 'D:/workspace/GameBuilder/plans/ui-mockups/naming-review';
const OUT = `${HERE}/shots`;
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH ?? 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe' });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(pathToFileURL(`${HERE}/index.html`).href);
await page.waitForSelector('body[data-cards-ready="1"]');

await page.screenshot({ path: `${OUT}/top.png` });
await page.screenshot({ path: `${OUT}/full.png`, fullPage: true });
await page.addStyleTag({ content: '.bar, th { position: static !important; }' });
await page.locator('#cards').scrollIntoViewIfNeeded();
const cmp = page.locator('#cmp');
await cmp.screenshot({ path: `${OUT}/cards.png` });

// Interaction check: flag two rows, filter, copy text.
await page.fill('#q', 'Va chạm');
await page.locator('tr.port:not(.hide) input[type=checkbox]').first().check();
await page.locator('tr.port:not(.hide) input[type=checkbox]').nth(1).check();
await page.locator('.alt:visible').first().fill('Chạm nhau');
await page.click('#copy');
await page.screenshot({ path: `${OUT}/flagged.png` });
console.log('copied text:\n' + await page.inputValue('#paste'));
console.log('flag count:', await page.textContent('#flagCount'));

const widths = await page.$$eval('#cmp .wc-node', (els) => els.map((e) => ({ kind: e.closest('.cell') && e.querySelector('.wc-name').textContent, w: +e.dataset.width, cut: +e.dataset.cut, over: +e.dataset.overlap })));
console.log(JSON.stringify(widths));
console.log('errors:', errors);
await browser.close();
