import * as THREE from 'three';
import { TRAFFIC_COLORS, type BlockStyle } from '../engine/block-styles';
import type { EntityView, Vec3 } from '../engine/types';
import { adjustColor, toonMat } from './arm-part-models';
import { VERTEX_GLOW, VERTEX_TOON, VERTEX_TOON_DOUBLE, bakedMesh, box, canvasTexture, cyl, glowMat, q, rbox, sizeKey, toonMapMat, type Part } from './factory-kit';

/**
 * Factory looks for blocks ("Kiểu dáng"): the open-frame conveyor, the scan gate, the drop chute with its cloth bag,
 * the arm base and the little code display. Each is built in real units inside the block's own box (the block's top is the belt surface, the
 * floor level round a chute, the plane the arm stands on), so nothing is stretched when the block is resized; only a
 * chute's number board and kerb rise above the box. Collision is the block's own box, as for every look.
 *
 * A block still in the node's default grey gets the look's own colour; any other colour is the user's.
 *
 * The warehouse looks follow the same rules: the roll cage, the signal tower, the sliding hole cover, the dock door,
 * the scan gate with a light sheet, the floor paint and the warehouse scenery are drawn inside their block; the flatbed
 * truck keeps its footprint and only its cab, board and side rails rise above the box (the block's top is the bed).
 */

/** The styles drawn here. */
export const FACTORY_BLOCK_STYLES: readonly BlockStyle[] = [
  'belt-frame',
  'scan-gate',
  'chute',
  'arm-base',
  'code-display',
  'roll-cage',
  'signal-tower',
  'hole-cover',
  'truck-flatbed',
  'dock-door',
  'dock-door-open',
  'scan-gate-sheet',
  'warehouse',
  'floor-lane',
  'floor-frame',
];
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
      const t = Math.max(0, (performance.now() - born) / 1000);
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

// ---------------------------------------------------------------- shared by the warehouse looks

const STEEL_DARK = '#4a515c';
const WIRE = '#aab2bd';
const WHITE = '#f1f3f6';
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** A box that never gets a zero or negative side, however small the block is. */
const sbox = (w: number, h: number, d: number): THREE.BufferGeometry => box(Math.max(w, 0.001), Math.max(h, 0.001), Math.max(d, 0.001));
/** The parts moved as a whole. */
const moved = (parts: readonly Part[], dx: number, dy: number, dz: number): Part[] => parts.map((p) => ({ ...p, at: [(p.at?.[0] ?? 0) + dx, (p.at?.[1] ?? 0) + dy, (p.at?.[2] ?? 0) + dz] }));

const boxGeos = new Map<string, THREE.BoxGeometry>();
function boxGeo(w: number, h: number, d: number): THREE.BoxGeometry {
  const key = `${q(w)}|${q(h)}|${q(d)}`;
  let g = boxGeos.get(key);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    boxGeos.set(key, g);
  }
  return g;
}

// ---------------------------------------------------------------- roll cage

/** How far the frame of a roll cage stands outside the clear room inside it, on each side (m). */
export const CAGE_FRAME = 0.03;
const CAGE_PLATE = 0.05;
const CAGE_WHEEL = 0.05;

/** A roll cage: the clear room inside, the height of its mesh walls above the floor plate, the free height under the plate. */
export interface RollCageDims {
  insideX: number;
  insideZ: number;
  wall: number;
  clearance: number;
}

/** The cage a block of this size is drawn as: the block is its outer box, the floor plate lies 0.4 m up (lower in a low block). */
export function rollCageDims(size: Vec3): RollCageDims {
  const floorTop = Math.min(0.35 + CAGE_PLATE, size.y * 0.4);
  const plate = Math.min(CAGE_PLATE, floorTop / 2);
  return {
    insideX: Math.max(size.x - 2 * CAGE_FRAME, 0.02),
    insideZ: Math.max(size.z - 2 * CAGE_FRAME, 0.02),
    wall: Math.max(size.y - floorTop, 0.02),
    clearance: floorTop - plate,
  };
}

/**
 * A roll cage standing on y = 0: a dark floor plate on four small castors, a post at each corner and four walls of wire
 * mesh (thin wires about 10 cm apart, so what lies inside stays in view). `wire` colours the posts and the mesh.
 */
export function rollCageParts(d: RollCageDims, wire = WIRE): Part[] {
  const outX = d.insideX + 2 * CAGE_FRAME;
  const outZ = d.insideZ + 2 * CAGE_FRAME;
  const hx = outX / 2;
  const hz = outZ / 2;
  const plate = Math.min(CAGE_PLATE, Math.max(d.clearance, 0.004));
  const floorTop = d.clearance + plate;
  const parts: Part[] = [{ geo: rbox(outX, plate, outZ, 0.012), color: STEEL_DARK, at: [0, floorTop - plate / 2, 0] }];
  const r = Math.min(CAGE_WHEEL, d.clearance * 0.45);
  const foot = Math.min(0.07, hx, hz);
  // wires, top rail and posts all stand in the frame's 3 cm, outside the clear room
  const wallX = d.insideX / 2 + CAGE_FRAME / 2;
  const wallZ = d.insideZ / 2 + CAGE_FRAME / 2;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      // legs and castors sit in the corners: 0.85 m stays free between them both ways under a 1 m cage
      const x = sx * (hx - foot / 2 - 0.005);
      const z = sz * (hz - Math.max(foot / 2, r) - 0.005);
      parts.push({ geo: cyl('x', r, Math.min(0.05, foot), 14), color: TYRE, at: [x, r, z] });
      parts.push({ geo: cyl('x', r * 0.45, Math.min(0.056, foot * 1.1), 10), color: STEEL, at: [x, r, z] });
      parts.push({ geo: rbox(foot, Math.max(d.clearance - r, 0.006), foot, 0.012), color: STEEL_DARK, at: [x, r + (d.clearance - r) / 2, z] });
      parts.push({ geo: cyl('y', CAGE_FRAME / 2, d.wall, 8), color: wire, at: [sx * wallX, floorTop + d.wall / 2, sz * wallZ] });
    }
  }
  const rails = clamp(Math.round(d.wall / 0.125), 2, 24);
  const top = Math.max(d.wall - 0.014, 0.004);
  for (const alongX of [true, false]) {
    const run = (alongX ? d.insideX : d.insideZ) + CAGE_FRAME;
    const edge = alongX ? wallZ : wallX;
    const wires = clamp(Math.round(run / 0.1), 2, 40);
    for (const s of [-1, 1]) {
      for (let k = 1; k <= rails; k++) {
        const y = floorTop + (top * k) / rails;
        parts.push({ geo: cyl(alongX ? 'x' : 'z', k === rails ? 0.014 : 0.006, run, 6), color: wire, at: alongX ? [0, y, s * edge] : [s * edge, y, 0] });
      }
      for (let k = 1; k < wires; k++) {
        const t = -run / 2 + (run * k) / wires;
        parts.push({ geo: cyl('y', 0.006, top, 5), color: wire, at: alongX ? [t, floorTop + top / 2, s * edge] : [s * edge, floorTop + top / 2, t] });
      }
    }
  }
  return parts;
}

