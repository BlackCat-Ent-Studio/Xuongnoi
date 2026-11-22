/**
 * Development-only page (served by the dev server, never part of the shipped pages): design mock-ups of the parcel-sorting
 * floor, in the style of robot sorting centres: a grid floor with drop holes in rows and columns, robots driving one-way
 * lanes between them, feeding stations along the edges. Several layouts can be switched to compare them.
 *
 * The figures of the sorting floor are the game's real drawing code (AGV, arm parts, belt, scan gate, chute, carton,
 * floor marker); the warehouse and the outbound side (roll cages, cage tugs, trucks, docks) are drawn for this page
 * only. All motion is a plain animation written here: no nodes, no wires, no physics. It exists so a layout can be
 * approved before the sample is built from pieces.
 */
import * as THREE from 'three';
import type { EntityView } from '../../src/engine/types';
import type { ArmHint } from '../../src/engine/render-hints';
import { buildBlockLook, type BlockLookFigure } from '../../src/render/block-looks';
import { AgvFigure } from '../../src/render/factory-agv';
import { FactoryArmFigure } from '../../src/render/factory-arm';
import { buildParcel } from '../../src/render/factory-parcels';
import { FloorMarkerFigure } from '../../src/render/floor-marker-figure';
import { VERTEX_TOON } from '../../src/render/factory-kit';
import { SceneView } from '../../src/render/scene-view';
import { addBuilding } from './factory-mockup-building';
import { DOCK_Z, GROUND, PITCH, TRUCK_CAGES, WALL_Z, planGround, type GroundPlan } from './factory-mockup-ground';
import { createOutbound, type Outbound } from './factory-mockup-outbound';

type P3 = { x: number; y: number; z: number };
type Cell = readonly [number, number];

// ---------------------------------------------------------------- layouts
/** `cage` = cartons a roll cage takes, `tugs` = cage tugs on the ground floor. */
interface Layout { id: string; name: string; note: string; holeRows: number; holeCols: number; west: number; east: number; robots: number; cage: number; tugs: number }
const LAYOUTS: Layout[] = [
  { id: 'gon', name: 'A · Sàn gọn', note: '9 lỗ thả (3 × 3), 2 trạm nạp một cạnh, 6 xe chia chọn; tầng dưới 3 xe kéo lồng, 3 cửa bến. Bản đã chọn.', holeRows: 3, holeCols: 3, west: 2, east: 0, robots: 6, cage: 6, tugs: 3 },
  { id: 'vua', name: 'B · Sàn vừa', note: '15 lỗ thả (3 × 5), 3 trạm nạp một cạnh, 12 xe chia chọn; 5 xe kéo lồng, 3 cửa bến.', holeRows: 3, holeCols: 5, west: 3, east: 0, robots: 12, cage: 6, tugs: 5 },
  { id: 'haidau', name: 'C · Nạp hai đầu', note: '15 lỗ thả (3 × 5), trạm nạp ở cả hai cạnh (2 + 2), 14 xe chia chọn; 6 xe kéo lồng, 3 cửa bến.', holeRows: 3, holeCols: 5, west: 2, east: 2, robots: 14, cage: 6, tugs: 6 },
  { id: 'lon', name: 'D · Sàn lớn', note: '35 lỗ thả (5 × 7), trạm nạp hai cạnh (3 + 3), 22 xe chia chọn; 10 xe kéo lồng, 5 cửa bến. Nặng máy nhất.', holeRows: 5, holeCols: 7, west: 3, east: 3, robots: 22, cage: 6, tugs: 10 },
];

// ---------------------------------------------------------------- sizes (the game's own showcase sizes)
const AGV = { L: 0.9, W: 0.7, H: 0.24, wheelR: 0.085, tray: { L: 0.74, W: 0.62, T: 0.05 }, stand: 0.05 };
const TRAY_TOP = AGV.H + AGV.stand + AGV.tray.T;
const BELT = { len: 3.0, y: 0.5, w: 0.6, speed: 0.5, gap: 0.6, near: 2.25 };
const ARM = { baseH: 0.3, baseR: 0.24, L1: 0.8, L2: 0.65, t: 0.15, grip: 0.2 };
const HOLE = 0.94, DROP = 0.75;
const COLORS = ['#ef4444', '#facc15', '#22c55e', '#3b82f6', '#a855f7', '#f97316'];
const sizeOf = (kg: number): P3 => (kg >= 4 ? { x: 0.42, y: 0.32, z: 0.36 } : kg >= 2 ? { x: 0.3, y: 0.22, z: 0.26 } : { x: 0.24, y: 0.18, z: 0.22 });

// ---------------------------------------------------------------- scene
const canvas = document.createElement('canvas');
document.body.prepend(canvas);
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
const view = new SceneView();
view.setMode('3d');
view.setBackdrop(0xe6e8ec);
view.setGrid('3d', false);
view.sync([]);
const scene = view.scene;
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 400);
/** Everything that belongs to the layout on show; emptied when another layout is chosen. */
let stage = new THREE.Group();
scene.add(stage);
let disposers: (() => void)[] = [];

const block = (id: string, position: P3, size: P3, extra: Partial<EntityView> = {}): EntityView => ({ id, kind: 'block', ownerNodeId: id, position, size, color: '#a3a3a3', visible: true, ...extra });
function addLook(style: Parameters<typeof buildBlockLook>[0], v: EntityView, label = ''): BlockLookFigure {
  const fig = buildBlockLook(style, v.color, v.size, label, v.id);
  fig.object.position.set(v.position.x, v.position.y, v.position.z);
  fig.object.scale.set(v.size.x, v.size.y, v.size.z);
  fig.object.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  stage.add(fig.object);
  return fig;
}
function flat(w: number, d: number, color: string, y: number, x: number, z: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, d), mat = new THREE.MeshLambertMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  stage.add(m);
  disposers.push(() => { geo.dispose(); mat.dispose(); });
  return m;
}
function solid(size: P3, color: string, pos: P3): void {
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z), mat = new THREE.MeshLambertMaterial({ color });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(pos.x, pos.y, pos.z);
  m.castShadow = true;
  stage.add(m);
  disposers.push(() => { geo.dispose(); mat.dispose(); });
}

