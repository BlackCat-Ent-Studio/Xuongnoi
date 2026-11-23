// Builds a contact sheet PNG from a list of images (grid, with captions) using a browser page.
// usage: node contact-sheet.mjs <out.png> <cols> <thumbWidth> <img1> <img2> ...
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
import fs from 'node:fs';
import path from 'node:path';
const [outPng, colsArg, wArg, ...imgs] = process.argv.slice(2);
const cols = Number(colsArg);
const w = Number(wArg);
const html = `<html><body style="margin:0;background:#222;display:grid;grid-template-columns:repeat(${cols},${w}px);gap:6px;padding:6px;font:12px sans-serif;color:#fff">${imgs
  .map((f) => `<figure style="margin:0"><img src="file:///${f.replace(/\\/g, '/')}" style="width:${w}px;display:block"><figcaption>${path.basename(f)}</figcaption></figure>`)
  .join('')}</body></html>`;
const tmp = path.join(path.dirname(outPng), '_sheet.html');
fs.writeFileSync(tmp, html);
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: cols * (w + 6) + 6, height: 800 } });
await p.goto('file:///' + tmp.replace(/\\/g, '/'));
await p.waitForLoadState('load');
await p.waitForTimeout(500);
await p.screenshot({ path: outPng, fullPage: true });
fs.unlinkSync(tmp);
await b.close();
