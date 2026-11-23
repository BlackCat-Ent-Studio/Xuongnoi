
/* ================= board, checker UI, layouts, controls, main loop ================= */
const NS = 'http://www.w3.org/2000/svg';
const screenEl = $('screen'), phoneEl = $('phone'), boardEl = $('board'), boardBox = $('boardbox'), wiresEl = $('wires');
const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
let sim = newSim();

/* ---------- cards ---------- */
const portEl = {}, nodeEl = {};
for (const n of CARDS) {
  const el = document.createElement('div');
  el.className = 'node' + (n.locked ? ' locked' : ''); el.style.left = n.x + 'px'; el.style.top = n.y + 'px';
  el.style.setProperty('--cat', `var(--cat-${n.cat})`);
  el.innerHTML = `<span class="badge">!</span><div class="head"><span class="ico"><i></i></span><div><div class="title">${n.title}</div><div class="sub">${n.sub}</div></div></div>`;
  const ports = document.createElement('div'); ports.className = 'ports';
  for (const [dir, list] of [['in', n.ins], ['out', n.outs]]) for (const [pid, label, t] of list) {
    const p = document.createElement('div'); p.className = `port ${dir} t-${t}`;
    p.innerHTML = `<span class="pin"></span><span>${label}</span><span class="val"></span>`;
    ports.append(p); portEl[`${n.id}.${pid}.${dir}`] = p;
  }
  el.append(ports); boardEl.append(el); nodeEl[n.id] = el;
}
const COLORS = { bool: 'var(--bool)', num: 'var(--num)', obj: 'var(--obj)' };
const wires = WIRE_DEFS.map((d) => {
  const g = document.createElementNS(NS, 'g');
  const mk = (cls) => { const p = document.createElementNS(NS, 'path'); p.setAttribute('class', cls); if (cls !== 'w-flash' && cls !== 'w-cut') p.style.stroke = COLORS[d.t]; g.append(p); return p; };
  const w = { ...d, g, cut: mk('w-cut'), base: mk('w-base'), glow: mk('w-glow'), core: mk('w-core'), flash: mk('w-flash'), mark: document.createElementNS(NS, 'text'), sparks: [], len: 0, seen: 0 };
  w.mark.setAttribute('class', 'cutmark'); w.mark.setAttribute('text-anchor', 'middle'); w.mark.textContent = '✕'; g.append(w.mark);
  wiresEl.append(g); return w;
});
const wireById = Object.fromEntries(wires.map((w) => [w.id, w]));
let boardScale = 1;
function pinCenter(el) {
  const r = el.querySelector('.pin').getBoundingClientRect(), b = boardEl.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - b.left) / boardScale, y: (r.top + r.height / 2 - b.top) / boardScale };
}
function layoutWires() {
  const b = boardEl.getBoundingClientRect(); boardScale = b.width / boardEl.offsetWidth || 1;
  for (const w of wires) {
    const a = pinCenter(portEl[`${w.from}.${w.fp}.out`]), c = pinCenter(portEl[`${w.to}.${w.tp}.in`]);
    const dx = Math.max(30, Math.abs(c.x - a.x) * 0.5);
    const d = `M${a.x},${a.y} C${a.x + dx},${a.y} ${c.x - dx},${c.y} ${c.x},${c.y}`;
    for (const p of [w.cut, w.base, w.glow, w.core, w.flash]) p.setAttribute('d', d);
    w.len = w.base.getTotalLength();
    const mid = w.base.getPointAtLength(w.len / 2); w.mark.setAttribute('x', mid.x); w.mark.setAttribute('y', mid.y + 5);
  }
}
function fitBoard() {
  const v2 = UI.checker === 'v2';
  const panelW = v2 && !(UI.layout === 'b' && UI.pip === 'full') ? (UI.panelOpen ? 262 : 34) : 0;
  boardBox.style.right = panelW + 'px';
  const bw = $('body').clientWidth, bh = $('body').clientHeight, pw = UI.frame === 'desktop' ? 330 : 230, pr = UI.frame === 'desktop' ? 14 : 10;
  const kk = pw / bw;
  screenEl.style.setProperty('--k', kk); screenEl.style.setProperty('--ty', (bh - pr - bh * kk) + 'px');
  screenEl.style.setProperty('--txm', (bw - pr - pw) + 'px'); screenEl.style.setProperty('--tx', (bw - pr - pw - panelW) + 'px');
  const w = boardBox.clientWidth || 1, h = boardBox.clientHeight || 1;
  const k = Math.min(w / 780, h / 320, 1.6);
  boardEl.style.transform = `translate(${Math.max(0, (w - 780 * k) / 2)}px, ${Math.max(0, (h - 320 * k) / 2)}px) scale(${k})`;
  layoutWires();
}

