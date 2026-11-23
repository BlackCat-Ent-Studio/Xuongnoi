import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

/* ================= core helpers ================= */
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;
const sm01 = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };
const outBack = (x) => { x = clamp(x, 0, 1); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };
function rng(seed) { let s = seed >>> 0; return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296); }
const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

const PAL = {
  wood0: '#241510', wood1: '#3a2417', wood2: '#5a3a22', wood3: '#7a4f2e', wood4: '#a06b3c', wood5: '#c8955a',
  cream: '#fff1d0', cream2: '#f3dcaa', cream3: '#d9bd84', honey: '#ffb938', amber: '#e8891a', amberDeep: '#a85c0c',
  sage: '#93b58c', sageDeep: '#5f8461', sageDark: '#3f5e45', red: '#e0553f', ink: '#3b2314',
  water: '#6cc3cf', waterDeep: '#3f97ad', crate: '#a9652c', crateDark: '#7e4724',
};
const FLOOR_COLS = ['#e2b677', '#d9ab6b', '#e7c486', '#d6a463'];
const TILE_A = ['#e6c28a', '#e0b97e'], TILE_B = ['#c98f55', '#c48a4f'];
const WALL_COLS = ['#f3dcaa', '#eed4a0', '#f6e2b8'];
const WAIN_COLS = ['#b07a46', '#a96f3f', '#b98350'];
const SIDE_COLS = ['#c8955a', '#bf8a50', '#cf9d62', '#b9814a'];

function canvasTex(size, draw) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  draw(c.getContext('2d'), size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
const SHADOW_TEX = canvasTex(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 2, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(50,25,10,.55)'); r.addColorStop(.6, 'rgba(50,25,10,.28)'); r.addColorStop(1, 'rgba(50,25,10,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});
const GLOW_TEX = canvasTex(128, (g, s) => {
  const r = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  r.addColorStop(0, 'rgba(255,214,120,.85)'); r.addColorStop(.45, 'rgba(255,190,90,.3)'); r.addColorStop(1, 'rgba(255,170,70,0)');
  g.fillStyle = r; g.fillRect(0, 0, s, s);
});

/* 3-step toon ramp (bright, so wood never goes muddy) */
const RAMP = new THREE.DataTexture(new Uint8Array([170, 218, 255]), 3, 1, THREE.RedFormat);
RAMP.minFilter = RAMP.magFilter = THREE.NearestFilter; RAMP.generateMipmaps = false; RAMP.needsUpdate = true;
const _mc = new Map();
function toonM(hex) { let m = _mc.get(hex); if (!m) { m = new THREE.MeshToonMaterial({ color: hex, gradientMap: RAMP }); _mc.set(hex, m); } return m; }
const toonNew = (hex, o = {}) => new THREE.MeshToonMaterial({ color: hex, gradientMap: RAMP, ...o });
const basicM = (hex, o = {}) => new THREE.MeshBasicMaterial({ color: hex, ...o });
const GROUND_CLIP = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0)];
const WATER_CLIP = [new THREE.Plane(new THREE.Vector3(0, 1, 0), 0.25)];
const asMat = (c) => (typeof c === 'string' ? toonM(c) : c);

function rbox(w, h, d, color, r, seg = 2) {
  const rad = Math.min(r ?? Math.min(w, h, d) * 0.3, Math.min(w, h, d) / 2 - 0.002);
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, rad), asMat(color));
}
function at(o, x = 0, y = 0, z = 0) { o.position.set(x, y, z); return o; }
function ball(r, color, sx = 1, sy = 1, sz = 1, ws = 14, hs = 10) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), asMat(color)); m.scale.set(sx, sy, sz); return m;
}
function lathe(pts, color, seg = 24, side) {
  const m = new THREE.Mesh(new THREE.LatheGeometry(pts.map(([x, y]) => new THREE.Vector2(x, y)), seg), side ? toonNew(color, { side }) : asMat(color));
  return m;
}
function rrShape(w, h, r) {
  const s = new THREE.Shape(); const x = -w / 2, y = -h / 2; r = Math.min(r, w / 2 - 0.001, h / 2 - 0.001);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r); s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  return s;
}
function roundedPoly(pts, d) {
  const sh = new THREE.Shape(), n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    const ab = b.clone().sub(a).normalize(), cb = c.clone().sub(b).normalize();
    const p1 = b.clone().sub(ab.multiplyScalar(d)), p2 = b.clone().add(cb.multiplyScalar(d));
    if (i === 0) sh.moveTo(p1.x, p1.y); else sh.lineTo(p1.x, p1.y);
    sh.quadraticCurveTo(b.x, b.y, p2.x, p2.y);
  }
  sh.closePath(); return sh;
}
/* flat painted layer lying on the floor: base at y, thickness depth */
function paint(shape, depth, color, y = 0) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, asMat(color)); m.position.y = y; return m;
}
function ringShape(w, h, r, t) { const s = rrShape(w, h, r); s.holes.push(rrShape(w - 2 * t, h - 2 * t, Math.max(0.02, r - t))); return s; }
function blobShadow(radius) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.02; m.scale.setScalar(radius * 2); m.renderOrder = 1; return m;
}
function glowSprite(size, opacity = 0.8) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: GLOW_TEX, transparent: true, depthWrite: false, opacity }));
  s.scale.set(size, size, 1); return s;
}