// ---------------------------------------------------------------- signal tower

/** Footprint and height the tower is drawn at full size in (m); a smaller block shrinks it, a taller one lengthens the pole. */
const TOWER_BASE = 0.14;
const TOWER_HEIGHT = 0.865;

/**
 * Which lens of the tower a block colour lights: 0 red (top), 1 yellow (middle), 2 green (bottom), by hue like the
 * traffic light, so "Đặt màu" 1 / 2 / 3 light them in that order. -1 = none: the block still has its default grey (or
 * any colour without a hue).
 */
export function signalTowerLamp(color: string): -1 | 0 | 1 | 2 {
  const hsl = { h: 0, s: 0, l: 0 };
  new THREE.Color(color).getHSL(hsl);
  if (hsl.s < 0.15) return -1;
  const deg = hsl.h * 360;
  if (deg < 20 || deg >= 300) return 0;
  return deg < 80 ? 1 : 2;
}

interface TowerDims {
  k: number;
  /** Height of the foot of the lens stack above the block's floor. */
  stack: number;
}

function towerDims(size: Vec3): TowerDims {
  const k = Math.max(Math.min(Math.min(size.x, size.z) / TOWER_BASE, size.y / TOWER_HEIGHT), 0.02);
  return { k, stack: size.y - 0.415 * k };
}

/** Height of the middle of lens `tier` (0 = bottom) above the block's floor. */
const towerLensY = (d: TowerDims, tier: number): number => d.stack + (0.13 * tier + 0.06) * d.k;

/** Foot, pole, cap and the three unlit lenses (green at the bottom, red on top, as on a real tower). */
function towerParts(size: Vec3): Part[] {
  const d = towerDims(size);
  const { k } = d;
  const floor = -size.y / 2;
  const pole = Math.max(d.stack - 0.03 * k, 0.004);
  const parts: Part[] = [
    { geo: cyl('y', 0.07 * k, 0.03 * k, 16), color: TYRE, at: [0, floor + 0.015 * k, 0] },
    { geo: cyl('y', 0.02 * k, pole, 10), color: STEEL, at: [0, floor + 0.03 * k + pole / 2, 0] },
    { geo: cyl('y', 0.05 * k, 0.03 * k, 14), color: TYRE, at: [0, floor + d.stack + 0.4 * k, 0] },
  ];
  for (let tier = 0; tier < 3; tier++) {
    const unlit = `#${new THREE.Color(TRAFFIC_COLORS[2 - tier]).multiplyScalar(0.28).getHexString()}`;
    parts.push({ geo: cyl('y', 0.048 * k, 0.012 * k, 16), color: TYRE, at: [0, floor + d.stack + (0.13 * tier - 0.004) * k, 0] });
    parts.push({ geo: cyl('y', 0.045 * k, 0.12 * k, 16), color: unlit, at: [0, floor + towerLensY(d, tier), 0] });
  }
  return parts;
}

// ---------------------------------------------------------------- hole cover

const COVER_RED = '#d92b2b';
/** Each rail is this wide, and the plate stops this far short of the block's side so the rail shows beside it (m). */
const COVER_RAIL = 0.03;
const COVER_SIDE = 0.04;

const coverMats = new Map<string, THREE.Material>();
/** Slanted stripes in the block colour and white; a plain colour where there is no canvas. */
function coverMaterial(color: string): THREE.Material {
  let m = coverMats.get(color);
  if (!m) {
    const tex = canvasTexture(`cover-stripes|${color}`, 256, 256, (g, w, h) => {
      g.fillStyle = color;
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ffffff';
      g.lineWidth = 30;
      for (let x = -h; x < w + h; x += 86) {
        g.beginPath();
        g.moveTo(x, h + 20);
        g.lineTo(x + h + 20, -20);
        g.stroke();
      }
    });
    m = tex ? toonMapMat(tex) : toonMat(color);
    coverMats.set(color, m);
  }
  return m;
}

/** Height of the rails of a cover of this height: the plate lies on them. */
const coverRail = (size: Vec3): number => Math.min(0.02, size.y * 0.5);

/** The two rails the plate slides on, along the block's longer side, at the foot of its two long edges. */
function coverRailParts(size: Vec3): Part[] {
  const f = new Lay(size);
  const h = coverRail(size);
  const w = Math.min(COVER_RAIL, f.short / 4);
  return [-1, 1].map((s) => ({ geo: f.box(f.long, h, w), color: STEEL_DARK, at: f.at(0, -size.y / 2 + h / 2, s * (f.short / 2 - w / 2)) }));
}

