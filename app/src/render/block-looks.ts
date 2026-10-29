import * as THREE from 'three';
import { TRAFFIC_COLORS, type BlockStyle } from '../engine/block-styles';
import type { Vec3 } from '../engine/types';

/**
 * Low-poly looks for blocks ("Kiểu dáng"). Every look is built inside the unit cube (-0.5..0.5) and the scene
 * scales it to the block size, so collision (the block's own box) always matches the footprint.
 *
 * Speed: a look is baked into at most two merged geometries (one tinted by the block colour through a cached
 * material, one with fixed vertex colours), shared by every block of that look. 200 houses = 400 draw calls
 * and zero per-block geometry.
 */
export interface BlockLookFigure {
  readonly object: THREE.Group;
  /** Re-tints the look; for a traffic light the colour picks the lit lamp. */
  setColor(color: string): void;
  /** Look geometry and materials are shared, so there is nothing per-figure to free. */
  dispose(): void;
}

type Tpl = 'box' | 'cyl' | 'pyr' | 'cone6' | 'ico0' | 'ico1';
type V3 = [number, number, number];

export interface LookPart {
  tpl: Tpl;
  pos: V3;
  size: V3;
  /** Share of the block colour (a tinted part) ... */
  tint?: number;
  /** ... or a fixed CSS colour. Exactly one of the two is set. */
  fixed?: string;
}

const tinted = (tpl: Tpl, pos: V3, size: V3, tint = 1): LookPart => ({ tpl, pos, size, tint });
const fixed = (tpl: Tpl, pos: V3, size: V3, color: string): LookPart => ({ tpl, pos, size, fixed: color });

/** Frame whose first horizontal axis `u` runs along the longer side of the block, `v` across it. */
class Frame {
  readonly long: number;
  readonly short: number;
  private readonly alongX: boolean;
  constructor(readonly size: Vec3) {
    this.alongX = size.x >= size.z;
    this.long = Math.max(size.x, size.z, 0.01);
    this.short = Math.max(Math.min(size.x, size.z), 0.01);
  }
  pos(u: number, y: number, v: number): V3 {
    return this.alongX ? [u, y, v] : [v, y, u];
  }
  sz(su: number, sy: number, sv: number): V3 {
    return this.alongX ? [su, sy, sv] : [sv, sy, su];
  }
  /** Unit-space length of `w` world units along u / across v / up. */
  U(w: number): number {
    return Math.min(w / this.long, 1);
  }
  V(w: number): number {
    return Math.min(w / this.short, 1);
  }
  Y(w: number): number {
    return Math.min(w / Math.max(this.size.y, 0.01), 0.6);
  }
}

const clampInt = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(v)));

// ---------------------------------------------------------------- recipes (pure data)

function house(): LookPart[] {
  const parts: LookPart[] = [
    tinted('box', [0, -0.225, 0], [0.86, 0.55, 0.8]),
    fixed('pyr', [0, 0.275, 0], [1, 0.45, 0.96], '#b5533c'),
    fixed('box', [0, -0.34, 0.405], [0.18, 0.32, 0.02], '#6b3f1d'),
    fixed('box', [0, -0.48, 0.45], [0.3, 0.04, 0.1], '#cfcfcf'),
    fixed('box', [0.25, 0.37, -0.12], [0.1, 0.2, 0.1], '#7a7a7a'),
  ];
  for (const x of [-0.27, 0.27]) parts.push(fixed('box', [x, -0.18, 0.405], [0.16, 0.14, 0.02], '#bfe3ff'));
  for (const x of [-0.435, 0.435]) parts.push(fixed('box', [x, -0.18, 0], [0.02, 0.14, 0.16], '#bfe3ff'));
  return parts;
}

function shop(): LookPart[] {
  const parts: LookPart[] = [
    tinted('box', [0, -0.19, 0], [0.96, 0.62, 0.8]),
    tinted('box', [0, 0.16, 0], [1, 0.08, 0.9], 0.7),
    fixed('box', [0, 0.3, 0.38], [0.64, 0.2, 0.05], '#fafafa'),
    tinted('box', [0, 0.3, 0.4], [0.56, 0.1, 0.05]),
    fixed('box', [-0.15, -0.27, 0.405], [0.5, 0.26, 0.02], '#bfe3ff'),
    fixed('box', [0.34, -0.33, 0.405], [0.16, 0.34, 0.02], '#6b3f1d'),
  ];
  const n = 6;
  for (let i = 0; i < n; i++) {
    parts.push(fixed('box', [-0.48 + (i + 0.5) * (0.96 / n), -0.02, 0.45], [0.96 / n, 0.05, 0.12], i % 2 ? '#fafafa' : '#e04848'));
  }
  return parts;
}

