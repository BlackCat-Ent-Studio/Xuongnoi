/**
 * Development-only: the outbound side of the design mock-up as a plain animation (no nodes, no wires, no physics).
 *
 * Every hole is one route. Its roll cage fills with the cartons dropped through the hole; one carton before full a tug is
 * called (amber); when the cage is full, or while it is being swapped, the hole is locked (red, cover shut). A tug always
 * brings an empty cage and takes the full one on the same trip, so the hole is locked only for the few seconds of the
 * swap itself: it sets the empty cage down in the lane, pulls the full one out to the other side, pushes the empty one
 * in, then leaves with the full one for the dock of that route, drives it into the truck and fetches the next empty cage
 * from the empty-cage lane. A truck that holds its four cages shuts, drives out, and an empty one backs in.
 */
import * as THREE from 'three';
import { glowMat } from '../../src/render/factory-kit';
import { CAGE_FLOOR, CAGE_SIDE, GATE, cageMesh, gateMesh, hatchMesh, holeLightGeo, truckFigure, tugFigure } from './factory-mockup-figures';
import { DOCK_Z, GROUND, PIT, TRUCK_CAGES, WALL_Z, groundRoute, type DoorPlan, type GroundPlan } from './factory-mockup-ground';

type P3 = { x: number; y: number; z: number };
export interface Carton { dest: number; size: P3; fig: { object: THREE.Object3D; dispose: () => void } }
export interface OutboundOptions {
  plan: GroundPlan;
  /** Holes with their 0-based row and column in the block of holes. */
  holes: readonly { n: number; x: number; z: number; row: number; col: number }[];
  /** Cartons a cage takes, and how many tugs serve the floor. */
  capacity: number; tugs: number;
  /** Builds a carton for a route (used for what already stands in cages and trucks when the page opens). */
  makeCarton: (dest: number) => Carton;
}
export type Light = 'green' | 'amber' | 'red';
export interface OutboundStats {
  capacity: number; swaps: number; cagesShipped: number; trucksOut: number; cartonsShipped: number; locked: number;
  routes: { n: number; count: number; light: Light }[];
  doors: { n: number; cages: number; trucks: number; away: boolean }[];
  /** Cartons standing in cages under holes, in cages on the move, and in trucks at the docks. */
  inHoleCages: number; inMovingCages: number; inTrucks: number;
  tugs: number; tugsWaiting: number; tugStuckMax: number; lockAvg: number; lockMax: number;
}
export interface Outbound {
  /** May a sorting robot tip its carton into this hole now? */
  canDrop: (n: number) => boolean;
  /** Books a place in the cage of the hole for a carton that is about to fall; returns where it will come to rest. */
  reserve: (n: number, p: Carton) => P3;
  land: (n: number, p: Carton) => void;
  step: (dt: number) => void;
  present: () => void;
  stats: () => OutboundStats;
  /** Where things are, for the camera presets and the checks. */
  probe: () => { tugs: { x: number; z: number; state: string; carrying: boolean; moving: boolean }[]; doors: { x: number; state: string; cages: number; off: number }[]; locked: number[] };
  /** Check for the trial: a note about the first two cages or two tugs found overlapping, or null. */
  audit: () => string | null;
  dispose: () => void;
}

interface Cage { g: THREE.Group; cartons: Carton[]; heights: number[] }
interface HoleLive {
  n: number; x: number; z: number; stops: [number, number]; door: DoorLive; cage: Cage | null; inflight: number; swapping: boolean; called: boolean;
  light: THREE.Mesh; hatch: THREE.Mesh; hatchK: number; lockedAt: number;
}
type TruckState = 'open' | 'shut' | 'gateUp' | 'leaving' | 'arriving' | 'gateDown' | 'opening';
interface DoorLive {
  plan: DoorPlan; g: THREE.Group; rear: THREE.Mesh; gate: THREE.Mesh; cages: Cage[]; state: TruckState; t: number; off: number; v: number; busy: boolean; trucks: number;
  board: Board; text: string;
}
type Step = { go: { x: number; z: number }; reverse?: boolean } | { wait: number } | { run: () => void };
type TugState = 'parked' | 'carry' | 'park' | 'toHole' | 'atHole' | 'swap' | 'toDock' | 'atDock' | 'load' | 'toBuffer' | 'atBuffer';
interface Tug {
  id: number; node: number; next: number | null; path: number[]; goal: number[]; x: number; z: number; heading: number; v: number; wait: number; still: number;
  state: TugState; cage: Cage | null; hole: HoleLive | null; door: DoorLive | null; timer: number; script: Step[]; fig: THREE.Group;
}
interface Board { mesh: THREE.Mesh; set: (text: string) => void; dispose: () => void }

