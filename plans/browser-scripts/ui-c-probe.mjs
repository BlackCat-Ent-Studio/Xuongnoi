// Quick look: empty editor + one sample, one look. Usage: THEME=light MODE=student node ui-c-probe.mjs
import { launch, openEditor, openSample, fit, sleep } from './ui-c-lib.mjs';
import fs from 'node:fs';
const OUT = 'D:/workspace/GameBuilder-ui-c/plans/reports/shots-ui-c-step1/probe/';
fs.mkdirSync(OUT, { recursive: true });
const theme = process.env.THEME ?? 'light';
const mode = process.env.MODE ?? 'student';
const sample = process.env.SAMPLE ?? 'Robot dò đường';
const b = await launch();
const { page, logs } = await openEditor(b, { theme, mode, width: Number(process.env.W ?? 1440), height: Number(process.env.H ?? 900) });
await page.screenshot({ path: `${OUT}${theme}-${mode}-0-empty.png` });
await openSample(page, sample);
await fit(page);
await page.screenshot({ path: `${OUT}${theme}-${mode}-1-sample.png` });
if (process.env.ZOOM1) {
  await page.locator('.wc-pct').click(); await sleep(400);
  await page.screenshot({ path: `${OUT}${theme}-${mode}-2-zoom1.png` });
}
console.log('LOGS', JSON.stringify(logs.slice(0, 8)));
await b.close();
