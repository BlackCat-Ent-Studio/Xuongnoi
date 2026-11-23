// Walks the visual tutorial preview step by step and screenshots each state (+ the "?" ghost hint).
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const dir = 'D:/workspace/GameBuilder/plans/ui-mockups/puzzle-phone/';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1100, height: 760 } });
const logs = [];
p.on('console', (m) => { if (['error', 'warning'].includes(m.type())) logs.push(m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await p.goto('file:///' + dir + 'tutorial-preview.html');
await p.waitForTimeout(1200);
if (logs.length) { console.log(logs.join('\n')); await b.close(); process.exit(1); }
const phone = p.locator('.phone');
const shot = async (n) => { await p.waitForTimeout(500); await phone.screenshot({ path: dir + `shot-tut-${n}.png` }); };
const port = (c, id) => p.locator(`.port[data-card="${c}"][data-p="${id}"]`).click({ force: true });
await shot('1-start');
await port('btn', 'self'); await shot('1b-picked');
await port('touch', 'b'); await shot('2-take-latch');
await p.click('.chip:has-text("Công tắc nhớ")', { force: true }); await shot('3-touch-to-latch');
await port('touch', 'on'); await port('latch', 'set'); await shot('4-latch-to-door');
await port('latch', 'on'); await port('door', 'open'); await shot('5-press-run');
await p.click('#run', { force: true }); await shot('6-bye');
// hint: fresh page, take latch, ask "?"
await p.reload(); await p.waitForTimeout(800);
await p.click('.skip'); await p.click('#hint'); await shot('7-hint-wire');
console.log(logs.join('\n') || 'no console errors');
await b.close();
