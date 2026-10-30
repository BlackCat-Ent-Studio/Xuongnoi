import * as THREE from 'three';
import { TRAFFIC_COLORS, type BlockStyle } from '../engine/block-styles';
import type { EntityView, Vec3 } from '../engine/types';
import { BLOCK_PACK } from './pack-model-table';
import { PackSlot, applyPlacement, fitPlacement, onPackLoaded, packTemplate, pickVariant, type PackPool } from './pack-models';

/**
 * Looks for blocks ("Kiểu dáng"). Every look is built inside the unit cube (-0.5..0.5) and the scene
 * scales it to the block size, so collision (the block's own box) always matches the footprint.
 *
 * Styles with a pool in BLOCK_PACK are drawn with MEGA PACK WORLD models instead (see buildPackLook); the rest
 * (box, sign, conveyor, rail) are code-drawn.
 *
 * Speed: a code-drawn look is baked into at most two merged geometries (one tinted by the block colour through a cached
 * material, one with fixed vertex colours), shared by every block of that look. 200 houses = 400 draw calls
 * and zero per-block geometry.
 */
export interface BlockLookFigure {
  readonly object: THREE.Group;
  /** Re-tints the look; for a traffic light the colour picks the lit lamp. */
  setColor(color: string): void;
  /** Per-frame animation from the live entity (belt stripes); absent for looks that never move. */
  update?(view: EntityView): void;
  /** Look geometry and materials are shared, so there is nothing per-figure to free. */
  dispose(): void;
}

type Tpl = 'box' | 'cylx' | 'cylz';
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

const BELT_SURFACE = '#2b2f36';

const clampInt = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, Math.round(v)));

// ---------------------------------------------------------------- recipes (pure data)

function sign(): LookPart[] {
  const parts: LookPart[] = [tinted('box', [0, 0.25, 0], [1, 0.5, 0.1])];
  for (const x of [-0.36, 0.36]) parts.push(fixed('box', [x, -0.25, 0], [0.08, 0.5, 0.08], '#8a5a2b'));
  return parts;
}

/** Width of the frame beams and the end rollers of a belt, in world units. */
const BELT_EDGE = 0.1;

/** Frame of a belt: body, side beams, belt surface and the two end rollers. The moving stripes are added by the figure. */
function conveyor(size: Vec3): LookPart[] {
  const f = new Frame(size);
  const roller = f.Y(0.2);
  const rollerCyl: Tpl = size.x >= size.z ? 'cylz' : 'cylx';
  const parts: LookPart[] = [
    tinted('box', [0, -0.14, 0], [1, 0.72, 1], 0.8),
    fixed('box', [0, 0.45, 0], f.sz(1 - 2 * f.U(BELT_EDGE), 0.1, 1 - 2 * f.V(BELT_EDGE)), BELT_SURFACE),
  ];
  for (const v of [-1, 1]) {
    parts.push(tinted('box', f.pos(0, 0.36, v * (0.5 - f.V(BELT_EDGE) / 2)), f.sz(1, 0.28, f.V(BELT_EDGE)), 1));
  }
  for (const u of [-1, 1]) {
    parts.push(fixed(rollerCyl, f.pos(u * (0.5 - f.U(BELT_EDGE)), 0.5 - roller / 2, 0), f.sz(f.U(0.2), roller, 1 - 2 * f.V(BELT_EDGE)), '#9ca3af'));
  }
  return parts;
}

/** Sleepers and two rails over a bed of gravel, repeating along the longer side. */
function rail(size: Vec3): LookPart[] {
  const f = new Frame(size);
  const parts: LookPart[] = [tinted('box', [0, -0.15, 0], [1, 0.7, 1], 0.6)];
  const n = clampInt(f.long / 0.6, 2, 60);
  const w = f.U(0.2);
  for (let i = 0; i < n; i++) {
    parts.push(fixed('box', f.pos(-0.5 + (i + 0.5) / n, 0.27, 0), f.sz(w, 0.14, 0.94), '#6b4a2b'));
  }
  const thick = f.Y(0.12);
  for (const v of [-1, 1]) {
    parts.push(fixed('box', f.pos(0, 0.5 - thick / 2, v * 0.3), f.sz(1, thick, f.V(0.1)), '#aab2bd'));
  }
  return parts;
}

