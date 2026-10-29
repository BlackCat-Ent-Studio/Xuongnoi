import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { openBrowser, sleep, record, SCRATCH } from './common.mjs';

const SHOTS = `${SCRATCH}/tools`;
mkdirSync(SHOTS, { recursive: true });
const SRC = 'D:/workspace/GameBuilder/app/src/samples/pickaxe-rock.json';
const LOOKS = ['human', 'robot', 'cat', 'chick', 'jelly', 'dino'];

function makeBoard(look) {
  const b = JSON.parse(readFileSync(SRC, 'utf-8'));
  b.graph.nodes.find((n) => n.id === 'character-1').params.look = look;
  b.graph.nodes.push(
    { id: 'carry-1', kind: 'carry', params: { mode: 'toggle', throwPower: 8 }, pos: { x: 560, y: 330 } },
    { id: 'key-q', kind: 'key', params: { key: 'KeyQ' }, pos: { x: 40, y: 610 } },
    {
      id: 'crate-1',
      kind: 'item',
      params: { position: { x: -2, y: 0.4, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#7c3aed', shape: 'crate', carryable: 'yes', holdStyle: 'head' },
      pos: { x: 300, y: 900 },
    },
  );
  b.graph.wires.push(
    { id: 'wq1', from: { node: 'character-1', port: 'self' }, to: { node: 'carry-1', port: 'character' } },
    { id: 'wq2', from: { node: 'key-q', port: 'pressed' }, to: { node: 'carry-1', port: 'grab' } },
  );
  const path = `${SCRATCH}/tools/board-${look}.json`;
  writeFileSync(path, JSON.stringify(b));
  return path;
}

const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
const tap = async (code, ms = 60) => {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
};
const walk = async (ms, code = 'ArrowRight') => {
  await page.keyboard.down(code);
  await sleep(ms);
  await page.keyboard.up(code);
};

for (const look of LOOKS) {
  const path = makeBoard(look);
  const chooser = page.waitForEvent('filechooser');
  await page.locator('[data-menu="file"]').click(); await page.locator('.mb-item', { hasText: 'Mở game mẫu' }).hover();
  await page.locator('.mb-item', { hasText: 'Mở file' }).first().click();
  await (await chooser).setFiles(path);
  await sleep(800);
  await page.locator('#btn-play').click();
  await sleep(900);
  if (await page.locator('button', { hasText: 'Phóng to' }).count()) await page.locator('button', { hasText: 'Phóng to' }).click(); await sleep(500); await page.mouse.move(720, 450);
  await page.mouse.wheel(0, -2500);
  await sleep(400);
  const shot = (n) => page.screenshot({ clip: { x: 420, y: 250, width: 600, height: 400 }, path: `${SHOTS}/${look}-${n}.png` });

  await walk(930); // x about -2.35 : crate in reach (1.2), pickaxe (x=0) is not
  await sleep(150);
  await tap('KeyQ');
  await sleep(250);
  await walk(420); // x about -0.6
  await sleep(150);
  await tap('KeyE');
  await sleep(350);
  await shot('both-slots');
  await tap('KeyF');
  await shot('swing-1');
  await shot('swing-2');
  await sleep(500);
  await shot('after');
  await page.locator('#btn-play').click();
  await sleep(400);
}

console.log('LOGS:', JSON.stringify(logs));
record('no console errors', logs.length === 0, logs.join(' || '));
await browser.close();
