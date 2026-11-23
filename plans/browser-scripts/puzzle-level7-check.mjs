// New level 7 "Phân loại thùng màu" on :5205: solution win, red-crate lose, "?" hints, at 1280x720 and 844x390.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-level7/';
const URL = 'http://localhost:5205/giai-do.html';
const ID = 'phan-loai-mau';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const ids = ['bot-dau-tien', 'cua-kho', 'nhat-sao', 'hai-nut-mot-cua', 'du-ba-thung', 'ne-linh-gac', ID, 'xuong-tong-hop'];

async function open(p, seen) {
  await p.goto(URL);
  await p.evaluate(([list, seenList]) => {
    localStorage.setItem('xuongnoi.puzzle.progress', JSON.stringify(Object.fromEntries(list.map((i) => [i, { stars: 1 }]))));
    localStorage.setItem('xuongnoi.puzzle.guideSeen', JSON.stringify(seenList));
  }, [ids, seen]);
  await p.goto(URL + '#/map');
  await p.reload();
  await p.waitForTimeout(1500);
  await p.click('text=Phân loại thùng màu');
  await p.waitForTimeout(3500);
}
const port = (p, node, dir, name) => p.locator(`.wc-node[data-id="${node}"] .wc-port[data-dir="${dir}"][data-port="${name}"] .wc-dot`).first();
async function wire(p, a, b2) {
  await port(p, a[0], 'out', a[1]).click({ force: true });
  await port(p, b2[0], 'in', b2[1]).click({ force: true });
  await p.waitForTimeout(250);
  console.log('wire', a.join('.'), '>', b2.join('.'), 'wires:', await p.locator('.wc-wire-hit').count(), 'toast:', await p.locator('.pz-toast:not([hidden])').allInnerTexts());

}
async function build(p, want) {
  const chips = p.locator('.pz-tray > *');
  console.log('tray:', (await chips.allInnerTexts()).join(' | '));
  for (const i of [0, 1, 2]) { await chips.nth(i).click({ force: true }); await p.waitForTimeout(250); }
  const placed = await p.locator('.wc-node').evaluateAll((els) => els.map((e) => e.dataset.id).filter((id) => /^p\d+$/.test(id)));
  console.log('placed ids:', placed.join(','));
  const [eye, not, and] = placed;
  await p.locator(`.pz-param[data-node="${eye}"][data-param="want"]`).click({ force: true });
  for (let k = 1; k < want; k++) await p.locator('.pz-pop .pz-step').nth(1).click({ force: true });
  await p.waitForTimeout(200);
  { const bb = await p.locator('.pz-board-host').boundingBox(); await p.mouse.click(bb.x + bb.width * 0.5, bb.y + bb.height * 0.6); } await p.waitForTimeout(300);
  await wire(p, ['robot', 'self'], [eye, 'who']);
  await wire(p, [eye, 'match'], [and, 'a']);
  await wire(p, ['hands', 'holding'], [not, 'in']);
  await wire(p, [not, 'out'], [and, 'b']);
  await wire(p, [and, 'out'], ['hands', 'grab']);
}

for (const [tag, vp] of [['phone', { width: 844, height: 390 }]]) {
  const p = await b.newPage({ viewport: vp });
  p.on('console', (m) => { if (['error'].includes(m.type())) logs.push(`${tag}: ${m.text()}`); });
  p.on('pageerror', (e) => logs.push(`${tag} pageerror: ${e.message}`));

  // 1) first visit: new-piece intro unseen
  await open(p, ['bot-dau-tien', 'du-ba-thung']);
  await p.screenshot({ path: out + `${tag}-1-open.png` });

  // 2) "?" hints (three presses)
  await p.locator('.pz-hint-btn').click({ force: true });
  await p.waitForTimeout(2200);
  await p.screenshot({ path: out + `${tag}-2-hint1.png` });
  await p.locator('.pz-hint-btn').click({ force: true });
  await p.waitForTimeout(2200);
  await p.screenshot({ path: out + `${tag}-3-hint2.png` });

  // 3) solution
  await open(p, ['bot-dau-tien', 'du-ba-thung', `intro:${ID}`]);
  await build(p, 2);
  await p.screenshot({ path: out + `${tag}-4-built.png` });
  await p.locator('.pz-btn.run').click({ force: true });
  await p.waitForTimeout(8000);
  await p.screenshot({ path: out + `${tag}-5-run8s.png` });
  await p.waitForTimeout(12000);
  await p.screenshot({ path: out + `${tag}-6-run20s.png` });
  let won = false;
  for (let i = 0; i < 40 && !won; i++) { await p.waitForTimeout(1000); won = (await p.locator('.pz-win').count()) > 0; }
  await p.waitForTimeout(1500);
  await p.screenshot({ path: out + `${tag}-7-win.png` });
  console.log(tag, 'solution won:', won);

  // 4) red crate loses
  await open(p, ['bot-dau-tien', 'du-ba-thung', `intro:${ID}`]);
  await build(p, 1);
  await p.locator('.pz-btn.run').click({ force: true });
  await p.waitForTimeout(7000);
  await p.screenshot({ path: out + `${tag}-8-red-carry.png` });
  await p.waitForTimeout(3500);
  await p.screenshot({ path: out + `${tag}-9-red-lose.png` });
  console.log(tag, 'win card after red:', (await p.locator('.pz-win').count()) > 0);
  await p.close();
}
console.log(logs.slice(0, 20).join('\n') || 'no console errors');
await b.close();
