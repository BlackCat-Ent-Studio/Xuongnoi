
/* ================= stage: Màn 2 scene (same props/robot as the cozy-stage preview) + player camera ================= */
const UI = { frame: 'phone', layout: 'b', checker: 'v1', view: 'board', pip: 'small', running: false, panelOpen: true };
const stageView = $('stageView');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setClearColor(0x000000, 0);
renderer.localClippingEnabled = true;
stageView.prepend(renderer.domElement);
const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 200);

const scene2 = (() => {
  const three = new THREE.Scene();
  three.add(new THREE.HemisphereLight(0xfff3dc, 0xa7753f, 1.7));
  const k = new THREE.DirectionalLight(0xffe2b8, 1.6); k.position.set(-4, 9, 8); three.add(k);
  const root = new THREE.Group(); three.add(root);
  root.add(makeBackWall().g, makeSideFloor().g);
  const win = makeWindow(); at(win.g, -9, 4.3, -1.45); root.add(win.g);
  const shelf = makeShelf(); at(shelf.g, -0.8, 3.7, -1.55); root.add(shelf.g);
  const lampA = makeLamp({ len: 3.3 }); at(lampA.g, -3.8, 8.2, -0.5); root.add(lampA.g);
  const lampB = makeLamp({ len: 3.3 }); at(lampB.g, 8.3, 8.2, -0.5); root.add(lampB.g);
  const btn = makeButton(); at(btn.g, BTN_X, 0, 0.35); root.add(btn.g);
  const door = makeDoor(); at(door.g, DOOR_X, 0, 0.45); root.add(door.g);
  const flag = makeFlag(); at(flag.g, 10, 0, 0.3); root.add(flag.g);
  const bot = makeActor('legs'); root.add(bot.g, bot.shadow); bot.setScale(1.6);
  let btnV = 0, clock = 0;
  return {
    three, bot,
    /* sim state -> pose; clock keeps flag/lamps alive while idle */
    apply(s, dt) {
      clock += dt;
      bot.x = s.x; bot.z = 0.35;
      bot.state = s.won ? 'happy' : s.moving ? 'walk' : 'idle';
      bot.speed = s.moving ? SPEED : 0;
      bot.yawT = s.won ? 0.25 : (s.moving || s.T > GO_AT) ? 1.05 : 0.5;
      btnV += ((s.btnDown ? 1 : 0) - btnV) * (1 - Math.exp(-dt * 14));
      bot.y = 0.2 * Math.max(0, 1 - ((s.x + 5) / 0.8) ** 2) * (1 - 0.5 * btnV);
      btn.set(btnV); door.set(sm01(s.door)); flag.update(clock, s.won ? 1 : 0); lampA.update(clock, 0); lampB.update(clock, 1.7);
      if (s.T === 0) bot.snap();
      bot.step(clock, dt);
    },
  };
})();

/* ---------- camera: orthographic side view, centre (cx, cy) in world units, zoom >= 1 relative to "fit" ---------- */
const BOUNDS = { x0: -13, x1: 13.5, y0: -0.9, y1: 9.6 };
const ZMIN = 1, ZMAX = 4;
const cam = { zoom: 1, cx: (BOUNDS.x0 + BOUNDS.x1) / 2, cy: (BOUNDS.y0 + BOUNDS.y1) / 2, anim: null };
const PIP_ZOOM = 3.2;
function viewSize() { const w = Math.max(1, stageView.clientWidth), h = Math.max(1, stageView.clientHeight); return { w, h, aspect: w / h }; }
const fitH = (aspect) => Math.max((BOUNDS.x1 - BOUNDS.x0) / aspect, BOUNDS.y1 - BOUNDS.y0);
function clampCam(c, aspect) {
  c.zoom = clamp(c.zoom, ZMIN, ZMAX);
  const vh = fitH(aspect) / c.zoom, vw = vh * aspect;
  c.cx = (BOUNDS.x1 - BOUNDS.x0) <= vw ? (BOUNDS.x0 + BOUNDS.x1) / 2 : clamp(c.cx, BOUNDS.x0 + vw / 2, BOUNDS.x1 - vw / 2);
  c.cy = (BOUNDS.y1 - BOUNDS.y0) <= vh ? (BOUNDS.y0 + BOUNDS.y1) / 2 : clamp(c.cy, BOUNDS.y0 + vh / 2, BOUNDS.y1 - vh / 2);
}
const smallPip = () => UI.layout === 'b' && UI.pip === 'small';
function activeCam(dt) {
  const { aspect } = viewSize();
  if (smallPip()) {          // the corner window just follows the bot
    const c = { zoom: PIP_ZOOM, cx: scene2.bot.x, cy: 3.2 };
    clampCam(c, aspect); return c;
  }
  if (cam.anim) {
    const k = 1 - Math.exp(-dt * 12), a = cam.anim;
    cam.zoom = lerp(cam.zoom, a.zoom, k); cam.cx = lerp(cam.cx, a.cx, k); cam.cy = lerp(cam.cy, a.cy, k);
    if (Math.abs(cam.zoom - a.zoom) < 0.003 && Math.abs(cam.cx - a.cx) < 0.01 && Math.abs(cam.cy - a.cy) < 0.01) { Object.assign(cam, a); cam.anim = null; }
  }
  clampCam(cam, aspect); return cam;
}
function placeCamera(c) {
  const { aspect } = viewSize();
  const vh = fitH(aspect) / c.zoom, vw = vh * aspect, p = 0.2;
  ortho.left = -vw / 2; ortho.right = vw / 2; ortho.top = vh / 2; ortho.bottom = -vh / 2; ortho.updateProjectionMatrix();
  ortho.position.set(c.cx, c.cy + Math.sin(p) * 40, Math.cos(p) * 40); ortho.lookAt(c.cx, c.cy, 0); ortho.updateMatrixWorld();
}
function resetCamera(animate = true) {
  const target = { zoom: 1, cx: (BOUNDS.x0 + BOUNDS.x1) / 2, cy: (BOUNDS.y0 + BOUNDS.y1) / 2 };
  if (animate) cam.anim = target; else { Object.assign(cam, target); cam.anim = null; }
}
function zoomAt(clientX, clientY, factor) {
  const r = stageView.getBoundingClientRect(), { aspect } = viewSize();
  cam.anim = null;
  const fx = (clientX - r.left) / r.width - 0.5, fy = (clientY - r.top) / r.height - 0.5;
  const vh0 = fitH(aspect) / cam.zoom, vw0 = vh0 * aspect;
  const wx = cam.cx + fx * vw0, wy = cam.cy - fy * vh0;
  cam.zoom = clamp(cam.zoom * factor, ZMIN, ZMAX);
  const vh1 = fitH(aspect) / cam.zoom, vw1 = vh1 * aspect;
  cam.cx = wx - fx * vw1; cam.cy = wy + fy * vh1;
  clampCam(cam, aspect);
}
function panBy(dxPx, dyPx) {
  const r = stageView.getBoundingClientRect(), { aspect } = viewSize();
  cam.anim = null;
  const vh = fitH(aspect) / cam.zoom, vw = vh * aspect;
  cam.cx -= dxPx * vw / r.width; cam.cy += dyPx * vh / r.height;
  clampCam(cam, aspect);
}
const gestureOK = () => (UI.layout === 'b' ? UI.pip === 'full' : UI.view === 'stage');

