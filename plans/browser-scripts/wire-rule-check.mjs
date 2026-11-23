import { mkdirSync } from 'node:fs';
import { openBrowser, sleep, record } from './common.mjs';

async function openSample(page, label) {
  await page.locator('[data-menu="file"]').click();
  await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await page.locator('.mb-item', { hasText: label }).first().click();
  await sleep(700);
}
async function startLesson(page, id) {
  await page.locator('#tab-lessons').click();
  await page.locator('.ld-item[data-lesson="' + id + '"]').click();
  await sleep(500);
}

const OUT = 'D:/workspace/GameBuilder/plans/reports/shots-wire-rule/';
mkdirSync(OUT, { recursive: true });
const PORT = process.env.PORT ?? 5230;
const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${PORT}/`);
await sleep(1500);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}

/** Cards on the canvas: how many "Khi bắt đầu" cards, wires leaving them, and how many pairs of cards overlap. */
async function boardAudit() {
  return page.evaluate(() => {
    const cards = [...document.querySelectorAll('.wc-node')].map((el) => ({ id: el.getAttribute('data-id'), kind: el.getAttribute('data-kind'), r: el.getBoundingClientRect() }));
    let overlaps = 0;
    const pairs = [];
    for (let i = 0; i < cards.length; i++) {
      for (let j = i + 1; j < cards.length; j++) {
        const a = cards[i].r;
        const b = cards[j].r;
        if (a.left < b.right - 1 && a.right > b.left + 1 && a.top < b.bottom - 1 && a.bottom > b.top + 1) {
          overlaps++;
          pairs.push(`${cards[i].kind}:${cards[i].id}/${cards[j].kind}:${cards[j].id}`);
        }
      }
    }
    const starts = cards.filter((c) => c.kind === 'on-start');
    const startWires = [...document.querySelectorAll('.wc-wire, path[data-wire]')].length;
    return { total: cards.length, starts: starts.length, overlaps, pairs: pairs.slice(0, 5), wires: startWires };
  });
}

async function playFor(ms, name) {
  await page.locator('[data-tut="play"]').click();
  await sleep(ms);
  await page.screenshot({ path: `${OUT}${name}-play.png` });
  const stop = page.locator('.pbtn.stop');
  if (await stop.isVisible().catch(() => false)) await stop.click();
  await sleep(400);
}

const samples = [
  ['Lính gác', 'sample-guard-patrol'],
  ['Bot leo bục', 'sample-platform-bot'],
  ['Võ đài', 'sample-arena'],
];
for (const [label, name] of samples) {
  await openSample(page, label);
  await sleep(900);
  const a = await boardAudit();
  await page.screenshot({ path: `${OUT}${name}-edit.png` });
  record(`${name}: one "Khi bắt đầu" card and no overlapping cards`, a.starts === 1 && a.overlaps === 0, JSON.stringify(a));
  await playFor(3500, name);
}

for (const [id, name] of [['chores', 'lesson-chores'], ['make-bot', 'lesson-make-bot']]) {
  await startLesson(page, id);
  await sleep(900);
  const a = await boardAudit();
  await page.screenshot({ path: `${OUT}${name}-edit.png` });
  record(`${name}: starting board has a card to wire and no overlap`, a.starts >= 1 && a.overlaps === 0, JSON.stringify(a));
  await playFor(3000, name);
  await page.locator('.ld-exit, [data-tut="lesson-exit"], .tut-exit').first().click({ timeout: 1500 }).catch(() => {});
  await sleep(300);
}

console.log('LOGS', JSON.stringify(logs.slice(0, 12)));
await browser.close();