// ---------------------------------------------------------------- the grid of one-way lanes
let L: Layout = LAYOUTS[1]!;
let ROWS = 0, COLS = 0;
const key = (c: Cell): number => c[0] * 1000 + c[1];
const posOf = (c: Cell): { x: number; z: number } => ({ x: c[1] * PITCH, z: c[0] * PITCH });
const isLane = (r: number, c: number): boolean => r >= 0 && c >= 0 && r < ROWS && c < COLS && (r % 2 === 0 || c % 2 === 0);
/** Where a robot may go from a cell: along its row and/or its column, each one way only, alternating lane by lane. */
function exits(c: Cell): Cell[] {
  const out: Cell[] = [];
  const [r, k] = c;
  if (r % 2 === 0) { const n: Cell = [r, k + ((r / 2) % 2 === 0 ? 1 : -1)]; if (isLane(n[0], n[1])) out.push(n); }
  if (k % 2 === 0) { const n: Cell = [r + ((k / 2) % 2 === 1 ? 1 : -1), k]; if (isLane(n[0], n[1])) out.push(n); }
  return out;
}
/** Shortest way along the lanes; `blocked` cells are walked around. Empty when there is none. */
function route(from: Cell, goals: readonly Cell[], blocked?: ReadonlySet<number>): Cell[] {
  const goalKeys = new Set(goals.map(key));
  if (goalKeys.has(key(from))) return [];
  const prev = new Map<number, Cell>();
  const seen = new Set<number>([key(from)]);
  let frontier: Cell[] = [from];
  while (frontier.length > 0) {
    const next: Cell[] = [];
    for (const c of frontier) {
      for (const n of exits(c)) {
        const k = key(n);
        if (seen.has(k) || (blocked?.has(k) && !goalKeys.has(k))) continue;
        seen.add(k);
        prev.set(k, c);
        if (goalKeys.has(k)) {
          const path: Cell[] = [n];
          let at = c;
          while (key(at) !== key(from)) { path.unshift(at); at = prev.get(key(at))!; }
          return path;
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return [];
}

// ---------------------------------------------------------------- things on the floor
interface Parcel { dest: number; kg: number; u: number; scanned: boolean; fig: ReturnType<typeof buildParcel>; size: P3 }
interface Hole { n: number; cell: Cell; x: number; z: number; stops: Cell[] }
interface ArmSet { j1: FactoryArmFigure; l1: FactoryArmFigure; j2: FactoryArmFigure; l2: FactoryArmFigure; palm: FactoryArmFigure; f1: FactoryArmFigure; f2: FactoryArmFigure }
interface Station {
  pick: Cell; dir: 1 | -1; x: number; z: number; belt: Parcel[]; spawnIn: number;
  /** Robots called to this station: the one being loaded and the one on its way behind it. */
  claims: Robot[]; serving: Robot | null;
  beltView: EntityView; beltFig: BlockLookFigure; gateFig: BlockLookFigure; gateU: number; lastScan: number; scanColor: string;
  shoulder: P3; rest: P3; arm: ArmSet; phase: 'rest' | 'reach' | 'carry' | 'back'; t: number; hand: P3; open: number; holding: Parcel | null;
}
interface Robot {
  id: number; cell: Cell; path: Cell[]; next: Cell | null; t: number; v: number; heading: number; spin: number; wait: number;
  state: 'idle' | 'toPick' | 'atPick' | 'loaded' | 'dumping'; goal: Cell[]; station: Station | null; hole: Hole | null; load: Parcel | null; timer: number;
  /** Waiting at a locked hole, then `away` on a lap round the floor before trying again; `still` = time without moving on. */
  hold: number; away: boolean; still: number;
  body: AgvFigure; tray: FactoryArmFigure; hinge: FactoryArmFigure;
}
let holes: Hole[] = [], stations: Station[] = [], robots: Robot[] = [];
let flying: { p: Parcel; from: P3; to: P3; t: number; hole: Hole }[] = [];
let occupied = new Map<number, Robot>();
let ground: GroundPlan = planGround(1, 1);
let out: Outbound | null = null;
/** Cartons fed on the belts, cartons that stood in cages and trucks when the layout opened, and the longest a robot stood. */
let time = 0, done = 0, fed = 0, stock = 0, robotStuckMax = 0, seed = 1, speed = 1, running = true;
let lastScanText = '—';
const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function makeParcel(dest: number): Parcel {
  const kg = rnd() < 0.17 ? 4 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 3);
  const size = sizeOf(kg);
  const fig = buildParcel('parcel-carton', COLORS[(dest - 1) % COLORS.length]!, `p${seed}`);
  fig.object.scale.set(size.x, size.y, size.z);
  fig.update?.({ size });
  scene.add(fig.object);
  return { dest, kg, u: 0.25, scanned: false, fig, size };
}
function newParcel(): Parcel { fed++; return makeParcel(1 + Math.floor(rnd() * holes.length)); }
const dropParcel = (p: Parcel): void => { scene.remove(p.fig.object); p.fig.dispose(); };
function place(p: Parcel, pos: P3, yaw = 0, roll = 0): void {
  p.fig.object.position.set(pos.x, pos.y, pos.z);
  p.fig.object.rotation.set(0, -yaw, roll);
}

function makeStation(pick: Cell, dir: 1 | -1, n: number): Station {
  const p = posOf(pick);
  const near = p.x - dir * BELT.near, far = near - dir * BELT.len;
  const beltView = block(`belt${n}`, { x: (near + far) / 2, y: BELT.y / 2, z: p.z }, { x: BELT.len, y: BELT.y, z: BELT.w }, { blockStyle: 'belt-frame', belt: { axis: 'x', speed: BELT.speed * dir, phase: 0 } });
  const beltFig = addLook('belt-frame', beltView);
  for (const s of [-1, 1]) solid({ x: BELT.len, y: 0.07, z: 0.04 }, '#2f7fe0', { x: beltView.position.x, y: BELT.y + 0.035, z: p.z + s * (BELT.w / 2 - 0.02) });
  const gateU = BELT.len * 0.45;
  const gateFig = addLook('scan-gate', block(`gate${n}`, { x: far + dir * gateU, y: BELT.y - 0.05 + 0.36, z: p.z }, { x: 0.14, y: 0.72, z: BELT.w + 0.19 }, { blockStyle: 'scan-gate' }));
  const base = { x: p.x - dir * 1.15, z: p.z - 0.72 };
  addLook('arm-base', block(`armbase${n}`, { x: base.x, y: ARM.baseH / 2, z: base.z }, { x: ARM.baseR * 2, y: ARM.baseH, z: ARM.baseR * 2 }, { blockStyle: 'arm-base' }));
  const part = (kind: ArmHint['part']): FactoryArmFigure => { const f = new FactoryArmFigure(kind, 'factory'); stage.add(f.object); return f; };
  const shoulder: P3 = { x: base.x, y: ARM.baseH + 0.12, z: base.z };
  const rest: P3 = { x: base.x + dir * 0.4, y: 1.05, z: base.z + 0.55 };
  return {
    pick, dir, x: p.x, z: p.z, belt: [], spawnIn: 0.3 + n * 0.5, claims: [], serving: null, beltView, beltFig, gateFig, gateU, lastScan: -9, scanColor: '#a3a3a3',
    shoulder, rest, arm: { j1: part('joint'), l1: part('link'), j2: part('joint'), l2: part('link'), palm: part('palm'), f1: part('finger'), f2: part('finger') },
    phase: 'rest', t: 0, hand: { ...rest }, open: 0.4, holding: null,
  };
}
const beltX = (s: Station, u: number): number => s.x - s.dir * (BELT.near + BELT.len) + s.dir * u;
const BELT_END = BELT.len - 0.22;

function build(layout: Layout): void {
  // clear the previous layout
  for (const r of robots) { scene.remove(r.body.object, r.tray.object, r.hinge.object); if (r.load) dropParcel(r.load); }
  for (const s of stations) { s.belt.forEach(dropParcel); if (s.holding) dropParcel(s.holding); }
  flying.forEach((f) => dropParcel(f.p));
  out?.dispose();
  disposers.forEach((d) => d());
  scene.remove(stage);
  stage = new THREE.Group();
  scene.add(stage);
  disposers = []; holes = []; stations = []; robots = []; flying = []; occupied = new Map();
  L = layout; ROWS = 2 * L.holeRows + 1; COLS = 2 * L.holeCols + 1;
  seed = 20261122; time = 0; done = 0; fed = 0; stock = 0; robotStuckMax = 0; lastScanText = '—';
  ground = planGround(L.holeRows, L.holeCols);

  const W = (COLS - 1) * PITCH, D = (ROWS - 1) * PITCH;
  deckParts = [flat(W + PITCH + 0.5, D + PITCH + 0.5, '#2c3038', 0.002, W / 2, D / 2)];
  floorMarks = [];
  // one floor marker (the game's own tile) on every lane cell, as on a real sorting floor
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    if (!isLane(r, c)) continue;
    const p = posOf([r, c]);
    const m = new FloorMarkerFigure(block(`m${r}-${c}`, { x: p.x, y: 0.004, z: p.z }, { x: PITCH, y: 0.01, z: PITCH }, { color: '#f59e0b' }), '3d');
    stage.add(m.object);
    floorMarks.push(m.object);
    disposers.push(() => m.dispose());
  }
  // drop holes in rows and columns
  let n = 0;
  for (let r = 1; r < ROWS; r += 2) for (let c = 1; c < COLS; c += 2) {
    n++;
    const p = posOf([r, c]);
    flat(HOLE - 0.08, HOLE - 0.08, '#0c0e12', 0.012, p.x, p.z);
    addLook('chute', block(`hole${n}`, { x: p.x, y: 0.02 - DROP / 2, z: p.z }, { x: HOLE, y: DROP, z: HOLE }, { color: COLORS[(n - 1) % COLORS.length]!, blockStyle: 'chute', label: String(n) }), String(n));
    holes.push({ n, cell: [r, c], x: p.x, z: p.z, stops: [[r - 1, c], [r + 1, c]] });
  }
  // the outbound side under and behind the floor: live cages, tugs, trucks
  out = createOutbound(stage, {
    plan: ground, capacity: L.cage, tugs: L.tugs,
    holes: holes.map((h) => ({ n: h.n, x: h.x, z: h.z, row: (h.cell[0] - 1) / 2, col: (h.cell[1] - 1) / 2 })),
    makeCarton: (dest) => { stock++; return makeParcel(dest); },
  });
  // feeding stations along the west and / or east edge, at the middle of a lane stretch
  const rowsFor = (count: number): number[] => { const all = Array.from({ length: L.holeRows }, (_, i) => 2 * i + 1); const step = all.length / count; return Array.from({ length: count }, (_, i) => all[Math.min(all.length - 1, Math.floor(i * step + step / 2))]!); };
  let sn = 0;
  for (const r of rowsFor(L.west)) stations.push(makeStation([r, 0], 1, sn++));
  for (const r of rowsFor(L.east)) stations.push(makeStation([r, COLS - 1], -1, sn++));
  // robots start on free stretches of the cross lanes
  const starts: Cell[] = [];
  for (let r = 0; r < ROWS; r += 2) for (let c = 1; c < COLS; c += 2) starts.push([r, c]);
  for (let i = 0; i < L.robots; i++) {
    const cell = starts[(i * 7) % starts.length]!;
    const used = robots.some((o) => key(o.cell) === key(cell));
    const at = used ? starts.find((s) => !robots.some((o) => key(o.cell) === key(s)))! : cell;
    const body = new AgvFigure(), tray = new FactoryArmFigure('link', 'factory'), hinge = new FactoryArmFigure('joint', 'hinge');
    scene.add(body.object, tray.object, hinge.object);
    const first = exits(at)[0]!;
    const robot: Robot = { id: i + 1, cell: at, path: [], next: null, t: 0, v: 0, heading: Math.atan2(first[0] - at[0], first[1] - at[1]), spin: 0, wait: 0, state: 'idle', goal: [], station: null, hole: null, load: null, timer: 0, hold: 0, away: false, still: 0, body, tray, hinge };
    robots.push(robot);
    occupied.set(key(at), robot);
  }
  // the warehouse around the sorting floor
  const building = addBuilding(stage, {
    id: L.id, W, D,
    holes: holes.map((h) => ({ n: h.n, x: h.x, z: h.z, color: COLORS[(h.n - 1) % COLORS.length]! })),
    stations: stations.map((s) => ({ x: s.x, z: s.z, dir: s.dir, beltFar: beltX(s, 0) })),
    ground,
  });
  disposers.push(building.dispose);
  deckParts.push(building.deck);
  showThrough(seeThrough);
  setCamera('all');
  $('note').textContent = L.note;
}

/** The deck plate and the dark floor on it (made see-through on request so the cages and tugs below can be watched) and the floor markers (hidden meanwhile). */
let deckParts: THREE.Mesh[] = [], floorMarks: THREE.Object3D[] = [], seeThrough = false;
const GLASS = Object.assign(VERTEX_TOON.clone(), { transparent: true, opacity: 0.16, depthWrite: false });
function showThrough(on: boolean): void {
  seeThrough = on;
  for (const m of deckParts) {
    if (m.material === VERTEX_TOON || m.material === GLASS) m.material = on ? GLASS : VERTEX_TOON;
    else Object.assign(m.material as THREE.Material, { transparent: on, opacity: on ? 0.28 : 1, depthWrite: !on, needsUpdate: true });
    m.castShadow = !on && m.material === VERTEX_TOON;
    m.renderOrder = on ? 2 : 0;
  }
  for (const m of floorMarks) m.visible = !on;
  $('xray').setAttribute('aria-pressed', String(on));
}

// ---------------------------------------------------------------- the animation
const ease = (t: number): number => t * t * (3 - 2 * t);
/** Seconds from the tray starting to tip until the carton rests in the cage. */
const FALL = 0.85;
const lerp3 = (a: P3, b: P3, t: number, lift = 0): P3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * lift, z: a.z + (b.z - a.z) * t });
const grip = (p: Parcel, centre: P3): P3 => ({ x: centre.x, y: centre.y + p.size.y / 2 + 0.1, z: centre.z });
const onBelt = (s: Station, p: Parcel, u = p.u): P3 => ({ x: beltX(s, u), y: BELT.y + p.size.y / 2 + 0.004, z: s.z });
function robotPos(r: Robot): { x: number; z: number } {
  const a = posOf(r.cell);
  if (!r.next) return a;
  const b = posOf(r.next), k = ease(Math.min(1, r.t));
  return { x: a.x + (b.x - a.x) * k, z: a.z + (b.z - a.z) * k };
}
const onTray = (r: Robot, p: Parcel): P3 => { const q = robotPos(r); return { x: q.x, y: TRAY_TOP + p.size.y / 2 + 0.004, z: q.z }; };
const turnTo = (from: number, to: number, max: number): number => { let d = to - from; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) <= max ? to : from + Math.sign(d) * max; };

