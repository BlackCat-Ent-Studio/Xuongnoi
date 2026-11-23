// Opens every bundled sample and prints the real size and position of each card (JSON) for the app on PORT.
// Usage: PORT=5213 node rename-sample-sizes.mjs > samples-new.json
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const port = process.env.PORT ?? '5213';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
p.on('pageerror', (e) => errors.push(e.message));
await p.goto(`http://localhost:${port}/`);
await p.waitForTimeout(1500);
const open = async () => {
  await p.locator('[data-menu="file"]').click();
  await p.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
};
await open();
const labels = (await p.locator('.mb-item .mb-label').allInnerTexts()).filter((l) => /\(|Nhảy cóc|Mê cung/.test(l));
await p.keyboard.press('Escape');
const res = {};
for (const label of labels) {
  await open();
  await p.locator('.mb-item', { hasText: label }).first().click();
  await p.waitForTimeout(700);
  res[label] = await p.evaluate(() => {
    const o = {};
    for (const n of document.querySelectorAll('.wc-node')) o[n.getAttribute('data-id')] = { x: Math.round(parseFloat(n.style.left)), y: Math.round(parseFloat(n.style.top)), w: n.offsetWidth, h: n.offsetHeight };
    return o;
  });
}
console.log(JSON.stringify({ errors, res }));
await b.close();