function stall(): LookPart[] {
  const parts: LookPart[] = [
    tinted('box', [0, -0.35, 0.1], [0.84, 0.3, 0.5], 0.8),
    fixed('box', [0, -0.19, 0.1], [0.88, 0.05, 0.54], '#b07a43'),
  ];
  for (const x of [-0.42, 0.42]) for (const z of [-0.4, 0.4]) parts.push(fixed('box', [x, -0.05, z], [0.06, 0.9, 0.06], '#8a5a2b'));
  ['#e53935', '#43a047', '#fdd835', '#fb8c00'].forEach((c, i) => parts.push(fixed('box', [-0.3 + i * 0.2, -0.12, 0.1], [0.15, 0.1, 0.15], c)));
  const n = 7;
  for (let i = 0; i < n; i++) {
    const x = -0.48 + (i + 0.5) * (0.96 / n);
    const make = (pos: V3, size: V3): LookPart => (i % 2 ? fixed('box', pos, size, '#fafafa') : tinted('box', pos, size));
    parts.push(make([x, 0.42, 0], [0.96 / n, 0.06, 1]));
    parts.push(make([x, 0.36, 0.46], [0.96 / n, 0.08, 0.06]));
  }
  return parts;
}

function factory(): LookPart[] {
  const parts: LookPart[] = [
    tinted('box', [0, -0.225, 0], [0.96, 0.55, 0.9], 0.95),
    tinted('box', [0, 0.07, 0], [1, 0.06, 0.96], 0.6),
    fixed('box', [0, -0.32, 0.455], [0.34, 0.36, 0.02], '#555f6b'),
    fixed('cyl', [0.33, 0.22, -0.28], [0.16, 0.56, 0.16], '#6b6b6b'),
    fixed('cyl', [0.33, 0.475, -0.28], [0.21, 0.05, 0.21], '#3a3f47'),
  ];
  for (const x of [-0.33, 0, 0.33]) {
    parts.push(tinted('box', [x, 0.19, 0], [0.3, 0.2, 0.9], 0.7));
    parts.push(fixed('box', [x, 0.2, 0.455], [0.24, 0.1, 0.02], '#bfe3ff'));
  }
  for (const x of [-0.3, 0.3]) parts.push(fixed('box', [x, -0.2, 0.455], [0.2, 0.12, 0.02], '#bfe3ff'));
  return parts;
}

function tree(): LookPart[] {
  return [
    fixed('cyl', [0, -0.275, 0], [0.16, 0.45, 0.16], '#7a4e2a'),
    tinted('ico1', [0, -0.02, 0], [0.92, 0.66, 0.92], 0.85),
    tinted('ico1', [0.02, 0.26, 0], [0.62, 0.48, 0.62], 1),
  ];
}

function lamppost(): LookPart[] {
  return [
    fixed('cyl', [-0.2, -0.47, 0], [0.4, 0.06, 0.4], '#3a3f47'),
    tinted('cyl', [-0.2, -0.04, 0], [0.16, 0.92, 0.16], 0.9),
    tinted('box', [0.05, 0.42, 0], [0.5, 0.05, 0.1], 0.9),
    tinted('box', [0.3, 0.46, 0], [0.34, 0.05, 0.34], 0.6),
    fixed('box', [0.3, 0.41, 0], [0.26, 0.07, 0.26], '#fff2a8'),
  ];
}

function trafficLightBody(): LookPart[] {
  return [
    fixed('cyl', [0, -0.47, 0], [0.5, 0.06, 0.5], '#3a3f47'),
    fixed('cyl', [0, -0.18, 0], [0.16, 0.64, 0.16], '#4b5563'),
    fixed('box', [0, 0.3, 0], [0.8, 0.34, 0.8], '#2b2f36'),
  ];
}
const TRAFFIC_LAMP_Y = [0.39, 0.3, 0.21] as const;

