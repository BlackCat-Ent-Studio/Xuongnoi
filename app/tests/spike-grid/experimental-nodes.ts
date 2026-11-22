/**
 * EXPERIMENTAL, measuring spike only. Nothing here is registered by the app; the spike tests register these kinds
 * themselves. Two candidate GENERAL pieces and one test stand-in:
 *
 *  - `x-grid-route`  "Tìm đường trên lưới": next cell on a grid of one-way lanes (candidate piece).
 *  - `x-cell-hold`   "Giữ ô": one robot per cell, shared reservation table (candidate piece).
 *  - `x-spike-jobs`  test stand-in for the feeding stations, the carton routes and the tipping time. NOT a candidate
 *                    piece: in the sample that part is the station circuit, the dispatcher and the tray.
 *
 * Cells are numbered like the floor markers that lie on them: number = row * cols + col + 1. Holes sit on (odd, odd).
 * Lanes are the even rows and columns, one way each, alternating: row 0 runs east (+x), column 0 runs north (-z).
 */
import { registerNode, getNodeDef } from '../../src/engine/registry';
import type { EntityView, NodeDef, WorldApi } from '../../src/engine/types';
import { listMarkers, markerByNumber, markerUnder } from '../../src/nodes/floor-marker';
import { asBool, asNum, asObject, numParam } from '../../src/nodes/util';

// ---------------------------------------------------------------- grid maths (shared by the nodes and the tests)

export interface GridShape {
  rows: number;
  cols: number;
}
export type Cell = readonly [row: number, col: number];

export const cellNumber = (g: GridShape, r: number, c: number): number => r * g.cols + c + 1;
export const cellOf = (g: GridShape, n: number): Cell => [Math.floor((n - 1) / g.cols), (n - 1) % g.cols];
export const isLane = (g: GridShape, r: number, c: number): boolean => r >= 0 && c >= 0 && r < g.rows && c < g.cols && (r % 2 === 0 || c % 2 === 0);

/** Cells a robot may drive to from cell `n`: along its row and / or its column, one way each. */
export function exitsOf(g: GridShape, n: number): number[] {
  const [r, c] = cellOf(g, n);
  const out: number[] = [];
  if (r % 2 === 0) {
    const k = c + ((r / 2) % 2 === 0 ? 1 : -1);
    if (isLane(g, r, k)) out.push(cellNumber(g, r, k));
  }
  if (c % 2 === 0) {
    const k = r + ((c / 2) % 2 === 1 ? 1 : -1);
    if (isLane(g, k, c)) out.push(cellNumber(g, k, c));
  }
  return out;
}

/** Shortest way along the lanes (breadth first); `blocked` cells are walked around unless they are the goal. Empty = none. */
export function routeOnGrid(g: GridShape, from: number, goal: number, blocked?: ReadonlySet<number>): number[] {
  if (from === goal) return [];
  const [fr, fc] = cellOf(g, from);
  const [gr, gc] = cellOf(g, goal);
  if (!isLane(g, fr, fc) || !isLane(g, gr, gc)) return [];
  const prev = new Map<number, number>();
  const seen = new Set<number>([from]);
  let frontier = [from];
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const at of frontier) {
      for (const n of exitsOf(g, at)) {
        if (seen.has(n) || (blocked?.has(n) && n !== goal)) continue;
        seen.add(n);
        prev.set(n, at);
        if (n === goal) {
          const path = [n];
          let back = at;
          while (back !== from) {
            path.unshift(back);
            back = prev.get(back)!;
          }
          return path;
        }
        next.push(n);
      }
    }
    frontier = next;
  }
  return [];
}

// ---------------------------------------------------------------- shared tables, one per run (per world)

interface Shared {
  /** Cell number -> id of the robot that holds it. */
  holds: Map<number, string>;
  /** Station cell number -> robots called to it. */
  calls: Map<number, string[]>;
  /** Test knobs read by the job stand-in. */
  stress: Stress;
}
export interface Stress {
  /** A station cell that hands over nothing between these seconds. */
  outage?: { station: number; from: number; to: number };
  /** The robot with this index stays put for `seconds` at its first stop beside a hole after `from` seconds. */
  freeze?: { robot: number; from: number; seconds: number };
}
const tables = new WeakMap<WorldApi, Shared>();
export function sharedOf(world: WorldApi): Shared {
  let s = tables.get(world);
  if (!s) {
    s = { holds: new Map(), calls: new Map(), stress: {} };
    tables.set(world, s);
  }
  return s;
}

// ---------------------------------------------------------------- "Tìm đường trên lưới"

const gridOf = (params: Record<string, unknown>): GridShape => ({ rows: Math.max(1, Math.round(numParam(params as never, 'rows', 7))), cols: Math.max(1, Math.round(numParam(params as never, 'cols', 7))) });

interface RouteState {
  /** The cell asked from on the tick before and the one before that, to tell whether the next leg goes straight on. */
  at: number;
  cameFrom: number;
}

