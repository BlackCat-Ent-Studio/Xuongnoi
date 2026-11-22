import * as THREE from 'three';
import type { BlockStyle } from '../engine/block-styles';
import type { EntityView, Vec3 } from '../engine/types';
import { adjustColor } from './arm-part-models';
import { VERTEX_TOON_DOUBLE, bakedMesh, box, canvasTexture, cyl, glowMat, q, rbox, sizeKey, toonMapMat, type Part } from './factory-kit';

/**
 * Factory looks for blocks ("Kiểu dáng"): the open-frame conveyor, the scan gate, the drop chute with its cloth bag,
 * the arm base and the little code display. Each is built in real units inside the block's own box (the block's top is the belt surface, the
 * floor level round a chute, the plane the arm stands on), so nothing is stretched when the block is resized; only a
 * chute's number board and kerb rise above the box. Collision is the block's own box, as for every look.
 *
 * A block still in the node's default grey gets the look's own colour; any other colour is the user's.
 */

/** The styles drawn here. */
export const FACTORY_BLOCK_STYLES: readonly BlockStyle[] = ['belt-frame', 'scan-gate', 'chute', 'arm-base', 'code-display'];
export const isFactoryBlockStyle = (style: string): boolean => (FACTORY_BLOCK_STYLES as readonly string[]).includes(style);

const BLOCK_DEFAULT = '#a3a3a3';
const DARK = '#2a2d34';
const TYRE = '#23252b';
const STEEL = '#8f97a3';
const YELLOW = '#ffc21a';
const BELT_BLUE = '#2f7fe0';
const BAG_BLUE = '#7fa6d6';
const ARM_ORANGE = '#ff9f2e';
/** Gate lamp while the block still has the default colour: a dim "nothing here" blue. */
const GATE_IDLE = '#2b6f86';

const hexOf = (color: string): string => `#${new THREE.Color(color).getHexString()}`;
const ownColor = (color: string, look: string): string => (hexOf(color) === BLOCK_DEFAULT ? look : hexOf(color));

/** A block laid out along its longer horizontal side: `u` along, `v` across. */
class Lay {
  readonly alongX: boolean;
  readonly long: number;
  readonly short: number;
  constructor(readonly size: Vec3) {
    this.alongX = size.x >= size.z;
    this.long = Math.max(size.x, size.z);
    this.short = Math.min(size.x, size.z);
  }
  at(u: number, y: number, v: number): [number, number, number] {
    return this.alongX ? [u, y, v] : [v, y, u];
  }
  /** A box given as along x up x across. */
  box(u: number, h: number, v: number): THREE.BufferGeometry {
    return this.alongX ? box(u, h, v) : box(v, h, u);
  }
  rbox(u: number, h: number, v: number, r: number): THREE.BufferGeometry {
    return this.alongX ? rbox(u, h, v, r) : rbox(v, h, u, r);
  }
  /** Axis name of the across direction (for a roller lying across the belt). */
  get acrossAxis(): 'x' | 'z' {
    return this.alongX ? 'z' : 'x';
  }
}

// ---------------------------------------------------------------- conveyor

/** Side rails are this wide and the belt surface stops this far short of each end (m). */
const BELT_RAIL = 0.05;
const BELT_END = 0.03;
/** Length of one chevron of the belt picture (m). */
const CHEVRON = 0.4;