function stepStation(s: Station, dt: number): void {
  s.spawnIn -= dt;
  if (s.spawnIn <= 0 && s.belt.length < 4 && (s.belt.length === 0 || s.belt[s.belt.length - 1]!.u > 0.25 + BELT.gap)) { s.belt.push(newParcel()); s.spawnIn = 2.2 + rnd() * 1.2; }
  s.belt.forEach((p, i) => {
    p.u = Math.min(i === 0 ? BELT_END : s.belt[i - 1]!.u - BELT.gap, p.u + BELT.speed * dt);
    if (!p.scanned && p.u >= s.gateU) { p.scanned = true; s.lastScan = time; s.scanColor = COLORS[(p.dest - 1) % COLORS.length]!; lastScanText = `${p.kg} kg → lỗ ${p.dest}`; }
  });
  const robot = s.claims.find((r) => r.state === 'atPick') ?? null;
  const front = s.belt[0];
  s.t += dt;
  if (s.phase === 'rest') { if (robot && !robot.load && front && front.u >= BELT_END - 0.005 && front.scanned) { s.serving = robot; s.phase = 'reach'; s.t = 0; } }
  else if (s.phase === 'reach') {
    const k = Math.min(1, s.t / 0.45);
    s.hand = lerp3(s.rest, grip(front!, onBelt(s, front!)), ease(k)); s.open = 0.4 - 0.1 * k;
    if (k >= 1) { s.holding = s.belt.shift()!; s.phase = 'carry'; s.t = 0; }
  } else if (s.phase === 'carry') {
    const p = s.holding!, k = Math.min(1, s.t / 0.9), target = s.serving!;
    s.hand = lerp3(grip(p, onBelt(s, p, BELT_END)), grip(p, onTray(target, p)), ease(k), 0.22); s.open = p.size.z + 0.02;
    if (k >= 1) { target.load = p; s.holding = null; s.phase = 'back'; s.t = 0; }
  } else {
    const k = Math.min(1, s.t / 0.5);
    s.hand = lerp3({ x: s.x, y: TRAY_TOP + 0.4, z: s.z }, s.rest, ease(k)); s.open = 0.4;
    if (k >= 1) s.phase = 'rest';
  }
}