export const gridRouteNode: NodeDef<RouteState> = {
  kind: 'x-grid-route',
  label: 'Tìm đường trên lưới (thử nghiệm)',
  category: 'logic',
  description: 'THỬ NGHIỆM. Trên sàn lưới có làn một chiều: cho biết từ ô đang đứng muốn tới ô đích thì ô kế tiếp là ô nào.',
  inputs: [
    { id: 'at', type: 'number', label: 'Ô đang đứng' },
    { id: 'goal', type: 'number', label: 'Ô đích' },
    { id: 'avoid', type: 'bool', label: 'Tránh ô đang bị giữ' },
    { id: 'who', type: 'object', label: 'Robot' },
  ],
  outputs: [
    { id: 'next', type: 'number', label: 'Ô kế tiếp' },
    { id: 'hasNext', type: 'bool', label: 'Còn phải đi' },
    { id: 'steps', type: 'number', label: 'Số ô còn lại' },
    { id: 'straight', type: 'bool', label: 'Đi thẳng tiếp' },
  ],
  params: [
    { id: 'rows', label: 'Số hàng ô', kind: 'number', default: 7, min: 1, max: 9, step: 2 },
    { id: 'cols', label: 'Số cột ô', kind: 'number', default: 7, min: 1, max: 9, step: 2 },
    { id: 'detour', label: 'Cách tránh (0 = cả đường không ô bị giữ, 1 = chỉ ô kế tiếp phải trống)', kind: 'number', default: 0, min: 0, max: 1, step: 1 },
  ],
  create: () => ({ at: 0, cameFrom: 0 }),
  evaluate(ctx, i, params, s) {
    const g = gridOf(params);
    const at = Math.round(asNum(i.at));
    const goal = Math.round(asNum(i.goal));
    if (at !== s.at) {
      s.cameFrom = s.at;
      s.at = at;
    }
    let path = routeOnGrid(g, at, goal);
    if (asBool(i.avoid) && path.length > 0) {
      const me = asObject(i.who);
      const taken = new Set<number>();
      for (const [cell, holder] of sharedOf(ctx.world).holds) if (holder !== me) taken.add(cell);
      if (numParam(params, 'detour', 0) >= 1) {
        // Step rule: only the very next cell must be free. Take the free exit that still leads to the goal soonest.
        let best: number[] = [];
        for (const exit of exitsOf(g, at)) {
          if (taken.has(exit)) continue;
          const rest = exit === goal ? [] : routeOnGrid(g, exit, goal);
          if (exit !== goal && rest.length === 0) continue;
          if (best.length === 0 || rest.length + 1 < best.length) best = [exit, ...rest];
        }
        if (best.length > 0) path = best;
      } else {
        // Path rule (as in the mock-up): a whole way that touches no held cell.
        const detour = routeOnGrid(g, at, goal, taken);
        if (detour.length > 0 && !taken.has(detour[0]!)) path = detour;
      }
    }
    const next = path[0] ?? at;
    const straight = path.length > 0 && s.cameFrom > 0 && next - at === at - s.cameFrom;
    return { next, hasNext: path.length > 0, steps: path.length, straight };
  },
};

// ---------------------------------------------------------------- "Giữ ô"

/** Half sizes of the axis-aligned box round a chassis turned to its heading. */
function reachOf(e: EntityView): { hx: number; hz: number } {
  const r = e.robot;
  if (!r) return { hx: e.size.x / 2, hz: e.size.z / 2 };
  const c = Math.abs(Math.cos(r.heading));
  const s = Math.abs(Math.sin(r.heading));
  return { hx: (r.length / 2) * c + (r.width / 2) * s, hz: (r.length / 2) * s + (r.width / 2) * c };
}

interface HoldState {
  /** The cell this robot is cleared to stand on / drive to (0 before the first tick), and the one it was cleared for before. */
  target: number;
  before: number;
}

/**
 * One robot per cell. A robot holds every cell its body lies on, plus the one cell it was last cleared for. It asks for
 * the next cell ("Ô muốn tới") while "Xin ô" is on; it gets it when no other robot holds it. Who asks first on a tick wins.
 */
