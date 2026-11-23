// Compact view of shots/metrics.json for the report.
import fs from 'node:fs';
const m = JSON.parse(fs.readFileSync(new URL('../shots/metrics.json', import.meta.url), 'utf8'));
for (const [k, v] of Object.entries(m)) {
  const c = v.contrast;
  const heads = Object.entries(c).filter(([n]) => n.startsWith('Nhóm')).map(([, r]) => r);
  console.log(k, '| font d/t/p/z', v.desktop.minF, v.tablet.minF, v.phone.minF, v.puzzle.minF, '| hit d/t/p/z', v.desktop.minH, v.tablet.minH, v.phone.minH, v.puzzle.minH,
    '| text', c.text, c.text2, c.text3, '| chrome', c.chromeText, c.chromeText2, '| run', c['runInk / run'], '| head min', Math.min(...heads), '| sel', c['accent (viền chọn)'], '| line2', c['line2 (viền ô nhập)'], '| cardLine', c.cardLine,
    '| wires', c['Đúng/Sai (viền dây)'], c['Số (viền dây)'], c['Vật thể (viền dây)'], '| minText', v.minText, '| cvd cats n/d/p', v.cvdCatsPorts.normal[0], v.cvdCatsPorts.deut[0], v.cvdCatsPorts.prot[0], 'ports', v.cvdCatsPorts.normal[1], v.cvdCatsPorts.deut[1], v.cvdCatsPorts.prot[1], '| faults', v.faults.length);
}
