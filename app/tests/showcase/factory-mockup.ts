/**
 * Development-only page (served by the dev server, never part of the shipped pages): a design mock-up of the parcel-sorting
 * floor. Every figure is the game's real drawing code (AGV, arm parts, belt, scan gate, chute, carton, floor marker), but
 * the motion is a plain animation written here: no nodes, no wires, no physics. It exists so the layout and the flow can
 * be approved before the sample is built from pieces.
 */
import * as THREE from 'three';
import type { EntityView } from '../../src/engine/types';
import type { ArmHint } from '../../src/engine/render-hints';
import { buildBlockLook, type BlockLookFigure } from '../../src/render/block-looks';
import { AgvFigure } from '../../src/render/factory-agv';
import { FactoryArmFigure } from '../../src/render/factory-arm';
import { buildParcel } from '../../src/render/factory-parcels';
import { FloorMarkerFigure } from '../../src/render/floor-marker-figure';
import { SceneView } from '../../src/render/scene-view';

type P2 = { x: number; z: number };
type P3 = { x: number; y: number; z: number };
interface Parcel { cls: number; kg: number; door: number; x: number; scanned: boolean; fig: ReturnType<typeof buildParcel>; size: P3 }

// ---------------------------------------------------------------- what is sorted
const CLASSES = [
  { name: 'Đỏ', color: '#ef4444' }, { name: 'Vàng', color: '#facc15' }, { name: 'Xanh lá', color: '#22c55e' },
  { name: 'Xanh dương', color: '#3b82f6' }, { name: 'Tím', color: '#a855f7' },
];
const HEAVY = 4;
const HEAVY_COLOR = '#7d8794';
const sizeOf = (kg: number): P3 => (kg >= HEAVY ? { x: 0.42, y: 0.32, z: 0.36 } : kg >= 2 ? { x: 0.3, y: 0.22, z: 0.26 } : { x: 0.24, y: 0.18, z: 0.22 });

// ---------------------------------------------------------------- one-way loop (metres; x to the right, z towards the viewer)
const L = 1.5, R = 12.5, TOP = -2.6, BOT = 2.6, RAD = 1.2;
const ST = R - L - 2 * RAD, SS = BOT - TOP - 2 * RAD, ARC = (Math.PI * RAD) / 2;
const TOTAL = 2 * ST + 2 * SS + 4 * ARC;
function at(s: number): { x: number; z: number; ang: number } {
  s = ((s % TOTAL) + TOTAL) % TOTAL;
  const arc = (cx: number, cz: number, a0: number, u: number) => { const a = a0 + u / RAD; return { x: cx + RAD * Math.cos(a), z: cz + RAD * Math.sin(a), ang: a + Math.PI / 2 }; };
  if (s < ST) return { x: L + RAD + s, z: TOP, ang: 0 }; s -= ST;
  if (s < ARC) return arc(R - RAD, TOP + RAD, -Math.PI / 2, s); s -= ARC;
  if (s < SS) return { x: R, z: TOP + RAD + s, ang: Math.PI / 2 }; s -= SS;
  if (s < ARC) return arc(R - RAD, BOT - RAD, 0, s); s -= ARC;
  if (s < ST) return { x: R - RAD - s, z: BOT, ang: Math.PI }; s -= ST;
  if (s < ARC) return arc(L + RAD, BOT - RAD, Math.PI / 2, s); s -= ARC;
  if (s < SS) return { x: L, z: BOT - RAD - s, ang: -Math.PI / 2 }; s -= SS;
  return arc(L + RAD, TOP + RAD, Math.PI, s);
}
/** The outside of the loop at a heading (the robots run clockwise seen from above). */
const outward = (ang: number): P2 => ({ x: Math.sin(ang), z: -Math.cos(ang) });
/** Distance along the loop from one point forward to another; a hair past the goal counts as standing on it. */
const ahead = (from: number, to: number): number => { const d = (((to - from) % TOTAL) + TOTAL) % TOTAL; return d > TOTAL - 0.02 ? 0 : d; };
const PICK_S = 2 * ST + SS + 3 * ARC + SS / 2;
const DOOR_X = [4.2, 7.0, 9.8];
const DOOR_OUT = 1.3;
const DOORS = [...DOOR_X.map((x) => x - (L + RAD)), ...DOOR_X.slice().reverse().map((x) => ST + ARC + SS + ARC + (R - RAD - x))].map((s, i) => {
  const p = at(s), n = outward(p.ang);
  return { n: i + 1, s, x: p.x + n.x * DOOR_OUT, z: p.z + n.z * DOOR_OUT, count: 0 };
});