/** Parts of a code-drawn look; `size` only matters for looks laid out along the block (belt, rail). Pack looks have none. */
export function blockLookParts(style: BlockStyle, size: Vec3): LookPart[] {
  switch (style) {
    case 'sign': return sign();
    case 'conveyor': return conveyor(size);
    case 'rail': return rail(size);
    case 'box': return [tinted('box', [0, 0, 0], [1, 1, 1])];
    default: return [];
  }
}

// ---------------------------------------------------------------- baking

const templates = new Map<Tpl, THREE.BufferGeometry>();
function template(tpl: Tpl): THREE.BufferGeometry {
  let g = templates.get(tpl);
  if (g) return g;
  switch (tpl) {
    case 'box': g = new THREE.BoxGeometry(1, 1, 1); break;
    case 'cylx': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).rotateZ(Math.PI / 2); break;
    case 'cylz': g = new THREE.CylinderGeometry(0.5, 0.5, 1, 10).rotateX(Math.PI / 2); break;
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
    case 'conveyor':
    case 'rail': {
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

// ---------------------------------------------------------------- belt stripes

const STRIPE_MATERIAL = new THREE.MeshLambertMaterial({ color: '#59616c' });
/** World distance between stripes and their thickness along the travel direction. */
const STRIPE_PERIOD = 0.6;
const STRIPE_THICK = 0.14;

/**
 * Cross stripes on the belt surface. Their position follows the belt's travelled distance (`view.belt.phase`), so they
 * run at the live speed, stand still when the belt stops and go back when it reverses.
 */
function beltStripes(parent: THREE.Group): (view: EntityView) => void {
  const stripes: THREE.Mesh[] = [];
  return (view) => {
    const belt = view.belt;
    if (!belt) return;
    const a = belt.axis;
    const o = a === 'x' ? 'z' : 'x';
    const sa = Math.max(view.size[a], 0.01);
    const so = Math.max(view.size[o], 0.01);
    const run = Math.max(sa - 2 * BELT_EDGE, 0.05);
    const n = Math.max(1, Math.round(run / STRIPE_PERIOD));
    const period = run / n;
    while (stripes.length < n) {
      const m = new THREE.Mesh(BOX_GEOMETRY, STRIPE_MATERIAL);
      m.receiveShadow = true;
      parent.add(m);
      stripes.push(m);
    }
    const across = Math.max(so - 2 * BELT_EDGE, 0.05) / so;
    stripes.forEach((m, i) => {
      if (i >= n) {
        m.visible = false;
        return;
      }
      const t = (((i * period + belt.phase) % run) + run) % run;
      const c = -run / 2 + t;
      const lo = Math.max(c - STRIPE_THICK / 2, -run / 2);
      const hi = Math.min(c + STRIPE_THICK / 2, run / 2);
      m.visible = hi - lo > 0.005;
      m.position.set(0, 0.5 + 0.004, 0);
      m.position[a] = (lo + hi) / 2 / sa;
      m.scale.set(1, 0.008, 1);
      m.scale[a] = (hi - lo) / sa;
      m.scale[o] = across;
    });
  };
}

// ---------------------------------------------------------------- pack looks

const placeholderMaterials = new Map<string, THREE.MeshLambertMaterial>();
function placeholderMaterial(color: string): THREE.MeshLambertMaterial {
  const key = new THREE.Color(color).getHexString();
  let m = placeholderMaterials.get(key);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color: `#${key}` });
    placeholderMaterials.set(key, m);
  }
  return m;
}

/**
 * Lenses of the pack traffic light (City_7_Traffic_Light_1, metres): heights as a share of the model height from the
 * top lamp (red) down, the lens face's distance in front of the model centre, and the lens width and thickness.
 * Our own lamps sit over the model's painted ones so the lit one is the only bright one.
 */
const PACK_LAMP_Y = [0.85, 0.703, 0.558] as const;
const PACK_LAMP_FRONT = 0.52;
const PACK_LAMP_WIDTH = 0.52;
const PACK_LAMP_THICK = 0.12;
const LAMP_GEOMETRY = new THREE.CylinderGeometry(0.5, 0.5, 1, 16).rotateX(Math.PI / 2);