/* ---------- live board update ---------- */
function setPort(node, pid, on, text, off) {
  const el = portEl[`${node}.${pid}.in`] || portEl[`${node}.${pid}.out`]; if (!el) return;
  if (el.classList.contains('on') !== on) el.classList.toggle('on', on);
  const v = el.querySelector('.val');
  if (v.textContent !== text) v.textContent = text;
  if (v.classList.contains('off') !== !!off) v.classList.toggle('off', !!off);
}
const YES = 'Đúng', NO = 'Sai';
const boolT = (b) => (b ? YES : NO);
function spark(w, color) {
  if (reduceMotion) return;
  const c = document.createElementNS(NS, 'circle'); c.setAttribute('r', 5); c.setAttribute('class', 'spark');
  c.style.fill = color; c.style.color = color; w.g.append(c); w.sparks.push({ el: c, t: 0, dur: 600 });
}
function updateBoard(s, dt) {
  const live = UI.running && UI.checker !== 'off';
  boardEl.classList.toggle('live', live);
  const w1 = wireOn('w1'), w2 = wireOn('w2'), w3 = wireOn('w3'), w4 = wireOn('w4');
  const pulse = (s.T - s.beganAt) < 0.45 && UI.running;       // "Vừa chạm" lasts one tick; hold it visible for a moment
  setPort('bot', 'self', true, 'có'); setPort('bot', 'x', UI.running, s.x.toFixed(1), !UI.running);
  setPort('btn', 'self', true, 'có'); setPort('btn', 'down', s.btnDown, boolT(s.btnDown), !s.btnDown);
  setPort('touch', 'a', w1, w1 ? 'có' : 'trống', !w1); setPort('touch', 'b', w2, w2 ? 'có' : 'trống', !w2);
  setPort('touch', 'touching', s.touching, boolT(s.touching), !s.touching); setPort('touch', 'began', pulse, boolT(pulse), !pulse);
  setPort('latch', 'set', pulse && w3, w3 ? boolT(pulse) : 'trống', !(pulse && w3)); setPort('latch', 'reset', false, 'trống', true);
  setPort('latch', 'on', s.latch, boolT(s.latch), !s.latch);
  setPort('door', 'open', s.doorCmd, w4 ? boolT(s.doorCmd) : 'trống', !s.doorCmd); setPort('door', 'amount', s.door > 0.02, s.door.toFixed(2), s.door <= 0.02);
  const hot = { bot: s.moving, btn: s.btnDown, touch: s.touching, latch: s.latch, door: s.door > 0.02 && s.door < 0.98 };
  const ev = UI.checker !== 'off' ? evalChecker(s) : null;
  for (const id of Object.keys(nodeEl)) {
    nodeEl[id].classList.toggle('hot', live && !!hot[id]);
    nodeEl[id].classList.toggle('culprit', UI.checker === 'v1' && !!ev && ev.culprit === id);
  }
  // wires: dim line, steady glow while the signal is true, white flash + spark the moment it fires
  const steady = { w1: s.touching, w2: s.touching, w3: false, w4: s.doorCmd };
  for (const w of wires) {
    const present = wireOn(w.id);
    w.cut.style.display = present ? 'none' : ''; w.mark.style.display = present ? 'none' : '';
    for (const p of [w.base, w.glow, w.core, w.flash]) p.style.display = present ? '' : 'none';
    const st = live && present && steady[w.id];
    w.base.style.opacity = present ? (st ? '.9' : w.t === 'obj' ? '.4' : '.3') : '0';
    w.glow.style.opacity = st ? '.5' : '0'; w.core.style.opacity = st ? '1' : '0';
    const f = s.fired[w.id], age = f === undefined ? 9 : s.T - f;
    const flashing = live && present && age < 0.7 && UI.running;
    w.flash.style.opacity = flashing ? String(1 - age / 0.7) : '0';
    if (live && present && f !== undefined && f !== w.seen) { w.seen = f; spark(w, COLORS[w.t]); }
    if (!UI.running) w.seen = 0;
    w.sparks = w.sparks.filter((sp) => {
      sp.t += dt * 1000; const k = Math.min(1, sp.t / sp.dur);
      const pt = w.base.getPointAtLength(k * w.len); sp.el.setAttribute('cx', pt.x); sp.el.setAttribute('cy', pt.y);
      sp.el.style.opacity = String(k > 0.85 ? (1 - k) / 0.15 : 1);
      if (k >= 1 || !UI.running) { sp.el.remove(); return false; } return true;
    });
  }
  updateChecker(ev, s);
}

