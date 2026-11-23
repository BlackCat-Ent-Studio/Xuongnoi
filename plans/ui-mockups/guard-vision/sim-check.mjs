// Headless check (no browser): 4 answers on the 3 presets x guard start phases, jitter bookkeeping, and single-slider sweeps.
// Usage: node sim-check.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const dir = path.dirname(fileURLToPath(import.meta.url));
const G = new Function(fs.readFileSync(path.join(dir, 'src', '05-sim.js'), 'utf8') + '\nreturn GVSim;')();

const fmt = (r) => (r.win ? `THANG ${r.t}s` : `thua ${r.t}s`);
let bad = 0;
const verdict = (r) => r.correct.win && !r.distance.win && !r.rash.win && !r.none.win;
console.log('--- presets x guard start phase (correct must WIN; the 3 wrong ways must LOSE)');
for (const preset of ['A', 'B', 'C']) for (const startFrac of [0, 0.2, 0.5, 0.8]) {
  const P = { ...G.defaults(), preset, startFrac };
  const crates = G.crateList(P), hidden = G.coverSpots(crates).every((s) => G.coverHidden(P, crates, s));
  const r = G.runAll(P), c = r.correct;
  const jitterOk = c.stopsInOpen === 0 && c.starts <= 3 && c.stops <= 4;
  const ok = verdict(r) && hidden && jitterOk && c.chains >= 1 && c.waitEvents >= 1;
  if (!ok) bad++;
  console.log((ok ? 'OK  ' : 'FAIL') + ` ${preset} phase=${startFrac}${preset === 'A' && startFrac === 0.5 ? ' (default)' : ''}`.padEnd(26) + ` dung: ${fmt(c)} dashes=${c.dashes} chains=${c.chains} waits=${c.waitEvents} starts=${c.starts} stops=${c.stops} stopsInOpen=${c.stopsInOpen} | cu: ${fmt(r.distance)} | lieu: ${fmt(r.rash)} | khong-noi: ${fmt(r.none)} | coverHidden=${hidden}`);
}

console.log('--- single-slider sweeps off the default (A, phase 0.5)');
const sweeps = { patrolLen: [1, 2, 3.2, 3.4], guardSpeed: [0.8, 1.0, 1.6, 2.2, 3], range: [6, 8, 9.5, 11, 12], angle: [50, 70, 90, 120, 160], heroSpeed: [2.4, 3, 4, 5, 6] };
const rows = [];
for (const [k, vals] of Object.entries(sweeps)) for (const v of vals) {
  const r = G.runAll({ ...G.defaults(), [k]: v });
  const flags = [];
  if (!r.correct.win) flags.push('DUNG-THUA(' + r.correct.reason + ')');
  if (r.distance.win) flags.push('cu-THANG');
  if (r.rash.win) flags.push('lieu-THANG');
  if (r.none.win) flags.push('khong-noi-THANG');
  rows.push(`${flags.length ? 'edge' : 'OK  '} ${(k + '=' + v).padEnd(16)} dung ${r.correct.win ? 'THANG ' + r.correct.t : 'thua'} ${flags.join(' ')}`);
}
console.log(rows.join('\n'));
console.log(bad ? `FAILED ${bad} rows` : 'ALL preset rows OK');
process.exit(bad ? 1 : 0);
