import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

/** Helpers for the cozy wooden workshop look: palette, toon materials, rounded primitives and merged plank boards. */

export const PAL = {
  wood1: '#3a2417',
  wood2: '#5a3a22',
  wood3: '#7a4f2e',
  wood4: '#a06b3c',
  wood5: '#c8955a',
  cream: '#fff1d0',
  cream2: '#f3dcaa',
  cream3: '#d9bd84',
  honey: '#ffb938',
  amber: '#e8891a',
  sage: '#93b58c',
  red: '#e0553f',
  water: '#6cc3cf',
  crate: '#a9652c',
  crateDark: '#7e4724',
  slab: '#8a5a34',
} as const;

export const FLOOR_COLS = ['#e2b677', '#d9ab6b', '#e7c486', '#d6a463'];
export const WALL_COLS = ['#f3dcaa', '#eed4a0', '#f6e2b8'];
export const WAIN_COLS = ['#b07a46', '#a96f3f', '#b98350'];
export const SIDE_COLS = ['#c8955a', '#bf8a50', '#cf9d62', '#b9814a'];

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const sm01 = (x: number): number => {
  const t = clamp(x, 0, 1);
  return t * t * (3 - 2 * t);
};

/** Small deterministic random generator, so a scene always gets the same boards. */
export function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => ((s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296);
}

let ramp: THREE.DataTexture | null = null;
/** 3-step toon ramp, bright so wood never goes muddy. */
function toonRamp(): THREE.DataTexture {
  if (!ramp) {
    ramp = new THREE.DataTexture(new Uint8Array([170, 218, 255]), 3, 1, THREE.RedFormat);
    ramp.minFilter = ramp.magFilter = THREE.NearestFilter;
    ramp.generateMipmaps = false;
    ramp.needsUpdate = true;
  }
  return ramp;
}

const matCache = new Map<string, THREE.MeshToonMaterial>();
/** Shared toon material for a colour (never disposed: the whole stage reuses it). */
export function toon(hex: string): THREE.MeshToonMaterial {
  let m = matCache.get(hex);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color: hex, gradientMap: toonRamp() });
    m.userData.shared = true;
    matCache.set(hex, m);
  }
  return m;
}

/** Own material, for parts whose colour changes at run time. */
export function toonOwn(hex: string, extra: THREE.MeshToonMaterialParameters = {}): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color: hex, gradientMap: toonRamp(), ...extra });
}

export type Paint = string | THREE.Material;
const asMat = (c: Paint): THREE.Material => (typeof c === 'string' ? toon(c) : c);

export function rbox(w: number, h: number, d: number, color: Paint, r?: number, seg = 2): THREE.Mesh {
  const rad = Math.min(r ?? Math.min(w, h, d) * 0.3, Math.min(w, h, d) / 2 - 0.002);
  return new THREE.Mesh(new RoundedBoxGeometry(w, h, d, seg, Math.max(0.001, rad)), asMat(color));
}

export function at<T extends THREE.Object3D>(o: T, x = 0, y = 0, z = 0): T {
  o.position.set(x, y, z);
  return o;
}

export function ball(r: number, color: Paint, sx = 1, sy = 1, sz = 1, ws = 14, hs = 10): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, ws, hs), asMat(color));
  m.scale.set(sx, sy, sz);
  return m;
}

export function lathe(pts: Array<[number, number]>, color: Paint, seg = 24, side?: THREE.Side): THREE.Mesh {
  const geo = new THREE.LatheGeometry(
    pts.map(([x, y]) => new THREE.Vector2(x, y)),
    seg,
  );
  const mat = side !== undefined && typeof color === 'string' ? toonOwn(color, { side }) : asMat(color);
  return new THREE.Mesh(geo, mat);
}

export function rrShape(w: number, h: number, r0: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  const r = Math.min(r0, w / 2 - 0.001, h / 2 - 0.001);
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

export function ringShape(w: number, h: number, r: number, t: number): THREE.Shape {
  const s = rrShape(w, h, r);
  s.holes.push(rrShape(w - 2 * t, h - 2 * t, Math.max(0.02, r - t)));
  return s;
}

/** Polygon with softly rounded corners. */
export function roundedPoly(pts: THREE.Vector2[], d: number): THREE.Shape {
  const sh = new THREE.Shape();
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n]!;
    const b = pts[i]!;
    const c = pts[(i + 1) % n]!;
    const ab = b.clone().sub(a).normalize();
    const cb = c.clone().sub(b).normalize();
    const p1 = b.clone().sub(ab.multiplyScalar(d));
    const p2 = b.clone().add(cb.multiplyScalar(d));
    if (i === 0) sh.moveTo(p1.x, p1.y);
    else sh.lineTo(p1.x, p1.y);
    sh.quadraticCurveTo(b.x, b.y, p2.x, p2.y);
  }
  sh.closePath();
  return sh;
}

/** Flat painted layer lying on the floor: base at `y`, thickness `depth`. */
export function paint(shape: THREE.Shape, depth: number, color: Paint, y = 0): THREE.Mesh {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 5 });
  g.rotateX(-Math.PI / 2);
  const m = new THREE.Mesh(g, asMat(color));
  m.position.y = y;
  return m;
}

/** Frees the geometries (and non-shared materials and textures) of a figure. */
export function disposeTree(root: THREE.Object3D): void {
  root.traverse((o) => {
    if (o instanceof THREE.Mesh || o instanceof THREE.Sprite) {
      if (o instanceof THREE.Mesh) o.geometry.dispose();
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) if (!m.userData.shared) m.dispose();
    }
  });
}

