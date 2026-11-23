// Text patches applied to index.html after the first visual review (kept as a record of what changed).
import fs from 'node:fs';
const f = new URL('../index.html', import.meta.url); let s = fs.readFileSync(f, 'utf8'); let n = 0;
const rep = (a, b) => { if (!s.includes(a)) { console.log('MISSING:', a.slice(0, 70)); return; } s = s.replace(a, () => b); n++; };
rep(".seg button { height: calc(var(--ctl) - 6px);", ".seg button { height: calc(var(--ctl) - 2px);");
rep(".pin-ty { height: var(--ctl); padding: 0 8px;", ".pin-ty { height: var(--ctl); min-width: var(--ctl); padding: 0 8px;");
rep(".mb { width: 200px; white-space", ".mb { min-width: 190px; white-space");
rep(".mb-h { display: flex; align-items: center; gap: 8px; height: var(--hh);", ".mb-h { display: flex; align-items: center; gap: 8px; height: calc(var(--hh) - 6px);");
rep(".mb .nm i { display: flex; align-items: center; gap: 5px; }", ".mb .nm { flex: none; }\n.mb .nm b, .mb .nm i { overflow: visible; }\n.mb .nm i { display: flex; align-items: center; gap: 5px; }");
rep(".led { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--ledOff); }", ".led { width: 9px; height: 9px; border-radius: 50%; flex: none; background: var(--ledOff); box-shadow: 0 0 0 1px color-mix(in srgb, currentColor 55%, transparent); }");
rep("--ledOff: #3b5551;", "--ledOff: #0a2623;");
rep("--ledOff: #6b7688;", "--ledOff: #10151b;");
rep("border-radius: 4px 10px 10px 4px; width: 212px; }", "border-radius: 4px 10px 10px 4px; }");
rep(".crumb .sep { color: var(--text2); font-weight: 700; }", ".crumb .sep { color: var(--text2); font-weight: 700; font-size: 18px; line-height: 1; }");
rep("const v = p.kind === 'color' ? 'theo bản sao' : p.kind === 'sel' ? 'theo bản sao' : `${p.def}${p.unit ? ' ' + p.unit : ''}`;", "const v = p.kind === 'num' ? `<em class=\"val\">${p.def}${p.unit ? ' ' + p.unit : ''}</em>` : '';");
rep('<i class="dot"></i><em class="val">${v}</em><span class="pin-nm">${p.name}</span>', '<i class="dot"></i>${v}<span class="pin-nm">${p.name}</span>');
// Tay máy: the two links feed the joints, so no wire has to pass behind a card
rep(`card('k1', 'action', 'Khớp', 'Khớp vai', 2, [['goc', 'num', 'Góc']], [['tn', 'obj', 'Thanh nối']]),
      card('k2', 'action', 'Khớp', 'Khớp khuỷu', 2, [['goc', 'num', 'Góc']], [['tn', 'obj', 'Thanh nối']]),
      card('kep', 'action', 'Tay kẹp', 'Gripper', 2, [['kep', 'bool', 'Kẹp']], [['nha', 'bool', 'Đã nhả']]),
      card('tn1', 'object', 'Thanh nối', 'Cánh tay trên', 3, [['goc', 'obj', 'Gắn vào']], []),
      card('tn2', 'object', 'Thanh nối', 'Cẳng tay', 3, [['goc', 'obj', 'Gắn vào']], [])],`,
`card('tn1', 'object', 'Thanh nối', 'Cánh tay trên', 1, [], [['vat', 'obj', 'Thanh']]),
      card('tn2', 'object', 'Thanh nối', 'Cẳng tay', 1, [], [['vat', 'obj', 'Thanh']]),
      card('kep', 'action', 'Tay kẹp', 'Gripper', 2, [['kep', 'bool', 'Kẹp']], [['nha', 'bool', 'Đã nhả']]),
      card('k1', 'action', 'Khớp', 'Khớp vai', 2, [['goc', 'num', 'Góc'], ['tn', 'obj', 'Thanh']], []),
      card('k2', 'action', 'Khớp', 'Khớp khuỷu', 2, [['goc', 'num', 'Góc'], ['tn', 'obj', 'Thanh']], [])],`);