// ---------------------------------------------------------------- sizes taken from the game's own showcase
const AGV = { L: 0.9, W: 0.7, H: 0.24, wheelR: 0.085, tray: { L: 0.74, W: 0.62, T: 0.05 }, stand: 0.05 };
const TRAY_TOP = AGV.H + AGV.stand + AGV.tray.T;
const BELT = { x0: -4.35, x1: -0.75, y: 0.5, w: 0.6, gate: -2.6, speed: 0.5, gap: 0.6 };
const BELT_END = BELT.x1 - 0.22;
const ARM = { x: 0.35, z: -0.75, baseH: 0.3, baseR: 0.24, L1: 0.8, L2: 0.65, t: 0.15, grip: 0.2 };
const SHOULDER: P3 = { x: ARM.x, y: ARM.baseH + 0.12, z: ARM.z };
const REST: P3 = { x: 0.75, y: 1.05, z: -0.2 };

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
const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 200);

const block = (id: string, position: P3, size: P3, extra: Partial<EntityView> = {}): EntityView => ({ id, kind: 'block', ownerNodeId: id, position, size, color: '#a3a3a3', visible: true, ...extra });

function addLook(style: Parameters<typeof buildBlockLook>[0], v: EntityView, label = ''): BlockLookFigure {
  const fig = buildBlockLook(style, v.color, v.size, label, v.id);
  fig.object.position.set(v.position.x, v.position.y, v.position.z);
  fig.object.scale.set(v.size.x, v.size.y, v.size.z);
  fig.object.traverse((o) => { if (o instanceof THREE.Mesh) o.castShadow = true; });
  scene.add(fig.object);
  return fig;
}
const flat = (w: number, d: number, color: string | THREE.Texture, y: number, x: number, z: number): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshLambertMaterial(typeof color === 'string' ? { color } : { map: color }));
  m.rotation.x = -Math.PI / 2;
  m.position.set(x, y, z);
  m.receiveShadow = true;
  scene.add(m);
  return m;
};
const solid = (size: P3, color: string, pos: P3): THREE.Mesh => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(size.x, size.y, size.z), new THREE.MeshLambertMaterial({ color }));
  m.position.set(pos.x, pos.y, pos.z);
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
  return m;
};

