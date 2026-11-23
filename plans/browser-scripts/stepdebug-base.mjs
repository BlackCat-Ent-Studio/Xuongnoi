import { chromium, launch, openPage, setSave, openLevel, shot, VIEWPORTS } from './stepdebug-lib.mjs';
const logs = [];
const b = await launch();
for (const [name, vp] of Object.entries(VIEWPORTS)) {
  const page = await openPage(b, vp, logs, name);
  await setSave(page, { seen: true });
  await openLevel(page, 2);
  await shot(page, `base-${name}-l2`);
  await page.close();
}
await b.close();
console.log(logs.join('\n'));