/** The striped plate: as long as the block, a little narrower, from just above the floor to the block's top. */
function coverPlate(size: Vec3, color: string): THREE.Mesh {
  const f = new Lay(size);
  const lift = coverRail(size) * 0.5;
  const across = Math.max(f.short - 2 * Math.min(COVER_SIDE, f.short / 4), 0.01);
  const thick = Math.max(size.y - lift, 0.002);
  const mesh = new THREE.Mesh(f.alongX ? boxGeo(f.long, thick, across) : boxGeo(across, thick, f.long), coverMaterial(color));
  mesh.position.y = size.y / 2 - thick / 2;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// ---------------------------------------------------------------- flatbed truck

/** Length of the block the cab takes at its low end along the longer side; the rest is the bed (m). */
const TRUCK_CAB = 1.55;
/** What each side rail (posts and top rail) and the board behind the cab take of the bed (m). */
const TRUCK_SIDE = 0.07;
const TRUCK_BOARD = 0.1;

interface TruckDims {
  cab: number;
  /** Width and height scale of cab and rails on a block narrower than a real truck. */
  k: number;
  /** Height scale of what hangs under the bed. */
  hk: number;
  bedFrom: number;
  bedLen: number;
}

function truckDims(size: Vec3): TruckDims {
  const f = new Lay(size);
  const cab = Math.min(TRUCK_CAB, f.long * 0.36);
  return { cab, k: clamp(f.short / 2.4, 0.02, 1), hk: clamp(size.y / 0.95, 0.02, 1.2), bedFrom: -f.long / 2 + cab, bedLen: f.long - cab };
}

/**
 * The clear bed of a truck block, in the block's own frame (middle of the block = 0): where cages can stand between the
 * board behind the cab (`from`), the open back (`to`) and the two side rails (`width` between them). `along` is the
 * block's longer horizontal side; `top` is the bed, which is the block's top.
 */
export function truckBed(size: Vec3): { along: 'x' | 'z'; from: number; to: number; width: number; top: number } {
  const f = new Lay(size);
  const d = truckDims(size);
  return { along: f.alongX ? 'x' : 'z', from: d.bedFrom + TRUCK_BOARD, to: f.long / 2, width: f.short - 2 * TRUCK_SIDE, top: size.y / 2 };
}

/**
 * A flatbed truck in the block's box: the block's top is the bed, its footprint the whole truck. The cab stands at the
 * low end of the longer side and rises above the box, as do the board behind it and the low side rails; the back is open.
 */
function truckParts(size: Vec3, color: string): Part[] {
  const f = new Lay(size);
  const d = truckDims(size);
  const { k, hk } = d;
  const L = f.long;
  const W = f.short;
  const top = size.y / 2;
  const floor = -size.y / 2;
  const front = -L / 2;
  const back = L / 2;
  const bedMid = d.bedFrom + d.bedLen / 2;
  const parts: Part[] = [];
  const add = (geo: THREE.BufferGeometry, c: string, u: number, y: number, v: number): void => void parts.push({ geo, color: c, at: f.at(u, y, v) });
  // chassis, wheels, bed
  const slab = Math.min(0.1, size.y * 0.3);
  add(f.box(Math.max(L - 0.3, L * 0.5), 0.2 * hk, 0.9 * k), STEEL_DARK, 0, top - 0.33 * hk, 0);
  const r = Math.min(0.42, size.y * 0.44);
  const tyre = Math.min(0.28 * k, W * 0.2);
  for (const u of [back - Math.min(0.85, d.bedLen * 0.3), front + d.cab * 0.5]) {
    for (const s of [-1, 1]) {
      add(cyl(f.acrossAxis, r, tyre, 18), TYRE, u, floor + r, s * (W / 2 - tyre / 2 - 0.08 * k));
      add(cyl(f.acrossAxis, r * 0.48, tyre * 1.07, 12), STEEL, u, floor + r, s * (W / 2 - tyre / 2 - 0.08 * k));
    }
  }
  add(f.box(d.bedLen, slab, W), STEEL_DARK, bedMid, top - slab / 2, 0);
  add(f.box(Math.min(0.1, L * 0.1), 0.14 * hk, W * 0.96), TYRE, back - Math.min(0.06, L * 0.06), top - 0.29 * hk, 0);
  // cab: body, windscreen, side windows, bumper
  const nose = Math.min(0.055, d.cab * 0.1);
  const cabFront = front + nose;
  const cabLen = Math.max(d.cab - nose - Math.min(0.1, d.cab * 0.1), 0.01);
  const cabMid = cabFront + cabLen / 2;
  const cabW = W * 0.92;
  const cabH = 1.75 * k;
  const cabFloor = top - 0.325 * hk;
  add(f.rbox(cabLen, cabH, cabW, 0.16 * k), color, cabMid, cabFloor + cabH / 2, 0);
  add(f.box(Math.min(0.05, cabLen * 0.2), 0.62 * k, cabW * 0.845), '#1d2733', cabFront + nose * 0.27, cabFloor + 1.255 * k, 0);
  for (const s of [-1, 1]) add(f.box(cabLen * 0.48, 0.55 * k, Math.min(0.05, W * 0.05)), '#1d2733', cabMid - cabLen * 0.16, cabFloor + 1.275 * k, s * (cabW / 2 - Math.min(0.015, W * 0.015)));
  add(f.rbox(Math.min(0.2, d.cab * 0.3), 0.3 * hk, W * 0.94, 0.05), TYRE, front + Math.min(0.1, d.cab * 0.15), top - 0.27 * hk, 0);
  // the board behind the cab, the kerbs, the low side rails, a yellow line at the open back
  const thin = Math.min(1, W / 0.6);
  add(f.box(Math.min(0.08, d.bedLen * 0.2), 1.5 * k, W), WHITE, d.bedFrom + Math.min(0.04, d.bedLen * 0.1), top + 0.75 * k, 0);
  add(f.box(Math.min(TRUCK_BOARD, d.bedLen * 0.25), 0.1 * k, W), color, d.bedFrom + Math.min(TRUCK_BOARD, d.bedLen * 0.25) / 2, top + 1.5 * k, 0);
  add(f.box(Math.min(0.05, d.bedLen * 0.1), 0.012, W * 0.95), YELLOW, back - Math.min(0.03, d.bedLen * 0.06), top + 0.006, 0);
  for (const s of [-1, 1]) {
    add(f.box(d.bedLen, 0.07 * k, 0.06 * thin), STEEL, bedMid, top + 0.035 * k, s * (W / 2 - 0.03 * thin));
    add(f.box(d.bedLen * 0.96, 0.44 * k, 0.05 * thin), WHITE, bedMid, top + 0.29 * k, s * (W / 2 - 0.025 * thin));
    add(f.box(d.bedLen, 0.07 * k, 0.07 * thin), color, bedMid, top + 0.53 * k, s * (W / 2 - 0.035 * thin));
    const post = Math.min(TRUCK_SIDE, d.bedLen * 0.1) * thin;
    for (const u of [back - post / 2, bedMid, d.bedFrom + post * 1.4]) add(f.box(post, 0.6 * k, post), STEEL, u, top + 0.3 * k, s * (W / 2 - post / 2));
  }
  return parts;
}

/** Tail lights and headlights, unlit so they read as lamps. */
function truckLightParts(size: Vec3): Part[] {
  const f = new Lay(size);
  const d = truckDims(size);
  const top = size.y / 2;
  const deep = Math.min(0.02, f.long * 0.01);
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    parts.push({ geo: f.box(deep, 0.1 * d.hk, f.short * 0.09), color: '#ff4b3e', at: f.at(f.long / 2 - deep * 0.6, top - 0.29 * d.hk, s * f.short * 0.396) });
    parts.push({ geo: f.box(deep, 0.12 * d.k, f.short * 0.108), color: '#fff6d8', at: f.at(-f.long / 2 + Math.min(0.055, d.cab * 0.1) - deep * 0.25, top - 0.05 * d.hk, s * f.short * 0.333) });
  }
  return parts;
}