function beltFrameParts(size: Vec3, color: string): Part[] {
  const f = new Lay(size);
  const L = f.long;
  const W = f.short;
  const H = size.y;
  const top = H / 2;
  const floor = -H / 2;
  const bw = Math.max(W - 2 * BELT_RAIL, W * 0.5);
  const parts: Part[] = [{ geo: f.box(L - 2 * BELT_END, Math.min(0.06, H * 0.5), bw), color: DARK, at: f.at(0, top - 0.002 - Math.min(0.06, H * 0.5) / 2, 0) }];
  const railH = Math.min(0.1, H);
  for (const s of [-1, 1]) {
    parts.push({ geo: f.rbox(L, railH, BELT_RAIL, 0.015), color, at: f.at(0, top + 0.01 - railH / 2, s * (W / 2 - BELT_RAIL / 2)) });
    parts.push({ geo: cyl(f.acrossAxis, Math.min(0.045, H * 0.4), bw, 12), color: TYRE, at: f.at(s * (L / 2 - 0.05), top - 0.004 - Math.min(0.045, H * 0.4), 0) });
  }
  // Open legs under the frame, one pair about every 1.6 m; a belt lying low on the floor has none.
  const legH = H - 0.09;
  if (legH > 0.05) {
    const inset = Math.min(0.25, L * 0.2);
    const pairs = Math.max(2, Math.round((L - 2 * inset) / 1.6) + 1);
    for (let i = 0; i < pairs; i++) {
      const u = -L / 2 + inset + ((L - 2 * inset) * i) / (pairs - 1);
      for (const s of [-1, 1]) {
        const v = s * (W / 2 - 0.055);
        parts.push({ geo: rbox(0.05, legH, 0.05, 0.01), color: STEEL, at: f.at(u, floor + legH / 2, v) });
        parts.push({ geo: rbox(0.11, 0.02, 0.11, 0.008), color: TYRE, at: f.at(u, floor + 0.01, v) });
      }
    }
    if (legH > 0.25) for (const s of [-1, 1]) parts.push({ geo: f.box(L - 2 * inset, 0.03, 0.03), color: STEEL, at: f.at(0, floor + Math.min(0.16, legH * 0.4), s * (W / 2 - 0.055)) });
  }
  return parts;
}

/** Drawn height and thickness of the low lip that stands for a side wall of the open-frame belt (m). */
const BELT_LIP_HEIGHT = 0.07;
const BELT_LIP_THICK = 0.04;

/** True for a block that is an open-frame belt (not one of its walls). */
export function isBeltFrame(e: EntityView): boolean {
  return e.kind === 'block' && e.belt !== undefined && e.blockStyle === 'belt-frame';
}

/**
 * A side wall of the open-frame belt as it is drawn: a low lip in the frame's colour along the foot of the wall.
 * The real wall keeps its full height; a tall slab would hide what rides on the belt.
 */
export function beltLipView(wall: EntityView): EntityView {
  const across: 'x' | 'z' = wall.size.x <= wall.size.z ? 'x' : 'z';
  const height = Math.min(BELT_LIP_HEIGHT, wall.size.y);
  const size = { ...wall.size, y: height };
  size[across] = Math.min(BELT_LIP_THICK, wall.size[across]);
  return { ...wall, size, color: ownColor(wall.color, BELT_BLUE), position: { ...wall.position, y: wall.position.y - wall.size.y / 2 + height / 2 } };
}

function chevronTexture(): THREE.Texture | null {
  return canvasTexture('belt-chevron', 128, 128, (g, W) => {
    g.fillStyle = '#2f333b';
    g.fillRect(0, 0, W, W);
    g.strokeStyle = '#59606b';
    g.lineWidth = 9;
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(44, 24);
    g.lineTo(84, 64);
    g.lineTo(44, 104);
    g.stroke();
  });
}

const planes = new Map<string, THREE.PlaneGeometry>();
function planeGeo(w: number, h: number): THREE.PlaneGeometry {
  const key = `${q(w)}|${q(h)}`;
  let g = planes.get(key);
  if (!g) {
    g = new THREE.PlaneGeometry(w, h);
    planes.set(key, g);
  }
  return g;
}