/* ---------- checker UI: V1 cat bubble, V2 checklist ---------- */
const bubble = $('bubble'), bubbleTxt = $('bubbleTxt');
const rowEls = CHECK_ROWS.map((r) => {
  const el = document.createElement('div'); el.className = 'crow pending';
  el.innerHTML = `<span class="mk">…</span><div><div class="l1"><span class="nm">${r.name}</span><span class="st"></span><span class="tm"></span></div><div class="ex">Mong đợi: ${r.expect}</div><div class="why"></div></div>`;
  $('chkRows').append(el); return { el, mk: el.querySelector('.mk'), st: el.querySelector('.st'), tm: el.querySelector('.tm'), why: el.querySelector('.why') };
});
const MARK = { ok: '✓', bad: '✗', pending: '…', blocked: '–' };
const txt = (el, t) => { if (el.textContent !== t) el.textContent = t; };
function updateChecker(ev, s) {
  // V1: Mèo Mun bubble under the culprit card
  const showBubble = UI.checker === 'v1' && ev && ev.culprit;
  if (showBubble) {
    const c = CARDS.find((n) => n.id === ev.culprit), el = nodeEl[c.id];
    const left = clamp(c.x - 20, 8, 780 - 318 - 8);
    bubble.style.left = left + 'px'; bubble.style.top = (c.y + el.offsetHeight + 16) + 'px'; bubble.style.setProperty('--tail', clamp(c.x + 78 - left - 8, 14, 230) + 'px');
    txt(bubbleTxt, ev.rows.find((r) => r.id === ev.culprit).whyLong);
  }
  bubble.classList.toggle('on', !!showBubble); $('task').classList.toggle('hide', !!showBubble);
  // V2: one row per piece
  const inStage = UI.layout === 'b' && UI.pip === 'full' && UI.running;
  const sb = $('sbub'); sb.classList.toggle('on', !!(showBubble && inStage));
  if (showBubble && inStage && sb.dataset.m !== ev.culprit) { sb.dataset.m = ev.culprit; sb.innerHTML = bubble.querySelector('svg').outerHTML + '<div><span class="who">Mèo Mun kiểm tra</span>' + ev.rows.find((r) => r.id === ev.culprit).whyLong + '</div>'; }
  if (!showBubble) sb.dataset.m = '';
  $('schk').classList.toggle('on', UI.checker === 'v2' && inStage);
  if (UI.checker === 'v2' && inStage) {
    const sk = $('schk'), key = ev.rows.map((r) => r.verdict + r.state).join('|');
    if (sk.dataset.k !== key) { sk.dataset.k = key; sk.innerHTML = ev.rows.map((r) => `<div class="sc ${r.verdict}"><b>${MARK[r.verdict]}</b>${r.name}<i>${r.state}</i></div>`).join('') + (ev.culprit ? `<div class="sr">${ev.rows.find((r) => r.id === ev.culprit).why}</div>` : ''); }
  }
  if (UI.checker !== 'v2') return;
  const idle = !UI.running;
  ev.rows.forEach((r, i) => {
    const o = rowEls[i], v = idle ? 'pending' : r.verdict;
    if (o.el.className !== `crow ${v}`) o.el.className = `crow ${v}`;
    txt(o.mk, MARK[v]); txt(o.st, idle ? '—' : r.state); txt(o.tm, idle ? '' : r.time); txt(o.why, v === 'bad' ? r.why : '');
  });
  txt($('chkSum'), idle ? '' : `${ev.okCount}/4 ✓ · ${s.T.toFixed(1)}s`);
  const foot = $('chkFoot');
  const msg = !UI.running ? 'Bấm CHẠY để kiểm tra từng mảnh.' : s.failed ? `Thua: lỗi nằm ở “${ev.rows.find((r) => r.id === ev.culprit)?.name}”.` : s.won ? 'Tất cả đúng như mong đợi.' : 'Đang chạy… mỗi dòng sẽ ✓ khi mảnh làm đúng việc.';
  if (foot.dataset.m !== msg) { foot.dataset.m = msg; foot.textContent = msg; }
}