const LIGHTS: Record<Light, string> = { green: '#3ddc6e', amber: '#ffb21e', red: '#ff3b30' };
const CRUISE = 1.9, WAIT_FULL = 10, LATCH = 0.3, LANE_SPEED = 1.0;
const TRUCK_Z = DOCK_Z - 0.06, TRUCK_AWAY = -15;

function board(w: number, h: number): Board {
  const canvas = document.createElement('canvas');
  canvas.width = 512; canvas.height = Math.round((512 * h) / w);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const geo = new THREE.PlaneGeometry(w, h), mat = new THREE.MeshBasicMaterial({ map: tex });
  return {
    mesh: new THREE.Mesh(geo, mat),
    set: (text) => {
      const g = canvas.getContext('2d');
      if (!g) return;
      g.fillStyle = '#141a24'; g.fillRect(0, 0, canvas.width, canvas.height);
      g.fillStyle = '#ffd34d'; g.textAlign = 'center'; g.textBaseline = 'middle';
      let size = canvas.height * 0.58;
      g.font = `800 ${size}px "Segoe UI", Arial, sans-serif`;
      while (g.measureText(text).width > canvas.width * 0.92 && size > 10) { size -= 3; g.font = `800 ${size}px "Segoe UI", Arial, sans-serif`; }
      g.fillText(text, canvas.width / 2, canvas.height / 2 + size * 0.04);
      tex.needsUpdate = true;
    },
    dispose: () => { geo.dispose(); mat.dispose(); tex.dispose(); },
  };
}

const turnTo = (from: number, to: number, max: number): number => { let d = to - from; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d) <= max ? to : from + Math.sign(d) * max; };

