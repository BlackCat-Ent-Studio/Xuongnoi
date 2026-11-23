import { readFileSync, writeFileSync } from 'node:fs';
import { openBrowser, SCRATCH } from './common.mjs';

const OUT = `${SCRATCH}/tools`;
const LOOKS = ['human', 'robot', 'cat', 'chick', 'jelly', 'dino'];
const NAMES = ['both-slots', 'swing-1', 'swing-2'];
const img = (l, n) => `data:image/png;base64,${readFileSync(`${OUT}/${l}-${n}.png`).toString('base64')}`;
const html = `<body style="margin:0;background:#fff;font:14px sans-serif"><table cellspacing=2>${LOOKS.map(
  (l) => `<tr><td>${l}</td>${NAMES.map((n) => `<td><img width=330 src="${img(l, n)}"></td>`).join('')}</tr>`,
).join('')}</table></body>`;
writeFileSync(`${OUT}/montage.html`, html);
const { browser, page } = await openBrowser();
await page.setViewportSize({ width: 1100, height: 1500 });
await page.goto(`file:///${OUT}/montage.html`);
await page.screenshot({ path: `${OUT}/contact-looks.png`, fullPage: true });
await browser.close();
console.log('done');