/* ---------- banner + zoom chip ---------- */
const banner = $('banner'), zoomChip = $('zoomchip');
let bannerKey = '';
function clearBanner() { bannerKey = ''; banner.classList.remove('on', 'lose'); }
function updateBanner(s) {
  const key = !UI.running ? '' : s.won ? 'win' : s.failed ? 'lose' : '';
  if (key === bannerKey) return; bannerKey = key;
  banner.classList.toggle('on', !!key); banner.classList.toggle('lose', key === 'lose');
  banner.innerHTML = key === 'win' ? 'Thắng rồi! ★★★<small>Bot đã tới cờ</small>' : key === 'lose' ? 'Thua: bot kẹt trước cửa<small>' + (UI.checker === 'off' ? 'Bật bộ kiểm tra để biết vì sao' : 'Xem bộ kiểm tra để biết vì sao') + '</small>' : '';
}

/* ---------- layout / view state ---------- */
let failTimer = 0;
function syncUI() {
  const v2 = UI.checker === 'v2';
  Object.assign(screenEl.dataset, { frame: UI.frame, layout: UI.layout, view: UI.view, pip: UI.pip, v2: v2 ? 'on' : 'off' });
  phoneEl.dataset.frame = UI.frame;
  const b = UI.layout === 'b';
  $('vtog').classList.toggle('hide', b);
  $('pipnote').classList.toggle('hide', !b); $('pipnote').textContent = UI.pip === 'small' ? 'Sân ở góc: chạm để phóng to' : 'Bảng ở góc: chạm để về bảng';
  $('tbDots').classList.toggle('hide', UI.layout !== 'c');
  $('tbDots').querySelectorAll('i').forEach((d, i) => d.classList.toggle('on', (i === 0) === (UI.view === 'board')));
  $('vtog').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === UI.view)));
  $('shrink').classList.toggle('hide', !(b && UI.pip === 'full'));
  const run = $('run'); run.innerHTML = UI.running ? 'DỪNG &#9632;' : 'CHẠY &#9654;'; run.classList.toggle('stop', UI.running);
  $('chk').classList.toggle('closed', !UI.panelOpen); $('chkTgl').innerHTML = UI.panelOpen ? '&#9654;' : '&#9664;';
  document.querySelectorAll('#ctrl .seg').forEach((seg) => seg.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(UI[seg.dataset.key] === x.dataset.v))));
  $('help').innerHTML = {
    a: '<b>Bố cục A:</b> cả màn hình là một việc. Bấm nút lớn <b>Nối mảnh ⇄ Xem sân</b> để đổi. Bấm <b>CHẠY</b> tự nhảy sang sân; bấm <b>DỪNG</b> (hoặc khi thua) quay về bảng.',
    b: '<b>Bố cục B:</b> bảng chiếm cả màn hình, sân là cửa sổ nhỏ ở góc (tự đi theo bot). <b>Chạm cửa sổ</b> để phóng to cả màn hình; ở chế độ lớn chạm một lần (hoặc nút ⤡) để thu nhỏ lại.',
    c: '<b>Bố cục C:</b> như A nhưng <b>vuốt ngang</b> để qua lại: vuốt sang trái trên bảng để xem sân; trên sân vuốt từ mép trái (dải sáng) sang phải để về bảng. Hai chấm trên thanh trên cho biết đang ở màn nào.',
  }[UI.layout] + ' Trên sân: <b>kéo</b> để di chuyển, <b>cuộn chuột / ctrl+cuộn / chụm hai ngón</b> để thu phóng, <b>chạm đôi</b> hoặc nút <b>⟳</b> để về vừa khung.';
  requestAnimationFrame(() => { fitBoard(); fitPhone(); });
}
function setView(v) { if (UI.view === v) return; UI.view = v; syncUI(); }
function setPip(p) { if (UI.pip === p) return; UI.pip = p; syncUI(); }
function run() {
  clearTimeout(failTimer); sim = newSim(); UI.running = true; clearBanner();
  if (UI.layout !== 'b') setView('stage'); else setPip('full');
  UI.panelOpen = true; syncUI();
}
function stop() {
  clearTimeout(failTimer); UI.running = false; sim = newSim(); clearBanner();
  UI.view = 'board'; UI.pip = 'small'; syncUI();
}
function onFail() {
  UI.panelOpen = true;
  if (UI.layout === 'b') { syncUI(); return; }          // B: the stage shows the cat / checklist itself
  failTimer = setTimeout(() => {          // bring the player to where the explanation lives
    if (!UI.running || !sim.failed) return;
    UI.view = 'board';
    syncUI();
  }, 1500);
  syncUI();
}
$('run').addEventListener('click', () => (UI.running ? stop() : run()));
$('vtog').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) setView(b.dataset.v); });
$('boardView').addEventListener('click', () => { if (UI.layout === 'b' && UI.pip === 'full') setPip('small'); });
$('shrink').addEventListener('click', () => setPip('small'));
$('zIn').addEventListener('click', () => { const r = stageView.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1.4); });
$('zOut').addEventListener('click', () => { const r = stageView.getBoundingClientRect(); zoomAt(r.left + r.width / 2, r.top + r.height / 2, 1 / 1.4); });
$('zReset').addEventListener('click', () => resetCamera(true));
$('chkTgl').addEventListener('click', () => { UI.panelOpen = !UI.panelOpen; syncUI(); });
$('ctrl').addEventListener('click', (e) => {
  const b = e.target.closest('.seg button'); if (!b) return;
  const key = b.parentElement.dataset.key;
  if (key === 'frame' || key === 'layout' || key === 'checker') {
    if (key === 'layout') { UI.view = 'board'; UI.pip = 'small'; if (UI.running) stop(); }
    UI[key] = b.dataset.v; resetCamera(false); syncUI();
  }
});
const applyCut = () => { cfg.cut = $('cut').checked; cfg.cutId = $('cutWhich').value; if (UI.running) stop(); sim = newSim(); fitBoard(); };
$('cut').addEventListener('change', applyCut); $('cutWhich').addEventListener('change', applyCut);