const CRUISE = 1.7, HOLD = 4;
function assign(r: Robot): void {
  if (r.state === 'idle') {
    const free = stations.filter((s) => s.claims.length < 2);
    if (free.length > 0) {
      // the nearest free station by lane distance
      let best: Station | null = null, bestLen = Infinity;
      for (const s of free) { const len = key(r.cell) === key(s.pick) ? 0 : route(r.cell, [s.pick]).length || Infinity; if (len < bestLen) { bestLen = len; best = s; } }
      if (best) { best.claims.push(r); r.station = best; r.state = 'toPick'; r.goal = [best.pick]; r.path = []; return; }
    }
    if (r.goal.length === 0 || key(r.goal[0]!) === key(r.cell)) {
      // nothing to fetch: drift along the cross lanes so the floor never jams
      const rr = 2 * Math.floor(rnd() * (L.holeRows + 1)), cc = 1 + 2 * Math.floor(rnd() * L.holeCols);
      r.goal = [[rr, cc]]; r.path = [];
    }
  }
}
function stepRobot(r: Robot, dt: number): void {
  if (r.state === 'dumping') {
    r.timer += dt;
    if (r.timer >= 1.5) { r.state = 'idle'; r.load = null; r.hole = null; r.goal = []; r.path = []; }
    return;
  }
  if (r.state === 'atPick') {
    if (!r.load) return;
    // loaded: let go of the station and head for the hole
    const hole = holes[r.load.dest - 1]!;
    r.hole = hole; r.state = 'loaded'; r.goal = hole.stops; r.path = [];
    // the station is free to call the next robot while this one pulls away
    if (r.station) { r.station.claims = r.station.claims.filter((q) => q !== r); r.station = null; }
  }
  if (r.next) {
    const a = posOf(r.cell), b = posOf(r.next);
    const want = Math.atan2(b.z - a.z, b.x - a.x);
    if (r.t === 0 && r.heading !== want) { r.heading = turnTo(r.heading, want, 5 * dt); r.v = 0; return; }
    const stopAfter = r.path.length === 0 || (r.path[0]![0] - r.next[0] !== r.next[0] - r.cell[0]) || (r.path[0]![1] - r.next[1] !== r.next[1] - r.cell[1]);
    const target = stopAfter && r.t > 0.55 ? Math.max(0.35, CRUISE * (1 - r.t) * 2.2) : CRUISE;
    r.v += Math.max(-7 * dt, Math.min(3 * dt, target - r.v));
    const d = (r.v * dt) / PITCH;
    r.t += d; r.spin += (d * PITCH) / AGV.wheelR;
    if (r.t >= 1) {
      occupied.delete(key(r.cell));
      r.cell = r.next; r.next = null; r.t = 0; r.wait = 0;
    }
    return;
  }
  // standing on a cell: arrived, or choose the next one
  if (r.goal.some((g) => key(g) === key(r.cell))) {
    r.v = 0;
    if (r.state === 'toPick') { r.state = 'atPick'; return; }
    if (r.state === 'loaded') {
      const h = r.hole!;
      if (r.away) { r.away = false; r.goal = h.stops; r.path = []; }
      else if (out!.canDrop(h.n)) {
        r.state = 'dumping'; r.timer = 0; r.hold = 0;
        flying.push({ p: r.load!, from: onTray(r, r.load!), to: out!.reserve(h.n, r.load!), t: -0.45, hole: h });
        return;
      } else {
        // the hole is locked (cage full or being swapped): wait beside it a moment, then take a lap and come back
        r.hold += dt;
        if (r.hold < HOLD) return;
        r.hold = 0; r.away = true; r.path = [];
        do r.goal = [[2 * Math.floor(rnd() * (L.holeRows + 1)), 1 + 2 * Math.floor(rnd() * L.holeCols)]]; while (key(r.goal[0]!) === key(r.cell));
      }
    } else r.goal = [];
  }
  assign(r);
  if (r.goal.length === 0) return;
  if (r.path.length === 0) r.path = route(r.cell, r.goal);
  let step = r.path[0];
  if (!step) return;
  const holder = occupied.get(key(step));
  if (holder && holder !== r) {
    r.v = 0; r.wait += dt;
    if (r.wait < 0.8) return;
    // somebody stands in the way: look for a way round the cells that are taken
    const taken = new Set<number>();
    for (const [k, o] of occupied) if (o !== r) taken.add(k);
    const detour = route(r.cell, r.goal, taken);
    r.wait = 0.4;
    if (detour.length === 0 || occupied.has(key(detour[0]!))) return;
    r.path = detour; step = detour[0]!;
  }
  r.path.shift();
  r.next = step; r.t = 0;
  occupied.set(key(step), r);
}