function road(size: Vec3): LookPart[] {
  const f = new Frame(size);
  const parts: LookPart[] = [tinted('box', [0, 0, 0], [1, 1, 1])];
  const thick = f.Y(0.03);
  const yy = 0.5 + thick / 2;
  if (f.short >= 1.2) {
    const n = clampInt(f.long / (f.short * 1.3), 2, 30);
    for (let i = 0; i < n; i++) {
      parts.push(fixed('box', f.pos(-0.5 + (i + 0.5) / n, yy, 0), f.sz(0.5 / n, thick, f.V(0.14)), '#f5f5f5'));
    }
  }
  if (f.short >= 3) {
    for (const v of [-0.5 + f.V(0.35), 0.5 - f.V(0.35)]) parts.push(fixed('box', f.pos(0, yy, v), f.sz(0.98, thick, f.V(0.1)), '#f5f5f5'));
  }
  return parts;
}

function sidewalk(size: Vec3): LookPart[] {
  const f = new Frame(size);
  const parts: LookPart[] = [tinted('box', [0, -0.06, 0], [1, 0.88, 1], 0.75), tinted('box', [0, 0.44, 0], [0.95, 0.12, 0.95], 1)];
  const thick = f.Y(0.02);
  const yy = 0.5 + thick / 2;
  const nu = clampInt(f.long, 1, 20);
  const nv = clampInt(f.short, 1, 20);
  for (let i = 1; i < nu; i++) parts.push(tinted('box', f.pos(-0.5 + i / nu, yy, 0), f.sz(f.U(0.05), thick, 0.95), 0.7));
  for (let i = 1; i < nv; i++) parts.push(tinted('box', f.pos(0, yy, -0.5 + i / nv), f.sz(0.95, thick, f.V(0.05)), 0.7));
  return parts;
}

function field(size: Vec3): LookPart[] {
  const f = new Frame(size);
  const parts: LookPart[] = [tinted('box', [0, 0, 0], [1, 1, 1], 0.9)];
  const rows = clampInt(f.short / 0.9, 2, 14);
  const perRow = clampInt(f.long / 0.7, 2, 30);
  const greens = ['#4caf50', '#66bb6a', '#81c784'];
  const ridge = f.Y(0.14);
  const plant = f.Y(0.32);
  for (let r = 0; r < rows; r++) {
    const v = -0.5 + (r + 0.5) / rows;
    parts.push(tinted('box', f.pos(0, 0.5 + ridge / 2, v), f.sz(0.98, ridge, 0.5 / rows), 0.7));
    for (let k = 0; k < perRow; k++) {
      const u = -0.5 + (k + 0.5) / perRow;
      parts.push(fixed('ico0', f.pos(u, 0.5 + ridge + plant * 0.3, v), f.sz(0.75 / perRow, plant, 0.62 / rows), greens[(r + k) % 3] ?? '#4caf50'));
    }
  }
  return parts;
}

function rock(): LookPart[] {
  return [
    tinted('cone6', [-0.05, -0.05, 0], [1, 0.9, 1], 0.85),
    tinted('cone6', [0.22, -0.175, 0.18], [0.55, 0.65, 0.55], 0.7),
    tinted('ico0', [-0.3, -0.39, 0.3], [0.3, 0.22, 0.3], 0.6),
    fixed('cone6', [-0.05, 0.26, 0], [0.34, 0.3, 0.34], '#f4f7fa'),
  ];
}

function fence(size: Vec3): LookPart[] {
  const f = new Frame(size);
  const n = clampInt(f.long / 0.9 + 1, 2, 40);
  const parts: LookPart[] = [];
  for (const y of [0.2, -0.12]) parts.push(tinted('box', f.pos(0, y, 0), f.sz(1, 0.12, 0.4), 1));
  const w = f.U(0.12);
  for (let i = 0; i < n; i++) {
    parts.push(tinted('box', f.pos(-0.5 + w / 2 + (i / (n - 1)) * (1 - w), -0.03, 0), f.sz(w, 0.94, 0.6), 0.8));
  }
  return parts;
}

function sign(): LookPart[] {
  const parts: LookPart[] = [tinted('box', [0, 0.25, 0], [1, 0.5, 0.1])];
  for (const x of [-0.36, 0.36]) parts.push(fixed('box', [x, -0.25, 0], [0.08, 0.5, 0.08], '#8a5a2b'));
  return parts;
}

/** Parts of a look; `size` only matters for looks laid out along the block (road, fence, ...). */
export function blockLookParts(style: BlockStyle, size: Vec3): LookPart[] {
  switch (style) {
    case 'house': return house();
    case 'shop': return shop();
    case 'stall': return stall();
    case 'factory': return factory();
    case 'tree': return tree();
    case 'lamppost': return lamppost();
    case 'trafficlight': return trafficLightBody();
    case 'road': return road(size);
    case 'sidewalk': return sidewalk(size);
    case 'field': return field(size);
    case 'rock': return rock();
    case 'fence': return fence(size);
    case 'sign': return sign();
    case 'box': return [tinted('box', [0, 0, 0], [1, 1, 1])];
  }
}

