
/* ================= app: camera, controls, loop ================= */
const qs = new URLSearchParams(location.search);
if (qs.has('bare')) document.body.classList.add('bare');
const stageEl = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setClearColor(0x000000, 0); renderer.localClippingEnabled = true;
stageEl.prepend(renderer.domElement);
const persp = new THREE.PerspectiveCamera(26, 1, 1, 150);

const rt = buildScene();
const P = GVSim.defaults();
for (const k of Object.keys(P)) if (qs.has(k)) P[k] = isNaN(+qs.get(k)) ? qs.get(k) : +qs.get(k);
const S = { play: qs.get('t') === null, floor: qs.get('floor') || 'plank', scale: +(qs.get('scale') || 1.3) };
let sim = GVSim.makeSim(P, null), acc = 0;

function placeCamera() {
  const w = stageEl.clientWidth || 1, h = stageEl.clientHeight || 1, aspect = w / h;
  persp.aspect = aspect; persp.fov = rt.fov; persp.updateProjectionMatrix();
  const viewH = rt.viewH * Math.max(1, 1.78 / aspect), tz = -0.1;
  const dist = (viewH / 2) / Math.tan(THREE.MathUtils.degToRad(rt.fov / 2));
  persp.position.set(Math.sin(rt.yaw) * Math.cos(rt.pitch) * dist, Math.sin(rt.pitch) * dist, tz + Math.cos(rt.yaw) * Math.cos(rt.pitch) * dist);
  persp.lookAt(0, 0, tz); persp.updateMatrixWorld();
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(persp.quaternion).multiplyScalar(rt.shift * viewH); persp.position.sub(up); persp.updateMatrixWorld();
  return persp;
}
function resize() { renderer.setSize(Math.max(1, stageEl.clientWidth), Math.max(1, stageEl.clientHeight), false); }
new ResizeObserver(resize).observe(stageEl);
for (const a of rt.actors) a.setScale(S.scale);

