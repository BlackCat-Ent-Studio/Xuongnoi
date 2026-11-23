import { instanceParams } from '../../src/circuits/instance';
import { runnableGraph } from '../../src/circuits/runnable';
import { getNodeDef, registerNode } from '../../src/engine/registry';
import { createRuntime } from '../../src/engine/runtime';
import { CIRCUIT_KIND, TICK_DT, type Board, type Circuit, type EntityView, type GraphNode, type NodeDef, type ParamValue, type Runtime, type Wire, type World, type WorldApi } from '../../src/engine/types';
import { GRID_BOT, GRID_BOT_WIRES, gridBotCircuit, laneArrows } from '../../src/handbook/boards-grid-floor';
import { registerAllNodes } from '../../src/nodes';
import { lanesOfWorld, routeOnLanes } from '../../src/nodes/grid-lanes';
import { asBool, asNum, numParam } from '../../src/nodes/util';
import type { RapierModule } from '../../src/world/rapier-loader';
import { createWorld } from '../../src/world/world';
import { overlapDepth } from './chassis-metrics';
import { CHASSIS_Y, FLOOR, stateHash } from './nav-rig';

/**
 * A floor of one-way lanes for the traffic tests, built the way a learner builds it: numbered floor markers with arrows,
 * ONE robot circuit ("Xe trên lưới") made of real pieces and copied once per robot, and one "Bảng giữ ô" card on the
 * main board that every copy is wired to. Stations, parcel routes and the tipping stop are played by a test-only card
 * (`x-grid-jobs`) on the main board; it is no piece of the product and sees a robot only through the circuit's pins.
 */

registerAllNodes();

// ---------------------------------------------------------------- the floor: holes on (odd row, odd column)

export interface GridShape {
  rows: number;
  cols: number;
}
export const LAYOUT_A: GridShape = { rows: 7, cols: 7 };
export const CHASSIS = { length: 0.9, width: 0.7 };
/** Side of a drop hole (m): the opening a chassis corner must never be over. */
export const HOLE = 0.94;

export const cellNumber = (g: GridShape, r: number, c: number): number => r * g.cols + c + 1;
export const cellOf = (g: GridShape, n: number): readonly [row: number, col: number] => [Math.floor((n - 1) / g.cols), (n - 1) % g.cols];
export const isLane = (g: GridShape, r: number, c: number): boolean => r >= 0 && c >= 0 && r < g.rows && c < g.cols && (r % 2 === 0 || c % 2 === 0);

/** Arrows of a lane cell: even rows run east, west, east...; even columns run north, south, north... A crossing has both; none points off the floor. */
export const arrowsOf = (r: number, c: number, g: GridShape = LAYOUT_A): string => laneArrows(r, c, g.rows, g.cols);