// floor with the lane painted on it
(() => {
  const FW = 22, FD = 12, CX = 5.5, PX = 96;
  const c = document.createElement('canvas');
  c.width = FW * PX; c.height = FD * PX;
  const g = c.getContext('2d')!;
  const X = (x: number): number => (x - (CX - FW / 2)) * PX, Z = (z: number): number => (z + FD / 2) * PX;
  g.fillStyle = '#cfd2d7'; g.fillRect(0, 0, c.width, c.height);
  const ring = (): void => { g.beginPath(); g.roundRect(X(L), Z(TOP), (R - L) * PX, (BOT - TOP) * PX, RAD * PX); };
  g.lineJoin = 'round';
  g.strokeStyle = '#b3b8c0'; g.lineWidth = 1.15 * PX; ring(); g.stroke();
  g.strokeStyle = '#eef0f3'; g.lineWidth = 3; g.setLineDash([18, 22]); ring(); g.stroke(); g.setLineDash([]);
  g.fillStyle = '#eef0f3';
  for (const s of [ST * 0.33, ST * 0.67, ST + ARC + SS / 2, ST + ARC + SS + ARC + ST * 0.33, ST + ARC + SS + ARC + ST * 0.67]) {
    const p = at(s);
    g.save(); g.translate(X(p.x), Z(p.z)); g.rotate(p.ang); g.beginPath(); g.moveTo(22, 0); g.lineTo(-12, -15); g.lineTo(-12, 15); g.closePath(); g.fill(); g.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  flat(FW, FD, tex, 0, CX, 0);
})();

// floor markers at every stop (0 = hand-over spot)
const markerAt = (s: number, n: number): void => {
  const p = at(s);
  const m = new FloorMarkerFigure(block(`mark-${n}`, { x: p.x, y: 0.004, z: p.z }, { x: 1, y: 0.01, z: 1 }, { color: '#f59e0b', label: String(n) }), '3d');
  scene.add(m.object);
};
markerAt(PICK_S, 0);
DOORS.forEach((d) => markerAt(d.s, d.n));

// doors: a hole in the floor with the game's chute look sunk into it, the number flag standing above
const HOLE = 0.94, DROP = 0.75;
for (const d of DOORS) {
  flat(HOLE + 0.5, HOLE + 0.5, '#2c3038', 0.006, d.x, d.z);
  flat(HOLE - 0.08, HOLE - 0.08, '#0c0e12', 0.012, d.x, d.z);
  const color = d.n === 6 ? HEAVY_COLOR : CLASSES[d.n - 1]!.color;
  addLook('chute', block(`door-${d.n}`, { x: d.x, y: 0.02 - DROP / 2, z: d.z }, { x: HOLE, y: DROP, z: HOLE }, { color, blockStyle: 'chute', label: String(d.n) }), String(d.n));
  // a coloured board so the class of each door reads from far away
  const side = d.z < 0 ? -1 : 1;
  solid({ x: 0.9, y: 0.34, z: 0.05 }, color, { x: d.x, y: 0.17, z: d.z + side * 0.78 });
}

// induction station
const beltView = block('belt', { x: (BELT.x0 + BELT.x1) / 2, y: BELT.y / 2, z: 0 }, { x: BELT.x1 - BELT.x0, y: BELT.y, z: BELT.w }, { blockStyle: 'belt-frame', belt: { axis: 'x', speed: BELT.speed, phase: 0 } });
const beltFig = addLook('belt-frame', beltView);
for (const s of [-1, 1]) solid({ x: BELT.x1 - BELT.x0, y: 0.07, z: 0.04 }, '#2f7fe0', { x: beltView.position.x, y: BELT.y + 0.035, z: s * (BELT.w / 2 - 0.02) });
const gateView = block('gate', { x: BELT.gate, y: BELT.y - 0.05 + 0.36, z: 0 }, { x: 0.14, y: 0.72, z: BELT.w + 0.19 }, { blockStyle: 'scan-gate' });
const gateFig = addLook('scan-gate', gateView);
addLook('arm-base', block('arm-base', { x: ARM.x, y: ARM.baseH / 2, z: ARM.z }, { x: ARM.baseR * 2, y: ARM.baseH, z: ARM.baseR * 2 }, { blockStyle: 'arm-base' }));

// arm parts (real figures, posed by hand)
const armPart = (part: ArmHint['part'], hint: ArmHint): FactoryArmFigure => { const f = new FactoryArmFigure(part, 'factory'); scene.add(f.object); void hint; return f; };
const J1 = armPart('joint', { part: 'joint', axis: 'pitch' }), L1F = armPart('link', { part: 'link' }), J2 = armPart('joint', { part: 'joint', axis: 'pitch' }), L2F = armPart('link', { part: 'link' });
const PALM = armPart('palm', { part: 'palm' }), F1 = armPart('finger', { part: 'finger', side: 1 }), F2 = armPart('finger', { part: 'finger', side: -1 });
const dir = (yaw: number, pitch: number): P3 => ({ x: Math.cos(pitch) * Math.cos(yaw), y: Math.sin(pitch), z: Math.cos(pitch) * Math.sin(yaw) });
const add3 = (a: P3, b: P3, k = 1): P3 => ({ x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k });
function poseArm(hand: P3, open: number): void {
  const dx = hand.x - SHOULDER.x, dz = hand.z - SHOULDER.z;
  const yaw = Math.atan2(dz, dx), d = Math.hypot(dx, dz), h = hand.y - SHOULDER.y;
  const l1 = ARM.L1, l2 = ARM.L2 + ARM.grip;
  const r = Math.min(l1 + l2 - 0.01, Math.max(0.3, Math.hypot(d, h)));
  const a1 = Math.atan2(h, d) + Math.acos((l1 * l1 + r * r - l2 * l2) / (2 * l1 * r));
  const a2 = a1 - (Math.PI - Math.acos((l1 * l1 + l2 * l2 - r * r) / (2 * l1 * l2)));
  const u1 = dir(yaw, a1), u2 = dir(yaw, a2), elbow = add3(SHOULDER, u1, l1);
  const put = (f: FactoryArmFigure, id: string, pos: P3, size: P3, pitch: number, hint: ArmHint): void => f.update(block(id, pos, size, { color: '#f97316', angle: -yaw, tilt: pitch }), '3d', hint, 0);
  put(J1, 'j1', SHOULDER, { x: 0.22, y: 0.22, z: 0.22 }, a1, { part: 'joint', axis: 'pitch' });
  put(L1F, 'l1', add3(SHOULDER, u1, l1 / 2), { x: l1, y: ARM.t, z: ARM.t }, a1, { part: 'link' });
  put(J2, 'j2', elbow, { x: 0.2, y: 0.2, z: 0.2 }, a2, { part: 'joint', axis: 'pitch' });
  put(L2F, 'l2', add3(elbow, u2, ARM.L2 / 2), { x: ARM.L2, y: ARM.t * 0.85, z: ARM.t * 0.85 }, a2, { part: 'link' });
  const wrist = add3(elbow, u2, ARM.L2 + 0.04);
  put(PALM, 'palm', wrist, { x: 0.07, y: 0.12, z: 0.42 }, a2, { part: 'palm' });
  const sideways: P3 = { x: -Math.sin(yaw), y: 0, z: Math.cos(yaw) };
  for (const [f, s] of [[F1, 1], [F2, -1]] as const) put(f, `f${s}`, add3(add3(wrist, u2, 0.11), sideways, s * (open / 2 + 0.02)), { x: 0.2, y: 0.1, z: 0.035 }, a2, { part: 'finger', side: s });
}

// ---------------------------------------------------------------- state
interface Robot { id: number; s: number; v: number; state: 'empty' | 'loading' | 'loaded' | 'dumping'; t: number; load: Parcel | null; spin: number; body: AgvFigure; tray: FactoryArmFigure; hinge: FactoryArmFigure }
let robots: Robot[] = [], belt: Parcel[] = [], flying: { p: Parcel; from: P3; to: P3; t: number; door: (typeof DOORS)[number]; landed: boolean }[] = [];
let arm = { phase: 'rest' as 'rest' | 'reach' | 'carry' | 'back', t: 0, hand: { ...REST }, holding: null as Parcel | null, target: null as Robot | null, open: 0.4 };
let time = 0, done = 0, spawnIn = 0.4, seed = 1, fleet = 8, speed = 1, running = true;
let lastScan: { cls: number; kg: number; door: number; at: number } | null = null;
const rnd = (): number => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

function newParcel(): Parcel {
  const cls = Math.floor(rnd() * CLASSES.length);
  const kg = rnd() < 0.17 ? 4 + Math.floor(rnd() * 3) : 1 + Math.floor(rnd() * 3);
  const size = sizeOf(kg);
  const fig = buildParcel('parcel-carton', CLASSES[cls]!.color, `p${seed}`);
  fig.object.scale.set(size.x, size.y, size.z);
  fig.update?.({ size });
  scene.add(fig.object);
  return { cls, kg, door: kg >= HEAVY ? 6 : cls + 1, x: BELT.x0 + 0.25, scanned: false, fig, size };
}
const drop = (p: Parcel): void => { scene.remove(p.fig.object); p.fig.dispose(); };
function place(p: Parcel, pos: P3, yaw = 0, k = 1): void {
  p.fig.object.position.set(pos.x, pos.y, pos.z);
  p.fig.object.rotation.set(0, -yaw, 0);
  p.fig.object.scale.set(p.size.x * k, p.size.y * k, p.size.z * k);
}

function reset(): void {
  for (const r of robots) { scene.remove(r.body.object, r.tray.object, r.hinge.object); if (r.load) drop(r.load); }
  belt.forEach(drop); flying.forEach((f) => drop(f.p)); if (arm.holding) drop(arm.holding);
  seed = 20261119; time = 0; done = 0; spawnIn = 0.4; lastScan = null; belt = []; flying = [];
  arm = { phase: 'rest', t: 0, hand: { ...REST }, holding: null, target: null, open: 0.4 };
  for (const d of DOORS) d.count = 0;
  robots = Array.from({ length: fleet }, (_, i): Robot => {
    const body = new AgvFigure(), tray = new FactoryArmFigure('link', 'factory'), hinge = new FactoryArmFigure('joint', 'hinge');
    scene.add(body.object, tray.object, hinge.object);
    return { id: i + 1, s: PICK_S - i * 1.5, v: 0, state: 'empty', t: 0, load: null, spin: 0, body, tray, hinge };
  });
}

const ease = (t: number): number => t * t * (3 - 2 * t);
const lerp3 = (a: P3, b: P3, t: number, lift = 0): P3 => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t + Math.sin(Math.PI * t) * lift, z: a.z + (b.z - a.z) * t });
const grip = (p: Parcel, centre: P3): P3 => ({ x: centre.x, y: centre.y + p.size.y / 2 + 0.1, z: centre.z });
const onBelt = (p: Parcel): P3 => ({ x: p.x, y: BELT.y + p.size.y / 2 + 0.004, z: 0 });
const onTray = (r: Robot, p: Parcel): P3 => { const q = at(r.s); return { x: q.x, y: TRAY_TOP + p.size.y / 2 + 0.004, z: q.z }; };

