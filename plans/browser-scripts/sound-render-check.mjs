// Renders each effect and 8 s of each music scene offline and prints peak / rms / length.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const b = await chromium.launch();
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:5202/src/puzzle/ui/sound/render-check.html');
await p.waitForFunction(() => window.soundReady === true, null, { timeout: 20000 });
const names = ['tap', 'pick', 'wire', 'unwire', 'run', 'stop', 'win', 'lose', 'star', 'hint', 'unlock', 'page'];
const rows = await p.evaluate(async (names) => {
  const out = [];
  for (const n of names) out.push(['sfx ' + n, await window.soundRender.renderSfx(n, 0)]);
  out.push(['sfx star#3', await window.soundRender.renderSfx('star', 2)]);
  for (const s of ['menu', 'level']) out.push(['music ' + s, await window.soundRender.renderMusic(s, 8)]);
  return out;
}, names);
const f = (x) => x.toFixed(3);
for (const [n, s] of rows) console.log(n.padEnd(12), 'peak', f(s.peak), 'rms', f(s.rms), 'audible', f(s.audibleSec) + 's', 'recipe', f(s.recipeSec) + 's', s.peak >= 0.9 || s.rms < 0.0005 ? 'FAIL' : 'ok');
console.log(errs.join('\n') || 'no page errors');
await b.close();