export const node = (id: string, kind: string, params: Record<string, ParamValue> = {}): GraphNode => ({ id, kind, params, pos: { x: 0, y: 0 } });
const wire = (from: string, to: string): Wire => {
  const [fn, fp] = from.split('.') as [string, string];
  const [tn, tp] = to.split('.') as [string, string];
  return { id: `${from}>${to}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } };
};

/** One marker per lane cell, tile = cell, number = row x cols + col + 1, arrows as the lanes run. `y` = height of the floor. */
export function laneMarkers(g: GridShape, pitch: number, opts: { y?: number; first?: number; prefix?: string } = {}): GraphNode[] {
  const out: GraphNode[] = [];
  for (let r = 0; r < g.rows; r++) {
    for (let c = 0; c < g.cols; c++) {
      if (!isLane(g, r, c)) continue;
      const number = cellNumber(g, r, c) + (opts.first ?? 1) - 1;
      out.push(node(`${opts.prefix ?? 'm'}${number}`, 'floor-marker', { number, position: { x: c * pitch, y: opts.y ?? 0, z: r * pitch }, size: pitch, exits: arrowsOf(r, c, g) || 'none' }));
    }
  }
  return out;
}

// ---------------------------------------------------------------- the robot circuit a learner wires

export const BOT = GRID_BOT;
export const DEFAULT_DRIVE: Record<string, ParamValue> = { power: 0.6, tolerance: 0.1, slowDistance: 1 };
export const TUNED_DRIVE: Record<string, ParamValue> = { power: 0.8, slowDistance: 0.6 };

/** Inner wires of the robot circuit, as `from>to`. The anti-forced tests cut them one at a time. */
export const BOT_WIRES: readonly string[] = GRID_BOT_WIRES.map(([from, to]) => `${from}>${to}`);

/** "Xe trên lưới" as the app ships it (src/handbook/boards-grid-floor.ts), with the drive settings of the run. */
export function botCircuit(drive: Record<string, ParamValue> = {}, detourAfter = 3): Circuit {
  return gridBotCircuit({ drive: { ...DEFAULT_DRIVE, ...drive }, detourAfter, bodyY: CHASSIS_Y });
}

/** A copy of the robot circuit standing on a cell middle, nose along `heading` (degrees). */
export function botCopy(id: string, x: number, z: number, heading: number, y = 0): GraphNode {
  return { id, kind: CIRCUIT_KIND, params: instanceParams(BOT, { place: { position: { x, y, z }, heading } }), pos: { x: 0, y: 0 } };
}

/** The four wires between copy `id` and row k of the hold card `hold`, as `from > to`. */
export const holdWires = (id: string, k: number, hold = 'giu-o'): string[] => [`${id}.robot>${hold}.robot${k}`, `${id}.o-muon>${hold}.want${k}`, `${hold}.cell${k}>${id}.o-duoc-di`, `${hold}.wait${k}>${id}.dang-cho`];

/** A board of plain cards and wires (`from.port>to.port`), no circuits. */
export const flatBoard = (nodes: GraphNode[], wires: readonly string[] = [], mode: Board['mode'] = '3d'): Board => ({ name: 'thử', mode, graph: { nodes, wires: wiresOf(wires), settings: { wireRule: true } } });

export const wiresOf = (rows: readonly string[]): Wire[] => rows.map((w) => wire(...(w.split('>') as [string, string])));

// ---------------------------------------------------------------- test-only stand-in for stations, routes and tipping

export interface Stress {
  /** A station cell that hands over nothing between these seconds. */
  outage?: { station: number; from: number; to: number };
  /** The robot with this index stays put for `seconds` at its first stop beside a hole after `from` seconds. */
  freeze?: { robot: number; from: number; seconds: number; done?: boolean };
}
interface Shared {
  /** Station cell number -> robots called to it. */
  calls: Map<number, string[]>;
  stress: Stress;
}
const tables = new WeakMap<WorldApi, Shared>();
export function sharedOf(world: WorldApi): Shared {
  let s = tables.get(world);
  if (!s) {
    s = { calls: new Map(), stress: {} };
    tables.set(world, s);
  }
  return s;
}

interface JobState {
  phase: 'idle' | 'toStation' | 'loading' | 'loaded' | 'tipping';
  goal: number;
  station: number;
  timer: number;
  delivered: number;
  seed: number;
  frozen: boolean;
}

/**
 * Stands in for everything that is not traffic: a robot is called to a station (two robots per station at most, the
 * nearer one by lane distance; otherwise it drifts to a random lane cell), waits `loadS` there, gets a random hole, drives
 * to the lane cell above or below it, waits `tipS`, and is free again. It learns that the robot has arrived only from the
 * two signals a learner has: the cell under the robot and "Robot k đứng giữa ô" of the hold card.
 */
const gridJobsNode: NodeDef<JobState> = {
  kind: 'x-grid-jobs',
  label: 'Việc giả (chỉ để thử)',
  category: 'logic',
  description: 'CHỈ ĐỂ THỬ. Giả làm trạm nạp, tuyến của kiện và thời gian nghiêng khay.',
  inputs: [
    { id: 'at', type: 'number', label: 'Ô đang đứng' },
    { id: 'stood', type: 'bool', label: 'Đứng giữa ô' },
  ],
  outputs: [
    { id: 'goal', type: 'number', label: 'Ô đích' },
    { id: 'delivered', type: 'number', label: 'Đã giao' },
    { id: 'dwelling', type: 'bool', label: 'Đang đứng làm việc' },
  ],
  params: [
    { id: 'rows', label: 'rows', kind: 'number', default: 7 },
    { id: 'cols', label: 'cols', kind: 'number', default: 7 },
    { id: 'seed', label: 'seed', kind: 'number', default: 1 },
    { id: 'index', label: 'robot index', kind: 'number', default: 0 },
    { id: 'stationA', label: 'station A cell', kind: 'number', default: 8 },
    { id: 'stationB', label: 'station B cell', kind: 'number', default: 36 },
    { id: 'loadS', label: 'seconds at the station', kind: 'number', default: 1.85 },
    { id: 'tipS', label: 'seconds tipping', kind: 'number', default: 1.5 },
  ],
  create: (_ctx, params) => ({ phase: 'idle', goal: 0, station: 0, timer: 0, delivered: 0, seed: (Math.round(numParam(params, 'seed', 1)) * 2654435761 + Math.round(numParam(params, 'index', 0)) * 40503 + 1) >>> 0, frozen: false }),
  evaluate(ctx, i, params, s) {
    const g: GridShape = { rows: Math.round(numParam(params, 'rows', 7)), cols: Math.round(numParam(params, 'cols', 7)) };
    const id = ctx.nodeId;
    const shared = sharedOf(ctx.world);
    const at = Math.round(asNum(i.at));
    const here = asBool(i.stood) && at === s.goal;
    const t = ctx.tick * ctx.dt;
    const lanes = lanesOfWorld(ctx.world, ctx.tick);
    const far = (from: number, to: number): number => (from === to ? 0 : routeOnLanes(lanes, from, to).length || Infinity);
    const rnd = (): number => {
      s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0;
      return s.seed / 4294967296;
    };
    const laneCell = (): number => cellNumber(g, 2 * Math.floor(rnd() * ((g.rows + 1) / 2)), 1 + 2 * Math.floor(rnd() * ((g.cols - 1) / 2)));
    const stations = [Math.round(numParam(params, 'stationA', 8)), Math.round(numParam(params, 'stationB', 36))];

    if (s.phase === 'loading') {
      const o = shared.stress.outage;
      const out = o !== undefined && o.station === s.station && t >= o.from && t < o.to;
      if (!out) s.timer += ctx.dt;
      if (s.timer >= numParam(params, 'loadS', 1.85)) {
        shared.calls.set(s.station, (shared.calls.get(s.station) ?? []).filter((q) => q !== id));
        const hole = Math.floor(rnd() * (((g.rows - 1) / 2) * ((g.cols - 1) / 2)));
        const hr = 2 * Math.floor(hole / ((g.cols - 1) / 2)) + 1;
        const hc = 2 * (hole % ((g.cols - 1) / 2)) + 1;
        const stops = [cellNumber(g, hr - 1, hc), cellNumber(g, hr + 1, hc)];
        s.goal = far(at, stops[0]!) <= far(at, stops[1]!) ? stops[0]! : stops[1]!;
        s.phase = 'loaded';
      }
    } else if (s.phase === 'tipping') {
      s.timer += ctx.dt;
      const f = shared.stress.freeze;
      const limit = s.frozen && f ? f.seconds : numParam(params, 'tipS', 1.5);
      if (s.timer >= limit) {
        s.delivered += 1;
        s.phase = 'idle';
        s.frozen = false;
      }
    } else if (here && s.phase === 'toStation') {
      s.phase = 'loading';
      s.timer = 0;
    } else if (here && s.phase === 'loaded') {
      s.phase = 'tipping';
      s.timer = 0;
      const f = shared.stress.freeze;
      if (f && f.robot === Math.round(numParam(params, 'index', 0)) && t >= f.from && !f.done) {
        s.frozen = true;
        f.done = true;
      }
    }
    if (s.phase === 'idle' && at > 0) {
      let best = 0;
      let bestLen = Infinity;
      for (const st of stations) {
        if ((shared.calls.get(st) ?? []).length >= 2) continue;
        const len = far(at, st);
        if (len < bestLen) {
          bestLen = len;
          best = st;
        }
      }
      if (best > 0) {
        shared.calls.set(best, [...(shared.calls.get(best) ?? []), id]);
        s.station = best;
        s.goal = best;
        s.phase = 'toStation';
      } else if (s.goal === 0 || here) {
        // Nothing to fetch: drift along the cross lanes so nobody parks in the way.
        do s.goal = laneCell();
        while (s.goal === at);
      }
    }
    return { goal: s.goal, delivered: s.delivered, dwelling: s.phase === 'loading' || s.phase === 'tipping' };
  },
};
if (!getNodeDef(gridJobsNode.kind)) registerNode(gridJobsNode as unknown as NodeDef<never>);

// ---------------------------------------------------------------- the board

export interface FloorOptions {
  robots: number;
  pitch: number;
  seed: number;
  /** Settings of every "Đi tới điểm". */
  drive?: Record<string, ParamValue>;
  /** "Chờ quá bao lâu thì đổi lối ra" of every "Tìm đường trên lưới" (s); 0 = never. */
  detourAfter?: number;
  /** "Đi thẳng thì xin ô kế tiếp sớm" of the hold card. */
  flow?: boolean;
  stress?: Stress;
}

export const STATIONS = [cellNumber(LAYOUT_A, 1, 0), cellNumber(LAYOUT_A, 5, 0)] as const;

/** Start cells: free stretches of the cross lanes, spread out. */
export function startCells(count: number): number[] {
  const g = LAYOUT_A;
  const starts: number[] = [];
  for (let r = 0; r < g.rows; r += 2) for (let c = 1; c < g.cols; c += 2) starts.push(cellNumber(g, r, c));
  return Array.from({ length: count }, (_, i) => starts[(i * 7) % starts.length]!);
}

const HEADING: Record<string, number> = { E: 0, S: 90, W: 180, N: -90 };

/** The whole floor of layout A as a board: markers, the hold card, one copy of the robot circuit and one job card per robot. */
export function floorBoard(o: FloorOptions): Board {
  const g = LAYOUT_A;
  const ids = Array.from({ length: o.robots }, (_, k) => `r${k + 1}`);
  const cells = startCells(o.robots);
  const nodes: GraphNode[] = [node('floor', FLOOR[1], FLOOR[2]), ...laneMarkers(g, o.pitch), node('giu-o', 'cell-hold', { robots: o.robots, flow: o.flow === false ? 'no' : 'yes' })];
  const wires: string[] = [];
  ids.forEach((id, k) => {
    const [r, c] = cellOf(g, cells[k]!);
    nodes.push(botCopy(id, c * o.pitch, r * o.pitch, HEADING[arrowsOf(r, c)[0]!]!), node(`${id}-jobs`, 'x-grid-jobs', { ...g, seed: o.seed, index: k, stationA: STATIONS[0], stationB: STATIONS[1] }));
    wires.push(...holdWires(id, k + 1), `${id}.o-dang-dung>${id}-jobs.at`, `giu-o.stood${k + 1}>${id}-jobs.stood`, `${id}-jobs.goal>${id}.o-dich`);
  });
  return { name: 'Sàn lưới thử', mode: '3d', graph: { nodes, wires: wiresOf(wires), settings: { wireRule: true, realPhysics: true } }, circuits: [botCircuit(o.drive, o.detourAfter ?? 3)] };
}

const isLink = (w: Wire, link: string): boolean => `${w.from.node}.${w.from.port}>${w.to.node}.${w.to.port}` === link;

/** The same board with one inner wire of the robot circuit taken out; throws when the wire is not there. */
export function cutInBot(board: Board, link: string): Board {
  const b = structuredClone(board);
  const g = b.circuits!.find((c) => c.id === BOT)!.graph;
  const before = g.wires.length;
  g.wires = g.wires.filter((w) => !isLink(w, link));
  if (g.wires.length !== before - 1) throw new Error(`wire not found in the robot circuit: ${link}`);
  return b;
}

/** The same board with one wire of the main board taken out. */
export function cutOnMain(board: Board, link: string): Board {
  const b = structuredClone(board);
  const before = b.graph.wires.length;
  b.graph.wires = b.graph.wires.filter((w) => !isLink(w, link));
  if (b.graph.wires.length !== before - 1) throw new Error(`wire not found on the main board: ${link}`);
  return b;
}

export interface Played {
  world: World;
  rt: Runtime;
  tick(n?: number): void;
  out(id: string, port: string): unknown;
  /** The chassis of copy `id`. */
  robot(id: string): EntityView;
  entity(ownerNodeId: string): EntityView | undefined;
}

/** Plays a board headless, circuits expanded the way the app does it: with "Vật lý thật" on when the crate engine is given, else under the plain rules. */
export function play(board: Board, rapier?: RapierModule): Played {
  const world = rapier ? createWorld(board.mode, { realPhysics: true, rapier }) : createWorld(board.mode);
  const rt = createRuntime(runnableGraph(board), world, board.mode);
  const entity = (owner: string): EntityView | undefined => world.entities().find((e) => e.ownerNodeId === owner);
  return {
    world,
    rt,
    tick(n = 1) {
      for (let i = 0; i < n; i++) {
        rt.tick({ keysDown: new Set<string>() });
        world.step(TICK_DT);
      }
    },
    out: (id, port) => rt.getOutput(id, port),
    robot: (id) => entity(`${id}/than`)!,
    entity,
  };
}

export interface Floor {
  run: Played;
  ids: string[];
  options: FloorOptions;
}

export function buildFloor(o: FloorOptions, rapier: RapierModule, board: Board = floorBoard(o)): Floor {
  const run = play(board, rapier);
  sharedOf(run.world).stress = o.stress ?? {};
  return { run, ids: Array.from({ length: o.robots }, (_, k) => `r${k + 1}`), options: o };
}

// ---------------------------------------------------------------- measuring, from the entity views alone

export interface FloorResult {
  seconds: number;
  delivered: number;
  perMinute: number;
  /** Longest time any robot went without moving 5 cm or turning 5 degrees (s), and which robot / when it ended. */
  longestStandstill: number;
  standstillBy: string;
  /** Times when no robot at all moved for 20 s; each entry is how long that lasted (s). `stuckAtEnd` = the last one never ended. */
  deadlocks: number[];
  stuckAtEnd: boolean;
  /** Smallest gap between two chassis outlines (m); negative = inside each other. */
  minGap: number;
  /** Farthest a chassis middle was from the middle line of its lane (m). */
  maxOffLane: number;
  /** Ticks with a chassis middle inside a hole cell; ticks with a chassis corner over a hole opening. */
  middleInHoleTicks: number;
  cornerOverHoleTicks: number;
  /** Distance from the marker middle when a robot began to load or tip (m): mean and worst; worst heading off the lane axis (degrees). */
  stopErrorMean: number;
  stopErrorMax: number;
  stopAngleMax: number;
  stops: number;
  /** Ticks on which two robots were cleared for the same cell (must be 0). */
  sharedCellTicks: number;
  msMean: number;
  msP95: number;
  msMax: number;
  hash: number;
  perRobot: number[];
}

const corners = (v: EntityView): { x: number; z: number }[] => {
  const r = v.robot!;
  const fx = Math.cos(r.heading);
  const fz = Math.sin(r.heading);
  const out: { x: number; z: number }[] = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) out.push({ x: v.position.x + (a * fx * r.length) / 2 - (b * fz * r.width) / 2, z: v.position.z + (a * fz * r.length) / 2 + (b * fx * r.width) / 2 });
  return out;
};

export function runFloor(f: Floor, seconds: number, each?: (t: number, views: EntityView[]) => void): FloorResult {
  const { run: r, ids } = f;
  const g = LAYOUT_A;
  const p = f.options.pitch;
  const ticks = Math.round(seconds / TICK_DT);
  const ms = new Float64Array(ticks);
  const res: FloorResult = { seconds, delivered: 0, perMinute: 0, longestStandstill: 0, standstillBy: '', deadlocks: [], stuckAtEnd: false, minGap: Infinity, maxOffLane: 0, middleInHoleTicks: 0, cornerOverHoleTicks: 0, stopErrorMean: 0, stopErrorMax: 0, stopAngleMax: 0, stops: 0, sharedCellTicks: 0, msMean: 0, msP95: 0, msMax: 0, hash: 2166136261, perRobot: [] };
  const anchor = ids.map((id) => r.robot(id)).map((v) => ({ x: v.position.x, z: v.position.z, h: v.robot!.heading, since: 0 }));
  const dwelling = ids.map(() => false);
  let allStillSince = 0;
  let stopSum = 0;
  for (let k = 0; k < ticks; k++) {
    const t0 = performance.now();
    r.tick();
    ms[k] = performance.now() - t0;
    const t = (k + 1) * TICK_DT;
    const views = ids.map((id) => r.robot(id));
    res.hash = stateHash(res.hash, views);
    for (let i = 0; i < views.length; i++) for (let j = i + 1; j < views.length; j++) res.minGap = Math.min(res.minGap, -overlapDepth(views[i]!, views[j]!));
    const cleared = ids.map((_, i) => Number(r.out('giu-o', `cell${i + 1}`))).filter((c) => c > 0);
    if (new Set(cleared).size !== cleared.length) res.sharedCellTicks += 1;
    let anyMoved = false;
    views.forEach((v, i) => {
      const a = anchor[i]!;
      const h = v.robot!.heading;
      if (Math.hypot(v.position.x - a.x, v.position.z - a.z) > 0.05 || Math.abs(h - a.h) > (5 * Math.PI) / 180) {
        anchor[i] = { x: v.position.x, z: v.position.z, h, since: t };
        anyMoved = true;
      } else if (t - a.since > res.longestStandstill) {
        res.longestStandstill = t - a.since;
        res.standstillBy = `${ids[i]} until ${t.toFixed(0)} s`;
      }
      // lane keeping
      const row = Math.round(v.position.z / p);
      const col = Math.round(v.position.x / p);
      const dz = Math.abs(v.position.z - row * p);
      const dx = Math.abs(v.position.x - col * p);
      if (!isLane(g, row, col)) res.middleInHoleTicks += 1;
      else res.maxOffLane = Math.max(res.maxOffLane, row % 2 === 0 && col % 2 === 0 ? Math.min(dx, dz) : row % 2 === 0 ? dz : dx);
      let over = false;
      for (const q of corners(v)) {
        const qr = Math.round(q.z / p);
        const qc = Math.round(q.x / p);
        if (qr % 2 !== 0 && qc % 2 !== 0 && Math.abs(q.z - qr * p) < HOLE / 2 && Math.abs(q.x - qc * p) < HOLE / 2) over = true;
      }
      if (over) res.cornerOverHoleTicks += 1;
      // accuracy where it stands to load or tip
      const now = r.out(`${ids[i]}-jobs`, 'dwelling') === true;
      if (now && !dwelling[i]) {
        const goal = Number(r.out(`${ids[i]}-jobs`, 'goal'));
        const [gr, gc] = cellOf(g, goal);
        const e = Math.hypot(v.position.x - gc * p, v.position.z - gr * p);
        stopSum += e;
        res.stops += 1;
        res.stopErrorMax = Math.max(res.stopErrorMax, e);
        const deg = ((((h * 180) / Math.PI) % 90) + 90) % 90;
        res.stopAngleMax = Math.max(res.stopAngleMax, Math.min(deg, 90 - deg));
      }
      dwelling[i] = now;
    });
    if (anyMoved) {
      if (t - allStillSince >= 20) res.deadlocks.push(t - allStillSince);
      allStillSince = t;
    }
    each?.(t, views);
  }
  if (seconds - allStillSince >= 20) {
    res.deadlocks.push(seconds - allStillSince);
    res.stuckAtEnd = true;
  }
  res.perRobot = ids.map((id) => Number(r.out(`${id}-jobs`, 'delivered')));
  res.delivered = res.perRobot.reduce((a, b) => a + b, 0);
  res.perMinute = res.delivered / (seconds / 60);
  res.stopErrorMean = res.stops > 0 ? stopSum / res.stops : 0;
  const sorted = Array.from(ms).sort((a, b) => a - b);
  res.msMean = sorted.reduce((a, b) => a + b, 0) / ticks;
  res.msP95 = sorted[Math.floor(ticks * 0.95)]!;
  res.msMax = sorted[ticks - 1]!;
  return res;
}

export function line(name: string, x: FloorResult): string {
  const mm = (v: number): string => (v * 1000).toFixed(0);
  return `${name}: ${x.delivered} delivered = ${x.perMinute.toFixed(2)}/min (per robot ${x.perRobot.join('/')}), longest standstill ${x.longestStandstill.toFixed(1)} s (${x.standstillBy}), deadlocks ${x.deadlocks.length}${x.deadlocks.length ? ` [${x.deadlocks.map((d) => d.toFixed(0)).join(', ')} s]${x.stuckAtEnd ? ' STUCK AT END' : ''}` : ''}, min gap ${mm(x.minGap)} mm, off lane max ${mm(x.maxOffLane)} mm, middle in hole ${x.middleInHoleTicks} ticks, corner over hole ${x.cornerOverHoleTicks} ticks, stop error mean ${mm(x.stopErrorMean)} / max ${mm(x.stopErrorMax)} mm over ${x.stops} stops, stop angle max ${x.stopAngleMax.toFixed(1)} deg, two robots cleared for one cell ${x.sharedCellTicks} ticks, ms/tick mean ${x.msMean.toFixed(3)} p95 ${x.msP95.toFixed(3)} max ${x.msMax.toFixed(1)}, hash ${x.hash.toString(16)}`;
}