function step(dt: number): void {
  time += dt;
  spawnIn -= dt;
  if (spawnIn <= 0 && belt.length < 5 && (belt.length === 0 || belt[belt.length - 1]!.x > BELT.x0 + 0.25 + BELT.gap)) { belt.push(newParcel()); spawnIn = 1.9 + rnd() * 0.9; }
  belt.forEach((p, i) => {
    p.x = Math.min(i === 0 ? BELT_END : belt[i - 1]!.x - BELT.gap, p.x + BELT.speed * dt);
    if (!p.scanned && p.x >= BELT.gate) { p.scanned = true; lastScan = { cls: p.cls, kg: p.kg, door: p.door, at: time }; }
  });
  // arm: from the belt end to the empty robot standing on the hand-over spot
  const waiting = robots.find((r) => r.state === 'empty' && r.v === 0 && ahead(r.s, PICK_S) < 0.005);
  const front = belt[0];
  arm.t += dt;
  if (arm.phase === 'rest') { if (waiting && front && front.x >= BELT_END - 0.005 && front.scanned) { arm.phase = 'reach'; arm.t = 0; arm.target = waiting; waiting.state = 'loading'; } }
  else if (arm.phase === 'reach') {
    const k = Math.min(1, arm.t / 0.45);
    arm.hand = lerp3(REST, grip(front!, onBelt(front!)), ease(k)); arm.open = 0.4 - 0.1 * k;
    if (k >= 1) { arm.holding = belt.shift()!; arm.phase = 'carry'; arm.t = 0; }
  } else if (arm.phase === 'carry') {
    const p = arm.holding!, k = Math.min(1, arm.t / 0.9);
    arm.hand = lerp3(grip(p, onBelt({ ...p, x: BELT_END })), grip(p, onTray(arm.target!, p)), ease(k), 0.22); arm.open = p.size.z + 0.02;
    if (k >= 1) { arm.target!.load = p; arm.target!.state = 'loaded'; arm.holding = null; arm.phase = 'back'; arm.t = 0; }
  } else {
    const k = Math.min(1, arm.t / 0.5), q = at(PICK_S);
    arm.hand = lerp3({ x: q.x, y: TRAY_TOP + 0.4, z: q.z }, REST, ease(k)); arm.open = 0.4;
    if (k >= 1) { arm.phase = 'rest'; arm.target = null; }
  }
  // robots: one direction, keep a gap, stop on the hand-over spot or on the marker of their door
  const CRUISE = 1.5, GAP = 1.25;
  for (const r of robots) {
    r.t += dt;
    if (r.state === 'loading') { r.v = 0; continue; }
    if (r.state === 'dumping') { r.v = 0; if (r.t >= 1.5) { r.state = 'empty'; r.load = null; } continue; }
    const goal = r.state === 'empty' ? PICK_S : DOORS[r.load!.door - 1]!.s;
    let room = ahead(r.s, goal);
    for (const o of robots) if (o !== r) room = Math.min(room, Math.max(0, ahead(r.s, o.s) - GAP));
    const want = Math.min(CRUISE, room * 3 + 0.04);
    r.v += Math.max(-6 * dt, Math.min(2.2 * dt, want - r.v));
    const move = Math.min(room, Math.max(0, r.v) * dt);
    r.s = (r.s + move) % TOTAL; r.spin += move / AGV.wheelR;
    if (move >= room || room < 1e-4) r.v = 0;
    if (r.state === 'loaded' && ahead(r.s, goal) < 0.005 && r.v === 0) {
      r.state = 'dumping'; r.t = 0;
      const d = DOORS[r.load!.door - 1]!;
      flying.push({ p: r.load!, from: onTray(r, r.load!), to: { x: d.x, y: -0.35, z: d.z }, t: -0.45, door: d, landed: false });
    }
  }
  for (const f of flying) { f.t += dt; if (f.t >= 0.8 && !f.landed) { f.landed = true; f.door.count++; done++; } }
  flying = flying.filter((f) => { if (f.t < 0.95) return true; drop(f.p); return false; });
}

