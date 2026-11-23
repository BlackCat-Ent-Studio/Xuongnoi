/* ================= app: renderer, camera, UI ================= */
const qs = new URLSearchParams(location.search);
if (qs.has('bare')) document.body.classList.add('bare');
const stageEl = $('stage');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.localClippingEnabled = true;
stageEl.prepend(renderer.domElement);
const persp = new THREE.PerspectiveCamera(28, 1, 0.1, 200);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

const FRAMES = { stage: 'Sân khấu 370×390', phone: 'Cả màn 844×390', desktop: 'Máy tính' };
const S = {
  scene: qs.get('scene') || 'l2', frame: qs.get('frame') || 'stage',
  charScale: +(qs.get('scale') || 1.6), zoom: +(qs.get('zoom') || 1),
  follow: qs.get('follow') !== '0', mask: qs.get('mask') === '1', floor: qs.get('floor') || 'plank',
  play: qs.get('t') === null, kitItem: qs.get('item') || 'all', bridge: qs.get('bridge') || 'auto',
};
const RT = {}; const triTable = {};
for (const def of SCENES) { RT[def.id] = Object.assign(def.build(), { label: def.label }); }
RT.l7.bridgeMode = S.bridge;
let cur = RT[S.scene] || RT.l2;
const tmpV = new THREE.Vector3();

function applyScale() { for (const rt of Object.values(RT)) for (const a of rt.actors) a.setScale(S.charScale); }

function placeCamera(rt, snap, dt = 0.016) {
  const w = stageEl.clientWidth || 1, h = stageEl.clientHeight || 1, aspect = w / h;
  if (rt.mode === 'kit') { persp.aspect = aspect; persp.fov = 30; persp.updateProjectionMatrix(); rt.frame(persp, aspect, S.zoom); return persp; }
  const viewH = rt.viewH / S.zoom;
  const halfW = viewH * aspect / 2 * (rt.mode === 'side' ? 1 : 1.25);
  const want = S.follow ? rt.focus().x : 0;
  const lo = rt.x0 + halfW, hi = rt.x1 - halfW;
  const tx = lo <= hi ? clamp(want, lo, hi) : (rt.x0 + rt.x1) / 2;
  rt.camX = (rt.camX === undefined || snap) ? tx : lerp(rt.camX, tx, 1 - Math.exp(-dt * 4));
  if (rt.mode === 'side') {
    ortho.left = -viewH * aspect / 2; ortho.right = viewH * aspect / 2; ortho.top = viewH / 2; ortho.bottom = -viewH / 2; ortho.updateProjectionMatrix();
    const ty = (rt.floorFrac - 0.5) * viewH / Math.cos(rt.pitch);
    ortho.position.set(rt.camX, ty + Math.sin(rt.pitch) * 40, Math.cos(rt.pitch) * 40); ortho.lookAt(rt.camX, ty, 0);
    ortho.updateMatrixWorld(); return ortho;
  }
  persp.aspect = aspect; persp.fov = rt.fov; persp.updateProjectionMatrix();
  const dist = (viewH / 2) / Math.tan(THREE.MathUtils.degToRad(rt.fov / 2));
  persp.position.set(rt.camX + Math.sin(rt.yaw) * Math.cos(rt.pitch) * dist, Math.sin(rt.pitch) * dist, 0.3 + Math.cos(rt.yaw) * Math.cos(rt.pitch) * dist);
  persp.lookAt(rt.camX, 0, 0.3); persp.updateMatrixWorld();
  tmpV.set(0, 1, 0).applyQuaternion(persp.quaternion).multiplyScalar(rt.shift * viewH); persp.position.sub(tmpV); persp.updateMatrixWorld();
  return persp;
}

function resize() {
  const w = Math.max(1, stageEl.clientWidth), h = Math.max(1, stageEl.clientHeight);
  renderer.setSize(w, h, false);
  placeCamera(cur, true);
}
new ResizeObserver(resize).observe(stageEl);

/* ---------- labels (prop kit) ---------- */
const labelsEl = $('labels'); let labelPool = [];
function updateLabels(cam) {
  const pts = cur.labelPoints ? cur.labelPoints() : [];
  while (labelPool.length < pts.length) { const s = document.createElement('span'); labelsEl.appendChild(s); labelPool.push(s); }
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  labelPool.forEach((el, i) => {
    const p = pts[i]; if (!p) { el.style.display = 'none'; return; }
    tmpV.copy(p.p).project(cam); el.style.display = ''; el.textContent = p.text;
    el.style.left = ((tmpV.x * 0.5 + 0.5) * w) + 'px'; el.style.top = ((-tmpV.y * 0.5 + 0.5) * h) + 'px';
  });
}