function step(dt: number): void {
  time += dt;
  for (const s of stations) stepStation(s, dt);
  for (const r of robots) {
    const cell = r.cell, state = r.state;
    stepRobot(r, dt);
    r.still = r.cell !== cell || r.state !== state || r.next ? 0 : r.still + dt;
    robotStuckMax = Math.max(robotStuckMax, r.still);
  }
  // a carton that has fallen through its hole comes to rest in the cage below and stays there
  for (const f of flying) f.t += dt;
  flying = flying.filter((f) => { if (f.t < FALL) return true; out!.land(f.hole.n, f.p); done++; return false; });
  out!.step(dt);
}

// ---------------------------------------------------------------- drawing the state with the real figures
const dirOf = (yaw: number, pitch: number): P3 => ({ x: Math.cos(pitch) * Math.cos(yaw), y: Math.sin(pitch), z: Math.cos(pitch) * Math.sin(yaw) });
const add3 = (a: P3, b: P3, k = 1): P3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
function poseArm(s: Station): void {
  const hand = s.hand, sh = s.shoulder;
  const dx = hand.x - sh.x, dz = hand.z - sh.z;
  const yaw = Math.atan2(dz, dx), d = Math.hypot(dx, dz), h = hand.y - sh.y;
  const l1 = ARM.L1, l2 = ARM.L2 + ARM.grip;
  const reach = Math.min(l1 + l2 - 0.01, Math.max(0.3, Math.hypot(d, h)));
  const a1 = Math.atan2(h, d) + Math.acos((l1 * l1 + reach * reach - l2 * l2) / (2 * l1 * reach));
  const a2 = a1 - (Math.PI - Math.acos((l1 * l1 + l2 * l2 - reach * reach) / (2 * l1 * l2)));
  const u1 = dirOf(yaw, a1), u2 = dirOf(yaw, a2), elbow = add3(sh, u1, l1);
  const put = (f: FactoryArmFigure, pos: P3, size: P3, pitch: number, hint: ArmHint): void => f.update(block('arm', pos, size, { color: '#f97316', angle: -yaw, tilt: pitch }), '3d', hint, 0);
  put(s.arm.j1, sh, { x: 0.22, y: 0.22, z: 0.22 }, a1, { part: 'joint', axis: 'pitch' });
  put(s.arm.l1, add3(sh, u1, l1 / 2), { x: l1, y: ARM.t, z: ARM.t }, a1, { part: 'link' });
  put(s.arm.j2, elbow, { x: 0.2, y: 0.2, z: 0.2 }, a2, { part: 'joint', axis: 'pitch' });
  put(s.arm.l2, add3(elbow, u2, ARM.L2 / 2), { x: ARM.L2, y: ARM.t * 0.85, z: ARM.t * 0.85 }, a2, { part: 'link' });
  const wrist = add3(elbow, u2, ARM.L2 + 0.04);
  put(s.arm.palm, wrist, { x: 0.07, y: 0.12, z: 0.42 }, a2, { part: 'palm' });
  const sideways: P3 = { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) };
  for (const [f, side] of [[s.arm.f1, 1], [s.arm.f2, -1]] as const) put(f, add3(add3(wrist, u2, 0.11), sideways, side * (s.open / 2 + 0.02)), { x: 0.2, y: 0.1, z: 0.035 }, a2, { part: 'finger', side });
}

