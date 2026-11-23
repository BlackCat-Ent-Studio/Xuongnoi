// Picks category colours that stay apart for normal, deuteranopia and protanopia vision, and prints WCAG ratios of today's app.
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('');
const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
const unlin = (v) => 255 * (v <= 0.0031308 ? v * 12.92 : 1.055 * Math.max(0, v) ** (1 / 2.4) - 0.055);
const lum = (c) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const M = {
  deut: [[0.367322, 0.860646, -0.227968], [0.280085, 0.672501, 0.047413], [-0.01182, 0.04294, 0.968881]],
  prot: [[0.152286, 1.052583, -0.204868], [0.114503, 0.786281, 0.099216], [-0.003882, -0.048116, 1.051998]],
};
const sim = (c, m) => { const l = c.map(lin); return m.map((r) => unlin(Math.min(1, Math.max(0, r[0] * l[0] + r[1] * l[1] + r[2] * l[2])))); };
const lab = (c) => {
  const [r, g, b] = c.map(lin);
  const x = (0.4124 * r + 0.3576 * g + 0.1805 * b) / 0.95047, y = 0.2126 * r + 0.7152 * g + 0.0722 * b, z = (0.0193 * r + 0.1192 * g + 0.9505 * b) / 1.08883;
  const f = (t) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
  return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
};
const dE = (a, b) => { const p = lab(a), q = lab(b); return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]); };
const hsl = (h, s, l) => { const a = s * Math.min(l, 1 - l); const f = (n) => { const k = (n + h / 30) % 12; return 255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))); }; return [f(0), f(8), f(4)]; };
const minDist = (cols) => { let m = 1e9; for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) m = Math.min(m, dE(cols[i], cols[j]), dE(sim(cols[i], M.deut), sim(cols[j], M.deut)), dE(sim(cols[i], M.prot), sim(cols[j], M.prot))); return m; };
let seed = 12345; const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const R = (a, b) => a + (b - a) * rnd();
const ranges = { input: [178, 200, 0.6, 1], logic: [248, 278, 0.45, 0.9], math: [80, 145, 0.45, 0.9], object: [18, 40, 0.75, 1], action: [350, 368, 0.55, 0.9], brain: [24, 52, 0.25, 0.6], output: [205, 225, 0.06, 0.25] };
function search(name, ok, lRange, n) {
  let best = null, bestD = -1;
  for (let i = 0; i < n; i++) {
    const cols = Object.values(ranges).map(([h0, h1, s0, s1]) => hsl(R(h0, h1) % 360, R(s0, s1), R(lRange[0], lRange[1])));
    if (!cols.every(ok)) continue;
    const d = minDist(cols);
    if (d > bestD) { bestD = d; best = cols; }
  }
  console.log(name, 'min dE (normal/deut/prot) =', bestD.toFixed(1));
  Object.keys(ranges).forEach((k, i) => console.log('  ', k, toHex(best[i])));
  return best;
}
const WHITE = [255, 255, 255];
if (process.argv[2] === 'mid') search('MID (tile on white >= 3)', (c) => ratio(c, WHITE) >= 3.1, [0.3, 0.6], 150000);
if (process.argv[2] === 'search') {
  search('DEEP (white text on colour >= 4.5)', (c) => ratio(c, WHITE) >= 4.6, [0.2, 0.5], 400000);
  search('BRIGHT (on dark card #182030 >= 4.5)', (c) => ratio(c, hex('#182030')) >= 5, [0.5, 0.82], 400000);
}
const report = (label, set) => {
  const cols = Object.values(set).map(hex); const keys = Object.keys(set);
  const pair = (f) => { let m = 1e9, w = ''; for (let i = 0; i < cols.length; i++) for (let j = i + 1; j < cols.length; j++) { const d = dE(f(cols[i]), f(cols[j])); if (d < m) { m = d; w = keys[i] + '/' + keys[j]; } } return m.toFixed(1) + ' (' + w + ')'; };
  console.log(label, '| normal', pair((c) => c), '| deut', pair((c) => sim(c, M.deut)), '| prot', pair((c) => sim(c, M.prot)));
};
report('TODAY cats', { input: '#4cc9d9', logic: '#a894ff', math: '#a9d861', object: '#f0965a', action: '#ff7f7f', brain: '#d3b48a', output: '#b9c4d0' });
report('TODAY ports', { bool: '#f7d046', num: '#5aa9ff', obj: '#f27ad0' });
const pairs = [
  ['text #e7e9ec on panel #1c1f25', '#e7e9ec', '#1c1f25'], ['text2 #aab2bd on panel', '#aab2bd', '#1c1f25'], ['text3 #8f98a4 on panel (palette descriptions 11.5px)', '#8f98a4', '#1c1f25'],
  ['text3 on bg #121418', '#8f98a4', '#121418'], ['disabled #626a75 on chrome #17191e', '#626a75', '#17191e'], ['tab text2 on chrome', '#aab2bd', '#17191e'],
  ['accent-ink on accent', '#05140d', '#3ecf8e'], ['accent text on chrome (Dang chay)', '#3ecf8e', '#17191e'], ['card port label on card #222832', '#e7e9ec', '#222832'],
  ['header ink #10151b on action #ff7f7f', '#10151b', '#ff7f7f'], ['header ink on logic #a894ff', '#10151b', '#a894ff'], ['warn #f2b33d on card', '#f2b33d', '#222832'],
  ['danger #ff7b7b on panel', '#ff7b7b', '#1c1f25'], ['line2 #3a404a input border on bg #121418 (non-text 3:1)', '#3a404a', '#121418'], ['line #2c3139 on panel (non-text)', '#2c3139', '#1c1f25'],
  ['switch off track #2b3038 on panel (non-text)', '#2b3038', '#1c1f25'], ['help "?" text3 on raise', '#8f98a4', '#2b3038'],
];
for (const [n, a, b] of pairs) console.log(ratio(hex(a), hex(b)).toFixed(2).padStart(6), n);