/* edge swipe (layout C): swipe left on the board -> stage; swipe right from the left strip on the stage -> board */
let swipe = null;
$('body').addEventListener('pointerdown', (e) => {
  if (UI.layout !== 'c' || e.target.closest('button, .chk')) return;
  const onEdge = e.target === $('edge');
  if ((UI.view === 'board' && !stageView.contains(e.target)) || (UI.view === 'stage' && onEdge)) swipe = { x: e.clientX, y: e.clientY, id: e.pointerId };
});
addEventListener('pointerup', (e) => {
  if (!swipe || e.pointerId !== swipe.id) return;
  const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y; swipe = null;
  if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
  if (UI.view === 'board' && dx < 0) setView('stage'); else if (UI.view === 'stage' && dx > 0) setView('board');
});
addEventListener('pointercancel', () => { swipe = null; });

/* ---------- scale the frame to the browser width ---------- */
function fitPhone() {
  const box = $('fitbox'), w = phoneEl.offsetWidth, h = phoneEl.offsetHeight;
  const avail = box.parentElement.clientWidth - 4;
  const k = Math.min(1, avail / w);
  phoneEl.style.transform = `scale(${k})`; box.style.width = w * k + 'px'; box.style.height = h * k + 'px';
  fitBoard();
}
addEventListener('resize', fitPhone);
new ResizeObserver(() => { const { w, h } = viewSize(); renderer.setSize(w, h, false); }).observe(stageView);

/* ---------- main loop ---------- */
let last = performance.now(), acc = 0, wasEnded = false;
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (UI.running && !(sim.won || sim.failed)) { acc += dt; while (acc >= 1 / 60) { stepSim(sim, 1 / 60); acc -= 1 / 60; } }
  else if (UI.running) stepSim(sim, dt);          // keep the door/robot animating after the end
  if (UI.running && sim.failed && !wasEnded) { wasEnded = true; onFail(); }
  if (!sim.failed) wasEnded = false;
  scene2.apply(sim, dt);
  const c = activeCam(dt); placeCamera(c); renderer.render(scene2.three, ortho);
  updateBoard(sim, dt); updateBanner(sim);
  const z = smallPip() ? PIP_ZOOM : cam.zoom; txt(zoomChip, z.toFixed(1) + '×');
  document.body.dataset.ready = '1';
  requestAnimationFrame(frame);
}

/* hooks for the test script */
window.__app = {
  UI, cam, cfg, get sim() { return sim; },
  seek(t) { clearTimeout(failTimer); sim = newSim(); UI.running = true; clearBanner(); runTo(sim, t); wasEnded = sim.failed; if (sim.failed) UI.panelOpen = true; syncUI(); },
  setView, setPip, resetCamera, syncUI,
};
syncUI(); fitPhone();
document.fonts?.ready.then(() => fitBoard());
requestAnimationFrame(frame);