// ---------------------------------------------------------------- baking

const templates = new Map<Tpl, THREE.BufferGeometry>();
function template(tpl: Tpl): THREE.BufferGeometry {
  let g = templates.get(tpl);
  if (g) return g;
  switch (tpl) {
    case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
    case 'cyl': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 10); break;
    // Square pyramid whose base exactly fills the unit square.
    case 'pyr': g = new THREE.ConeGeometry(Math.SQRT1_2, 1, 4).rotateY(Math.PI / 4); break;
    case 'cone6': g = new THREE.ConeGeometry(0.5, 1, 6); break;
    case 'ico0': g = new THREE.IcosahedronGeometry(0.5, 0); break;
    case 'ico1': g = new THREE.IcosahedronGeometry(0.5, 1); break;
  }
  g = g.index ? g.toNonIndexed() : g;
  g.deleteAttribute('uv');
  templates.set(tpl, g);
  return g;
}

/** Merges parts into one geometry with a per-vertex colour; `colorOf` gives each part's vertex colour. */
export function bakeParts(parts: readonly LookPart[], colorOf: (p: LookPart) => THREE.Color): THREE.BufferGeometry | null {
  if (parts.length === 0) return null;
  const pos: number[] = [];
  const nor: number[] = [];
  const col: number[] = [];
  const m = new THREE.Matrix4();
  const nm = new THREE.Matrix3();
  const v = new THREE.Vector3();
  for (const p of parts) {
    const g = template(p.tpl);
    m.compose(new THREE.Vector3(...p.pos), new THREE.Quaternion(), new THREE.Vector3(...p.size));
    nm.getNormalMatrix(m);
    const c = colorOf(p);
    const pa = g.getAttribute('position');
    const na = g.getAttribute('normal');
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i).applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(na, i).applyMatrix3(nm).normalize();
      nor.push(v.x, v.y, v.z);
      col.push(c.r, c.g, c.b);
    }
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  out.computeBoundingSphere();
  return out;
}

interface Baked {
  tinted: THREE.BufferGeometry | null;
  fixed: THREE.BufferGeometry | null;
}
const bakedCache = new Map<string, Baked>();

function cacheKey(style: BlockStyle, size: Vec3): string {
  switch (style) {
    case 'road':
    case 'sidewalk':
    case 'field':
    case 'fence': {
      // Layout depends on the proportions, so blocks of nearly the same size share one bake.
      const q = (n: number) => Math.round(n * 2) / 2;
      return `${style}:${q(size.x)}x${q(size.y)}x${q(size.z)}`;
    }
    default:
      return style;
  }
}

function bake(style: BlockStyle, size: Vec3): Baked {
  const key = cacheKey(style, size);
  let b = bakedCache.get(key);
  if (!b) {
    const parts = blockLookParts(style, size);
    b = {
      tinted: bakeParts(parts.filter((p) => p.tint !== undefined), (p) => new THREE.Color().setScalar(p.tint ?? 1)),
      fixed: bakeParts(parts.filter((p) => p.fixed !== undefined), (p) => new THREE.Color(p.fixed)),
    };
    bakedCache.set(key, b);
  }
  return b;
}

const tintMaterials = new Map<string, THREE.MeshLambertMaterial>();
function tintMaterial(color: string): THREE.MeshLambertMaterial {
  const key = new THREE.Color(color).getHexString();
  let m = tintMaterials.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: `#${key}`, vertexColors: true });
    tintMaterials.set(key, m);
  }
  return m;
}
const FIXED_MATERIAL = new THREE.MeshLambertMaterial({ vertexColors: true });

const lampMaterials = new Map<string, THREE.MeshBasicMaterial>();
function lampMaterial(color: string): THREE.MeshBasicMaterial {
  let m = lampMaterials.get(color);
  if (!m) {
    m = new THREE.MeshBasicMaterial({ color });
    lampMaterials.set(color, m);
  }
  return m;
}
const dim = (color: string): string => `#${new THREE.Color(color).multiplyScalar(0.28).getHexString()}`;

/** Which of the three lamps (0 red, 1 yellow, 2 green) a colour lights, by hue. */
export function trafficLampIndex(color: string): 0 | 1 | 2 {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(color).getHSL(hsl);
  const deg = hsl.h * 360;
  if (deg < 20 || deg >= 300) return 0;
  return deg < 80 ? 1 : 2;
}