/** The moving surface: a chevron picture that travels with the belt's own travelled distance. */
function beltSurface(parent: THREE.Group, size: Vec3): (view: EntityView) => void {
  const base = chevronTexture();
  const tex = base ? base.clone() : null;
  if (tex) {
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.needsUpdate = true;
  }
  const material = tex ? toonMapMat(tex) : new THREE.MeshLambertMaterial({ color: '#2f333b' });
  let mesh: THREE.Mesh | null = null;
  let axis: 'x' | 'z' | '' = '';
  return (view) => {
    const a = view.belt?.axis ?? (size.x >= size.z ? 'x' : 'z');
    const run = Math.max(size[a] - 2 * BELT_END, 0.05);
    if (a !== axis) {
      axis = a;
      if (mesh) parent.remove(mesh);
      const o = a === 'x' ? 'z' : 'x';
      const across = Math.max(size[o] - 2 * BELT_RAIL, size[o] * 0.5);
      mesh = new THREE.Mesh(planeGeo(run, across), material);
      mesh.rotation.order = 'YXZ';
      mesh.rotation.set(-Math.PI / 2, a === 'x' ? 0 : -Math.PI / 2, 0);
      mesh.position.y = size.y / 2;
      mesh.receiveShadow = true;
      mesh.userData.ownerNodeId = parent.userData.ownerNodeId;
      parent.add(mesh);
    }
    if (!tex) return;
    // Chevrons point the way the belt runs; the picture shifts by the distance the belt has travelled.
    const dir = (view.belt?.speed ?? 1) < 0 ? -1 : 1;
    const repeat = (dir * run) / CHEVRON;
    tex.repeat.set(repeat, 1);
    tex.offset.x = -((view.belt?.phase ?? 0) * repeat) / run;
  };
}

// ---------------------------------------------------------------- scan gate

function gateFrameParts(size: Vec3): Part[] {
  const f = new Lay(size);
  const S = f.long; // the gate spans the block's longer side; the belt passes through along the shorter one
  const D = f.short;
  const H = size.y;
  const top = H / 2;
  const floor = -H / 2;
  const post = Math.min(0.06, D, S * 0.2);
  const beamY = top - 0.05 - 0.03;
  const k = Math.min(1, D / 0.14);
  const parts: Part[] = [
    { geo: f.rbox(S, 0.06, Math.min(0.08, D), 0.012), color: YELLOW, at: f.at(0, beamY, 0) },
    { geo: f.rbox(Math.min(0.22, S * 0.4), 0.06, 0.14 * k, 0.012), color: TYRE, at: f.at(0, beamY - 0.055, 0) },
  ];
  for (const s of [-1, 1]) parts.push({ geo: rbox(post, Math.max(beamY - floor, 0.05), post, 0.012), color: YELLOW, at: f.at(s * (S / 2 - post / 2), (beamY + floor) / 2, 0) });
  return parts;
}

function gateLampParts(size: Vec3): Part[] {
  const f = new Lay(size);
  const S = f.long;
  const top = size.y / 2;
  const beamY = top - 0.05 - 0.03;
  const k = Math.min(1, f.short / 0.14);
  return [
    { geo: f.box(Math.max(S - 0.19, S * 0.4) * 0.7, 0.02, 0.024 * k), color: '#ffffff', at: f.at(0, beamY - 0.092, 0) },
    { geo: cyl('y', 0.035 * k, 0.05, 12), color: '#ffffff', at: f.at(0, top - 0.025, 0) },
  ];
}

// ---------------------------------------------------------------- chute

/** Width of the kerb round the hole and how far it stands above the floor (m). */
const KERB = 0.07;
const KERB_UP = 0.05;
const BOARD_UP = 1.1;

interface ChuteDims {
  funnelH: number;
  bagH: number;
  holeX: number;
  holeZ: number;
  board: number;
  boardAt: [number, number, number];
}

function chuteDims(size: Vec3): ChuteDims {
  const funnelH = Math.min(0.3, size.y * 0.4);
  const board = Math.min(0.38, size.x);
  return {
    funnelH,
    bagH: Math.max(size.y - funnelH - 0.02, 0.03),
    holeX: Math.max(size.x - 2 * KERB, size.x * 0.5),
    holeZ: Math.max(size.z - 2 * KERB, size.z * 0.5),
    board,
    // on the back kerb, at its left end, inside the block's footprint
    boardAt: [-size.x / 2 + board / 2, size.y / 2 + BOARD_UP, -size.z / 2 + KERB / 2],
  };
}

