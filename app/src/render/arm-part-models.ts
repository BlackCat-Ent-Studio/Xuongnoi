import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { EntityView, ViewMode } from '../engine/types';
import type { ArmHint, ArmPartKind } from '../engine/render-hints';

/**
 * The "cartoon factory" look of the arm family: tapered orange links, dark servo collars with motor caps and bolts,
 * a black claw with yellow pads, an orange piston with a chrome rod and a black head. Every part is built for the exact
 * size the node gave its block (length, thickness, finger span), along the local +x axis with +y up, so any parameter
 * value draws correctly. Geometry is cached by size and materials by colour, so instances share both.
 *
 * Draw only: the blocks keep their own collision boxes; nothing here feeds back into the world.
 */

/** Colours the nodes used before this look existed: a piece still carrying one of them gets the look's own colour. */
const OLD_DEFAULT: Record<ArmPartKind, string> = {
  joint: '#8b5cf6',
  link: '#a3a3a3',
  palm: '#f59e0b',
  finger: '#f59e0b',
  housing: '#0ea5e9',
  rod: '#0ea5e9',
  head: '#0ea5e9',
};
const LOOK_DEFAULT: Record<ArmPartKind, string> = {
  joint: '#4a4f58',
  link: '#ff9f2e',
  palm: '#2a2d34',
  finger: '#2a2d34',
  housing: '#ff9f2e',
  rod: '#0ea5e9',
  head: '#0ea5e9',
};
const PAD = '#ffd23f';
const CHROME = '#c9ced6';
const HEAD = '#23252b';
const BOLT = '#c9ced6';
const WARN_RED = '#ff2d2d';

/** The colour to draw a part in: the user's colour, or the look's own when the param still holds the old default. */
export function armPartColor(part: ArmPartKind, color: string): string {
  const c = color.toLowerCase();
  if (part === 'rod') return CHROME;
  if (part === 'head') return HEAD;
  return c === OLD_DEFAULT[part] ? LOOK_DEFAULT[part] : color;
}

/** Same hue, lightness and saturation shifted (for caps, stripes and end rings that follow the piece colour). */
export function adjustColor(hex: string, dl: number, ds = 0): string {
  const c = new THREE.Color(hex);
  const h = { h: 0, s: 0, l: 0 };
  c.getHSL(h);
  c.setHSL(h.h, Math.min(1, Math.max(0, h.s + ds)), Math.min(1, Math.max(0, h.l + dl)));
  return `#${c.getHexString()}`;
}

// ---------------------------------------------------------------- shared materials / geometry