/* ---------- caption / measurement ---------- */
function measure(cam) {
  const a = cur.focus && cur.focus(); if (!a) return 0;
  const v0 = new THREE.Vector3(a.x, 0, a.z).project(cam), v1 = new THREE.Vector3(a.x, a.h * a.charScale, a.z).project(cam);
  return Math.abs(v1.y - v0.y) * stageEl.clientHeight / 2;
}
function updateCaption(cam) {
  const px = measure(cam), w = stageEl.clientWidth, h = stageEl.clientHeight;
  $('caption').textContent = cur.title + '  ·  Khung ' + w + '×' + h + 'px' + (px ? ' · nhân vật chính cao khoảng ' + Math.round(px) + 'px (' + Math.round(px / h * 100) + '% chiều cao khung).' : '.');
  if (cur.mode !== 'kit') $('hud').textContent = '△ ' + (renderer.info.render.triangles / 1000).toFixed(1) + 'k';
  else $('hud').textContent = '△ ' + (renderer.info.render.triangles / 1000).toFixed(1) + 'k';
}

/* ---------- UI ---------- */
function setPressed(container, attr, val) { container.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset[attr] === val))); }
const sceneBox = $('scenes');
for (const def of SCENES) {
  const b = document.createElement('button'); b.type = 'button'; b.dataset.scene = def.id; b.textContent = def.label; b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => setScene(def.id)); sceneBox.appendChild(b);
}
const kitBox = $('kitBtns');
[{ id: 'all', label: 'Tất cả' }, ...KIT].forEach((it) => {
  const b = document.createElement('button'); b.type = 'button'; b.dataset.item = it.id; b.textContent = it.label; b.setAttribute('aria-pressed', 'false');
  b.addEventListener('click', () => { S.kitItem = it.id; RT.kit.select(it.id, stageEl.clientWidth / stageEl.clientHeight); setPressed(kitBox, 'item', it.id); placeCamera(cur, true); });
  kitBox.appendChild(b);
});
function syncUI() {
  setPressed(sceneBox, 'scene', S.scene); setPressed($('frames'), 'frame', S.frame); setPressed(kitBox, 'item', S.kitItem); setPressed($('bridgeBtns'), 'bridge', S.bridge);
  stageEl.dataset.frame = S.frame;
  $('sScale').value = S.charScale; $('oScale').textContent = S.charScale.toFixed(2) + '×';
  $('sZoom').value = S.zoom; $('oZoom').textContent = S.zoom.toFixed(2) + '×';
  $('cFollow').checked = S.follow; $('cMask').checked = S.mask; $('mask').classList.toggle('on', S.mask); $('selFloor').value = S.floor;
  $('bPlay').setAttribute('aria-pressed', String(S.play)); $('bPlay').textContent = S.play ? 'Đang chạy' : 'Đang dừng';
  $('bridgeBox').hidden = S.scene !== 'l7'; $('kitBox').hidden = S.scene !== 'kit';
  $('floorRow').hidden = !(cur.mode === '3d');
}
function setScene(id) {
  if (!RT[id]) return;
  S.scene = id; cur = RT[id];
  if (cur.setFloor) cur.setFloor(S.floor);
  if (id === 'l7') cur.bridgeMode = S.bridge;
  cur.reset(); if (id === 'kit') cur.select(S.kitItem, stageEl.clientWidth / stageEl.clientHeight);
  for (let i = 0; i < 3; i++) cur.step(1 / 60);
  syncUI(); placeCamera(cur, true);
}
$('frames').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
  S.frame = b.dataset.frame; syncUI(); requestAnimationFrame(() => { if (cur.mode === 'kit') cur.select(S.kitItem, stageEl.clientWidth / stageEl.clientHeight); placeCamera(cur, true); });
}));
$('sScale').addEventListener('input', (e) => { S.charScale = +e.target.value; applyScale(); syncUI(); });
$('sZoom').addEventListener('input', (e) => { S.zoom = +e.target.value; syncUI(); });
$('cFollow').addEventListener('change', (e) => { S.follow = e.target.checked; });
$('cMask').addEventListener('change', (e) => { S.mask = e.target.checked; syncUI(); });
$('selFloor').addEventListener('change', (e) => { S.floor = e.target.value; for (const rt of Object.values(RT)) if (rt.setFloor) rt.setFloor(S.floor); });
$('bPlay').addEventListener('click', () => { S.play = !S.play; syncUI(); });
$('bRestart').addEventListener('click', () => { cur.reset(); placeCamera(cur, true); S.play = true; syncUI(); });
$('bridgeBtns').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => { S.bridge = b.dataset.bridge; RT.l7.bridgeMode = S.bridge; syncUI(); }));
$('bCopy').addEventListener('click', async () => {
  const w = stageEl.clientWidth, h = stageEl.clientHeight;
  const data = { scene: S.scene, frame: S.frame, frameSizePx: [w, h], charScale: +S.charScale.toFixed(2), zoom: +S.zoom.toFixed(2), followCamera: S.follow, floorStyle: S.floor, kitItem: S.kitItem, bridgeMode: S.bridge,
    charHeightPx: Math.round(measure(placeCamera(cur, false))) };
  const text = JSON.stringify(data, null, 2), ta = $('copyOut'), st = $('status');
  try { if (!navigator.clipboard) throw new Error('no clipboard'); await navigator.clipboard.writeText(text); ta.style.display = 'none'; st.textContent = 'Đã sao chép thông số. Dán gửi lại nhé!'; }
  catch (e) { ta.value = text; ta.style.display = 'block'; ta.focus(); ta.select(); st.textContent = 'Không tự sao chép được. Hãy bôi đen khung dưới rồi copy (Ctrl+C).'; }
});