export function createOutbound(stage: THREE.Group, o: OutboundOptions): Outbound {
  const { plan } = o, CAP = o.capacity, gy = -GROUND;
  const at = (id: number): { x: number; z: number } => plan.nodes.get(id)!;
  const allCages = new Set<Cage>();
  let time = 0, swaps = 0, cagesShipped = 0, trucksOut = 0, cartonsShipped = 0, tugStuckMax = 0, lockSum = 0, lockN = 0, lockMax = 0;

  // ---------------------------------------------------------------- cages
  function newCage(): Cage {
    const g = new THREE.Group();
    g.add(cageMesh());
    stage.add(g);
    const c: Cage = { g, cartons: [], heights: [0, 0, 0, 0] };
    allCages.add(c);
    return c;
  }
  /** The next free place in a cage: on top of its lowest pile. */
  function slot(c: Cage, p: Carton): P3 {
    let k = 0;
    for (let i = 1; i < 4; i++) if (c.heights[i]! < c.heights[k]! - 1e-6) k = i;
    const y = CAGE_FLOOR + c.heights[k]! + p.size.y / 2 + 0.003;
    c.heights[k]! += p.size.y + 0.003;
    return { x: (k % 2 === 0 ? -1 : 1) * 0.215, y, z: (k < 2 ? -1 : 1) * 0.215 };
  }
  function stow(c: Cage, p: Carton, local: P3): void {
    c.g.add(p.fig.object);
    p.fig.object.position.set(local.x, local.y, local.z);
    p.fig.object.rotation.set(0, (((c.cartons.length * 37 + p.dest * 11) % 7) - 3) * 0.04, 0);
    p.fig.object.traverse((m) => { m.castShadow = false; });
    c.cartons.push(p);
  }
  function scrap(c: Cage): void {
    for (const p of c.cartons) { c.g.remove(p.fig.object); p.fig.dispose(); }
    c.g.removeFromParent();
    allCages.delete(c);
  }
  const setCage = (c: Cage, x: number, z: number): void => { c.g.position.set(x, gy, z); };

  // ---------------------------------------------------------------- docks and trucks
  const doors: DoorLive[] = plan.doors.map((d, j) => {
    const { group, rear } = truckFigure();
    stage.add(group);
    const gate = gateMesh();
    gate.position.set(d.x, gy - PIT + GATE.h, WALL_Z + 0.02);
    const b = board(2.9, 0.46);
    b.mesh.position.set(d.x, gy - PIT + GATE.h + 0.72, WALL_Z + 0.22);
    stage.add(gate, b.mesh);
    const door: DoorLive = { plan: d, g: group, rear, gate, cages: [], state: 'open', t: 0, off: 0, v: 0, busy: false, trucks: 0, board: b, text: '' };
    group.position.set(d.x, gy - PIT, TRUCK_Z);
    for (let i = 0; i < [2, 3, 1, 0, 2][j % 5]!; i++) {
      const c = newCage(), dest = d.holes[(i + j) % d.holes.length]!;
      for (let k = 0; k < CAP; k++) { const p = o.makeCarton(dest); stow(c, p, slot(c, p)); }
      load(door, c);
    }
    return door;
  });
  function load(d: DoorLive, c: Cage): void {
    const s = d.plan.slots[d.cages.length]!;
    d.g.add(c.g);
    c.g.position.set(s.x - d.plan.x, PIT, s.z - TRUCK_Z);
    d.cages.push(c);
  }
  function stepDoor(d: DoorLive, dt: number): void {
    d.t += dt;
    if (d.state === 'open') { if (d.cages.length >= TRUCK_CAGES && !d.busy) { d.state = 'shut'; d.t = 0; } }
    else if (d.state === 'shut') { if (d.t >= 0.9) { d.state = 'gateUp'; d.t = 0; } }
    else if (d.state === 'gateUp') { if (d.t >= 1.1) { d.state = 'leaving'; d.t = 0; d.v = 0; } }
    else if (d.state === 'leaving') {
      d.v = Math.min(4.5, d.v + 1.8 * dt); d.off -= d.v * dt;
      if (d.off <= TRUCK_AWAY) {
        for (const c of d.cages) { cartonsShipped += c.cartons.length; cagesShipped++; scrap(c); }
        d.cages = []; d.trucks++; trucksOut++; d.state = 'arriving'; d.t = 0;
      }
    } else if (d.state === 'arriving') {
      // backing in: brakes to a stop at the dock
      d.v = Math.min(3.2, d.t * 2.5, Math.sqrt(2 * 1.2 * Math.max(0, -d.off)) + 0.12); d.off = Math.min(0, d.off + d.v * dt);
      if (d.off >= 0) { d.v = 0; d.state = 'gateDown'; d.t = 0; }
    } else if (d.state === 'gateDown') { if (d.t >= 1.1) { d.state = 'opening'; d.t = 0; } }
    else if (d.t >= 0.9) { d.state = 'open'; d.t = 0; }
    d.g.position.set(d.plan.x, gy - PIT, TRUCK_Z + d.off);
  }

  // ---------------------------------------------------------------- holes
  const lightGeo = holeLightGeo();
  const holes: HoleLive[] = o.holes.map((h) => {
    const cage = newCage();
    setCage(cage, h.x, h.z);
    for (let k = (h.n * 5 + 2) % (CAP - 1); k > 0; k--) { const p = o.makeCarton(h.n); stow(cage, p, slot(cage, p)); }
    const light = new THREE.Mesh(lightGeo, glowMat(LIGHTS.green));
    light.position.set(h.x, 0, h.z);
    const hatch = hatchMesh();
    hatch.position.set(h.x - 0.45, 0.036, h.z);
    hatch.visible = false;
    stage.add(light, hatch);
    return { n: h.n, x: h.x, z: h.z, stops: plan.stops(h.row, h.col), door: doors[h.row]!, cage, inflight: 0, swapping: false, called: false, light, hatch, hatchK: 0, lockedAt: -1 };
  });
  const countOf = (h: HoleLive): number => (h.cage ? h.cage.cartons.length : 0);
  const isLocked = (h: HoleLive): boolean => !h.cage || h.swapping || countOf(h) + h.inflight >= CAP;
  const lightOf = (h: HoleLive): Light => (isLocked(h) ? 'red' : h.called ? 'amber' : 'green');
  const landing = new Map<Carton, P3>();

  // ---------------------------------------------------------------- the empty-cage lane
  const lane: { cage: Cage; z: number }[] = plan.buffer.queue.map((z) => { const cage = newCage(); setCage(cage, plan.buffer.x, z); return { cage, z }; });
  const laneStart = WALL_Z - 0.75;
  function stepLane(dt: number): void {
    // the front cage holds back while a tug is still leaving the pick-up cell with the one before it
    const leaving = occupied.get(plan.buffer.node)?.cage != null;
    lane.forEach((q, i) => {
      const limit = i === 0 ? (leaving ? q.z : plan.buffer.queue[0]!) : lane[i - 1]!.z - 1.1;
      q.z = Math.max(q.z, Math.min(limit, plan.buffer.queue[i]!, q.z + LANE_SPEED * dt));
      setCage(q.cage, plan.buffer.x, q.z);
    });
    const last = lane[lane.length - 1];
    if (lane.length < plan.buffer.queue.length && (!last || last.z > laneStart + 1.1)) {
      const cage = newCage();
      setCage(cage, plan.buffer.x, laneStart);
      lane.push({ cage, z: laneStart });
    }
  }
  const laneReady = (): boolean => lane.length > 0 && lane[0]!.z >= plan.buffer.queue[0]! - 1e-6;

  // ---------------------------------------------------------------- tugs
  const occupied = new Map<number, Tug>();
  const jobs: HoleLive[] = [];
  const tugs: Tug[] = [];
  for (let i = 0; i < Math.min(o.tugs, plan.pockets.length); i++) {
    const node = plan.pockets[i]!, p = at(node), fig = tugFigure(), cage = newCage();
    stage.add(fig);
    const t: Tug = { id: i + 1, node, next: null, path: [], goal: [], x: p.x, z: p.z, heading: p.x < 0 ? 0 : Math.PI, v: 0, wait: 0, still: 0, state: 'parked', cage, hole: null, door: null, timer: 0, script: [], fig };
    setCage(cage, p.x, p.z);
    tugs.push(t);
    occupied.set(node, t);
  }
  /** Turns on the spot, then drives to the point; true once there. `reverse` backs up to it. */
  function drive(t: Tug, x: number, z: number, dt: number, stop: boolean, reverse = false): boolean {
    const dx = x - t.x, dz = z - t.z, dist = Math.hypot(dx, dz);
    if (dist < 1e-4) { t.x = x; t.z = z; return true; }
    const want = Math.atan2(dz, dx) + (reverse ? Math.PI : 0);
    if (t.heading !== want) {
      t.heading = turnTo(t.heading, want, 6 * dt);
      if (t.heading !== want) { t.v = 0; return false; }
    }
    const target = stop ? Math.min(CRUISE, Math.sqrt(2 * 3.5 * dist) + 0.2) : CRUISE;
    t.v += Math.max(-9 * dt, Math.min(4 * dt, target - t.v));
    const s = Math.min(dist, t.v * dt);
    t.x += (dx / dist) * s; t.z += (dz / dist) * s;
    if (dist - s < 1e-4) { t.x = x; t.z = z; return true; }
    return false;
  }
  function assign(t: Tug, h: HoleLive): void { t.state = 'toHole'; t.hole = h; t.door = h.door; t.goal = [...h.stops]; t.path = []; }
  function dispatch(): void {
    while (jobs.length > 0) {
      const h = jobs[0]!;
      let best: Tug | null = null, bestLen = Infinity;
      for (const t of tugs) {
        if (!t.cage || t.script.length > 0 || (t.state !== 'parked' && t.state !== 'park' && t.state !== 'carry')) continue;
        const from = t.next ?? t.node, len = h.stops.includes(from) ? 0 : groundRoute(plan, from, h.stops).length || Infinity;
        if (len < bestLen) { bestLen = len; best = t; }
      }
      if (!best) return;
      jobs.shift();
      assign(best, h);
    }
  }
  /** The swap under a hole: the tug stands at `a` with the empty cage, the full one goes out to `b` on the other side. */
  function startSwap(t: Tug, h: HoleLive, a: number, b: number): void {
    const A = at(a), B = at(b), H = { x: h.x, z: h.z };
    const empty = t.cage!;
    let full: Cage | null = null;
    occupied.set(b, t);
    h.swapping = true;
    t.state = 'swap';
    t.script = [
      { run: () => { t.cage = null; } }, { wait: LATCH },
      { go: H }, { wait: LATCH }, { run: () => { full = h.cage; h.cage = null; t.cage = full; } },
      { go: B }, { run: () => { t.cage = null; } }, { wait: LATCH },
      { go: A, reverse: true }, { wait: LATCH }, { run: () => { t.cage = empty; } },
      { go: H }, { run: () => { t.cage = null; h.cage = empty; h.swapping = false; h.called = false; swaps++; if (occupied.get(a) === t) occupied.delete(a); } }, { wait: LATCH },
      { go: B }, { wait: LATCH },
      { run: () => { t.cage = full; t.node = b; t.hole = null; t.state = 'toDock'; t.goal = [h.door.plan.bay]; t.path = []; } },
    ];
  }
  /** At the dock: into the truck with the full cage, set it down, back out to the bay. */
  function startLoad(t: Tug, d: DoorLive): void {
    const s = d.plan.slots[d.cages.length]!, bay = at(d.plan.bay), entry = { x: s.x, z: DOCK_Z + 0.3 };
    d.busy = true;
    t.state = 'load';
    t.script = [
      { go: entry }, { go: s }, { wait: LATCH },
      { run: () => { load(d, t.cage!); t.cage = null; } },
      { go: entry, reverse: true }, { go: bay, reverse: true },
      { run: () => { d.busy = false; t.door = null; t.state = 'toBuffer'; t.goal = [plan.buffer.node]; t.path = []; } },
    ];
  }
  function runScript(t: Tug, dt: number): void {
    const s = t.script[0]!;
    if ('go' in s) { if (drive(t, s.go.x, s.go.z, dt, true, s.reverse)) t.script.shift(); }
    else if ('wait' in s) { t.v = 0; s.wait -= dt; if (s.wait <= 0) t.script.shift(); }
    else { t.script.shift(); s.run(); }
  }
  function stepTug(t: Tug, dt: number): void {
    if (t.script.length > 0) { runScript(t, dt); return; }
    if (t.next !== null) {
      const a = at(t.node), b = at(t.next), c = t.path[0] === undefined ? null : at(t.path[0]);
      // keeps its speed through a cell only when the way goes straight on
      const straight = !!c && Math.abs((b.x - a.x) * (c.z - b.z) - (b.z - a.z) * (c.x - b.x)) < 1e-6;
      if (drive(t, b.x, b.z, dt, !straight)) { occupied.delete(t.node); t.node = t.next; t.next = null; t.wait = 0; }
      return;
    }
    t.v = 0;
    // standing on a cell: what the errand asks for here
    if (t.state === 'parked') return;
    if (t.state === 'carry') {
      if (plan.pockets.includes(t.node)) { t.state = 'parked'; return; }
      const freeBays = plan.pockets.filter((p) => !occupied.has(p) && !tugs.some((u) => u !== t && u.state === 'park' && u.goal[0] === p));
      const path = freeBays.length > 0 ? groundRoute(plan, t.node, freeBays) : [];
      if (path.length === 0) return;
      t.state = 'park'; t.goal = [path[path.length - 1]!]; t.path = path;
    } else if (t.state === 'park') {
      if (t.node === t.goal[0]) { t.state = 'parked'; t.goal = []; return; }
    } else if (t.state === 'toHole') {
      if (t.goal.includes(t.node)) { t.state = 'atHole'; t.timer = 0; }
    } else if (t.state === 'toDock') {
      if (t.node === t.goal[0]) t.state = 'atDock';
    } else if (t.state === 'toBuffer') {
      if (t.node === t.goal[0]) t.state = 'atBuffer';
    }
    if (t.state === 'atHole') {
      const h = t.hole!, other = h.stops[0] === t.node ? h.stops[1] : h.stops[0];
      t.timer += dt;
      if ((countOf(h) >= CAP || t.timer >= WAIT_FULL) && h.inflight === 0 && !occupied.has(other)) startSwap(t, h, t.node, other);
      return;
    }
    if (t.state === 'atDock') {
      const d = t.door!;
      // the tug before this one must be clear of the cell beside the bay: the cage swings past it on the way in
      if (d.state === 'open' && !d.busy && d.cages.length < TRUCK_CAGES && !occupied.has(d.plan.exit)) startLoad(t, d);
      return;
    }
    if (t.state === 'atBuffer') {
      if (laneReady()) t.script = [{ wait: LATCH }, { run: () => { t.cage = lane.shift()!.cage; t.state = 'carry'; t.goal = []; } }];
      return;
    }
    if (t.goal.length === 0 || t.goal.includes(t.node)) return;
    if (t.path.length === 0) t.path = groundRoute(plan, t.node, t.goal);
    let next = t.path[0];
    if (next === undefined) return;
    const holder = occupied.get(next);
    if (holder && holder !== t) {
      t.wait += dt;
      if (t.wait < 0.8) return;
      // somebody stands in the way: look for a way round the cells that are taken
      const taken = new Set<number>();
      for (const [k, u] of occupied) if (u !== t) taken.add(k);
      const detour = groundRoute(plan, t.node, t.goal, taken);
      t.wait = 0.4;
      if (detour.length === 0 || occupied.has(detour[0]!)) return;
      t.path = detour; next = detour[0]!;
    }
    t.path.shift();
    t.next = next;
    occupied.set(next, t);
  }

  function step(dt: number): void {
    time += dt;
    for (const h of holes) {
      if (!h.called && h.cage && countOf(h) + h.inflight >= CAP - 1) { h.called = true; jobs.push(h); }
      const locked = isLocked(h);
      if (locked && h.lockedAt < 0) h.lockedAt = time;
      if (!locked && h.lockedAt >= 0) { const d = time - h.lockedAt; lockSum += d; lockN++; lockMax = Math.max(lockMax, d); h.lockedAt = -1; }
      h.hatchK = Math.max(0, Math.min(1, h.hatchK + (locked && h.inflight === 0 ? 4 : -4) * dt));
    }
    dispatch();
    for (const t of tugs) {
      const x = t.x, z = t.z, hd = t.heading;
      stepTug(t, dt);
      t.still = t.state === 'parked' || x !== t.x || z !== t.z || hd !== t.heading ? 0 : t.still + dt;
      tugStuckMax = Math.max(tugStuckMax, t.still);
      if (t.cage) setCage(t.cage, t.x, t.z);
    }
    stepLane(dt);
    for (const d of doors) stepDoor(d, dt);
  }

  const ease = (k: number): number => k * k * (3 - 2 * k);
  function present(): void {
    for (const t of tugs) { t.fig.position.set(t.x, gy, t.z); t.fig.rotation.y = -t.heading; }
    for (const h of holes) {
      h.light.material = glowMat(LIGHTS[lightOf(h)]);
      h.hatch.visible = h.hatchK > 0.01;
      h.hatch.scale.x = Math.max(0.01, ease(h.hatchK));
    }
    for (const d of doors) {
      const rearShut = d.state === 'open' ? 0 : d.state === 'shut' ? ease(Math.min(1, d.t / 0.8)) : d.state === 'opening' ? 1 - ease(Math.min(1, d.t / 0.8)) : 1;
      d.rear.scale.y = 0.04 + 0.96 * rearShut;
      const gateOpen = d.state === 'gateUp' ? ease(Math.min(1, d.t)) : d.state === 'gateDown' ? 1 - ease(Math.min(1, d.t)) : d.state === 'leaving' || d.state === 'arriving' ? 1 : 0;
      d.gate.scale.y = 1 - 0.95 * gateOpen;
      const text = d.state === 'leaving' ? 'XE ĐANG RỜI BẾN' : d.state === 'arriving' ? 'XE RỖNG ĐANG LÙI VÀO' : `LỒNG ${d.cages.length}/${TRUCK_CAGES} · ĐÃ ĐI ${d.trucks} XE`;
      if (text !== d.text) { d.text = text; d.board.set(text); }
    }
  }

  function stats(): OutboundStats {
    const sum = (list: Iterable<Cage>): number => { let n = 0; for (const c of list) n += c.cartons.length; return n; };
    const inHoleCages = sum(holes.flatMap((h) => (h.cage ? [h.cage] : []))), inTrucks = sum(doors.flatMap((d) => d.cages));
    return {
      capacity: CAP, swaps, cagesShipped, trucksOut, cartonsShipped, locked: holes.filter(isLocked).length,
      routes: holes.map((h) => ({ n: h.n, count: countOf(h), light: lightOf(h) })),
      doors: doors.map((d) => ({ n: d.plan.n, cages: d.cages.length, trucks: d.trucks, away: d.state === 'leaving' || d.state === 'arriving' })),
      inHoleCages, inTrucks, inMovingCages: sum(allCages) - inHoleCages - inTrucks,
      tugs: tugs.length, tugsWaiting: tugs.filter((t) => t.state === 'parked').length, tugStuckMax, lockAvg: lockN > 0 ? lockSum / lockN : 0, lockMax,
    };
  }

  return {
    canDrop: (n) => !isLocked(holes[n - 1]!),
    reserve: (n, p) => {
      const h = holes[n - 1]!, local = slot(h.cage!, p);
      h.inflight++;
      landing.set(p, local);
      return { x: h.x + local.x, y: gy + local.y, z: h.z + local.z };
    },
    land: (n, p) => {
      const h = holes[n - 1]!;
      h.inflight--;
      stow(h.cage!, p, landing.get(p)!);
      landing.delete(p);
    },
    step, present, stats,
    probe: () => ({
      tugs: tugs.map((t) => ({ x: t.x, z: t.z, state: t.state, carrying: !!t.cage, moving: t.v > 0.3 })),
      doors: doors.map((d) => ({ x: d.plan.x, state: d.state, cages: d.cages.length, off: d.off })),
      locked: holes.filter(isLocked).map((h) => h.n),
    }),
    audit: () => {
      const spots = [...allCages].map((c) => ({ x: c.g.position.x + (c.g.parent === stage ? 0 : c.g.parent!.position.x), z: c.g.position.z + (c.g.parent === stage ? 0 : c.g.parent!.position.z) }));
      for (let i = 0; i < spots.length; i++) for (let j = i + 1; j < spots.length; j++) {
        if (Math.abs(spots[i]!.x - spots[j]!.x) < CAGE_SIDE - 0.01 && Math.abs(spots[i]!.z - spots[j]!.z) < CAGE_SIDE - 0.01) return `cages at ${spots[i]!.x.toFixed(2)},${spots[i]!.z.toFixed(2)} and ${spots[j]!.x.toFixed(2)},${spots[j]!.z.toFixed(2)} t=${time.toFixed(1)}`;
      }
      for (let i = 0; i < tugs.length; i++) for (let j = i + 1; j < tugs.length; j++) {
        if (Math.hypot(tugs[i]!.x - tugs[j]!.x, tugs[i]!.z - tugs[j]!.z) < 0.75) return `tugs ${tugs[i]!.id} and ${tugs[j]!.id} at ${tugs[i]!.x.toFixed(2)},${tugs[i]!.z.toFixed(2)} t=${time.toFixed(1)}`;
      }
      return null;
    },
    dispose: () => {
      for (const c of [...allCages]) scrap(c);
      for (const d of doors) d.board.dispose();
    },
  };
}
