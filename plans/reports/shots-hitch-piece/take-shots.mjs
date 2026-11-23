// Shots of the "Chốt gài" try board on the real editor (Học sinh mode, light theme).
// Needs the dev server of the worktree: `npx vite --port 5343 --strictPort` in app/.
// usage: node take-shots.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';

process.env.BASE ??= 'http://localhost:5343';
const { launch, openEditor, sleep } = await import('../../browser-scripts/ui-c-lib.mjs');
const OUT = path.dirname(fileURLToPath(import.meta.url));
const browser = await launch();

async function dismiss(page) {
  if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) { await page.locator('[data-tut="invite-no"]').click(); await sleep(300); }
}

/** Stores the try board, built by the app's own module, as the autosave and reloads the editor on it. */
async function openBoard(page) {
  await page.evaluate(async () => {
    const io = await import('/src/io/index.ts');
    const boards = await import('/src/handbook/boards-hitch.ts');
    localStorage.setItem('xuong-noi:autosave', io.serializeBoard(boards.tryHitch()));
  });
  await page.reload();
  await sleep(2500);
  await dismiss(page);
}

const { page, logs } = await openEditor(browser, { theme: 'light', mode: 'student', width: 1700, height: 1000 });
await openBoard(page);
await page.screenshot({ path: path.join(OUT, '01-board-wiring.png') });
const card = page.locator('.wc-node[data-kind="hitch"]').first();
await card.scrollIntoViewIfNeeded().catch(() => {});
await sleep(200);
await card.screenshot({ path: path.join(OUT, '02-card-hitch.png') }).catch((e) => console.log('card shot failed', e.message));
await card.locator('.wc-node-head').click().catch(() => {});
await sleep(500);
await page.screenshot({ path: path.join(OUT, '03-hitch-selected-panel.png') });

await page.locator('.play .pbtn.primary').click();
await page.locator('button:has-text("Mô phỏng"):visible').first().click().catch(() => {});
const t0 = Date.now();
const marks = [[0.4, '04-start'], [5.6, '05-under-the-cart'], [7.5, '06-carrying'], [9, '07-carrying-near-marker-2'], [13, '08-released'], [20, '09-parked']];
for (const [at, name] of marks) {
  while ((Date.now() - t0) / 1000 < at) await sleep(20);
  await page.screenshot({ path: path.join(OUT, `${name}-t${at.toFixed(1)}s.png`) });
  console.log('shot', name, at);
}
console.log('page errors:', JSON.stringify(logs));
await browser.close();