// ---------------------------------------------------------------- dock door

const SHUTTER = '#39404b';

interface DoorDims {
  /** Clear opening: width between the posts and height under the lintel. */
  openW: number;
  openH: number;
  post: number;
  lintel: number;
  drum: number;
  /** Depth of the frame (flush with the block's low side across) and of the drum box (flush with its high side). */
  frameD: number;
  drumD: number;
}

function doorDims(size: Vec3): DoorDims {
  const f = new Lay(size);
  const post = Math.min(0.22, f.long * 0.15);
  const edge = Math.min(0.03, f.long * 0.02);
  const kh = Math.min(1, (size.y * 0.4) / 0.72);
  return { post, openW: Math.max(f.long - 2 * (post + edge), 0.01), lintel: 0.3 * kh, drum: 0.42 * kh, openH: Math.max(size.y - 0.72 * kh, 0.01), frameD: f.short * 0.84, drumD: f.short * 0.84 };
}

/** The clear opening of a dock door block: width between its posts and height under its lintel (m). */
export function dockDoorOpening(size: Vec3): { width: number; height: number } {
  const d = doorDims(size);
  return { width: d.openW, height: d.openH };
}

/**
 * A roll-up dock door filling the block: yellow posts and lintel, the drum box above them (it stands out on the block's
 * high side across, the inside of the hall), and the slatted shutter with a yellow bottom bar. Closed, the shutter
 * fills the opening; open, only a short length of it hangs under the lintel.
 */
function dockDoorParts(size: Vec3, open: boolean, shutter: string): Part[] {
  const f = new Lay(size);
  const d = doorDims(size);
  const floor = -size.y / 2;
  const S = f.long;
  const frameV = -f.short / 2 + d.frameD / 2;
  const parts: Part[] = [];
  const add = (geo: THREE.BufferGeometry, c: string, u: number, y: number, v: number): void => void parts.push({ geo, color: c, at: f.at(u, y, v) });
  for (const s of [-1, 1]) add(f.box(d.post, d.openH, d.frameD), YELLOW, s * (d.openW / 2 + d.post / 2), floor + d.openH / 2, frameV);
  add(f.box(S, d.lintel, d.frameD), YELLOW, 0, floor + d.openH + d.lintel / 2, frameV);
  add(f.rbox(Math.max(S - 0.2, S * 0.8), d.drum, d.drumD, 0.05), STEEL_DARK, 0, size.y / 2 - d.drum / 2, f.short / 2 - d.drumD / 2);
  const hang = open ? Math.min(0.45, d.openH * 0.2) : d.openH;
  const thick = Math.min(0.08, d.frameD * 0.3);
  const bar = Math.min(0.1, hang * 0.5);
  const w = d.openW + Math.min(0.04, d.post);
  add(f.box(w, hang, thick), shutter, 0, floor + d.openH - hang / 2, frameV);
  const rib = adjustColor(shutter, 0.1);
  for (let y = 0.4, n = 0; y < hang - bar && n < 60; y += 0.4, n++) add(f.box(w, 0.04, thick * 1.25), rib, 0, floor + d.openH - y, frameV);
  add(f.box(w, bar, thick * 1.5), YELLOW, 0, floor + d.openH - hang + bar / 2, frameV);
  return parts;
}

// ---------------------------------------------------------------- light sheet of the scan gate

const SHEET_CYAN = '#4fdcff';
/** The sheet hangs this far down from the gate's beam (m): about the gap between beam and belt. */
const SHEET_DROP = 0.5;

interface SheetState {
  sheet: THREE.MeshBasicMaterial;
  line: THREE.MeshBasicMaterial;
  trail: THREE.MeshBasicMaterial | null;
  bars: THREE.MeshBasicMaterial;
  /** Seconds for the scan line to go down and up once, and how thick line and trail are drawn. */
  period: number;
  lineScale: number;
  trailScale: number;
}