// ---------------------------------------------------------------- drawing the state with the real figures
function present(): void {
  beltView.belt = { axis: 'x', speed: BELT.speed, phase: time * BELT.speed };
  beltFig.update?.(beltView);
  gateFig.setColor(lastScan && time - lastScan.at < 0.6 ? (lastScan.kg >= HEAVY ? HEAVY_COLOR : CLASSES[lastScan.cls]!.color) : '#a3a3a3');
  for (const p of belt) place(p, onBelt(p));
  for (const r of robots) {
    const q = at(r.s), n = outward(q.ang);
    const wheels = ([[1, -1], [1, 1], [-1, -1], [-1, 1]] as const).map(([f, s]) => ({ side: s * (AGV.W / 2 + 0.035), forward: f * AGV.L * 0.29, radius: AGV.wheelR, spin: r.spin }));
    r.body.update({ id: `r${r.id}`, kind: 'robot', ownerNodeId: `r${r.id}`, position: { x: q.x, y: AGV.H / 2, z: q.z }, size: { x: AGV.L, y: AGV.H, z: AGV.W }, color: '#f97316', visible: true,
      robot: { length: AGV.L, width: AGV.W, speed: r.v, heading: q.ang, turnRate: 0, wheels, ...(r.load ? { payload: r.load.kg } : {}) } } as EntityView);
    // tray: hinged on the outside edge, tips towards the door
    const tilt = r.state === 'dumping' ? (35 * Math.PI / 180) * (r.t < 0.4 ? ease(r.t / 0.4) : r.t > 1.1 ? 1 - ease(Math.min(1, (r.t - 1.1) / 0.4)) : 1) : 0;
    const len = AGV.tray.W, hingeY = AGV.H + AGV.stand + AGV.tray.T / 2;
    const hx = q.x + n.x * (len / 2), hz = q.z + n.z * (len / 2);
    const inward = { x: -n.x, z: -n.z }, yaw = Math.atan2(inward.z, inward.x);
    const centre: P3 = { x: hx + inward.x * (len / 2) * Math.cos(tilt), y: hingeY + (len / 2) * Math.sin(tilt), z: hz + inward.z * (len / 2) * Math.cos(tilt) };
    r.tray.update(block(`tray${r.id}`, centre, { x: len, y: AGV.tray.T, z: AGV.tray.L }, { color: '#f97316', angle: -yaw, tilt }), '3d', { part: 'link' }, 0);
    r.hinge.update(block(`hinge${r.id}`, { x: hx, y: hingeY, z: hz }, { x: 0.06, y: 0.06, z: 0.06 }, { angle: -yaw, tilt }), '3d', { part: 'joint', axis: 'pitch' }, 0);
    if (r.load && r.state !== 'dumping') place(r.load, onTray(r, r.load), q.ang);
  }
  for (const f of flying) {
    const k = Math.max(0, Math.min(1, f.t / 0.8)), e = k * k;
    place(f.p, { x: f.from.x + (f.to.x - f.from.x) * ease(k), y: f.from.y + (f.to.y - f.from.y) * e + Math.sin(Math.PI * Math.min(1, k * 1.3)) * 0.05, z: f.from.z + (f.to.z - f.from.z) * ease(k) }, 0, 1);
    f.p.fig.object.rotation.z = k * 0.9;
  }
  poseArm(arm.hand, arm.open);
  if (arm.holding) { const p = arm.holding; place(p, { x: arm.hand.x, y: arm.hand.y - p.size.y / 2 - 0.1, z: arm.hand.z }); }
}

