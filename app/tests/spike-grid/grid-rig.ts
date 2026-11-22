/**
 * Measuring spike (throwaway): a 7 x 7 cell floor of one-way lanes on ONE flat floor, holes as plain no-go cells, and
 * robots built from "Thân robot" + two "Động cơ" + "Đi tới điểm". Three robot circuits can be chosen:
 *
 *  - 'hold'      EXPERIMENTAL "Tìm đường trên lưới" + EXPERIMENTAL "Giữ ô", asking for the next cell after arriving.
 *  - 'hold-flow' the same, but a robot going straight on asks for the next cell before it has stopped.
 *  - 'eyes'      EXPERIMENTAL "Tìm đường trên lưới" + EXISTING pieces only for right of way ("Dò phía trước" ahead and to
 *                the right, "Nhớ số" for the cell being driven to).
 *
 * Everything is measured from the entity views on every tick.
 */
import { performance } from 'node:perf_hooks';
import { TICK_DT, type EntityView, type ParamValue } from '../../src/engine/types';
import type { RapierModule } from '../../src/world/rapier-loader';
import type { NodeSpec, WireSpec } from '../helpers/arm-rig';
import { overlapDepth } from '../helpers/chassis-metrics';
import { navBot, navRig, stateHash, type NavRig } from '../helpers/nav-rig';
import { cellNumber, cellOf, exitsOf, isLane, registerSpikeNodes, sharedOf, type GridShape, type Stress } from './experimental-nodes';

registerSpikeNodes();

export const GRID: GridShape = { rows: 7, cols: 7 };
export const CHASSIS = { length: 0.9, width: 0.7 };
/** Side of a drop hole in the mock-up (m). */
export const HOLE = 0.94;
export const STATIONS = [cellNumber(GRID, 1, 0), cellNumber(GRID, 5, 0)] as const;

export type Approach = 'hold' | 'hold-flow' | 'eyes' | 'eyes-turn';

export interface FloorOptions {
  robots: number;
  pitch: number;
  approach: Approach;
  seed: number;
  /** Settings of every "Đi tới điểm". */
  drive?: Record<string, ParamValue>;
  /** 'hold' circuits: route around held cells after waiting this long (s); 0 = never. */
  detourAfter?: number;
  /** 'eyes' circuit: reach of the straight-ahead eye (m). */
  frontReach?: number;
  stress?: Stress;
  loadS?: number;
  tipS?: number;
}

export const markerRows = (pitch: number): NodeSpec[] => {
  const out: NodeSpec[] = [];
  for (let r = 0; r < GRID.rows; r++) for (let c = 0; c < GRID.cols; c++) if (isLane(GRID, r, c)) out.push([`m${cellNumber(GRID, r, c)}`, 'floor-marker', { number: cellNumber(GRID, r, c), position: { x: c * pitch, y: 0, z: r * pitch }, size: pitch }]);
  return out;
};

/** Start cells as in the mock-up: free stretches of the cross lanes, spread out. */
export function startCells(count: number): number[] {
  const starts: number[] = [];
  for (let r = 0; r < GRID.rows; r += 2) for (let c = 1; c < GRID.cols; c += 2) starts.push(cellNumber(GRID, r, c));
  return Array.from({ length: count }, (_, i) => starts[(i * 7) % starts.length]!);
}

export function headingBetween(from: number, to: number): number {
  const [fr, fc] = cellOf(GRID, from);
  const [tr, tc] = cellOf(GRID, to);
  return tc > fc ? 0 : tc < fc ? 180 : tr > fr ? 90 : -90;
}

export const DEFAULT_DRIVE: Record<string, ParamValue> = { power: 0.6, tolerance: 0.1, slowDistance: 1 };