function chuteSolidParts(size: Vec3, boardColor: string): Part[] {
  const top = size.y / 2;
  const d = chuteDims(size);
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    // sunk a few millimetres into the floor, so the rounded underside leaves no slit
    parts.push({ geo: rbox(size.x, KERB_UP + 0.006, KERB, 0.018), color: YELLOW, at: [0, top + KERB_UP / 2 - 0.003, s * (size.z / 2 - KERB / 2)] });
    parts.push({ geo: rbox(KERB, KERB_UP + 0.006, size.z, 0.018), color: YELLOW, at: [s * (size.x / 2 - KERB / 2), top + KERB_UP / 2 - 0.003, 0] });
  }
  const [bx, by, bz] = d.boardAt;
  const k = d.board / 0.38;
  parts.push({ geo: cyl('y', 0.022, BOARD_UP - 0.16 * k, 8), color: STEEL, at: [bx, top + (BOARD_UP - 0.16 * k) / 2, bz] });
  parts.push({ geo: cyl('y', 0.032, 0.02, 12), color: DARK, at: [bx, top + KERB_UP + 0.008, bz] });
  parts.push({ geo: rbox(d.board, 0.32 * k, 0.035, 0.03), color: boardColor, at: [bx, by, bz] });
  // the ring the bag hangs on
  const ringR = Math.min(d.holeX, d.holeZ) * 0.32;
  const ring = new THREE.TorusGeometry(ringR, 0.014, 6, 16);
  ring.rotateX(Math.PI / 2);
  parts.push({ geo: ring, color: '#343841', at: [0, -size.y / 2 + d.bagH, 0] });
  return parts;
}

/** Funnel and cloth bag: thin shells seen from both sides. */
function chuteShellParts(size: Vec3, bagColor: string): Part[] {
  const top = size.y / 2;
  const d = chuteDims(size);
  // a four-sided funnel: built for a square hole of side 1, then stretched to the hole
  const funnel = new THREE.CylinderGeometry(Math.SQRT1_2, 0.3 * Math.SQRT2, d.funnelH, 4, 1, true);
  funnel.rotateY(Math.PI / 4);
  funnel.scale(d.holeX, 1, d.holeZ);
  const R = Math.min(d.holeX, d.holeZ) / 0.8;
  const profile = [[0.02, 0], [0.2, 0.01], [0.28, 0.1], [0.3, 0.5], [0.27, 0.86], [0.25, 1]] as const;
  const bag = new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r * R, y * d.bagH)), 12);
  return [
    { geo: funnel, color: '#6b7380', at: [0, top - 0.004 - d.funnelH / 2, 0] },
    { geo: bag, color: bagColor, at: [0, -size.y / 2, 0] },
  ];
}

