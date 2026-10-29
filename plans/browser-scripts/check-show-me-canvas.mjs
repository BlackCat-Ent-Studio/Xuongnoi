// "Chỉ cho tôi" on a wiring step must switch the centre tab from Màn chơi to Bảng nối.
import { openBrowser, sleep, record, stepNo, dragKind, setNumber, clickNext, startLesson } from './tut-common.mjs';

const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1000);
await startLesson(page, 'walk-jump');
await clickNext(page); // intro -> floor
await dragKind(page, 'block', 60, 50);
await setNumber(page, 'size', 20, 0);
await dragKind(page, 'character', 330, 50);
await page.locator('[data-tut="play"]').click();
await sleep(500);
await page.locator('.pbtn.stop').click();
await sleep(400);
await dragKind(page, 'stick', 60, 260);
record('on the stick -> wire step', (await stepNo(page)) === 'Bước 8/12', await stepNo(page));
const tab = async () => page.locator('.dock-center [role=tab][aria-selected=true]').first().innerText();
await page.locator('.dock-center [role=tab]', { hasText: 'Màn chơi' }).click();
await sleep(300);
record('centre tab is Màn chơi before', (await tab()) === 'Màn chơi', await tab());
await page.locator('.ld [data-tut="show"]').click();
await sleep(400);
record('Chỉ cho tôi switches to Bảng nối', (await tab()) === 'Bảng nối', await tab());
record('the two ports are highlighted and visible', (await page.locator('.tut-hl').count()) === 2 && (await page.locator('.wc-port.tut-hl').first().isVisible()), String(await page.locator('.tut-hl').count()));
// a palette-only step must not move the centre tab
await page.locator('.ld [data-tut="back"]').click();
await sleep(200);
await page.locator('.ld [data-tut="back"]').click();
await sleep(200);
await page.locator('.dock-center [role=tab]', { hasText: 'Màn chơi' }).click();
await page.locator('.ld [data-tut="show"]').click();
await sleep(300);
record('palette step leaves the centre tab alone', (await tab()) === 'Màn chơi', `${await stepNo(page)} / ${await tab()}`);
record('no console errors', logs.length === 0, JSON.stringify(logs));
await browser.close();