const GRADIENT = (() => {
  const t = new THREE.DataTexture(new Uint8Array([110, 110, 110, 255, 170, 170, 170, 255, 220, 220, 220, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
  t.minFilter = t.magFilter = THREE.NearestFilter;
  t.needsUpdate = true;
  return t;
})();

const mats = new Map<string, THREE.MeshToonMaterial>();
/** One toon material per colour, shared by every arm part and the robot chassis. */
export function toonMat(hex: string): THREE.MeshToonMaterial {
  let m = mats.get(hex);
  if (!m) {
    m = new THREE.MeshToonMaterial({ color: hex, gradientMap: GRADIENT });
    mats.set(hex, m);
  }
  return m;
}

const geos = new Map<string, THREE.BufferGeometry>();
function geo(key: string, make: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let g = geos.get(key);
  if (!g) {
    g = make();
    geos.set(key, g);
  }
  return g;
}
const q = (v: number): string => (Math.round(v * 1000) / 1000).toString();

const rbox = (w: number, h: number, d: number, r: number, seg = 1): THREE.BufferGeometry =>
  geo(`rb|${q(w)}|${q(h)}|${q(d)}|${q(r)}|${seg}`, () => new RoundedBoxGeometry(w, h, d, seg, Math.max(0.002, Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3))));
const box = (w: number, h: number, d: number): THREE.BufferGeometry => geo(`b|${q(w)}|${q(h)}|${q(d)}`, () => new THREE.BoxGeometry(w, h, d));
/** Cylinder whose axis runs along z (`axis` 'z'), x or y. */
const cyl = (axis: 'x' | 'y' | 'z', r: number, len: number, seg = 16): THREE.BufferGeometry =>
  geo(`c|${axis}|${q(r)}|${q(len)}|${seg}`, () => {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    if (axis === 'z') g.rotateX(Math.PI / 2);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    return g;
  });

function mesh(g: THREE.BufferGeometry, color: string, x = 0, y = 0, z = 0): THREE.Mesh {
  const m = new THREE.Mesh(g, toonMat(color));
  m.position.set(x, y, z);
  m.castShadow = true;
  return m;
}

// ---------------------------------------------------------------- the parts

/** Link: a tapered, bevelled slab with a lighter stripe, from the pivot at x = -L/2 to the next pivot at x = +L/2. */
function buildLink(size: { x: number; y: number; z: number }, color: string): THREE.Group {
  const L = size.x;
  const t = size.y;
  const w0 = t * 1.25;
  const w1 = t * 0.85;
  const d = size.z * 0.8;
  const slab = geo(`link|${q(L)}|${q(t)}|${q(d)}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-w0 / 2, 0);
    s.lineTo(w0 / 2, 0);
    s.lineTo(w1 / 2, L);
    s.lineTo(-w1 / 2, L);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelSize: Math.min(0.03, t * 0.15), bevelThickness: Math.min(0.03, t * 0.15), bevelSegments: 2, curveSegments: 1 });
    g.translate(0, 0, -d / 2);
    return g;
  });
  const sw = 0.14 * ((w0 + w1) / 2) + 0.02;
  const stripe = geo(`linkstripe|${q(L)}|${q(t)}|${q(d)}`, () => {
    const s = new THREE.Shape();
    s.moveTo(-sw, L * 0.22);
    s.lineTo(sw, L * 0.22);
    s.lineTo(sw, L * 0.78);
    s.lineTo(-sw, L * 0.78);
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: d + 0.08, bevelEnabled: false });
    g.translate(0, 0, -(d + 0.08) / 2);
    return g;
  });
  const inner = new THREE.Group();
  inner.add(mesh(slab, color), mesh(stripe, adjustColor(color, 0.22, 0.05)));
  inner.position.y = -L / 2;
  const wrap = new THREE.Group();
  wrap.add(inner);
  wrap.rotation.z = -Math.PI / 2; // the slab is modelled along +y; the block's length runs along +x
  return wrap;
}

/** Servo: a dark collar on the pivot with a motor cap, a yellow pin and six bolts on each face. */
function buildJoint(size: { x: number; y: number; z: number }, color: string, axis: 'pitch' | 'yaw'): THREE.Group {
  const r = Math.max(size.x, size.y) * 0.56;
  const len = size.z + 0.04;
  const g = new THREE.Group();
  g.add(mesh(cyl('z', r, len, 20), color));
  const cap = adjustColor(color, 0.12);
  for (const s of [-1, 1]) {
    g.add(mesh(cyl('z', r * 0.52, 0.1, 16), cap, 0, 0, s * (len / 2 + 0.04)));
    g.add(mesh(cyl('z', r * 0.2, 0.14, 8), PAD, 0, 0, s * (len / 2 + 0.07)));
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      g.add(mesh(cyl('z', 0.028, 0.04, 6), BOLT, Math.cos(a) * r * 0.8, Math.sin(a) * r * 0.8, s * (len / 2 + 0.01)));
    }
  }
  if (axis === 'yaw') g.rotation.x = Math.PI / 2;
  return g;
}

/** Palm: black rounded block with a yellow stripe on the finger side. */
function buildPalm(size: { x: number; y: number; z: number }, color: string): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(rbox(size.x, size.y, size.z, 0.04), color));
  const across = size.y >= size.z ? 'y' : 'z';
  const stripe = across === 'y' ? box(0.02, size.y * 0.92, size.z * 0.4) : box(0.02, size.y * 0.4, size.z * 0.92);
  g.add(mesh(stripe, PAD, size.x / 2 + 0.004, 0, 0));
  return g;
}

/** Finger: black rounded bar with a yellow pad on the face that looks at the middle of the gripper. */
function buildFinger(size: { x: number; y: number; z: number }, color: string, side: 1 | -1, mode: ViewMode): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(rbox(size.x, size.y, size.z, 0.035), color));
  const inward = -side;
  if (mode === '2d-side') {
    g.add(mesh(box(size.x * 0.62, 0.04, size.z * 0.78), PAD, size.x * 0.1, inward * (size.y / 2 - 0.005), 0));
  } else {
    g.add(mesh(box(size.x * 0.62, size.y * 0.78, 0.04), PAD, size.x * 0.1, 0, inward * (size.z / 2 - 0.005)));
  }
  return g;
}

/** Piston barrel: coloured cylinder with dark end caps. */
function buildHousing(size: { x: number; y: number; z: number }, color: string): THREE.Group {
  const r = Math.max(size.y, size.z) / 2;
  const g = new THREE.Group();
  g.add(mesh(cyl('x', r, size.x, 20), color));
  for (const s of [-1, 1]) g.add(mesh(cyl('x', r * 1.14, Math.min(0.08, size.x * 0.2), 20), '#4a4f58', (s * (size.x - Math.min(0.08, size.x * 0.2))) / 2, 0, 0));
  return g;
}

function buildRod(size: { x: number; y: number; z: number }): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(cyl('x', Math.max(size.y, size.z) / 2, size.x, 12), CHROME));
  return g;
}

/** Pusher head: black rounded block with a yellow band. */
function buildHead(size: { x: number; y: number; z: number }): THREE.Group {
  const g = new THREE.Group();
  g.add(mesh(rbox(size.x, size.y, size.z, Math.min(0.08, size.y * 0.2)), HEAD));
  g.add(mesh(box(size.x + 0.02, size.y * 0.2, size.z + 0.02), PAD));
  return g;
}

// ---------------------------------------------------------------- warning cue

const ringMat = new THREE.MeshBasicMaterial({ color: WARN_RED, transparent: true, depthWrite: false, depthTest: false });
const glowMat = new THREE.MeshBasicMaterial({ color: '#ff4a4a', transparent: true, depthWrite: false });
let warnSpriteMat: THREE.SpriteMaterial | null = null;
/** The red "!" triangle, drawn on a canvas the first time a joint overloads (keeps this module loadable without a DOM). */
function warnSprite(): THREE.SpriteMaterial {
  if (warnSpriteMat) return warnSpriteMat;
  if (typeof document === 'undefined') return new THREE.SpriteMaterial({ color: WARN_RED, depthTest: false }); // no canvas (headless): a plain red square
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#fff';
    g.beginPath();
    g.moveTo(64, 8);
    g.lineTo(120, 112);
    g.lineTo(8, 112);
    g.closePath();
    g.fill();
    g.fillStyle = '#e5322d';
    g.beginPath();
    g.moveTo(64, 24);
    g.lineTo(106, 104);
    g.lineTo(22, 104);
    g.closePath();
    g.fill();
    g.fillStyle = '#fff';
    g.font = '800 62px Arial';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('!', 64, 78);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  warnSpriteMat = new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true });
  return warnSpriteMat;
}

function buildWarning(radius: number, axis: 'pitch' | 'yaw'): THREE.Group {
  const g = new THREE.Group();
  const ring = new THREE.Mesh(geo(`warnring|${q(radius)}`, () => new THREE.TorusGeometry(radius * 1.3, radius * 0.1, 6, 20)), ringMat);
  const glow = new THREE.Mesh(geo(`warnglow|${q(radius)}`, () => new THREE.SphereGeometry(radius * 1.15, 10, 6)), glowMat);
  if (axis === 'yaw') ring.rotation.x = Math.PI / 2;
  ring.renderOrder = glow.renderOrder = 5;
  const sprite = new THREE.Sprite(warnSprite());
  sprite.scale.set(0.4, 0.4, 1);
  sprite.center.set(0.5, -0.9);
  sprite.renderOrder = 9;
  g.add(ring, glow, sprite);
  return g;
}

/** Red ring and glow pulse about three times a second; one call per frame is enough for all joints. */
function pulseWarnings(nowMs: number): void {
  const p = 0.55 + 0.45 * Math.sin(nowMs * 0.008);
  ringMat.opacity = p;
  glowMat.opacity = 0.2 * p;
}

// ---------------------------------------------------------------- figure

/** One arm block as drawn: positioned and turned like the block it stands for, rebuilt only when its size, colour or hint changes. */
export class ArmPartFigure {
  readonly object = new THREE.Group();
  readonly part: ArmPartKind;
  private key = '';

  constructor(part: ArmPartKind) {
    this.part = part;
  }

  update(view: EntityView, mode: ViewMode, hint: ArmHint, nowMs: number): void {
    const { size } = view;
    const color = armPartColor(this.part, view.color);
    const warn = this.part === 'joint' && hint.overloaded === true;
    const key = [this.part, q(size.x), q(size.y), q(size.z), color, hint.axis ?? '', hint.side ?? 0, mode, warn].join('|');
    if (key !== this.key) {
      this.key = key;
      this.object.clear();
      this.object.add(this.build(size, color, hint, mode, warn));
      const owner = view.ownerNodeId;
      this.object.traverse((o) => {
        o.userData.ownerNodeId = owner;
      });
    }
    this.object.position.set(view.position.x, view.position.y, view.position.z);
    // Same turning rule as a plain block: about Z in the side view, about the vertical axis (and tilt) elsewhere.
    this.object.rotation.order = 'YZX';
    this.object.rotation.set(0, mode === '2d-side' ? 0 : (view.angle ?? 0), mode === '2d-side' ? (view.angle ?? 0) : mode === '3d' ? (view.tilt ?? 0) : 0);
    if (warn) pulseWarnings(nowMs);
    this.object.updateMatrixWorld();
  }

  private build(size: { x: number; y: number; z: number }, color: string, hint: ArmHint, mode: ViewMode, warn: boolean): THREE.Group {
    const out = new THREE.Group();
    switch (this.part) {
      case 'link':
        out.add(buildLink(size, color));
        break;
      case 'joint': {
        const axis = hint.axis ?? 'pitch';
        out.add(buildJoint(size, color, axis));
        if (warn) out.add(buildWarning(Math.max(size.x, size.y) * 0.56, axis));
        break;
      }
      case 'palm':
        out.add(buildPalm(size, color));
        break;
      case 'finger':
        out.add(buildFinger(size, color, hint.side ?? 1, mode));
        break;
      case 'housing':
        out.add(buildHousing(size, color));
        break;
      case 'rod':
        out.add(buildRod(size));
        break;
      case 'head':
        out.add(buildHead(size));
        break;
    }
    return out;
  }

  /** Geometry and materials are shared by every figure, so there is nothing per-figure to free. */
  dispose(): void {
    this.object.clear();
  }
}