function present(): void {
  for (const s of stations) {
    s.beltView.belt = { axis: 'x', speed: BELT.speed * s.dir, phase: time * BELT.speed * s.dir };
    s.beltFig.update?.(s.beltView);
    s.gateFig.setColor(time - s.lastScan < 0.6 ? s.scanColor : '#a3a3a3');
    for (const p of s.belt) place(p, onBelt(s, p));
    poseArm(s);
    if (s.holding) place(s.holding, { x: s.hand.x, y: s.hand.y - s.holding.size.y / 2 - 0.1, z: s.hand.z });
  }
  for (const r of robots) {
    const q = robotPos(r);
    const wheels = ([[1, -1], [1, 1], [-1, -1], [-1, 1]] as const).map(([f, s]) => ({ side: s * (AGV.W / 2 + 0.035), forward: f * AGV.L * 0.29, radius: AGV.wheelR, spin: r.spin }));
    r.body.update({ id: `r${r.id}`, kind: 'robot', ownerNodeId: `r${r.id}`, position: { x: q.x, y: AGV.H / 2, z: q.z }, size: { x: AGV.L, y: AGV.H, z: AGV.W }, color: '#f97316', visible: true,
      robot: { length: AGV.L, width: AGV.W, speed: r.v, heading: r.heading, turnRate: 0, wheels, ...(r.load ? { payload: r.load.kg } : {}) } } as EntityView);
    // the tray is hinged on the side of the hole it serves and tips towards it
    const left = { x: Math.sin(r.heading), z: -Math.cos(r.heading) };
    const side = r.hole && (r.hole.x - q.x) * left.x + (r.hole.z - q.z) * left.z < 0 ? -1 : 1;
    const out = { x: left.x * side, z: left.z * side };
    const tilt = r.state === 'dumping' ? (35 * Math.PI / 180) * (r.timer < 0.4 ? ease(r.timer / 0.4) : r.timer > 1.1 ? 1 - ease(Math.min(1, (r.timer - 1.1) / 0.4)) : 1) : 0;
    const len = AGV.tray.W, hingeY = AGV.H + AGV.stand + AGV.tray.T / 2;
    const hx = q.x + out.x * (len / 2), hz = q.z + out.z * (len / 2);
    const yaw = Math.atan2(-out.z, -out.x);
    const centre: P3 = { x: hx - out.x * (len / 2) * Math.cos(tilt), y: hingeY + (len / 2) * Math.sin(tilt), z: hz - out.z * (len / 2) * Math.cos(tilt) };
    r.tray.update(block(`tray${r.id}`, centre, { x: len, y: AGV.tray.T, z: AGV.tray.L }, { color: '#f97316', angle: -yaw, tilt }), '3d', { part: 'link' }, 0);
    r.hinge.update(block(`hinge${r.id}`, { x: hx, y: hingeY, z: hz }, { x: 0.06, y: 0.06, z: 0.06 }, { angle: -yaw, tilt }), '3d', { part: 'joint', axis: 'pitch' }, 0);
    if (r.load && r.state !== 'dumping') place(r.load, onTray(r, r.load), r.heading);
  }
  for (const f of flying) {
    // slides off the tipped tray to over the hole, then falls straight down into the cage
    const k = Math.max(0, Math.min(1, f.t / FALL)), side = ease(Math.min(1, k / 0.4)), fall = Math.max(0, (k - 0.25) / 0.75) ** 2;
    place(f.p, { x: f.from.x + (f.to.x - f.from.x) * side, y: f.from.y - 0.12 * side + (f.to.y - f.from.y + 0.12) * fall, z: f.from.z + (f.to.z - f.from.z) * side }, 0, Math.sin(Math.PI * Math.min(1, k / 0.55)) * 0.5);
  }
  out!.present();
}