/* merged quad meshes (boards): vertex colours, 2 triangles each */
function quadGeo(list) {
  const pos = [], nor = [], col = [], idx = []; let n = 0; const c = new THREE.Color();
  for (const q of list) {
    const [ox, oy, oz] = q.o, [ux, uy, uz] = q.u, [vx, vy, vz] = q.v;
    const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, l = Math.hypot(nx, ny, nz) || 1;
    c.set(q.c);
    const P = [[ox, oy, oz], [ox + ux, oy + uy, oz + uz], [ox + ux + vx, oy + uy + vy, oz + uz + vz], [ox + vx, oy + vy, oz + vz]];
    for (const p of P) { pos.push(p[0], p[1], p[2]); nor.push(nx / l, ny / l, nz / l); col.push(c.r, c.g, c.b); }
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3); n += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx); return g;
}
const BOARD_MAT = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: RAMP, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
const boardMesh = (list) => new THREE.Mesh(quadGeo(list), BOARD_MAT);
const pick = (cols, R) => cols[Math.floor(R() * cols.length)];

function rowsTop({ x0, x1, y, zBack, zFront, rowW = 0.8, gap = 0.05, minL = 2.4, maxL = 4.2, cols, seed = 1 }) {
  const R = rng(seed), q = [], rows = Math.max(1, Math.round((zFront - zBack) / rowW)), rw = (zFront - zBack) / rows;
  for (let r = 0; r < rows; r++) {
    const zf = zFront - r * rw; let x = x0 - R() * maxL;
    while (x < x1) {
      const L = minL + R() * (maxL - minL), a = Math.max(x, x0), b = Math.min(x + L, x1);
      if (b - a > 0.15) q.push({ o: [a + gap / 2, y, zf - gap / 2], u: [b - a - gap, 0, 0], v: [0, 0, -(rw - gap)], c: pick(cols, R) });
      x += L;
    }
  }
  return q;
}
function rowsFront({ x0, x1, y0, y1, z, courseH = 0.6, gap = 0.05, minL = 2.4, maxL = 4.2, cols, seed = 1 }) {
  const R = rng(seed), q = [], rows = Math.max(1, Math.round((y1 - y0) / courseH)), ch = (y1 - y0) / rows;
  for (let r = 0; r < rows; r++) {
    const yb = y0 + r * ch; let x = x0 - R() * maxL;
    while (x < x1) {
      const L = minL + R() * (maxL - minL), a = Math.max(x, x0), b = Math.min(x + L, x1);
      if (b - a > 0.15) q.push({ o: [a + gap / 2, yb + gap / 2, z], u: [b - a - gap, 0, 0], v: [0, ch - gap, 0], c: pick(cols, R) });
      x += L;
    }
  }
  return q;
}
function colsFront({ x0, x1, y0, y1, z, w = 1.1, gap = 0.05, cols, seed = 1 }) {
  const R = rng(seed), q = [];
  for (let x = x0; x < x1 - 0.01; x += w) q.push({ o: [x + gap / 2, y0, z], u: [w - gap, 0, 0], v: [0, y1 - y0, 0], c: pick(cols, R) });
  return q;
}
function tilesTop({ x0, x1, y, z0, z1, s = 1.25, gap = 0.07, seed = 3 }) {
  const R = rng(seed), q = []; let ix = 0;
  for (let x = x0; x < x1 - 0.01; x += s, ix++) {
    let iz = 0;
    for (let z = z1; z > z0 + 0.01; z -= s, iz++) {
      const a = Math.max(x, x0), w = Math.min(x + s, x1) - a, d = Math.min(s, z - z0);
      q.push({ o: [a + gap / 2, y, z - gap / 2], u: [w - gap, 0, 0], v: [0, 0, -(d - gap)], c: pick((ix + iz) % 2 ? TILE_B : TILE_A, R) });
    }
  }
  return q;
}
