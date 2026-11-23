// Shoots direction C, light theme, in each softness level, plus the contrast numbers the page computes.
const pw = 'file:///C:/Users/trong/AppData/Local/Temp/claude/a12094c0c35d488c/21dd1524-bf64-49b0-bdae-47a5b1b986a8/scratchpad/smoke/node_' + 'modules/playwright/index.mjs';
const { chromium } = await import(pw);
const OUT = 'D:/workspace/GameBuilder/plans/previews/ui-redesign-261118/shots/';
const b = await chromium.launch({ executablePath: 'C:/Users/trong/AppData/Local/ms-playwright/chromium-1248/chrome-win64/chrome.exe' });
const p = await b.newPage({ viewport: { width: 1520, height: 1100 } });
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
for (const s of ['s0', 's1', 's2', 's3']) {
  await p.goto(`file:///D:/workspace/GameBuilder/plans/previews/ui-redesign-261118/index.html?dir=c&th=light&mode=hs&soft=${s}`);
  await p.waitForTimeout(600);
  await p.locator('#fit-full').screenshot({ path: `${OUT}soft-${s}-c-light-hs-editor.png` });
  const m = await p.evaluate(() => ({ minText: window.__metrics.minText, text3: window.__metrics.contrast.text3, cardLine: window.__metrics.contrast.cardLine, num: window.__metrics.contrast['Số (viền dây)'], bool: window.__metrics.contrast['Đúng/Sai (viền dây)'] }));
  console.log(s, JSON.stringify(m));
}
console.log('errors', JSON.stringify(errs));
await b.close();
