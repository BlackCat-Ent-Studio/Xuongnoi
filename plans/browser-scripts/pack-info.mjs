// Draw calls / triangles of the city 3D board while playing (needs a temporary window.__r renderer hook).
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const URL = process.argv[2];
const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL);
await page.waitForTimeout(1500);
const no = page.locator('[data-tut="invite-no"]');
if (await no.isVisible().catch(() => false)) await no.click();
await page.getByRole('button', { name: 'Tệp' }).first().click();
await page.getByText('Mở game mẫu').first().click();
await page.waitForTimeout(400);
await page.getByText('Thành phố giao hàng 3D').first().click();
await page.waitForTimeout(1500);
await page.locator('text=Màn chơi >> visible=true').first().click();
await page.waitForTimeout(8000);
const info = () =>
  page.evaluate(() => {
    const r = window.__r;
    return { calls: r.info.render.calls, tris: r.info.render.triangles, geos: r.info.memory.geometries, tex: r.info.memory.textures, shadow: r.shadowMap.enabled };
  });
console.log('edit', JSON.stringify(await info()));
console.log(JSON.stringify(await page.evaluate(() => {
  const by = {};
  window.__s.traverseVisible((o) => {
    if (!o.isMesh) return;
    const g = o.geometry; const t = Math.round((g.index ? g.index.count : g.attributes.position.count) / 3);
    const k = o.name || o.geometry.type || 'anon';
    by[k] = (by[k] || 0) + t;
  });
  return Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 25);
})));
await page.locator('[data-tut="play"]').click();
await page.waitForTimeout(4000);
await page.getByText('Bấm để lái xe').first().click().catch(() => undefined);
await page.waitForTimeout(2000);
console.log('play', JSON.stringify(await info()));
console.log(JSON.stringify(await page.evaluate(() => {
  const by = {};
  let casters = 0;
  window.__s.traverseVisible((o) => {
    if (!o.isMesh) return;
    const g = o.geometry; const t = Math.round((g.index ? g.index.count : g.attributes.position.count) / 3);
    if (o.castShadow) casters += t;
    const k = o.name || 'anon';
    by[k] = (by[k] || 0) + t;
  });
  return { casters, top: Object.entries(by).sort((a, b) => b[1] - a[1]).slice(0, 8) };
})));
await browser.close();
