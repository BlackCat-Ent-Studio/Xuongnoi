// Prints the widths of the top bar's parts at several window widths, to find what has to give way on narrow screens.
import { launch, openEditor } from './ui-c-lib.mjs';
const b = await launch();
for (const mode of ['student', 'teacher']) {
  for (const w of [1024, 1180, 1280, 1366, 1440]) {
    const { page, ctx } = await openEditor(b, { theme: 'light', mode, width: w, height: 768 });
    await page.locator('[data-mode="2d"]').click().catch(() => {}); await new Promise((r) => setTimeout(r, 400));
    const r = await page.evaluate(() => {
      const wd = (s) => { const e = document.querySelector(s); return e ? Math.round(e.getBoundingClientRect().width) : 0; };
      const kids = (s) => [...document.querySelectorAll(s + ' > *')].filter((e) => e.getBoundingClientRect().width > 0).map((e) => `${(e.className || e.tagName).toString().split(' ')[0]}:${Math.round(e.getBoundingClientRect().width)}`).join(' ');
      const tb = document.querySelector('.topbar');
      const left = document.querySelector('.tb-left').getBoundingClientRect();
      const play = document.querySelector('.play').getBoundingClientRect();
      const right = document.querySelector('.tb-right').getBoundingClientRect();
      const rightKids = [...document.querySelector('.tb-right').children].filter((e) => e.getBoundingClientRect().width > 0);
      const rightNeed = rightKids.reduce((s, e) => s + e.getBoundingClientRect().width, 0) + (rightKids.length - 1) * 8;
      return { bar: wd('.topbar'), left: kids('.tb-left'), leftEnd: Math.round(left.right), playStart: Math.round(play.left), playEnd: Math.round(play.right), rightStart: Math.round(right.left), rightNeed: Math.round(rightNeed), rightKids: kids('.tb-right'), overlapL: left.right > play.left, overlapR: play.right > right.right - rightNeed };
    });
    console.log(mode, w, JSON.stringify(r));
    await ctx.close();
  }
}
await b.close();
