// Editor step run: open a sample, Chơi, 🐢 Từng bước, wait for the freeze, screenshot paused + continue.
const { chromium } = await import('file:///C:/Users/trong/AppData/Local/Temp/claude/D--workspace-GameBuilder/091c5a2d-ceff-4dfe-a2af-61a656b30d1c/scratchpad/smoke/node_modules/playwright/index.mjs');
const out = 'D:/workspace/GameBuilder/plans/reports/shots-editor-step/';
const url = process.argv[2] ?? 'http://localhost:5241/';
const sample = process.argv[3] ?? 'Lính gác';
const tag = process.argv[4] ?? 'guard';
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const logs = [];
const p = await b.newPage({ viewport: { width: 1440, height: 860 } });
p.on('pageerror', (e) => logs.push(`pageerror: ${e.message}`));
p.on('console', (m) => { if (m.type() === 'error') logs.push(`console: ${m.text()}`); });
await p.goto(url);
await p.waitForTimeout(1200);
await p.getByRole('button', { name: 'Không', exact: true }).first().click({ timeout: 2000 }).catch(() => {});
await p.getByText('Tệp', { exact: true }).first().click();
await p.getByText('Mở game mẫu').first().click();
await p.getByText(sample).first().click();
await p.waitForTimeout(1200);
await p.screenshot({ path: out + `${tag}-1-edit.png` });
await p.locator('#btn-play').click();
await p.waitForTimeout(1500);
const step = p.locator('[data-tut="step"]');
console.log('step label before:', await step.innerText(), 'disabled:', await step.isDisabled());
await p.keyboard.down('ArrowRight');
await step.click();
await p.waitForTimeout(100);
let label = '';
for (let i = 0; i < 40; i++) {
  label = await step.innerText();
  if (label.includes('Tiếp') && !(await step.isDisabled())) break;
  await p.waitForTimeout(250);
}
console.log('label after wait:', label);
await p.keyboard.up('ArrowRight');
await p.waitForTimeout(500);
await p.screenshot({ path: out + `${tag}-2-paused.png` });
console.log('lit cards:', await p.locator('.wc-node.step-lit').count(), 'pins:', await p.locator('.step-pin').count(), 'wires:', await p.locator('.step-wire').count());
await step.click();
await p.waitForTimeout(100);
for (let i = 0; i < 40; i++) {
  label = await step.innerText();
  if (label.includes('Tiếp') && !(await step.isDisabled())) break;
  await p.waitForTimeout(250);
}
await p.waitForTimeout(500);
await p.screenshot({ path: out + `${tag}-3-second-break.png` });
await p.locator('.pbtn.stop').click();
await p.waitForTimeout(500);
console.log('after stop: label', await step.innerText(), 'lit', await p.locator('.wc-node.step-lit').count(), 'step-on', await p.locator('.wc.step-on').count());
console.log(logs.join('\n'));
await b.close();