// ---------------------------------------------------------------- camera: drag to orbit, wheel to zoom
const CAMS: Record<string, { target: P3; yaw: number; pitch: number; dist: number }> = {
  all: { target: { x: 5.2, y: 0, z: 0 }, yaw: 0.18, pitch: 0.82, dist: 21 },
  station: { target: { x: -0.6, y: 0.5, z: 0 }, yaw: 0.55, pitch: 0.5, dist: 7.5 },
  door: { target: { x: 7.0, y: 0.2, z: 3.0 }, yaw: -0.5, pitch: 0.55, dist: 7 },
  top: { target: { x: 5.2, y: 0, z: 0 }, yaw: 0, pitch: 1.5, dist: 22 },
};
const cam = { ...CAMS.all!, target: { ...CAMS.all!.target } };
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
  cam.pitch = Math.min(1.52, Math.max(0.12, cam.pitch + (e.clientY - dragging.y) * 0.005));
  dragging = { x: e.clientX, y: e.clientY };
});
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.dist = Math.min(40, Math.max(3, cam.dist * (e.deltaY > 0 ? 1.1 : 0.9))); }, { passive: false });

// ---------------------------------------------------------------- counters and controls
const $ = (id: string): HTMLElement => document.getElementById(id)!;
$('doors').innerHTML = DOORS.map((d) => `<span title="${d.n === 6 ? `từ ${HEAVY} kg` : CLASSES[d.n - 1]!.name}"><i style="background:${d.n === 6 ? HEAVY_COLOR : CLASSES[d.n - 1]!.color}"></i>Cửa ${d.n}: <b id="d${d.n}">0</b></span>`).join('');
function counters(): void {
  $('s-done').textContent = String(done);
  $('s-rate').textContent = time > 5 ? ((done / time) * 60).toFixed(1).replace('.', ',') : '—';
  $('s-wait').textContent = String(belt.length);
  $('s-idle').textContent = String(robots.filter((r) => r.state === 'empty').length);
  $('s-scan').textContent = lastScan ? `${lastScan.kg >= HEAVY ? 'Nặng' : CLASSES[lastScan.cls]!.name} · ${lastScan.kg} kg → cửa ${lastScan.door}` : '—';
  for (const d of DOORS) $(`d${d.n}`).textContent = String(d.count);
}
const press = (sel: string, el: Element): void => document.querySelectorAll(sel).forEach((b) => b.setAttribute('aria-pressed', String(b === el)));
$('play').addEventListener('click', () => { running = !running; $('play').textContent = running ? 'Tạm dừng' : 'Chạy'; });
$('reset').addEventListener('click', () => { reset(); counters(); });
document.querySelectorAll<HTMLElement>('[data-speed]').forEach((b) => b.addEventListener('click', () => { speed = Number(b.dataset.speed); press('[data-speed]', b); }));
document.querySelectorAll<HTMLElement>('[data-fleet]').forEach((b) => b.addEventListener('click', () => { fleet = Number(b.dataset.fleet); press('[data-fleet]', b); reset(); counters(); }));
document.querySelectorAll<HTMLElement>('[data-cam]').forEach((b) => b.addEventListener('click', () => { const c = CAMS[b.dataset.cam!]!; Object.assign(cam, c, { target: { ...c.target } }); press('[data-cam]', b); }));

function fit(): void {
  const w = window.innerWidth, h = window.innerHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
}
let last = 0, n = 0;
function frame(now: number): void {
  fit();
  const dt = Math.min(0.05, (now - last) / 1000 || 0);
  last = now;
  if (running) for (let i = 0; i < speed; i++) step(dt);
  present(); aim();
  renderer.render(scene, camera);
  if (++n % 10 === 0) counters();
  requestAnimationFrame(frame);
}
reset();
for (let i = 0; i < 16 * 60; i++) step(1 / 60);
counters();
Object.assign(window, { __mock: { cam, CAMS, state: () => ({ done, time, robots: robots.length }) } });
requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