rep("[['vai', 'num', 'Góc vai'], ['khuyu', 'num', 'Góc khuỷu'], ['kep', 'bool', 'Kẹp']]", "[['kep', 'bool', 'Kẹp'], ['vai', 'num', 'Góc vai'], ['khuyu', 'num', 'Góc khuỷu']]");
rep("W('k1', 'tn', 'tn1', 'goc', 'obj'), W('k2', 'tn', 'tn2', 'goc', 'obj')", "W('tn1', 'vat', 'k1', 'tn', 'obj'), W('tn2', 'vat', 'k2', 'tn', 'obj')");
// factory: tighter columns so the board stays readable at 1366 px
rep("pins: [], gapx: 58,", "pins: [], gapx: 50, gy: 10,");
rep("[['tick', 'bool', 'Tới giờ']], { w: 168 })", "[['tick', 'bool', 'Tới giờ']], { w: 160 })");
rep("[1, 2, 3, 4, 5, 6, 7, 8].map((i) => ['x' + i, 'num', 'Lệnh xe ' + i])),", "[1, 2, 3, 4, 5, 6, 7, 8].map((i) => ['x' + i, 'num', 'Lệnh xe ' + i]), { w: 168 }),");
rep("gy = S.mode === 'hs' ? 14 : 10, gx", "gy = cur().gy || (S.mode === 'hs' ? 14 : 10), gx");
rep("padT = pieceView() ? 20 : 58,", "padT = pieceView() || S.bench || cur().lvl === 4 ? 20 : 58,");
rep("if (pieceView()) return '';\n  if (t.lvl === 4)", "if (pieceView() || S.bench) return '';\n  if (t.lvl === 4)");
// bench: only the circuit's own outputs follow the schematic; a new target loads a new parcel; no sample chips
rep("cur().pins.filter((p) => p.dir === 'out').forEach((p) => { o[p.id] = id === 'agv' ? B.tilt >= 1 : id === 'taymay' ? B.p >= 0.7 : p.ty === 'bool' ? B.p >= 1 : B.p >= 0.6 ? 3 : 0; });",
  "cur().pins.filter((p) => p.dir === 'out').forEach((p) => { o[p.id] = p.added ? (p.ty === 'bool' ? false : 0) : id === 'agv' ? B.tilt >= 1 : id === 'taymay' ? B.p >= 0.7 : p.ty === 'bool' ? B.p >= 1 : B.p >= 0.6 ? 3 : 0; });");
rep("t.pins.push(pin(id, d.d, 'Chân mới', 'bool'));", "t.pins.push({ ...pin(id, d.d, 'Chân mới', 'bool'), added: 1 });");
rep("const arr = v && Math.abs(tx - B.x) < 0.5;", "if (v !== B.tv) { B.tv = v; if (v) { B.load = 1; B.tilt = 0; } }\n    const arr = v && Math.abs(tx - B.x) < 0.5;");
rep("if (!arr && !B.load) { B.tilt = Math.max(0, B.tilt - dt * 3); }", "if (!v) B.tilt = Math.max(0, B.tilt - dt * 3);");
rep("if (!v && Math.abs(B.x - 24) < 0.5) { B.load = 1; B.tilt = 0; }", "");
rep("$$('.world [data-w]').forEach((g) => g.classList.toggle('live', isLive(ws[+g.dataset.w])));", "$$('.world [data-w]').forEach((g) => g.classList.toggle('live', isLive(ws[+g.dataset.w]) && !(S.bench && g.classList.contains('chip'))));");
fs.writeFileSync(f, s); console.log('applied', n);
