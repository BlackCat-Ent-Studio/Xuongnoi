// Screenshots for the node rename: palette, sample board, properties, handbook, lesson step, puzzle level.
// Usage: PORT=5213 node rename-shots.mjs
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const port = process.env.PORT ?? '5213';
const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-rename/';
const base = `http://localhost:${port}`;
const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--enable-webgl'] });
const logs = [];
for (const [vw, vh] of [[1280, 720], [844, 390]]) {
  const tag = `${vw}x${vh}`;
  const ctx = await b.newContext({ viewport: { width: vw, height: vh } });
  const p = await ctx.newPage();
  p.on('pageerror', (e) => logs.push(`[${tag}] pageerror ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') logs.push(`[${tag}] ${m.text()}`); });
  p.on('dialog', (d) => d.dismiss());
  await p.goto(`${base}/`);
  await p.evaluate(() => localStorage.setItem('xuongnoi.tutorial.invited', '1'));
  await p.waitForTimeout(1500);
  // dismiss first-launch invite if present
  const no = p.locator('[data-tut="invite-no"]');
  if (await no.count()) await no.first().click().catch(() => {});
  await p.waitForTimeout(300);
  await p.locator('#tab-palette').click();
  await p.waitForTimeout(500);
  await p.screenshot({ path: `${OUT}${tag}-1-palette.png` });

  // search by the OLD name
  const q = p.locator('.pn-search-input');
  if (await q.count()) {
    await q.fill('Cảm biến chạm');
    await p.waitForTimeout(300);
    await p.screenshot({ path: `${OUT}${tag}-1b-palette-search-old-name.png` });
    await q.fill('');
  }

  // sample board
  await p.locator('[data-menu="file"]').click();
  await p.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await p.locator('.mb-item', { hasText: 'Né và bắn' }).first().click();
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}${tag}-2-sample-board.png` });

  // properties: select the touch-like node (zone/health/shooter)
  const sel = p.locator('.wc-node[data-kind="shooter"] .wc-node-head').first();
  if (await sel.count()) { await sel.click(); await p.waitForTimeout(400); }
  await p.screenshot({ path: `${OUT}${tag}-3-properties.png` });

  // handbook at touch
  await p.evaluate(() => document.dispatchEvent(new CustomEvent('handbook:open', { detail: 'touch' })));
  await p.waitForTimeout(700);
  await p.screenshot({ path: `${OUT}${tag}-4-handbook.png` });
  await p.keyboard.press('Escape');
  await p.waitForTimeout(300);

  // lesson step
  await p.locator('#tab-lessons').click().catch(() => {});
  await p.waitForTimeout(300);
  const item = p.locator('.ld-item[data-lesson="bot-senses"]');
  if (await item.count()) {
    await item.click();
    await p.waitForTimeout(600);
    for (let i = 0; i < 1; i++) {
      const next = p.locator('[data-tut="next"], .ld-next').first();
      if (await next.count()) await next.click().catch(() => {});
      await p.waitForTimeout(400);
    }
  } else {
    logs.push(`[${tag}] lesson bot-senses item missing: ${await p.locator('.ld-item').evaluateAll((els) => els.map((e) => e.getAttribute('data-lesson')).join(','))}`);
  }
  await p.screenshot({ path: `${OUT}${tag}-5-lesson-step.png` });

  // puzzle levels (unlock the first seven so the board opens directly)
  await p.goto(`${base}/giai-do.html`);
  await p.evaluate(() => {
    const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', 'phan-loai-mau'];
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(ids.map((i) => [i, { stars: 3 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', '1');
  });
  await p.reload();
  for (const id of ['cua-kho', 'ne-linh-gac']) {
    await p.goto(`${base}/giai-do.html#/map`);
    await p.reload();
    await p.waitForTimeout(1500);
    await p.goto(`${base}/giai-do.html#/level/${id}`);
    await p.waitForTimeout(2500);
    // put two pieces from the tray on the board so a movable card shows its English subtitle
    const chips = p.locator('.pz-chip');
    for (let i = 0; i < Math.min(2, await chips.count()); i++) { await chips.nth(i).click().catch(() => {}); await p.waitForTimeout(400); }
    await p.screenshot({ path: `${OUT}${tag}-6-puzzle-${id}.png` });
  }
  await ctx.close();
}
console.log(logs.join('\n') || 'no console errors');
await b.close();