let sheetStates: { idle: SheetState; read: SheetState } | null = null;
/** The two looks of the light sheet: waiting (faint, a slow cyan line) and just read (brighter, a fast white line). */
function sheetLook(): { idle: SheetState; read: SheetState } {
  if (sheetStates) return sheetStates;
  const fade = canvasTexture('scan-trail', 8, 64, (g, w, h) => {
    const grad = g.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
  });
  const state = (reading: boolean): SheetState => ({
    sheet: new THREE.MeshBasicMaterial({ color: SHEET_CYAN, transparent: true, opacity: reading ? 0.3 : 0.1, side: THREE.DoubleSide, depthWrite: false }),
    line: new THREE.MeshBasicMaterial({ color: reading ? '#ffffff' : SHEET_CYAN, transparent: true, opacity: reading ? 1 : 0.85, depthWrite: false }),
    trail: fade ? new THREE.MeshBasicMaterial({ color: SHEET_CYAN, map: fade, transparent: true, opacity: reading ? 0.95 : 0.5, side: THREE.DoubleSide, depthWrite: false }) : null,
    bars: glowMat(reading ? '#d8f8ff' : '#58bcd6'),
    period: reading ? 0.7 : 3.2,
    lineScale: reading ? 1.6 : 1,
    trailScale: reading ? 1.67 : 1,
  });
  sheetStates = { idle: state(false), read: state(true) };
  return sheetStates;
}

/** Where the sheet hangs in a gate block (block middle = 0): its width between the posts, its bottom and its height. */
export function lightSheetBox(size: Vec3): { width: number; bottom: number; height: number } {
  const f = new Lay(size);
  const post = Math.min(0.06, f.short, f.long * 0.2);
  const y1 = size.y / 2 - 0.08 - 0.1;
  const y0 = Math.max(-size.y / 2 + 0.01, y1 - SHEET_DROP);
  return { width: Math.max(f.long - 2 * post - 0.01, 0.01), bottom: y0, height: Math.max(y1 - y0, 0.01) };
}

/** Height of the scan line in a sheet at `seconds` on the clock: it runs up and down between 3 cm from each end. */
export function scanLineY(sheet: { bottom: number; height: number }, seconds: number, period: number): number {
  const u = (((seconds / period) % 1) + 1) % 1;
  return sheet.bottom + Math.min(0.03, sheet.height / 2) + Math.max(sheet.height - 0.06, 0) * (u < 0.5 ? u * 2 : 2 - u * 2);
}

interface LightSheet {
  setReading(reading: boolean): void;
  tick(): void;
}

/**
 * The light sheet under a scan gate: a glowing bar on the inside of each post, a faint sheet of light between them and
 * a scan line that runs up and down it. It has two looks (see `sheetLook`); only the bars are baked per gate size.
 */
function addLightSheet(parent: THREE.Group, size: Vec3): LightSheet {
  const f = new Lay(size);
  const b = lightSheetBox(size);
  const mid = b.bottom + b.height / 2;
  const look = sheetLook();
  const turn = f.alongX ? 0 : Math.PI / 2;
  const bars = bakedMesh(`sheet-bars|${sizeKey(size)}`, () => [-1, 1].map((s) => ({ geo: f.box(0.012, b.height, Math.min(0.014, f.short)), color: '#ffffff', at: f.at(s * (b.width / 2 - 0.004), mid, 0) })), look.idle.bars);
  bars.userData.sheetPart = 'bars';
  const sheet = new THREE.Mesh(planeGeo(b.width, b.height), look.idle.sheet);
  sheet.rotation.y = turn;
  sheet.position.y = mid;
  sheet.renderOrder = 3;
  sheet.userData.sheetPart = 'sheet';
  const line = new THREE.Mesh(boxGeo(b.width, 0.01, Math.min(0.014, f.short)), look.idle.line);
  line.rotation.y = turn;
  line.renderOrder = 4;
  line.userData.sheetPart = 'line';
  const trail = look.idle.trail ? new THREE.Mesh(planeGeo(b.width, 0.12), look.idle.trail) : null;
  if (trail) {
    trail.rotation.y = turn;
    trail.renderOrder = 4;
    trail.userData.sheetPart = 'trail';
  }
  parent.add(bars, sheet, line);
  if (trail) parent.add(trail);
  let state = look.idle;
  return {
    setReading(reading) {
      state = reading ? look.read : look.idle;
      bars.material = state.bars;
      sheet.material = state.sheet;
      line.material = state.line;
      line.scale.y = state.lineScale;
      if (trail && state.trail) {
        trail.material = state.trail;
        trail.scale.y = state.trailScale;
      }
    },
    tick() {
      const y = scanLineY(b, performance.now() / 1000, state.period);
      line.position.y = y;
      if (trail) trail.position.y = y;
    },
  };
}

// ---------------------------------------------------------------- floor paint

const PAINT_TEAL = '#0f8f80';
/** Paint lies this thick on the block's floor (m), or as thick as a thinner block. */
const PAINT_THICK = 0.012;

/** A lane line along the block's longer side with an arrow head about every 4 m; `reverse` turns the arrows round. */
function floorLaneParts(size: Vec3, color: string, reverse: boolean): Part[] {
  const f = new Lay(size);
  const t = Math.min(PAINT_THICK, size.y);
  const y = -size.y / 2 + t / 2;
  const parts: Part[] = [{ geo: f.box(f.long, t, Math.min(0.08, f.short)), color, at: f.at(0, y, 0) }];
  const head = Math.min(0.2, f.short / 2, f.long / 2);
  if (head < 0.05) return parts;
  const n = clamp(Math.round(f.long / 4.2), 1, 60);
  // a three-sided disc points to +z; it is turned to the block's long side, and round again for a lane that runs the other way
  const yaw = (f.alongX ? Math.PI / 2 : 0) + (reverse ? Math.PI : 0);
  for (let i = 0; i < n; i++) parts.push({ geo: cyl('y', head, t, 3), color, at: f.at(-f.long / 2 + ((i + 0.5) * f.long) / n, y, 0), turn: [0, yaw, 0] });
  return parts;
}

/** A painted outline along the four edges of the block's footprint. */
function floorFrameParts(size: Vec3, color: string): Part[] {
  const t = Math.min(PAINT_THICK, size.y);
  const y = -size.y / 2 + t / 2;
  const w = Math.min(0.06, size.x / 4, size.z / 4);
  const parts: Part[] = [];
  for (const s of [-1, 1]) {
    parts.push({ geo: sbox(size.x, t, w), color, at: [0, y, s * (size.z / 2 - w / 2)] });
    parts.push({ geo: sbox(w, t, size.z - 2 * w), color, at: [s * (size.x / 2 - w / 2), y, 0] });
  }
  return parts;
}