function robotCircuit(id: string, index: number, cell: number, o: FloorOptions): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const [r, c] = cellOf(GRID, cell);
  const bot = navBot({ id, x: c * o.pitch, z: r * o.pitch, heading: headingBetween(cell, exitsOf(GRID, cell)[0]!), length: CHASSIS.length, width: CHASSIS.width, drive: { ...DEFAULT_DRIVE, ...(o.drive ?? {}) } });
  const nodes: NodeSpec[] = [...bot.nodes, [`${id}-route`, 'x-grid-route', { ...GRID }], [`${id}-jobs`, 'x-spike-jobs', { ...GRID, seed: o.seed, index, stationA: STATIONS[0], stationB: STATIONS[1], ...(o.loadS !== undefined ? { loadS: o.loadS } : {}), ...(o.tipS !== undefined ? { tipS: o.tipS } : {}) }]];
  const wires: WireSpec[] = [...bot.wires, [id, 'self', `${id}-jobs`, 'who'], [id, 'self', `${id}-route`, 'who'], [`${id}-jobs`, 'goal', `${id}-route`, 'goal'], [`${id}-go`, 'arrived', `${id}-jobs`, 'arrived']];

  if (o.approach === 'eyes' || o.approach === 'eyes-turn') {
    const p = o.pitch;
    nodes.push(
      [`${id}-cell`, 'sample-hold', { start: cell }],
      [`${id}-find`, 'floor-marker-find', {}],
      [`${id}-step`, 'and', {}],
      [`${id}-eye`, 'ahead-sensor', { reach: o.frontReach ?? 0.8 }],
      // The cell ahead and to the right: whoever stands there is about to enter the same crossing and goes first.
      [`${id}-eyeR`, 'ahead-sensor', { reach: p * 0.8, mountSide: p, beam: p * 0.8, mountForward: p * 0.6 }],
      [`${id}-any`, 'or', {}],
      [`${id}-free`, 'not', {}],
    );
    wires.push(
      [`${id}-cell`, 'held', `${id}-route`, 'at'],
      [`${id}-cell`, 'held', `${id}-jobs`, 'at'],
      [`${id}-route`, 'next', `${id}-cell`, 'value'],
      [`${id}-go`, 'arrived', `${id}-step`, 'a'],
      [`${id}-route`, 'hasNext', `${id}-step`, 'b'],
      [`${id}-step`, 'out', `${id}-cell`, 'store'],
      [`${id}-cell`, 'held', `${id}-find`, 'number'],
      [`${id}-find`, 'marker', `${id}-go`, 'target'],
      [id, 'self', `${id}-eye`, 'who'],
      [id, 'self', `${id}-eyeR`, 'who'],
      [`${id}-eye`, 'blocked', `${id}-any`, 'a'],
      [`${id}-eyeR`, 'blocked', `${id}-any`, 'b'],
      [`${id}-any`, 'out', `${id}-free`, 'in'],
    );
    if (o.approach === 'eyes') wires.push([`${id}-free`, 'out', `${id}-go`, 'go']);
    else {
      // The eyes turn with the nose, so while the robot turns on the spot they sweep over the neighbours. Here they are
      // believed only while the nose points at the next cell (heading error under 20 degrees: error x error < 400).
      nodes.push([`${id}-err2`, 'math', { op: 'mul' }], [`${id}-lim`, 'const', { value: 400 }], [`${id}-turning`, 'compare', { op: 'gt' }], [`${id}-may`, 'or', {}]);
      wires.push(
        [`${id}-go`, 'headingError', `${id}-err2`, 'a'],
        [`${id}-go`, 'headingError', `${id}-err2`, 'b'],
        [`${id}-err2`, 'out', `${id}-turning`, 'a'],
        [`${id}-lim`, 'value', `${id}-turning`, 'b'],
        [`${id}-free`, 'out', `${id}-may`, 'a'],
        [`${id}-turning`, 'out', `${id}-may`, 'b'],
        [`${id}-may`, 'out', `${id}-go`, 'go'],
      );
    }
    return { nodes, wires };
  }

  nodes.push([`${id}-hold`, 'x-cell-hold', { flow: o.approach === 'hold-flow' ? 1 : 0 }]);
  wires.push(
    [id, 'self', `${id}-hold`, 'who'],
    [`${id}-hold`, 'held', `${id}-route`, 'at'],
    [`${id}-hold`, 'held', `${id}-jobs`, 'at'],
    [`${id}-route`, 'next', `${id}-hold`, 'want'],
    [`${id}-hold`, 'marker', `${id}-go`, 'target'],
    ['start', 'started', `${id}-go`, 'go'],
  );
  wires.push(['start', 'started', `${id}-hold`, 'ask']);
  if ((o.detourAfter ?? 0) > 0) {
    nodes.push([`${id}-patience`, 'timer', { seconds: o.detourAfter! }], [`${id}-calm`, 'not', {}]);
    wires.push([`${id}-hold`, 'waiting', `${id}-patience`, 'run'], [`${id}-hold`, 'waiting', `${id}-calm`, 'in'], [`${id}-calm`, 'out', `${id}-patience`, 'reset'], [`${id}-patience`, 'done', `${id}-route`, 'avoid']);
  }
  return { nodes, wires };
}

