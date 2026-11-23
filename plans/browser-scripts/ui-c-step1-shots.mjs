// Screenshot matrix for the editor look: light/dark x Học sinh/Giáo viên, plus 1024x768.
// Needs `npx vite --port 5301 --strictPort` in app/. ONLY=light-student limits the looks; SIZES=1440,1024 limits sizes.
import { launch, openEditor, openSample, fit, sleep } from './ui-c-lib.mjs';
import fs from 'node:fs';

const OUT = 'D:/workspace/GameBuilder-ui-c/plans/reports/shots-ui-c-step1/';
fs.mkdirSync(OUT, { recursive: true });
const looks = [['light', 'student'], ['light', 'teacher'], ['dark', 'student'], ['dark', 'teacher']];
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const sizes = (process.env.SIZES ?? '1440,1024').split(',').map(Number);
const dims = { 1440: [1440, 900], 1024: [1024, 768] };
const b = await launch();
const allLogs = [];

async function selectCard(page, names) {
  const kinds = await page.$$eval('.wc-node', (els) => els.map((e) => e.dataset.kind));
  const pick = names.find((k) => kinds.includes(k)) ?? kinds[Math.min(2, kinds.length - 1)];
  await page.locator(`.wc-node[data-kind="${pick}"] .wc-node-head`).first().click();
  await sleep(500);
  return pick;
}
async function closeMenus(page) { await page.keyboard.press('Escape'); await sleep(150); }

for (const [theme, mode] of looks) {
  const tag = `${theme}-${mode}`;
  if (only && !only.includes(tag)) continue;
  for (const w of sizes) {
    const [width, height] = dims[w];
    const sfx = w === 1440 ? '' : `-${w}`;
    const { page, ctx, logs } = await openEditor(b, { theme, mode, width, height });
    await page.screenshot({ path: `${OUT}${tag}${sfx}-1-empty.png` });

    await openSample(page, 'Robot dò đường'); await fit(page);
    await page.screenshot({ path: `${OUT}${tag}${sfx}-2-robot.png` });

    await openSample(page, 'Băng chuyền phân loại'); await fit(page);
    const picked = await selectCard(page, ['conveyor', 'counter', 'sensor']);
    await page.screenshot({ path: `${OUT}${tag}${sfx}-3-sorter-selected-${picked}.png` });

    // running: the wire current. Deselect so the board shows plain wires.
    await page.locator('.wc').click({ position: { x: 20, y: 120 } }).catch(() => {});
    await page.locator('[data-tut="play"]').click(); await sleep(4500);
    await page.screenshot({ path: `${OUT}${tag}${sfx}-4-running.png` });
    await page.locator('.pbtn.stop').click(); await sleep(600);

    // step run on the robot sample
    await openSample(page, 'Robot dò đường'); await fit(page);
    await page.locator('[data-tut="step"]').click(); await sleep(1500);
    await page.screenshot({ path: `${OUT}${tag}${sfx}-5-step-run.png` });
    await page.locator('.pbtn.stop').click().catch(() => {}); await sleep(500);

    // handbook
    await page.locator('[data-menu="help"]').click(); await sleep(200);
    await page.locator('.mb-item', { hasText: 'Sổ tay mảnh ghép' }).click(); await sleep(1000);
    await page.screenshot({ path: `${OUT}${tag}${sfx}-6-handbook.png` });
    await closeMenus(page);
    await page.locator('.modal-overlay .btn, .hb-head button').first().click().catch(() => {});
    await sleep(300);
    allLogs.push(...logs.map((l) => `${tag}${sfx}: ${l}`));
    await ctx.close();

    // a lesson in progress (fresh empty board): step 2 points at the palette item, step 3 at a property row
    const lesson = await openEditor(b, { theme, mode, width, height });
    await lesson.page.locator('[data-launch="learn"]').click(); await sleep(800);
    await lesson.page.locator('.ld [data-tut="next"]').click(); await sleep(500);
    await lesson.page.screenshot({ path: `${OUT}${tag}${sfx}-7-lesson-pointer.png` });
    allLogs.push(...lesson.logs.map((l) => `${tag}${sfx} lesson: ${l}`));
    await lesson.ctx.close();
  }
}
console.log('LOGS', JSON.stringify([...new Set(allLogs)].slice(0, 12)));
await b.close();
