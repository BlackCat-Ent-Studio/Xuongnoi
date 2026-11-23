import { openBrowser, sleep, nodeOf, dragKind, wire, selectNode, setNumber, setSelect, clickNext, startLesson, stepNo } from './tut-common.mjs';

const OUT = 'C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/c6588d98-de8b-47ca-8a66-fd5282a3c2b1/scratchpad/sweep';
const { browser, page, logs } = await openBrowser();
await page.goto(`http://localhost:${process.env.PORT ?? 5173}/`);
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(1200);
if (await page.locator('[data-tut="invite-no"]').isVisible().catch(() => false)) {
  await page.locator('[data-tut="invite-no"]').click();
  await sleep(300);
}
await startLesson(page, 'win-lose');
const L3 = async (label) => console.log(label, '|', await stepNo(page));
await L3('intro');
await clickNext(page);
await L3('goal');
await selectNode(page, 'counter');
await setNumber(page, 'target', 1);
await dragKind(page, 'win-lose', 600, 60);
await wire(page, nodeOf('counter'), 'reached', nodeOf('win-lose'), 'win');
await dragKind(page, 'compare', 600, 280);
await wire(page, nodeOf('character'), 'y', nodeOf('compare'), 'a');
await setSelect(page, 'op', 'lt');
await dragKind(page, 'const', 600, 500);
await setNumber(page, 'value', -5);
await L3('before const wire');
const kinds = await page.locator('.wc-node').evaluateAll((els) => els.map((e) => e.dataset.kind));
console.log('nodes', kinds.join(','));
const wiresBefore = await page.locator('.wc-wire').count();
await wire(page, nodeOf('const'), 'value', nodeOf('compare'), 'b');
console.log(`wires before=${wiresBefore} after=${await page.locator('.wc-wire').count()}`);
await L3('after const wire');
await page.screenshot({ path: `${OUT}/debug-l3-replay.png` });
console.log('LOGS', JSON.stringify(logs));
await browser.close();