/* ---------- gestures: drag = pan, wheel / ctrl+wheel / two-finger pinch = zoom, double tap = fit ---------- */
const ptrs = new Map();
let down = null, lastTap = { t: 0, x: 0, y: 0 }, shrinkTimer = 0, pinchPrev = null;
const pdist = () => { const [a, b] = [...ptrs.values()]; return Math.hypot(a.x - b.x, a.y - b.y); };
const pmid = () => { const [a, b] = [...ptrs.values()]; return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };
stageView.addEventListener('pointerdown', (e) => {
  if (e.target.closest('button')) return;
  try { stageView.setPointerCapture(e.pointerId); } catch (_) { /* synthetic pointers cannot be captured */ }
  ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size === 1) down = { t: performance.now(), x: e.clientX, y: e.clientY, moved: false };
  else { if (down) down.moved = true; pinchPrev = { d: pdist(), m: pmid() }; }
  if (gestureOK()) stageView.classList.add('grabbing');
});
stageView.addEventListener('pointermove', (e) => {
  const p = ptrs.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) > 7) down.moved = true;
  if (!gestureOK()) return;
  if (ptrs.size === 1) panBy(dx, dy);
  else if (ptrs.size === 2 && pinchPrev) {
    const d = pdist(), m = pmid();
    panBy(m.x - pinchPrev.m.x, m.y - pinchPrev.m.y);
    if (pinchPrev.d > 0) zoomAt(m.x, m.y, d / pinchPrev.d);
    pinchPrev = { d, m };
  }
});
function endPointer(e) {
  if (!ptrs.has(e.pointerId)) return;
  ptrs.delete(e.pointerId); pinchPrev = null;
  if (ptrs.size === 0) {
    stageView.classList.remove('grabbing');
    const wasTap = down && !down.moved && performance.now() - down.t < 380 && e.type === 'pointerup';
    if (wasTap) handleTap(e.clientX, e.clientY);
    down = null;
  } else if (ptrs.size === 1) { const [only] = ptrs.values(); if (down) { down.x = only.x; down.y = only.y; } }
}
stageView.addEventListener('pointerup', endPointer);
stageView.addEventListener('pointercancel', endPointer);
stageView.addEventListener('wheel', (e) => {
  if (!gestureOK()) return;
  e.preventDefault();
  zoomAt(e.clientX, e.clientY, Math.exp(e.ctrlKey ? -clamp(e.deltaY, -60, 60) * 0.009 : -clamp(e.deltaY, -150, 150) * 0.0016));
}, { passive: false });
function handleTap(x, y) {
  if (smallPip()) { setPip('full'); return; }
  const now = performance.now();
  if (now - lastTap.t < 330 && Math.hypot(x - lastTap.x, y - lastTap.y) < 34) {
    lastTap.t = 0; resetCamera(true); return;       // double tap = fit
  }
  lastTap = { t: now, x, y };
}