// ---------------------------------------------------------------- warehouse scenery

const WALL = '#e3e6ea';
const WALL_BAND = '#8e98a5';
const COLUMN = '#c5cad2';
const PALLET = '#b98a55';
const CARTON = '#cf9f62';
const WRAPS = [CARTON, '#d8c9a8', '#b9c8dc', CARTON, '#cfd6de'] as const;
const WALL_THICK = 0.3;
/** Distance between the middles of two dock doors, and between two rows of hall columns (m). */
const DOOR_PITCH = 4.8;
const COLUMN_PITCH = 6.8;

interface HallLayout {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  floor: number;
  /** Height of the walls above the floor; the roof trusses rise above it to the block's top. */
  eaves: number;
  rise: number;
  /** x of the two lines of free columns (the low-x one only in a wide hall). */
  eastX: number;
  westX: number | null;
  /** z of each row of columns, far (dock wall) to near. */
  rows: number[];
  door: Vec3;
  doors: number[];
}

function hallLayout(size: Vec3): HallLayout {
  const W = size.x;
  const D = size.z;
  const eastX = W / 2 - Math.min(2, W * 0.1);
  const rise = Math.min(1.8, (eastX + W / 2) * 0.06, size.y * 0.2);
  const eaves = Math.max(size.y - rise - 0.25, size.y * 0.5);
  const count = clamp(Math.floor((W - 3) / DOOR_PITCH), 0, 3);
  const shift = Math.min(2.2, W * 0.065);
  const rows: number[] = [];
  for (let k = 1; k <= Math.min(Math.floor((D - 2) / COLUMN_PITCH), 12); k++) rows.push(-D / 2 + WALL_THICK / 2 + COLUMN_PITCH * k);
  return {
    x0: -W / 2,
    x1: W / 2,
    z0: -D / 2,
    z1: D / 2,
    floor: -size.y / 2,
    eaves,
    rise,
    eastX,
    westX: W >= 20 ? -W / 2 + 6.5 : null,
    rows,
    door: { x: 3.5, y: Math.min(4.32, eaves * 0.6), z: Math.min(0.5, D * 0.2) },
    doors: Array.from({ length: count }, (_, i) => shift + (i - (count - 1) / 2) * DOOR_PITCH),
  };
}

/**
 * The dock doors a warehouse block draws in its far wall (low z): the middle and size a dock door block needs to cover
 * one exactly, relative to the middle of the warehouse block. The warehouse draws each as an open door, so a closed
 * door block put there shuts it while it is shown and opens it while it is hidden.
 */
export function warehouseDoors(size: Vec3): { position: Vec3; size: Vec3 }[] {
  const h = hallLayout(size);
  return h.doors.map((x) => ({ position: { x, y: h.floor + h.door.y / 2, z: h.z0 + h.door.z / 2 }, size: { ...h.door } }));
}

/**
 * A warehouse round whatever stands inside the block: the dock wall with its doors along the low-z side, a high wall
 * along the low-x side, hall columns, roof trusses with hanging lamps, pallet racks along the high wall, and the floor
 * paint that belongs to the building (dock line, door bays, a walkway). The two near sides stay open and the row of
 * columns nearest the open z side carries no truss, so the usual tilted camera looks in under nothing. `solid` is
 * shaded, `glow` is the lamps.
 */