/* ---------- UI ---------- */
const NAMES = { correct: 'Lời giải đúng (tính giờ)', distance: 'Cách cũ (đo khoảng cách)', rash: 'Chạy liều (không tính)', none: 'Không nối gì' };
const SL = [['pLen', 'oLen', 'patrolLen', 1], ['pGs', 'oGs', 'guardSpeed', 1], ['pRange', 'oRange', 'range', 1], ['pAngle', 'oAngle', 'angle', 0], ['pHs', 'oHs', 'heroSpeed', 1]];
function syncUI() {
  for (const [i, o, k, d] of SL) { $(i).value = P[k]; $(o).textContent = (+P[k]).toFixed(d); }
  document.querySelectorAll('#presets button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.preset === P.preset)));
  $('selFloor').value = S.floor;
}
function rebuild() {
  rt.buildCrates(GVSim.crateList(P)); rt.buildGuardLane(P.patrolLen); rt.setFloor(S.floor);
  sim = GVSim.makeSim(P, null); rt.buildRoute(sim.route); acc = 0; $('res').hidden = true; refresh(0);
}
function start(mode) { sim.reset(mode); acc = 0; S.play = true; refresh(0); }
for (const [i, , k] of SL) $(i).addEventListener('input', (e) => { P[k] = +e.target.value; syncUI(); rebuild(); });
document.querySelectorAll('#presets button').forEach((b) => b.addEventListener('click', () => { P.preset = b.dataset.preset; syncUI(); rebuild(); }));
$('selFloor').addEventListener('change', (e) => { S.floor = e.target.value; rt.setFloor(S.floor); });
$('cLane').addEventListener('change', (e) => { rt.lanes.visible = e.target.checked; });
$('bCorrect').addEventListener('click', () => start('correct'));
$('bOld').addEventListener('click', () => start('distance'));
$('bRash').addEventListener('click', () => start('rash'));
$('bNone').addEventListener('click', () => start('none'));
$('bReset').addEventListener('click', () => { S.play = true; rebuild(); });
$('bCheck').addEventListener('click', () => {
  const t = $('res'); t.hidden = false; t.innerHTML = '<tr><td>Đang tính…</td></tr>';
  setTimeout(() => {
    const r = GVSim.runAll(P);
    t.innerHTML = '<tr><th>Cách</th><th>Kết quả</th><th>Lúc</th></tr>' + Object.keys(NAMES).map((k) => {
      const x = r[k], good = (k === 'correct') === x.win;
      return `<tr><td>${NAMES[k]}</td><td class="${x.win ? 'w' : 'l'}">${x.win ? 'Thắng' : 'Thua'}${good ? '' : ' (sai ý!)'}</td><td>${x.t}s</td></tr>`;
    }).join('');
  }, 30);
});
$('bCopy').addEventListener('click', async () => {
  const crates = GVSim.crateList(P);
  const data = { ...P, crateCoords: crates, crateSize: GVSim.CRATE_SIZE, coverSpots: GVSim.coverSpots(crates), start: GVSim.HERO_START, goal: GVSim.GOAL, guardLane: { x: GVSim.GUARD_X, zFrom: GVSim.LANE_Z0, zTo: +(GVSim.LANE_Z0 + P.patrolLen).toFixed(2) }, safetyMarginSec: GVSim.MARGIN, distanceAnswerThreshold: GVSim.DIST_THRESHOLD, timeLimit: GVSim.TIME_LIMIT, floor: S.floor, results: GVSim.runAll(P) };
  const text = JSON.stringify(data, null, 2), ta = $('copyOut'), st = $('status');
  try { if (!navigator.clipboard) throw new Error('no clipboard'); await navigator.clipboard.writeText(text); ta.style.display = 'none'; st.textContent = 'Đã sao chép thông số. Dán gửi lại nhé!'; }
  catch (e) { ta.value = text; ta.style.display = 'block'; ta.focus(); ta.select(); st.textContent = 'Không tự sao chép được. Hãy bôi đen khung dưới rồi copy (Ctrl+C).'; }
});

/* ---------- HUD ---------- */
const tmpV = new THREE.Vector3();
function refresh(dt) {
  rt.sync(sim, dt);
  const chip = $('chip'), h = sim.h, still = h.v < 0.3;
  if (sim.over && !sim.over.win) { chip.dataset.k = 'danger'; chip.textContent = sim.over.reason; }
  else if (sim.over) { chip.dataset.k = 'hidden'; chip.textContent = 'Mèo nhỏ đã tới ô xanh'; }
  else if (!sim.mode) { chip.dataset.k = 'safe'; chip.textContent = 'Bấm một nút “Chạy” bên phải để bắt đầu'; }
  else if (still) { chip.dataset.k = 'hidden'; chip.textContent = 'Mèo đang nấp sau thùng, lính gác không thấy'; }
  else { chip.dataset.k = 'safe'; chip.textContent = 'Mèo đang chạy tới chỗ nấp kế'; }
  $('timer').textContent = (sim.mode ? NAMES[sim.mode] + ' · ' : 'Chưa chạy · ') + sim.t.toFixed(1) + 's / ' + GVSim.TIME_LIMIT + 's';
  const b = $('banner');
  if (sim.over) { b.className = 'banner on ' + (sim.over.win ? 'win' : 'lose'); $('bTitle').textContent = sim.over.win ? 'THẮNG!' : 'THUA!'; $('bWhy').textContent = sim.over.reason; }
  else b.className = 'banner';
  // the cat's reasoning, live above its head
  const th = $('think'), inf = sim.info;
  if (inf && sim.mode && !sim.over) {
    const calm = still ? '💭 ' : '';
    th.dataset.k = sim.mode === 'none' ? 'off' : inf.go ? 'go' : 'wait';
    th.textContent = sim.mode === 'none' ? calm + inf.text : calm + inf.text + (inf.go ? '  ✔ CHẠY' : '  ✘ TRỐN');
    tmpV.set(h.x, 2.7, h.z).project(placeCamera());
    th.style.display = 'block'; th.style.left = ((tmpV.x * 0.5 + 0.5) * stageEl.clientWidth) + 'px'; th.style.top = ((-tmpV.y * 0.5 + 0.5) * stageEl.clientHeight) + 'px';
  } else th.style.display = 'none';
}
function renderNow() { renderer.render(rt.three, placeCamera()); }
function updateCaption() { $('caption').textContent = `Khung ${stageEl.clientWidth}×${stageEl.clientHeight}px · quạt vàng = tầm nhìn của lính gác (thùng chặn quạt) · vòng cam = chỗ nấp · bong bóng trên đầu mèo = mèo đang tính giờ.`; }

let last = performance.now(), frameN = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  const running = S.play && !sim.over;
  if (running) { acc += dt; let n = 0; while (acc >= GVSim.DT && n++ < 6) { sim.step(); acc -= GVSim.DT; } if (n >= 6) acc = 0; }
  refresh(running ? dt : 0.0001);
  renderNow();
  if (++frameN % 20 === 1) updateCaption();
  document.body.dataset.ready = '1';
  requestAnimationFrame(loop);
}

/* ---------- boot ---------- */
syncUI(); resize(); rebuild();
const startMode = qs.get('mode');
if (startMode) sim.reset(startMode);
window.__gv = {
  P, get sim() { return sim; }, rt, GVSim, rebuild, refresh, renderNow,
  /* deterministic jump: run the sim for t seconds in the given mode, then freeze */
  seek(t, mode) { S.play = false; sim.reset(mode === undefined ? sim.mode : mode); for (let i = 0, n = Math.round(t * 60); i < n && !sim.over; i++) sim.step(); refresh(0.016); renderNow(); },
  /* run until pred(sim) is true (or maxT seconds), then freeze; returns the sim time */
  seekUntil(mode, pred, maxT = 40) { S.play = false; sim.reset(mode); for (let i = 0; i < maxT * 60 && !sim.over; i++) { sim.step(); if (pred(sim)) break; } refresh(0.016); renderNow(); return +sim.t.toFixed(2); },
};
if (qs.get('t') !== null) window.__gv.seek(+qs.get('t'), startMode || null);
requestAnimationFrame(loop);
</script>
</body>
</html>