/**
 * A block drawn with models from the pack. The slot sits in an inner group scaled by 1/size, so models are laid out
 * in world units while the scene still scales the whole look to the block size. Until the model has loaded a unit box
 * in the block colour stands in. A traffic light gets three lamps on its pole; the block colour picks the lit one.
 */
function buildPackLook(style: BlockStyle, pool: PackPool, color: string, size: Vec3, seed: string): BlockLookFigure {
  const object = new THREE.Group();
  const inner = new THREE.Group();
  object.add(inner);
  const placeholder = new THREE.Mesh(BOX_GEOMETRY, placeholderMaterial(color));
  placeholder.receiveShadow = true;
  const path = pickVariant(pool.models, seed);
  const slot = new PackSlot(path, pool, placeholder, seed);
  inner.add(slot.object);

  let lamps: THREE.Mesh[] = [];
  const lampGroup = new THREE.Group();
  if (style === 'trafficlight') {
    lamps = PACK_LAMP_Y.map(() => {
      const lamp = new THREE.Mesh(LAMP_GEOMETRY, lampMaterial(dim(TRAFFIC_COLORS[0])));
      lamp.userData.ownerNodeId = seed;
      lampGroup.add(lamp);
      return lamp;
    });
    slot.object.add(lampGroup);
  }

  let box: Vec3 = { ...size };
  let current = color;
  const lightLamps = (): void => {
    const lit = trafficLampIndex(current);
    lamps.forEach((lamp, i) => {
      const base = TRAFFIC_COLORS[i] ?? TRAFFIC_COLORS[0];
      lamp.material = lampMaterial(i === lit ? base : dim(base));
    });
  };
  const layout = (): void => {
    inner.scale.set(1 / Math.max(box.x, 0.01), 1 / Math.max(box.y, 0.01), 1 / Math.max(box.z, 0.01));
    placeholder.scale.set(box.x, box.y, box.z);
    slot.layout(box);
    const t = lamps.length > 0 ? packTemplate(path) : null;
    lampGroup.visible = t !== null;
    if (!t) return;
    // Lamps live in model space, so they follow the pole's own scale and position.
    applyPlacement(lampGroup, fitPlacement(t.bounds, box, 'stand'));
    const { min, max } = t.bounds;
    const h = max.y - min.y;
    lamps.forEach((lamp, i) => {
      lamp.position.set((min.x + max.x) / 2, min.y + h * (PACK_LAMP_Y[i] ?? 0.85), (min.z + max.z) / 2 + PACK_LAMP_FRONT);
      lamp.scale.set(PACK_LAMP_WIDTH, PACK_LAMP_WIDTH, PACK_LAMP_THICK);
    });
  };
  // PackSlot lays its copies out itself when the model arrives; the lamps need the same moment.
  const unsubscribe = onPackLoaded(layout);
  layout();
  lightLamps();

  return {
    object,
    update(view) {
      box = { ...view.size };
      layout();
    },
    setColor(c) {
      current = c;
      placeholder.material = placeholderMaterial(c);
      lightLamps();
    },
    dispose() {
      unsubscribe();
      slot.dispose();
    },
  };
}

// ---------------------------------------------------------------- figure

/** `seed` (the owner node id) picks which model of a pool a block gets, so it keeps its look. */
export function buildBlockLook(style: BlockStyle, color: string, size: Vec3, label = '', seed = ''): BlockLookFigure {
  const pool = BLOCK_PACK[style];
  if (pool) return buildPackLook(style, pool, color, size, seed);
  const object = new THREE.Group();
  const baked = bake(style, size);
  let tintedMesh: THREE.Mesh | null = null;
  if (baked.tinted) {
    tintedMesh = new THREE.Mesh(baked.tinted, tintMaterial(color));
    object.add(tintedMesh);
  }
  if (baked.fixed) object.add(new THREE.Mesh(baked.fixed, FIXED_MATERIAL));

  let recolor: (c: string) => void = () => undefined;
  let animate: ((view: EntityView) => void) | undefined;
  if (style === 'conveyor') {
    animate = beltStripes(object);
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
    ...(animate ? { update: animate } : {}),
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