export const cellHoldNode: NodeDef<HoldState> = {
  kind: 'x-cell-hold',
  label: 'Giữ ô (thử nghiệm)',
  category: 'logic',
  description: 'THỬ NGHIỆM. Mỗi ô sàn chỉ một robot: robot giữ ô nó đang đứng và ô nó vừa xin được; ô đang bị robot khác giữ thì phải chờ.',
  inputs: [
    { id: 'who', type: 'object', label: 'Robot', required: true },
    { id: 'want', type: 'number', label: 'Ô muốn tới' },
    { id: 'ask', type: 'bool', label: 'Xin ô' },
  ],
  outputs: [
    { id: 'held', type: 'number', label: 'Ô được đi' },
    { id: 'marker', type: 'object', label: 'Mốc được đi' },
    { id: 'waiting', type: 'bool', label: 'Đang chờ ô' },
  ],
  params: [
    { id: 'arriveWithin', label: 'Coi như đứng giữa ô khi còn cách (m)', kind: 'number', default: 0.06, min: 0.01, max: 1, step: 0.01 },
    { id: 'flow', label: 'Đi thẳng thì xin ô kế tiếp sớm (0 = không, 1 = có)', kind: 'number', default: 0, min: 0, max: 1, step: 1 },
  ],
  create: () => ({ target: 0, before: 0 }),
  evaluate(ctx, i, params, s) {
    const id = asObject(i.who);
    const self = id !== null ? ctx.world.getEntity(id) : undefined;
    if (!self || id === null) return { held: 0, marker: null, waiting: false };
    const holds = sharedOf(ctx.world).holds;
    if (s.target === 0) s.target = markerUnder(ctx.world, ctx.mode, self.position)?.number ?? 0;
    for (const [cell, holder] of holds) if (holder === id) holds.delete(cell);
    const { hx, hz } = reachOf(self);
    for (const m of listMarkers(ctx.world)) {
      const half = m.size / 2;
      if (Math.abs(self.position.x - m.x) < half + hx && Math.abs(self.position.z - m.z) < half + hz && !holds.has(m.number)) holds.set(m.number, id);
    }
    if (s.target > 0) holds.set(s.target, id);
    const want = Math.round(asNum(i.want));
    let waiting = false;
    // On the very first tick not every robot has written where it stands yet, so nobody is cleared for anything.
    const here = markerByNumber(ctx.world, s.target);
    const there = markerByNumber(ctx.world, want);
    if (asBool(i.ask) && want > 0 && want !== s.target && ctx.tick > 0 && here && there) {
      // The robot may leave for another cell only from the middle of the one it was cleared for. Going straight on it
      // may ask earlier (setting "flow"): as soon as its middle is inside that cell.
      const off = Math.hypot(self.position.x - here.x, self.position.z - here.z);
      const was = markerByNumber(ctx.world, s.before);
      const straight = was !== null && Math.abs(there.x - here.x - (here.x - was.x)) < 1e-6 && Math.abs(there.z - here.z - (here.z - was.z)) < 1e-6;
      const inside = Math.abs(self.position.x - here.x) < here.size / 2 && Math.abs(self.position.z - here.z) < here.size / 2;
      const ready = off <= numParam(params, 'arriveWithin', 0.06) || (numParam(params, 'flow', 0) >= 1 && straight && inside);
      const holder = holds.get(want);
      if (!ready) {
        // still on the way: not waiting for anybody
      } else if (holder === undefined || holder === id) {
        s.before = s.target;
        s.target = want;
        holds.set(want, id);
      } else waiting = true;
    }
    return { held: s.target, marker: markerByNumber(ctx.world, s.target)?.id ?? null, waiting };
  },
};

// ---------------------------------------------------------------- test stand-in: stations, carton routes, tipping

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
 * nearer station by lane distance; otherwise it drifts to a random lane cell), waits `loadS` there, gets a random hole
 * 1..holes, drives to the lane cell above or below it, waits `tipS`, and is free again.
 */
export const spikeJobsNode: NodeDef<JobState> = {
  kind: 'x-spike-jobs',
  label: 'Việc giả (chỉ để đo)',
  category: 'logic',
  description: 'CHỈ ĐỂ ĐO. Giả làm trạm nạp, tuyến của kiện và thời gian nghiêng khay.',
  inputs: [
    { id: 'who', type: 'object', label: 'Robot' },
    { id: 'at', type: 'number', label: 'Ô được đi' },
    { id: 'arrived', type: 'bool', label: 'Đã tới' },
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
    const g = gridOf(params);
    const id = asObject(i.who) ?? ctx.nodeId;
    const shared = sharedOf(ctx.world);
    const at = Math.round(asNum(i.at));
    const self = ctx.world.getEntity(id);
    const goalAt = markerByNumber(ctx.world, s.goal);
    // Standing on the middle of the goal cell (measured, so a one-tick-old "Đã tới" of the cell before cannot count).
    const here = asBool(i.arrived) && at === s.goal && !!self && !!goalAt && Math.hypot(self.position.x - goalAt.x, self.position.z - goalAt.z) < 0.2 && Math.abs(self.robot?.speed ?? 0) < 0.05;
    const t = ctx.tick * ctx.dt;
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
        const len = stops.map((c) => (c === at ? 0 : routeOnGrid(g, at, c).length || Infinity));
        s.goal = len[0]! <= len[1]! ? stops[0]! : stops[1]!;
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
      if (f && f.robot === Math.round(numParam(params, 'index', 0)) && t >= f.from && !('done' in f)) {
        s.frozen = true;
        (f as { done?: boolean }).done = true;
      }
    }
    if (s.phase === 'idle' && at > 0) {
      let best = 0;
      let bestLen = Infinity;
      for (const st of stations) {
        if ((shared.calls.get(st) ?? []).length >= 2) continue;
        const len = at === st ? 0 : routeOnGrid(g, at, st).length || Infinity;
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

export function registerSpikeNodes(): void {
  for (const def of [gridRouteNode, cellHoldNode, spikeJobsNode] as unknown as NodeDef<never>[]) if (!getNodeDef(def.kind)) registerNode(def);
}