export interface Floor {
  rig: NavRig;
  ids: string[];
  options: FloorOptions;
}

export function buildFloor(o: FloorOptions, rapier: RapierModule): Floor {
  const ids = Array.from({ length: o.robots }, (_, k) => `r${k + 1}`);
  const cells = startCells(o.robots);
  const parts = ids.map((id, k) => robotCircuit(id, k, cells[k]!, o));
  const rig = navRig([...markerRows(o.pitch), ['start', 'on-start', {}], ...parts.flatMap((p) => p.nodes)], parts.flatMap((p) => p.wires), rapier);
  sharedOf(rig.world as never).stress = o.stress ?? {};
  return { rig, ids, options: o };
}

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
  touchingTicks: number;
  /** Farthest a chassis middle was from the middle line of its lane (m). */
  maxOffLane: number;
  /** Ticks with a chassis middle inside a hole cell; ticks with a chassis corner over a hole opening. */
  middleInHoleTicks: number;
  cornerOverHoleTicks: number;
  /** Distance from the marker middle when a robot stood to load or tip (m): mean and worst; worst heading off the lane axis (degrees). */
  stopErrorMean: number;
  stopErrorMax: number;
  stopAngleMax: number;
  stops: number;
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
  const { rig: r, ids } = f;
  const p = f.options.pitch;
  const ticks = Math.round(seconds / TICK_DT);
  const ms = new Float64Array(ticks);
  const res: FloorResult = { seconds, delivered: 0, perMinute: 0, longestStandstill: 0, standstillBy: '', deadlocks: [], stuckAtEnd: false, minGap: Infinity, touchingTicks: 0, maxOffLane: 0, middleInHoleTicks: 0, cornerOverHoleTicks: 0, stopErrorMean: 0, stopErrorMax: 0, stopAngleMax: 0, stops: 0, msMean: 0, msP95: 0, msMax: 0, hash: 2166136261, perRobot: [] };
  const first = ids.map((id) => r.entity(id)!);
  const anchor = first.map((v) => ({ x: v.position.x, z: v.position.z, h: v.robot!.heading, since: 0 }));
  const dwelling = ids.map(() => false);
  let allStillSince = 0;
  let stopSum = 0;
  for (let k = 0; k < ticks; k++) {
    const t0 = performance.now();
    r.tick();
    ms[k] = performance.now() - t0;
    const t = (k + 1) * TICK_DT;
    const views = ids.map((id) => r.entity(id)!);
    res.hash = stateHash(res.hash, views);
    for (let i = 0; i < views.length; i++) for (let j = i + 1; j < views.length; j++) res.minGap = Math.min(res.minGap, -overlapDepth(views[i]!, views[j]!));
    let anyMoved = false;
    let touching = false;
    for (let i = 0; i < views.length; i++) for (let j = i + 1; j < views.length; j++) if (-overlapDepth(views[i]!, views[j]!) < 0.001) touching = true;
    if (touching) res.touchingTicks += 1;
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
      if (!isLane(GRID, row, col)) res.middleInHoleTicks += 1;
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
        const [gr, gc] = cellOf(GRID, goal);
        const e = Math.hypot(v.position.x - gc * p, v.position.z - gr * p);
        stopSum += e;
        res.stops += 1;
        res.stopErrorMax = Math.max(res.stopErrorMax, e);
        const deg = (((h * 180) / Math.PI) % 90 + 90) % 90;
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
  return `${name}: ${x.delivered} delivered = ${x.perMinute.toFixed(2)}/min (per robot ${x.perRobot.join('/')}), longest standstill ${x.longestStandstill.toFixed(1)} s (${x.standstillBy}), deadlocks ${x.deadlocks.length}${x.deadlocks.length ? ` [${x.deadlocks.map((d) => d.toFixed(0)).join(', ')} s]${x.stuckAtEnd ? ' STUCK AT END' : ''}` : ''}, min gap ${mm(x.minGap)} mm, touching ticks ${x.touchingTicks}, off lane max ${mm(x.maxOffLane)} mm, middle in hole ${x.middleInHoleTicks} ticks, corner over hole ${x.cornerOverHoleTicks} ticks, stop error mean ${mm(x.stopErrorMean)} / max ${mm(x.stopErrorMax)} mm over ${x.stops} stops, stop angle max ${x.stopAngleMax.toFixed(1)} deg, ms/tick mean ${x.msMean.toFixed(3)} p95 ${x.msP95.toFixed(3)} max ${x.msMax.toFixed(1)}, hash ${x.hash.toString(16)}`;
}