/* ---------- loop ---------- */
function renderNow(dt = 0.016, snap = false) {
  const cam = placeCamera(cur, snap, dt);
  renderer.render(cur.three, cam);
  if (cur.mode === 'kit') updateLabels(cam); else labelPool.forEach((el) => { el.style.display = 'none'; });
  return cam;
}
let last = performance.now(), frameN = 0;
function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (S.play) cur.step(dt);
  const cam = renderNow(dt);
  if (++frameN % 15 === 1) updateCaption(cam);
  document.body.dataset.ready = '1';
  requestAnimationFrame(loop);
}

/* ---------- boot ---------- */
applyScale();
resize();
for (const def of SCENES) {      // triangle count per scene, measured after a few seconds of play
  const rt = RT[def.id]; cur = rt;
  if (rt.setFloor) rt.setFloor(S.floor);
  rt.reset(); if (rt.mode === 'kit') rt.select('all', 1.8);
  for (let i = 0; i < 150; i++) rt.step(1 / 60);
  renderNow(0.016, true); triTable[def.id] = renderer.info.render.triangles;
}
const li = $('triList');
for (const def of SCENES) { const e = document.createElement('li'); e.innerHTML = '<span></span><b></b>'; e.firstChild.textContent = def.label; e.lastChild.textContent = triTable[def.id].toLocaleString('vi-VN'); li.appendChild(e); }
cur = RT[S.scene] || RT.l2; S.scene = cur.id;
if (cur.setFloor) cur.setFloor(S.floor);
for (const rt of Object.values(RT)) if (rt.setFloor) rt.setFloor(S.floor);
cur.reset(); if (cur.mode === 'kit') cur.select(S.kitItem, stageEl.clientWidth / stageEl.clientHeight);
for (let i = 0; i < 3; i++) cur.step(1 / 60);
syncUI(); resize();
const triOf = (o) => { let n = 0; o.traverse((m) => { if (m.isMesh && m.visible && m.geometry) n += (m.geometry.index ? m.geometry.index.count : m.geometry.attributes.position.count) / 3; }); return Math.round(n); };
window.__stage = {
  S, RT, triTable, setScene, syncUI,
  breakdown() { const r = {}; for (const [id, rt] of Object.entries(RT)) { const total = triOf(rt.three); const act = rt.actors.map((a) => a.kind + ':' + triOf(a.g)); r[id] = { total, actors: act }; } return r; },
  seek(t) {
    S.play = false; cur.reset(); if (cur.mode === 'kit') cur.select(S.kitItem, stageEl.clientWidth / stageEl.clientHeight);
    for (let i = 0, n = Math.round(t * 60); i < n; i++) cur.step(1 / 60);
    syncUI(); const cam = renderNow(0.016, true); updateCaption(cam); return renderer.info.render.triangles;
  },
};
if (qs.get('t') !== null) window.__stage.seek(+qs.get('t'));
requestAnimationFrame(loop);
</script>
</body>
</html>