/** Soft warm glow used behind lamps and stars (one canvas texture for the whole page). */
let glowTexture: THREE.CanvasTexture | null = null;
function glowTex(): THREE.CanvasTexture | null {
  if (glowTexture) return glowTexture;
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (!g) return null;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, 'rgba(255,214,120,.85)');
  r.addColorStop(0.45, 'rgba(255,190,90,.3)');
  r.addColorStop(1, 'rgba(255,170,70,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

export function glowSprite(size: number, opacity = 0.8): THREE.Sprite | null {
  const map = glowTex();
  if (!map) return null;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, opacity }));
  s.scale.set(size, size, 1);
  return s;
}

// ----- merged boards: every plank is one quad (2 triangles) with a vertex colour -----

export interface Quad {
  o: [number, number, number];
  u: [number, number, number];
  v: [number, number, number];
  c: string;
}

function quadGeo(list: readonly Quad[]): THREE.BufferGeometry {
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  let n = 0;
  const c = new THREE.Color();
  for (const q of list) {
    const [ox, oy, oz] = q.o;
    const [ux, uy, uz] = q.u;
    const [vx, vy, vz] = q.v;
    const nx = uy * vz - uz * vy;
    const ny = uz * vx - ux * vz;
    const nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    c.set(q.c);
    const corners = [
      [ox, oy, oz],
      [ox + ux, oy + uy, oz + uz],
      [ox + ux + vx, oy + uy + vy, oz + uz + vz],
      [ox + vx, oy + vy, oz + vz],
    ] as const;
    for (const p of corners) {
      pos.push(p[0], p[1], p[2]);
      nor.push(nx / l, ny / l, nz / l);
      col.push(c.r, c.g, c.b);
    }
    idx.push(n, n + 1, n + 2, n, n + 2, n + 3);
    n += 4;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  return g;
}

let boardMaterial: THREE.MeshToonMaterial | null = null;
/** Planks sit a hair in front of the slab they cover, so the material pulls them forward in depth. */
function boardMat(): THREE.MeshToonMaterial {
  if (!boardMaterial) {
    boardMaterial = new THREE.MeshToonMaterial({
      vertexColors: true,
      gradientMap: toonRamp(),
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    boardMaterial.userData.shared = true;
  }
  return boardMaterial;
}

export function boardMesh(list: readonly Quad[]): THREE.Mesh {
  const m = new THREE.Mesh(quadGeo(list), boardMat());
  m.receiveShadow = true;
  return m;
}

const pickOf = (cols: readonly string[], R: () => number): string => cols[Math.floor(R() * cols.length)] ?? '#d9ab6b';

/** Planks lying along x, in rows front-to-back, on a horizontal face at height `y`. */
export function rowsTop(o: {
  x0: number;
  x1: number;
  y: number;
  zBack: number;
  zFront: number;
  rowW?: number;
  gap?: number;
  minL?: number;
  maxL?: number;
  cols: readonly string[];
  seed?: number;
}): Quad[] {
  const { x0, x1, y, zBack, zFront, rowW = 0.8, gap = 0.05, minL = 2.4, maxL = 4.2, cols, seed = 1 } = o;
  const R = rng(seed);
  const q: Quad[] = [];
  const rows = Math.max(1, Math.round((zFront - zBack) / rowW));
  const rw = (zFront - zBack) / rows;
  for (let r = 0; r < rows; r++) {
    const zf = zFront - r * rw;
    let x = x0 - R() * maxL;
    while (x < x1) {
      const L = minL + R() * (maxL - minL);
      const a = Math.max(x, x0);
      const b = Math.min(x + L, x1);
      if (b - a > 0.15) q.push({ o: [a + gap / 2, y, zf - gap / 2], u: [b - a - gap, 0, 0], v: [0, 0, -(rw - gap)], c: pickOf(cols, R) });
      x += L;
    }
  }
  return q;
}

/** Planks lying along x, in courses from `y0` up to `y1`, on a vertical face at depth `z` (facing +z). */
export function rowsFront(o: {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z: number;
  courseH?: number;
  gap?: number;
  minL?: number;
  maxL?: number;
  cols: readonly string[];
  seed?: number;
}): Quad[] {
  const { x0, x1, y0, y1, z, courseH = 0.6, gap = 0.05, minL = 2.4, maxL = 4.2, cols, seed = 1 } = o;
  const R = rng(seed);
  const q: Quad[] = [];
  const rows = Math.max(1, Math.round((y1 - y0) / courseH));
  const ch = (y1 - y0) / rows;
  for (let r = 0; r < rows; r++) {
    const yb = y0 + r * ch;
    let x = x0 - R() * maxL;
    while (x < x1) {
      const L = minL + R() * (maxL - minL);
      const a = Math.max(x, x0);
      const b = Math.min(x + L, x1);
      if (b - a > 0.15) q.push({ o: [a + gap / 2, yb + gap / 2, z], u: [b - a - gap, 0, 0], v: [0, ch - gap, 0], c: pickOf(cols, R) });
      x += L;
    }
  }
  return q;
}

/** Upright boards side by side on a vertical face at depth `z`. */
export function colsFront(o: { x0: number; x1: number; y0: number; y1: number; z: number; w?: number; gap?: number; cols: readonly string[]; seed?: number }): Quad[] {
  const { x0, x1, y0, y1, z, w = 1.1, gap = 0.05, cols, seed = 1 } = o;
  const R = rng(seed);
  const q: Quad[] = [];
  for (let x = x0; x < x1 - 0.01; x += w) q.push({ o: [x + gap / 2, y0, z], u: [w - gap, 0, 0], v: [0, y1 - y0, 0], c: pickOf(cols, R) });
  return q;
}