// ---------------------------------------------------------------- sign text

const textureCache = new Map<string, THREE.Texture | null>();
function signTexture(text: string, aspect: number): THREE.Texture | null {
  const key = `${text}|${aspect.toFixed(1)}`;
  if (textureCache.has(key)) return textureCache.get(key) ?? null;
  let tex: THREE.Texture | null = null;
  if (typeof document !== 'undefined') {
    const h = 128;
    const w = Math.round(h * aspect);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const g = canvas.getContext('2d');
    if (g) {
      let fontPx = h * 0.7;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.font = `bold ${fontPx}px sans-serif`;
      const wide = g.measureText(text).width;
      if (wide > w * 0.94) {
        fontPx = fontPx * ((w * 0.94) / wide);
        g.font = `bold ${fontPx}px sans-serif`;
      }
      g.lineJoin = 'round';
      g.lineWidth = Math.max(2, fontPx * 0.14);
      g.strokeStyle = 'rgba(20,24,32,0.9)';
      g.strokeText(text, w / 2, h / 2);
      g.fillStyle = '#ffffff';
      g.fillText(text, w / 2, h / 2);
      tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
    }
  }
  textureCache.set(key, tex);
  return tex;
}
const textMaterials = new Map<THREE.Texture, THREE.MeshBasicMaterial>();
const UNIT_PLANE = new THREE.PlaneGeometry(1, 1);
const BOX_GEOMETRY = new THREE.BoxGeometry(1, 1, 1);

// ---------------------------------------------------------------- figure

export function buildBlockLook(style: BlockStyle, color: string, size: Vec3, label = ''): BlockLookFigure {
  const object = new THREE.Group();
  const baked = bake(style, size);
  let tintedMesh: THREE.Mesh | null = null;
  if (baked.tinted) {
    tintedMesh = new THREE.Mesh(baked.tinted, tintMaterial(color));
    object.add(tintedMesh);
  }
  if (baked.fixed) object.add(new THREE.Mesh(baked.fixed, FIXED_MATERIAL));

  let recolor: (c: string) => void = () => undefined;
  if (style === 'trafficlight') {
    const lamps = TRAFFIC_LAMP_Y.map((y) => {
      const lamp = new THREE.Mesh(BOX_GEOMETRY, lampMaterial(dim(TRAFFIC_COLORS[0])));
      lamp.position.set(0, y, 0);
      lamp.scale.set(0.5, 0.07, 0.86);
      object.add(lamp);
      return lamp;
    });
    const cap = new THREE.Mesh(BOX_GEOMETRY, lampMaterial(color));
    cap.position.set(0, 0.48, 0);
    cap.scale.set(0.5, 0.025, 0.5);
    object.add(cap);
    recolor = (c) => {
      const lit = trafficLampIndex(c);
      lamps.forEach((lamp, i) => {
        const base = TRAFFIC_COLORS[i] ?? TRAFFIC_COLORS[0];
        lamp.material = lampMaterial(i === lit ? base : dim(base));
      });
      cap.material = lampMaterial(c);
    };
  } else if (style === 'sign' && label) {
    const aspect = Math.min(8, Math.max(0.5, (size.x * 0.92) / Math.max(size.y * 0.42, 0.05)));
    const tex = signTexture(label, aspect);
    if (tex) {
      let mat = textMaterials.get(tex);
      if (!mat) {
        mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
        textMaterials.set(tex, mat);
      }
      for (const side of [1, -1]) {
        const plane = new THREE.Mesh(UNIT_PLANE, mat);
        plane.scale.set(0.92, 0.42, 1);
        plane.position.set(0, 0.25, side * 0.052);
        if (side < 0) plane.rotation.y = Math.PI;
        object.add(plane);
      }
    }
  }

  object.traverse((o) => {
    if (o instanceof THREE.Mesh && !(o.material instanceof THREE.MeshBasicMaterial && o.material.map)) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });

  recolor(color);
  return {
    object,
    setColor(c) {
      if (tintedMesh) tintedMesh.material = tintMaterial(c);
      recolor(c);
    },
    dispose() {
      /* geometry, materials and textures are shared and live for the page */
    },
  };
}

/** Number of meshes under a built look; used by tests. */
export function countMeshes(figure: BlockLookFigure): number {
  let n = 0;
  figure.object.traverse((o) => {
    if (o instanceof THREE.Mesh) n++;
  });
  return n;
}