const numberMats = new Map<string, THREE.MeshBasicMaterial | null>();
/** A big white number or short word with no background, for the chute's board. */
function numberMaterial(text: string): THREE.MeshBasicMaterial | null {
  if (numberMats.has(text)) return numberMats.get(text) ?? null;
  const tex = canvasTexture(`chute-number|${text}`, 128, 128, (g) => {
    g.fillStyle = '#ffffff';
    let px = 104;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = `800 ${px}px "Segoe UI",Arial,sans-serif`;
    const wide = g.measureText(text).width;
    if (wide > 116) {
      px = Math.max(18, (px * 116) / wide);
      g.font = `800 ${px}px "Segoe UI",Arial,sans-serif`;
    }
    g.fillText(text, 64, 70);
  });
  const mat = tex ? new THREE.MeshBasicMaterial({ map: tex, transparent: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) : null;
  numberMats.set(text, mat);
  return mat;
}

// ---------------------------------------------------------------- code display

/** Seconds the screens stay lit up after a display appears with a number on it (a fresh read). */
const DISPLAY_FLASH_S = 0.35;
const SCREEN_GREEN = '#6dff96';

const screenMats = new Map<string, THREE.MeshBasicMaterial | null>();
/** A dark screen with a green number; an empty screen shows a dim dash. Null where there is no canvas. */
function screenMaterial(text: string): THREE.MeshBasicMaterial | null {
  if (screenMats.has(text)) return screenMats.get(text) ?? null;
  const tex = canvasTexture(`code-screen|${text}`, 160, 128, (g, W, H) => {
    g.fillStyle = '#0c1410';
    g.beginPath();
    g.roundRect(0, 0, W, H, 14);
    g.fill();
    g.strokeStyle = '#3a4a40';
    g.lineWidth = 5;
    g.beginPath();
    g.roundRect(3, 3, W - 6, H - 6, 12);
    g.stroke();
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    if (!text) {
      g.fillStyle = '#2f6b45';
      g.fillRect(W / 2 - 22, H / 2 - 5, 44, 10);
      return;
    }
    g.fillStyle = SCREEN_GREEN;
    g.shadowColor = '#3cff78';
    g.shadowBlur = 12;
    let px = 104;
    g.font = `800 ${px}px ui-monospace,Consolas,monospace`;
    const wide = g.measureText(text).width;
    if (wide > 136) {
      px = Math.max(18, (px * 136) / wide);
      g.font = `800 ${px}px ui-monospace,Consolas,monospace`;
    }
    g.fillText(text, W / 2, H * 0.55);
  });
  const mat = tex ? new THREE.MeshBasicMaterial({ map: tex, transparent: true }) : null;
  screenMats.set(text, mat);
  return mat;
}

/** Centre and turn of the four screens of a display (one per upright face), and their width and height. */
export function displayScreens(size: Vec3): { w: number; h: number; at: [number, number, number]; turn: number }[] {
  return [0, 1, 2, 3].map((k) => {
    const a = (k * Math.PI) / 2;
    const alongX = k % 2 === 1; // faces +x / -x: the screen is as wide as the box is deep
    return {
      w: (alongX ? size.z : size.x) * 0.8,
      h: size.y * 0.8,
      at: [Math.sin(a) * (size.x / 2 + 0.002), 0, Math.cos(a) * (size.z / 2 + 0.002)],
      turn: a,
    };
  });
}

/**
 * The display: a dark box with the same number on all four upright faces, so it reads from every side. When it shows a
 * number it lights up for a moment (it was just read). Returns what to run each frame and what to free, or null when nothing moves.
 */
function addDisplay(parent: THREE.Group, size: Vec3, text: string): { tick(): void; dispose(): void } | null {
  parent.add(bakedMesh(`code-display|${sizeKey(size)}`, () => [{ geo: rbox(size.x, size.y, size.z, 0.02), color: TYRE }]));
  const mat = screenMaterial(text);
  if (!mat) return null;
  const glow = text ? new THREE.MeshBasicMaterial({ color: '#d9ffe4', transparent: true, opacity: 0, depthWrite: false }) : null;
  for (const s of displayScreens(size)) {
    const screen = new THREE.Mesh(planeGeo(s.w, s.h), mat);
    screen.position.set(...s.at);
    screen.rotation.y = s.turn;
    parent.add(screen);
    if (!glow) continue;
    const flash = new THREE.Mesh(planeGeo(s.w, s.h), glow);
    flash.position.set(s.at[0] * 1.02, 0, s.at[2] * 1.02);
    flash.rotation.y = s.turn;
    flash.renderOrder = 3;
    parent.add(flash);
  }
  if (!glow) return null;
  const born = performance.now();
  return {
    tick() {
      const t = (performance.now() - born) / 1000;
      glow.opacity = t < DISPLAY_FLASH_S ? 0.85 * (1 - t / DISPLAY_FLASH_S) : 0;
    },
    dispose: () => glow.dispose(),
  };
}

// ---------------------------------------------------------------- arm base

function armBaseParts(size: Vec3, color: string): Part[] {
  const r = Math.min(size.x, size.z) / 2;
  const h = size.y;
  const floor = -h / 2;
  const foot = Math.min(0.05, h * 0.25);
  const collar = Math.min(0.04, h * 0.2);
  const cone = Math.max(h - foot - collar, 0.01);
  return [
    { geo: cyl('y', r, foot, 24), color: DARK, at: [0, floor + foot / 2, 0] },
    { geo: cyl('y', r * 0.86, 0.012, 24), color: '#ffd23f', at: [0, floor + foot + 0.004, 0] },
    { geo: cyl('y', r * 0.72, cone, 20, r * 0.52), color, at: [0, floor + foot + cone / 2, 0] },
    { geo: cyl('y', r * 0.58, collar, 20), color: DARK, at: [0, h / 2 - collar / 2, 0] },
  ];
}

// ---------------------------------------------------------------- figure

/** What `buildBlockLook` returns; repeated here so this file does not import the file that imports it. */
export interface FactoryBlockFigure {
  readonly object: THREE.Group;
  setColor(color: string): void;
  update(view: EntityView): void;
  dispose(): void;
}

/**
 * The factory look of a block. Like every block look it sits in the unit cube and the scene scales it to the block;
 * an inner group undoes that scale, so the parts keep their real sizes.
 */
export function buildFactoryBlockLook(style: BlockStyle, color: string, size: Vec3, label = '', seed = ''): FactoryBlockFigure {
  const object = new THREE.Group();
  const inner = new THREE.Group();
  object.add(inner);
  let box3: Vec3 = { ...size };
  let tint = hexOf(color);
  let animate: ((view: EntityView) => void) | null = null;
  let flash: { tick(): void; dispose(): void } | null = null;
  let lamp: THREE.Mesh | null = null;

  const paintLamp = (): void => {
    if (lamp) lamp.material = glowMat(tint === BLOCK_DEFAULT ? GATE_IDLE : tint);
  };

  const build = (): void => {
    inner.clear();
    animate = null;
    flash?.dispose();
    flash = null;
    lamp = null;
    const s = { x: Math.max(box3.x, 0.02), y: Math.max(box3.y, 0.02), z: Math.max(box3.z, 0.02) };
    inner.scale.set(1 / s.x, 1 / s.y, 1 / s.z);
    inner.userData.ownerNodeId = seed;
    const sk = sizeKey(s);
    if (style === 'belt-frame') {
      const c = ownColor(tint, BELT_BLUE);
      inner.add(bakedMesh(`belt-frame|${sk}|${c}`, () => beltFrameParts(s, c)));
      animate = beltSurface(inner, s);
    } else if (style === 'scan-gate') {
      inner.add(bakedMesh(`gate|${sk}`, () => gateFrameParts(s)));
      lamp = bakedMesh(`gate-lamp|${sk}`, () => gateLampParts(s), glowMat(GATE_IDLE));
      inner.add(lamp);
      paintLamp();
    } else if (style === 'chute') {
      const bag = ownColor(tint, BAG_BLUE);
      const board = tint === BLOCK_DEFAULT ? BELT_BLUE : adjustColor(tint, -0.08);
      inner.add(bakedMesh(`chute|${sk}|${board}`, () => chuteSolidParts(s, board)));
      inner.add(bakedMesh(`chute-shell|${sk}|${bag}`, () => chuteShellParts(s, bag), VERTEX_TOON_DOUBLE));
      const text = label.trim();
      const mat = text ? numberMaterial(text) : null;
      if (mat) {
        const d = chuteDims(s);
        const side = 0.3 * (d.board / 0.38);
        for (const face of [1, -1]) {
          const plane = new THREE.Mesh(planeGeo(side, side), mat);
          plane.position.set(d.boardAt[0], d.boardAt[1], d.boardAt[2] + face * 0.02);
          if (face < 0) plane.rotation.y = Math.PI;
          inner.add(plane);
        }
      }
    } else if (style === 'code-display') {
      flash = addDisplay(inner, s, label.trim());
    } else {
      const c = ownColor(tint, ARM_ORANGE);
      inner.add(bakedMesh(`arm-base|${sk}|${c}`, () => armBaseParts(s, c)));
    }
    inner.traverse((o) => {
      o.userData.ownerNodeId = seed;
    });
  };
  build();

  return {
    object,
    setColor(c) {
      const next = hexOf(c);
      if (next === tint) return;
      tint = next;
      if (style === 'scan-gate') paintLamp();
      else if (style !== 'code-display') build();
    },
    update(view) {
      const { x, y, z } = view.size;
      if (x !== box3.x || y !== box3.y || z !== box3.z) {
        box3 = { x, y, z };
        build();
      }
      animate?.(view);
      flash?.tick();
    },
    dispose() {
      flash?.dispose();
      inner.clear();
    },
  };
}