function warehouseParts(size: Vec3, band: string): { solid: Part[]; glow: Part[] } {
  const h = hallLayout(size);
  const { x0, x1, z0, z1, eaves: E } = h;
  const W = x1 - x0;
  const D = z1 - z0;
  const solid: Part[] = [];
  const glow: Part[] = [];
  const add = (geo: THREE.BufferGeometry, color: string, x: number, y: number, z: number, turn?: [number, number, number]): void => void solid.push({ geo, color, at: [x, h.floor + y, z], ...(turn ? { turn } : {}) });
  const wallT = Math.min(WALL_THICK, W / 4, D / 4);
  const bandH = Math.min(1.3, E);
  const stripeY = Math.max(E * 0.62, h.door.y + 0.35);
  const stripe = stripeY + 0.2 < E;
  const pier = Math.min(0.4, W / 4, D / 4);

  // ---- dock wall: plain runs between the doors, the wall over each door, the doors themselves (drawn open)
  const wz = z0 + wallT / 2;
  const opening = dockDoorOpening(h.door);
  let from = x0;
  for (const run of [...h.doors.map((d) => d - opening.width / 2), x1]) {
    if (run > from) {
      add(sbox(run - from, E, wallT), WALL, (from + run) / 2, E / 2, wz);
      add(sbox(run - from, bandH, wallT * 1.2), WALL_BAND, (from + run) / 2, bandH / 2, z0 + wallT * 0.6);
    }
    from = run + opening.width;
  }
  for (const d of warehouseDoors(size)) {
    add(sbox(opening.width, E - opening.height, wallT), WALL, d.position.x, (E + opening.height) / 2, wz);
    solid.push(...moved(dockDoorParts(d.size, true, SHUTTER), d.position.x, d.position.y, d.position.z));
  }
  if (stripe) add(sbox(W, 0.4, wallT * 1.13), band, 0, stripeY, z0 + wallT * 0.565);
  const piers = [x0 + pier / 2];
  h.doors.forEach((d, i) => piers.push(i === 0 ? d - DOOR_PITCH / 2 : (d + h.doors[i - 1]!) / 2));
  if (h.doors.length > 0) piers.push(h.doors.at(-1)! + DOOR_PITCH / 2);
  piers.push(x1 - pier / 2);
  for (let i = 0; i < piers.length; i++) {
    const a = piers[i]!;
    add(sbox(pier, E, pier), COLUMN, a, E / 2, z0 + pier / 2 + wallT * 0.17);
    const gap = (piers[i + 1] ?? a) - a;
    const extra = Math.min(Math.round(gap / 5.5) - 1, 12);
    if (gap > 7) for (let k = 1; k <= extra; k++) add(sbox(pier, E, pier), COLUMN, a + (gap * k) / (extra + 1), E / 2, z0 + pier / 2 + wallT * 0.17);
  }

  // ---- high side wall with its band, stripe and piers
  const wx = x0 + wallT / 2;
  add(sbox(wallT, E, D), WALL, wx, E / 2, 0);
  add(sbox(wallT * 1.2, bandH, D), WALL_BAND, x0 + wallT * 0.6, bandH / 2, 0);
  if (stripe) add(sbox(wallT * 1.13, 0.4, D), band, x0 + wallT * 0.565, stripeY, 0);
  for (const z of [...h.rows, z1 - pier / 2]) add(sbox(pier, E, pier), COLUMN, x0 + pier / 2 + wallT * 0.17, E / 2, z);

  // ---- free columns with a yellow guard at the foot
  for (const x of h.westX === null ? [h.eastX] : [h.westX, h.eastX]) {
    for (const z of h.rows) {
      add(sbox(0.42, E, 0.42), COLUMN, x, E / 2, z);
      add(sbox(0.56, Math.min(1.1, E), 0.56), YELLOW, x, Math.min(1.1, E) / 2, z);
      add(sbox(0.58, 0.14, 0.58), TYRE, x, Math.min(0.75, E * 0.6), z);
    }
  }

  // ---- roof trusses from the high wall to the far line of columns (none over the nearest row), purlins, lamps
  const xa = x0 + wallT / 2;
  const span = h.eastX - xa;
  const xm = (xa + h.eastX) / 2;
  const low = Math.max(E - 0.5, E * 0.8);
  const T = Math.min(0.12, E * 0.05);
  const panels = 2 * clamp(Math.round(span / 8), 1, 6);
  const topY = (x: number): number => E + h.rise * (1 - Math.abs((x - xm) / (span / 2)));
  const trussRows = D > 2 ? [z0 + Math.min(0.45, D * 0.1), ...h.rows.slice(0, -1)] : [];
  for (const z of trussRows) {
    add(sbox(span, T, T), STEEL_DARK, xm, low, z);
    const slope = Math.atan2(h.rise, span / 2);
    for (const s of [-1, 1]) add(sbox(Math.hypot(h.rise, span / 2), T, T), STEEL_DARK, xm + (s * span) / 4, E + h.rise / 2, z, [0, 0, -s * slope]);
    for (let i = 0; i <= panels; i++) {
      const x = xa + (span * i) / panels;
      const up = topY(x) - low;
      add(sbox(T * 0.8, up, T * 0.8), STEEL_DARK, x, low + up / 2, z);
      if (i === panels) continue;
      const x2 = xa + (span * (i + 1)) / panels;
      const rising = i < panels / 2;
      const ya = rising ? low : topY(x);
      const yb = rising ? topY(x2) : low;
      add(sbox(Math.hypot(x2 - x, yb - ya), T * 0.7, T * 0.7), STEEL_DARK, (x + x2) / 2, (ya + yb) / 2, z, [0, 0, Math.atan2(yb - ya, x2 - x)]);
    }
  }
  const lastTruss = trussRows.at(-1);
  if (lastTruss !== undefined && trussRows.length > 1) {
    for (let i = 0; i <= 4; i++) {
      const x = xa + (span * i) / 4;
      add(sbox(0.1, 0.1, lastTruss - z0), STEEL, x, topY(x) + 0.11, (lastTruss + z0) / 2);
    }
  }
  const rod = Math.min(1.6, low * 0.2);
  for (const z of trussRows.slice(1)) {
    for (const share of [0.33, 0.55, 0.77]) {
      const x = xa + span * share;
      add(cyl('y', 0.015, rod, 5), STEEL_DARK, x, low - rod / 2, z);
      add(cyl('y', 0.4, 0.2, 12, 0.14), STEEL_DARK, x, low - rod - 0.1, z);
      glow.push({ geo: cyl('y', 0.32, 0.03, 12), color: '#fff6d8', at: [x, h.floor + low - rod - 0.21, z] });
    }
  }

  // ---- pallet racks along the high wall, clear of the middle of the hall; a few loose pallets
  const rackTop = Math.min(5.4, E - 0.4);
  const bay = 2.9;
  const lines: [number, number, number][] = [];
  if (W >= 16) lines.push([x0 + 1.3, z0 + 6.5, z1 - 1]);
  if (W >= 20) lines.push([x0 + 3.9, z0 + 11.3, z1 - 1]);
  if (rackTop >= 1.6) {
    for (const [rx, zFrom, zTo] of lines) {
      for (let z = zFrom, i = 0; z + bay <= zTo && i < 40; z += bay, i++) {
        for (const s of [0, bay]) for (const k of [-0.5, 0.5]) add(sbox(0.1, rackTop, 0.1), '#2a5fb0', rx + k, rackTop / 2, z + s);
        for (const y of [1.8, 3.55, 5.2]) if (y <= rackTop) for (const k of [-0.5, 0.5]) add(sbox(0.06, 0.12, bay), ARM_ORANGE, rx + k, y, z + bay / 2);
        [0.15, 1.9, 3.65].forEach((y, l) => {
          if (y + 1.75 > rackTop) return;
          for (const p of [0.75, 2.15]) {
            if ((i * 3 + l * 5 + Math.round(p)) % 7 === 0) continue;
            const tall = 0.7 + ((i + l) % 3) * 0.25;
            add(sbox(1.0, 0.14, 1.2), PALLET, rx, y + 0.07, z + p);
            add(sbox(0.92, tall, 1.08), WRAPS[(i + l * 2 + Math.round(p)) % WRAPS.length]!, rx, y + 0.14 + tall / 2, z + p);
          }
        });
      }
    }
  }
  if (W >= 16 && D >= 14 && E >= 1.6) {
    for (const [px, pz, tall, c] of [[x0 + 4.5, z0 + 8.8, 1.1, 0], [x0 + 4.6, z0 + 7.3, 0.8, 2], [x1 - 5, z1 - 2.4, 1.0, 4], [x1 - 3.5, z1 - 2.2, 0.7, 0]] as const) {
      add(sbox(1.2, 0.14, 1.0), PALLET, px, 0.07, pz);
      add(sbox(1.08, tall, 0.92), WRAPS[c]!, px, 0.14 + tall / 2, pz);
    }
  }

  // ---- floor paint of the building: the dock line, a bay each side of every door, a walkway along the open side
  const paint = Math.min(PAINT_THICK, size.y / 4);
  if (D >= 12) {
    const dockZ = z0 + 6.2;
    add(sbox(W - 1, paint, 0.12), YELLOW, 0, 0.002 + paint / 2, dockZ);
    for (const d of h.doors) {
      for (const s of [-1, 1]) {
        const x = d + s * (opening.width / 2 + 0.1);
        add(sbox(0.1, paint, 1.0), YELLOW, x, 0.002 + paint / 2, dockZ + 0.56);
        add(sbox(0.1, paint, 5.4), WHITE, x, 0.002 + paint / 2, dockZ - 0.06 - 2.7);
      }
    }
  }
  if (D >= 16 && W >= 10) {
    const len = Math.min(22, W * 0.65);
    const wayX = Math.min(1, W * 0.03);
    const wayZ = z1 - 2.8;
    add(sbox(len, paint, 1.03), '#8fc79a', wayX, 0.002 + paint / 2, wayZ);
    for (const s of [-1, 1]) add(sbox(len, paint, 0.07), WHITE, wayX, 0.002 + paint / 2, wayZ + s * 0.55);
    for (let x = wayX - len / 2 + 1; x <= wayX + len / 2 - 0.5; x += 2) add(sbox(0.5, paint, 0.7), WHITE, x, 0.003 + paint / 2, wayZ);
  }
  return { solid, glow };
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
  let sheet: LightSheet | null = null;
  let lens: THREE.Mesh | null = null;

  /** The tower lens the block colour lights glows in that colour; none while the block has no colour of its own. */
  const lightTower = (): void => {
    if (!lens) return;
    const lit = tint === BLOCK_DEFAULT ? -1 : signalTowerLamp(tint);
    lens.visible = lit >= 0;
    if (lit < 0) return;
    lens.position.y = -Math.max(box3.y, 0.02) / 2 + towerLensY(towerDims(box3), 2 - lit);
    lens.material = glowMat(tint);
  };

  const paintLamp = (): void => {
    if (lamp) lamp.material = glowMat(tint === BLOCK_DEFAULT ? GATE_IDLE : tint);
  };

  const build = (): void => {
    inner.clear();
    animate = null;
    flash?.dispose();
    flash = null;
    lamp = null;
    sheet = null;
    lens = null;
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
    } else if (style === 'roll-cage') {
      const c = ownColor(tint, WIRE);
      inner.add(bakedMesh(`roll-cage|${sk}|${c}`, () => moved(rollCageParts(rollCageDims(s), c), 0, -s.y / 2, 0)));
    } else if (style === 'signal-tower') {
      inner.add(bakedMesh(`tower|${sk}`, () => towerParts(s)));
      const k = towerDims(s).k;
      lens = bakedMesh(`tower-lens|${q(k)}`, () => [{ geo: cyl('y', 0.047 * k, 0.118 * k, 16), color: '#ffffff' }], glowMat(GATE_IDLE));
      inner.add(lens);
      lightTower();
    } else if (style === 'hole-cover') {
      inner.add(bakedMesh(`cover-rails|${sk}`, () => coverRailParts(s)));
      inner.add(coverPlate(s, ownColor(tint, COVER_RED)));
    } else if (style === 'truck-flatbed') {
      const c = ownColor(tint, BELT_BLUE);
      inner.add(bakedMesh(`truck|${sk}|${c}`, () => truckParts(s, c), VERTEX_TOON, true));
      inner.add(bakedMesh(`truck-lights|${sk}`, () => truckLightParts(s), VERTEX_GLOW));
    } else if (style === 'dock-door' || style === 'dock-door-open') {
      const c = ownColor(tint, SHUTTER);
      const open = style === 'dock-door-open';
      inner.add(bakedMesh(`dock-door|${open}|${sk}|${c}`, () => dockDoorParts(s, open, c)));
    } else if (style === 'scan-gate-sheet') {
      inner.add(bakedMesh(`gate|${sk}`, () => gateFrameParts(s)));
      lamp = bakedMesh(`gate-lamp|${sk}`, () => gateLampParts(s), glowMat(GATE_IDLE));
      inner.add(lamp);
      paintLamp();
      sheet = addLightSheet(inner, s);
      sheet.setReading(tint !== BLOCK_DEFAULT);
      sheet.tick();
    } else if (style === 'warehouse') {
      const c = ownColor(tint, BELT_BLUE);
      inner.add(bakedMesh(`warehouse|${sk}|${c}`, () => warehouseParts(s, c).solid, VERTEX_TOON, true));
      const lamps = bakedMesh(`warehouse-lamps|${sk}`, () => warehouseParts(s, c).glow, VERTEX_GLOW);
      // a hall too small for a row of lamps has none to draw
      if (lamps.geometry.getAttribute('position')) inner.add(lamps);
    } else if (style === 'floor-lane') {
      const c = ownColor(tint, PAINT_TEAL);
      const reverse = label.trim().startsWith('-');
      inner.add(bakedMesh(`floor-lane|${sk}|${c}|${reverse}`, () => floorLaneParts(s, c, reverse), VERTEX_TOON, true));
    } else if (style === 'floor-frame') {
      const c = ownColor(tint, YELLOW);
      inner.add(bakedMesh(`floor-frame|${sk}|${c}`, () => floorFrameParts(s, c), VERTEX_TOON, true));
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
      else if (style === 'scan-gate-sheet') {
        paintLamp();
        sheet?.setReading(tint !== BLOCK_DEFAULT);
      } else if (style === 'signal-tower') lightTower();
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
      sheet?.tick();
    },
    dispose() {
      flash?.dispose();
      inner.clear();
    },
  };
}
