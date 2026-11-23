// Live smoke test of the real-time sound API (no ears): unlock, play effects, switch music scenes, toggle settings.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const p = await b.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto('http://localhost:5202/src/puzzle/ui/sound/render-check.html');
await p.waitForFunction(() => window.soundReady === true);
const r = await p.evaluate(async () => {
  const s = window.soundApi;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  s.playSfx('tap'); s.startMusic('menu'); // before unlock: silent, no throw
  s.unlockAudio();
  await sleep(300);
  for (const n of ['tap', 'tap', 'pick', 'wire', 'unwire', 'run', 'stop', 'win', 'star', 'star', 'hint', 'unlock', 'page', 'lose']) { s.playSfx(n); await sleep(60); }
  await sleep(1500);
  s.startMusic('menu'); s.startMusic('level'); await sleep(1800);
  s.setSettings({ music: false }); await sleep(600);
  s.setSettings({ music: true }); await sleep(800);
  s.setSettings({ sfx: false }); s.playSfx('win');
  s.setSettings({ sfx: true });
  s.stopMusic(); await sleep(1200);
  return 'done';
});
console.log(r, errs.join('\n') || 'no errors');
await b.close();