// ---------------------------------------------------------------- camera: drag to orbit, wheel to zoom
const cam = { target: { x: 0, y: 0, z: 0 }, yaw: 0.25, pitch: 0.8, dist: 20 };
function setCamera(name: string): void {
  const W = (COLS - 1) * PITCH, D = (ROWS - 1) * PITCH;
  // the whole plant from the far end of the deck to the dock wall
  const mid = { x: W / 2, y: -1.0, z: (D + 3.6 + WALL_Z) / 2 + 1.2 };
  const s = stations[0]!, h = holes[Math.floor(holes.length / 2)]!;
  const far = Math.max(W + 24, (D + 3.6 - WALL_Z) * 1.55);
  if (name === 'station') Object.assign(cam, { target: { x: s.x - s.dir * 1.6, y: 0.5, z: s.z }, yaw: s.dir * -0.6, pitch: 0.5, dist: 8 });
  else if (name === 'hole') Object.assign(cam, { target: { x: h.x, y: 0.2, z: h.z }, yaw: 0.5, pitch: 0.6, dist: 7.5 });
  else if (name === 'ground') Object.assign(cam, { target: { x: W * 0.4, y: -GROUND + 1.0, z: D * 0.42 }, yaw: -0.5, pitch: 0.06, dist: Math.max(14, W * 0.95) });
  else if (name === 'dock') Object.assign(cam, { target: { x: W / 2 + 3.4, y: -GROUND + 1.0, z: DOCK_Z - 1.7 }, yaw: 0.92, pitch: 0.46, dist: Math.max(16, W * 1.2) });
  else if (name === 'top') Object.assign(cam, { target: { x: W / 2, y: 0, z: mid.z - 1.2 }, yaw: 0, pitch: 1.5, dist: far * 0.92 });
  else Object.assign(cam, { target: mid, yaw: 0.42, pitch: 0.68, dist: far });
  document.querySelectorAll('[data-cam]').forEach((b) => b.setAttribute('aria-pressed', String((b as HTMLElement).dataset.cam === name)));
}
function aim(): void {
  const c = Math.cos(cam.pitch);
  camera.position.set(cam.target.x + cam.dist * c * Math.sin(cam.yaw), cam.target.y + cam.dist * Math.sin(cam.pitch), cam.target.z + cam.dist * c * Math.cos(cam.yaw));
  camera.lookAt(cam.target.x, cam.target.y, cam.target.z);
  view.focusSun(cam.target, Math.max(6, cam.dist * 0.6));
}
let dragging: { x: number; y: number } | null = null;
canvas.addEventListener('pointerdown', (e) => { dragging = { x: e.clientX, y: e.clientY }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
canvas.addEventListener('pointerup', () => { dragging = null; canvas.style.cursor = 'grab'; });
canvas.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  cam.yaw -= (e.clientX - dragging.x) * 0.006;
  cam.pitch = Math.min(1.52, Math.max(0.05, cam.pitch + (e.clientY - dragging.y) * 0.005));
  dragging = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.min(110, Math.max(3, cam.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });

// ---------------------------------------------------------------- counters and controls
function $(id: string): HTMLElement { return document.getElementById(id)!; }
function counters(): void {
  $('s-done').textContent = String(done);
  $('s-rate').textContent = time > 8 ? ((done / time) * 60).toFixed(1).replace('.', ',') : '—';
  $('s-wait').textContent = String(stations.reduce((n, s) => n + s.belt.length, 0));
  $('s-idle').textContent = `${robots.filter((r) => r.state === 'idle').length} / ${robots.length}`;
  $('s-scan').textContent = lastScanText;
  $('s-size').textContent = `${holes.length} lỗ · ${stations.length} trạm`;
  const o = out!.stats();
  $('s-cages').textContent = String(o.cagesShipped);
  $('s-trucks').textContent = String(o.trucksOut);
  $('s-locked').textContent = `${o.locked} / ${holes.length}`;
  $('s-tugs').textContent = `${o.tugsWaiting} / ${o.tugs}`;
  const doors = o.doors.map((d) => `<span>Cửa ${d.n}: <b>${d.away ? 'đổi xe' : `${d.cages}/${TRUCK_CAGES}`}</b></span>`).join('');
  const routes = o.routes.map((r) => `<i class="${r.light}" title="Lỗ ${r.n}">${holes.length > 15 ? '' : `<small>${r.n}</small>`}${r.count}/${o.capacity}</i>`).join('');
  const html = `<div class="cap">Lồng đã lên xe tải ở từng cửa</div><div class="doors">${doors}</div><div class="cap">Kiện trong lồng của từng lỗ</div><div class="grid" style="grid-template-columns:repeat(${L.holeCols},1fr)">${routes}</div><div class="legend"><i class="green"></i>mở <i class="amber"></i>gần đầy, đã gọi xe kéo <i class="red"></i>khoá</div>`;
  if (html !== routesHtml) { routesHtml = html; $('routes').innerHTML = html; }
}
let routesHtml = '';
const press = (sel: string, el: Element): void => document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
$('layouts').innerHTML = LAYOUTS.map((l, i) => `<button type="button" data-layout="${l.id}" aria-pressed="${i === 0}">${l.name}</button>`).join('');
function warm(): void { for (let i = 0; i < 20 * 60; i++) step(1 / 60); counters(); }
document.querySelectorAll<HTMLElement>('[data-layout]').forEach((b) => b.addEventListener('click', () => { build(LAYOUTS.find((l) => l.id === b.dataset.layout)!); warm(); press('[data-layout]', b); }));
$('play').addEventListener('click', () => { running = !running; $('play').textContent = running ? 'Tạm dừng' : 'Chạy'; });
$('reset').addEventListener('click', () => { build(L); counters(); });
document.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => b.addEventListener('click', () => { speed = Number(b.dataset.speed); press('[data-speed]', b); }));
document.querySelectorAll<HTMLElement>('[data-cam]').forEach((b) => b.addEventListener('click', () => setCamera(b.dataset.cam!)));
$('xray').addEventListener('click', () => showThrough(!seeThrough));

function fit(): void {
  const w = window.innerWidth, h = window.innerHeight, k = renderer.getPixelRatio();
  if (canvas.width !== Math.floor(w * k) || canvas.height !== Math.floor(h * k)) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}
let last = 0, frames = 0;
function frame(now: number): void {
  fit();
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (running) for (let i = 0; i < speed; i++) step(dt);
  present(); aim();
  renderer.render(scene, camera);
  if (++frames % 10 === 0) counters();
  requestAnimationFrame(frame);
}
build(LAYOUTS[0]!);
warm();

// ---------------------------------------------------------------- checks (used by the headless trial and the pictures)
/** Where every carton is; what went in must equal what is somewhere or has left on a truck. */
function report(): Record<string, unknown> {
  const o = out!.stats();
  const onBelts = stations.reduce((n, s) => n + s.belt.length + (s.holding ? 1 : 0), 0), onRobots = robots.filter((r) => r.load && r.state !== 'dumping').length;
  const accounted = onBelts + onRobots + flying.length + o.inHoleCages + o.inMovingCages + o.inTrucks + o.cartonsShipped;
  const round = (v: number): number => Math.round(v * 10) / 10;
  return {
    id: L.id, seconds: Math.round(time), fed, stock, sorted: done, perMin: round((done / time) * 60),
    swaps: o.swaps, cagesShipped: o.cagesShipped, trucksOut: o.trucksOut, cartonsShipped: o.cartonsShipped,
    lockedNow: o.locked, lockAvg: round(o.lockAvg), lockMax: round(o.lockMax), robotStuckMax: round(robotStuckMax), tugStuckMax: round(o.tugStuckMax), tugStuckAt: o.tugStuckAt,
    where: { onBelts, onRobots, falling: flying.length, inHoleCages: o.inHoleCages, inMovingCages: o.inMovingCages, inTrucks: o.inTrucks, shipped: o.cartonsShipped },
    conserved: fed + stock === accounted, in: fed + stock, accounted,
    jam: robotStuckMax > 30 || o.tugStuckMax > 30,
  };
}
/** Two sorting robots closer than their bodies allow, if any. */
function robotOverlap(): string | null {
  for (let i = 0; i < robots.length; i++) for (let j = i + 1; j < robots.length; j++) {
    const a = robotPos(robots[i]!), b = robotPos(robots[j]!);
    if (Math.hypot(a.x - b.x, a.z - b.z) < 0.9) return `robots ${robots[i]!.id} and ${robots[j]!.id} t=${time.toFixed(1)}`;
  }
  return null;
}
const SEEK: Record<string, () => { x: number; z: number } | null> = {
  /** A sorting robot standing beside a locked hole with its carton. */
  locked: () => { const r = robots.find((q) => q.state === 'loaded' && q.hold > 1.2 && !q.next); return r ? { x: r.hole!.x, z: r.hole!.z } : null; },
  swap: () => out!.probe().tugs.find((t) => t.state === 'swap' && t.carrying && t.moving) ?? null,
  load: () => out!.probe().tugs.find((t) => t.state === 'load' && t.z < DOCK_Z - 0.5 && t.carrying) ?? null,
  leaving: () => { const d = out!.probe().doors.find((q) => q.state === 'leaving' && q.off < -2.2); return d ? { x: d.x, z: DOCK_Z } : null; },
  arriving: () => { const d = out!.probe().doors.find((q) => q.state === 'arriving' && q.off > -6); return d ? { x: d.x, z: DOCK_Z } : null; },
};
Object.assign(window, {
  __mock: {
    state: report,
    /** Runs a layout headless for a number of simulated seconds (for checks). */
    trial: (id: string, seconds: number) => {
      build(LAYOUTS.find((l) => l.id === id)!);
      let overlaps = 0, first: string | null = null;
      for (let i = 0; i < seconds * 60; i++) {
        step(1 / 60);
        if (i % 4 !== 0) continue;
        const hit = out!.audit() ?? robotOverlap();
        if (hit) { overlaps++; first ??= hit; }
      }
      return { ...report(), overlaps, firstOverlap: first };
    },
    /** Steps the layout on show until a moment worth a picture comes up, then stops the clock; returns where it is. */
    seek: (what: string, maxSeconds = 600) => {
      for (let i = 0; i < maxSeconds * 60; i++) { step(1 / 60); const at = SEEK[what]!(); if (at) { running = false; counters(); return { ...at, time }; } }
      return null;
    },
    run: (on: boolean) => { running = on; },
    through: showThrough,
    /** Draw calls and triangles of the last frame. */
    cost: () => ({ calls: renderer.info.render.calls, triangles: renderer.info.render.triangles }),
    look: (view: Partial<typeof cam>) => { Object.assign(cam, view); },
  },
});
requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
