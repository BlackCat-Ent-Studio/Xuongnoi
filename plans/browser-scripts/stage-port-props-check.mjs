// Plays a level's reference solution in a stand-alone game view on the stage port (:5204) and takes a screenshot series
// (door closed / swinging / open, stars, carried crate). usage: node stage-port-props-check.mjs <levelId> <outPrefix> <secondsCsv> [follow] [WxH]
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const [levelId, prefix, secs, follow, size] = process.argv.slice(2);
const [W, H] = (size ?? '520x440').split('x').map(Number);
const out = 'D:/workspace/GameBuilder/plans/reports/shots-stage-port/';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: Math.max(900, W + 20), height: Math.max(600, H + 20) } });
const logs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await p.goto('http://localhost:5204/giai-do.html');
await p.waitForTimeout(800);
const info = await p.evaluate(async ({ levelId, follow, W, H }) => {
  const { createGameView } = await import('/src/render/game-view.ts');
  const { createCozyStage, STAGE_CHARACTER_SCALE } = await import('/src/puzzle/stage/cozy-stage.ts');
  const { PUZZLE_LEVELS } = await import('/src/puzzle/levels/index.ts');
  const { buildPlayGraph } = await import('/src/puzzle/run-level.ts');
  const { mainCharacterId } = await import('/src/puzzle/ui/level-screen.ts');
  const level = PUZZLE_LEVELS.find((l) => l.id === levelId);
  const box = document.createElement('div');
  box.id = 'propbox';
  box.style.cssText = `position:fixed;left:0;top:0;width:${W}px;height:${H}px;z-index:99999;background:#bfeedd`;
  document.body.appendChild(box);
  const view = createGameView({ transparentStage: true, stage: createCozyStage() });
  view.mount(box);
  const { viewPitch } = await import('/src/nodes/camera.ts');
  const cam = level.base.nodes.find((n) => n.kind === 'camera');
  const pitch = level.mode === '3d' && cam ? viewPitch(String(cam.params.view ?? 'free')).pitch : undefined;
  const hero = follow === 'follow' ? mainCharacterId(level) : null;
  view.setStageFit({ top: 0.08, bottom: 0.08, follow: hero, heroScale: STAGE_CHARACTER_SCALE, ...(pitch !== undefined ? { pitch } : {}), ...(level.mode === '2d-side' ? { sidePitch: 0.2 } : {}) });
  view.resize();
  view.play(buildPlayGraph(level, level.solution), level.mode, () => ({ keysDown: new Set() }));
  window.__pv = view;
  return level.mode;
}, { levelId, follow, W, H });
let last = 0;
for (const s of secs.split(',').map(Number)) {
  await p.waitForTimeout((s - last) * 1000);
  last = s;
  const tri = await p.evaluate(() => window.__pzRenderInfo?.render.triangles ?? -1);
  const clip = process.env.CLIP ? Object.fromEntries(['x', 'y', 'width', 'height'].map((k, i) => [k, Number(process.env.CLIP.split(',')[i])])) : undefined;
  await p.screenshot({ path: `${out}${prefix}-t${String(s).replace('.', '_')}.png`, clip: clip ?? { x: 0, y: 0, width: W, height: H } });
  console.log('t', s, 'triangles', tri);
}
console.log(info, logs.slice(0, 10).join('\n') || 'no console errors');
await b.close();
