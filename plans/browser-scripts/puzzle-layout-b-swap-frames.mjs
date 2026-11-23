// Layout B: frames of the swap animation (corner stage -> full, and back) plus the animated properties. usage: node puzzle-layout-b-swap-frames.mjs <phone|desk>
import { launch, openPage, setSave, openLevel, shot, VIEWPORTS } from './layout-b-lib.mjs';

const tag = process.argv[2] ?? 'phone';
const logs = [];
const browser = await launch();
const page = await openPage(browser, VIEWPORTS[tag], logs, tag);
await setSave(page, { seen: true });
await openLevel(page, 2);
const transitions = await page.evaluate(() => {
  const props = (sel) => getComputedStyle(document.querySelector(sel)).transitionProperty;
  return { stage: props('.pz-stage'), board: props('.pz-board-host') };
});
console.log('transition properties', JSON.stringify(transitions));
await page.click('.pz-pip-hit');
await page.waitForTimeout(160);
await shot(page, `${tag}-swap-1-early`);
await page.waitForTimeout(120);
await shot(page, `${tag}-swap-2-mid`);
await page.waitForTimeout(900);
await shot(page, `${tag}-swap-3-done`);
await page.click('.pz-pip-hit');
await page.waitForTimeout(170);
await shot(page, `${tag}-swap-4-back-early`);
console.log(logs.join('\n') || 'no console errors');
await browser.close();
