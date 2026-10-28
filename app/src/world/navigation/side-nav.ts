import { TICK_DT, type SolidBox } from '../../engine/types';
import { GRAVITY } from '../physics';
import { DEFAULT_MAX_EXPANSIONS } from './plane-nav';
import { MinHeap } from './min-heap';

/**
 * Platform-graph navigation for the side view. Nodes are "spots": a place a character can stand
 * (a column of the level and the top of a block under it, with room above). Edges are the moves the
 * physics allows: walk, jump up or across a gap (checked against the real jump arc), and drop down.
 * Jump reach comes from the character's speed and jump power plus the world gravity, not from fixed numbers.
 */

export const SIDE_CELL = 0.5;
const MARGIN = 3;
const MAX_COLUMNS = 3000;
/** Support must overlap the body by at least this much to hold it up. */
const MIN_SUPPORT_OVERLAP = 0.1;
/** Extra width kept clear around the body, so a path never grazes a wall. */
const BODY_SLACK = 0.02;
/** Same-height tolerance when matching spots. */
const LEVEL_EPS = 0.05;
/** Head and feet clearance trimmed from the body box when testing for blocks. */
const VERT_EPS = 0.02;
/** Safety kept below the physically highest jump. */
const RISE_MARGIN = 0.06;
/** Deepest landing a jump may aim for (jumps across a gap onto lower ground). */
const MAX_JUMP_DOWN = 4;
/** Arc sampling interval in seconds. */
const ARC_DT = 0.04;
/** Planning cost (seconds) of a jump over walking: prefer walking when both work. */
const JUMP_PENALTY = 0.3;
const MAX_JUMP_COLUMNS = 20;

export interface SideBody {
  halfWidth: number;
  height: number;
}

export interface SideLimits {
  /** Units per second. */
  speed: number;
  /** Initial upward velocity in units per second. */
  jumpPower: number;
}

export type SideStepKind = 'walk' | 'jump' | 'drop';

interface Rect {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

export interface SideSpot {
  id: number;
  col: number;
  x: number;
  /** Top of the block it stands on. */
  y: number;
}

interface Edge {
  to: number;
  kind: SideStepKind;
  cost: number;
}

export interface SideGraph {
  readonly x0: number;
  readonly cols: number;
  readonly spots: readonly SideSpot[];
  readonly byCol: readonly (readonly SideSpot[])[];
  readonly body: SideBody;
  readonly rects: readonly Rect[];
  /** Edge lists per limits key, filled lazily (index = spot id). */
  readonly edges: Map<string, (Edge[] | undefined)[]>;
}

export interface SideStep {
  /** Where this step ends: the column center and the surface height. */
  x: number;
  y: number;
  kind: SideStepKind;
  /** Where the step starts. */
  srcX: number;
  srcY: number;
  /** +1 or -1: the horizontal direction of the step. */
  dir: number;
}

export interface SidePath {
  steps: SideStep[];
  /** True when the goal cannot be reached: the steps lead to the reachable spot closest to it. */
  partial?: boolean;
}

export function colX(graph: SideGraph, col: number): number {
  return graph.x0 + (col + 0.5) * SIDE_CELL;
}

export function colOf(graph: SideGraph, x: number): number {
  return Math.min(graph.cols - 1, Math.max(0, Math.floor((x - graph.x0) / SIDE_CELL)));
}

/** True when something at height `y` holds up a body centered at `x`. */
function supported(rects: readonly Rect[], x: number, y: number, halfWidth: number): boolean {
  for (const r of rects) {
    if (Math.abs(r.y1 - y) > LEVEL_EPS) continue;
    if (Math.min(r.x1, x + halfWidth) - Math.max(r.x0, x - halfWidth) > MIN_SUPPORT_OVERLAP) return true;
  }
  return false;
}

function bodyFree(rects: readonly Rect[], xlo: number, xhi: number, ylo: number, yhi: number): boolean {
  for (const r of rects) {
    if (r.x0 < xhi && r.x1 > xlo && r.y0 < yhi && r.y1 > ylo) return false;
  }
  return true;
}

/** Builds the spots for a body of the given size. Returns null when the level has no blocks or is too wide. */
export function buildSideGraph(boxes: readonly SolidBox[], body: SideBody): SideGraph | null {
  if (boxes.length === 0) return null;
  const rects: Rect[] = boxes.map((b) => ({
    x0: b.position.x - b.size.x / 2,
    x1: b.position.x + b.size.x / 2,
    y0: b.position.y - b.size.y / 2,
    y1: b.position.y + b.size.y / 2,
  }));
  let minX = Infinity;
  let maxX = -Infinity;
  for (const r of rects) {
    minX = Math.min(minX, r.x0);
    maxX = Math.max(maxX, r.x1);
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null;
  const x0 = Math.floor((minX - MARGIN) / SIDE_CELL) * SIDE_CELL;
  const cols = Math.ceil((maxX + MARGIN - x0) / SIDE_CELL);
  if (cols > MAX_COLUMNS) return null;

  const r = body.halfWidth;
  const rb = body.halfWidth + BODY_SLACK;
  const spots: SideSpot[] = [];
  const byCol: SideSpot[][] = [];
  for (let c = 0; c < cols; c++) {
    const xc = x0 + (c + 0.5) * SIDE_CELL;
    const tops: number[] = [];
    for (const rect of rects) {
      const overlap = Math.min(rect.x1, xc + r) - Math.max(rect.x0, xc - r);
      if (overlap > MIN_SUPPORT_OVERLAP) tops.push(rect.y1);
    }
    tops.sort((a, b) => a - b);
    const column: SideSpot[] = [];
    let last = -Infinity;
    for (const top of tops) {
      if (top - last <= LEVEL_EPS) continue;
      last = top;
      if (!bodyFree(rects, xc - rb, xc + rb, top + VERT_EPS, top + body.height - VERT_EPS)) continue;
      const spot: SideSpot = { id: spots.length, col: c, x: xc, y: top };
      spots.push(spot);
      column.push(spot);
    }
    byCol.push(column);
  }
  return { x0, cols, spots, byCol, body, rects, edges: new Map() };
}

// ---------- physics-derived limits ----------

/** Highest rise (feet) a jump clears, using the discrete integration the world runs (one gravity step before each move). */
export function maxJumpRise(jumpPower: number): number {
  const g = -GRAVITY;
  return (jumpPower * jumpPower) / (2 * g) - (jumpPower * TICK_DT) / 2 - RISE_MARGIN;
}

/** Seconds until a jump from rest at height 0 comes down to feet height `dy`, or null when it never reaches it. */
function landingTime(jumpPower: number, dy: number): number | null {
  const g = -GRAVITY;
  const disc = jumpPower * jumpPower - 2 * g * dy;
  if (disc < 0) return null;
  return (jumpPower + Math.sqrt(disc)) / g;
}

function limitsKey(l: SideLimits): string {
  return `${l.speed.toFixed(2)}|${l.jumpPower.toFixed(2)}`;
}

// ---------- edges ----------

function computeEdges(graph: SideGraph, spot: SideSpot, limits: SideLimits): Edge[] {
  const out: Edge[] = [];
  const { body, rects, byCol } = graph;
  const rb = body.halfWidth + BODY_SLACK;
  const h = body.height;
  const speed = Math.max(0.01, limits.speed);
  const stepTime = SIDE_CELL / speed;
  const rise = maxJumpRise(limits.jumpPower);

  const walkable = new Set<number>();
  for (const d of [-1, 1]) {
    const c2 = spot.col + d;
    if (c2 < 0 || c2 >= graph.cols) continue;
    const x2 = colX(graph, c2);
    const lo = Math.min(spot.x, x2) - rb;
    const hi = Math.max(spot.x, x2) + rb;
    if (!bodyFree(rects, lo, hi, spot.y + VERT_EPS, spot.y + h - VERT_EPS)) continue;

    const same = byCol[c2]!.find((s) => Math.abs(s.y - spot.y) <= LEVEL_EPS);
    if (same) {
      // A gap as wide as the body leaves both spots supported but nothing in between: that is a jump, not a walk.
      if (supported(rects, (spot.x + x2) / 2, spot.y, body.halfWidth)) {
        out.push({ to: same.id, kind: 'walk', cost: stepTime });
        walkable.add(same.id);
      }
      continue;
    }
    // Nothing to stand on at this height: walk off the edge and fall to the first floor below.
    const landing = [...byCol[c2]!].reverse().find((s) => s.y < spot.y - LEVEL_EPS);
    if (landing && bodyFree(rects, x2 - rb, x2 + rb, landing.y + VERT_EPS, spot.y + h - VERT_EPS)) {
      const fall = Math.sqrt((2 * (spot.y - landing.y)) / -GRAVITY);
      out.push({ to: landing.id, kind: 'drop', cost: stepTime + fall });
    }
  }

  // Jumps: any spot within reach whose arc (full speed toward it) clears every block on the way down onto it.
  if (limits.jumpPower > 0) {
    const tMax = landingTime(limits.jumpPower, -MAX_JUMP_DOWN) ?? 0;
    const reach = Math.min(MAX_JUMP_COLUMNS, Math.ceil((speed * tMax) / SIDE_CELL));
    for (const d of [-1, 1]) {
      for (let k = 1; k <= reach; k++) {
        const c2 = spot.col + d * k;
        if (c2 < 0 || c2 >= graph.cols) break;
        for (const target of byCol[c2]!) {
          const dy = target.y - spot.y;
          if (dy > rise || dy < -MAX_JUMP_DOWN) continue;
          // Neighbors already reachable on foot, and neighbors below (drops), need no jump.
          if (walkable.has(target.id) || (k === 1 && dy < -LEVEL_EPS)) continue;
          const tLand = landingTime(limits.jumpPower, dy);
          if (tLand === null) continue;
          const dx = Math.abs(target.x - spot.x);
          if (dx > speed * tLand) continue;
          let clear = true;
          for (let t = ARC_DT; t < tLand - 0.03 && clear; t += ARC_DT) {
            const x = spot.x + d * Math.min(speed * t, dx);
            const yb = spot.y + limits.jumpPower * t + 0.5 * GRAVITY * t * t;
            clear = bodyFree(rects, x - rb, x + rb, yb + VERT_EPS, yb + h - VERT_EPS);
          }
          if (clear) out.push({ to: target.id, kind: 'jump', cost: tLand + JUMP_PENALTY });
        }
      }
    }
  }
  return out;
}

function edgesOf(graph: SideGraph, spot: SideSpot, limits: SideLimits): Edge[] {
  const key = limitsKey(limits);
  let table = graph.edges.get(key);
  if (!table) {
    if (graph.edges.size >= 6) graph.edges.clear();
    table = new Array<Edge[] | undefined>(graph.spots.length);
    graph.edges.set(key, table);
  }
  let list = table[spot.id];
  if (!list) {
    list = computeEdges(graph, spot, limits);
    table[spot.id] = list;
  }
  return list;
}

// ---------- search ----------

/** Where a body whose feet are at `feetY` stands (or lands): the highest spot at or just below it. */
function startSpot(graph: SideGraph, x: number, feetY: number): SideSpot | null {
  const c0 = colOf(graph, x);
  for (const c of [c0, c0 - 1, c0 + 1]) {
    if (c < 0 || c >= graph.cols) continue;
    const column = graph.byCol[c]!;
    for (let i = column.length - 1; i >= 0; i--) {
      if (column[i]!.y <= feetY + 0.35) return column[i]!;
    }
  }
  return null;
}

/** The spot a goal at feet height `feetY` belongs to: highest spot not above it (with some slack), else the lowest one. */
function goalSpot(graph: SideGraph, x: number, feetY: number): SideSpot | null {
  const c0 = colOf(graph, x);
  for (const c of [c0, c0 - 1, c0 + 1]) {
    if (c < 0 || c >= graph.cols) continue;
    const column = graph.byCol[c]!;
    if (column.length === 0) continue;
    for (let i = column.length - 1; i >= 0; i--) {
      if (column[i]!.y <= feetY + 0.6) return column[i]!;
    }
    return column[0]!;
  }
  return null;
}

export interface SideQuery {
  x: number;
  /** Height of the feet (or of the spot a goal object rests on). */
  feetY: number;
}

/**
 * A* over spots. Cost is travel time. When the goal spot cannot be reached (or the search hit `maxExpansions`)
 * the steps lead to the explored spot closest to the goal and the path is marked `partial`. Returns null only when
 * the start or goal has no spot; an empty step list means start and goal share a spot (or nothing closer exists).
 */
export function findSidePath(
  graph: SideGraph,
  from: SideQuery,
  to: SideQuery,
  limits: SideLimits,
  maxExpansions: number = DEFAULT_MAX_EXPANSIONS,
): SidePath | null {
  const start = startSpot(graph, from.x, from.feetY);
  const goal = goalSpot(graph, to.x, to.feetY);
  if (!start || !goal) return null;
  if (start.id === goal.id) return { steps: [] };

  const n = graph.spots.length;
  const g = new Float64Array(n).fill(Infinity);
  const parent = new Int32Array(n).fill(-1);
  const via = new Array<Edge['kind']>(n).fill('walk');
  const speed = Math.max(0.01, limits.speed);
  const heuristic = (s: SideSpot): number => Math.abs(s.x - goal.x) / speed;

  const heap = new MinHeap();
  g[start.id] = 0;
  heap.push(heuristic(start), start.id);
  let found = false;
  let closest = start.id;
  let closestDist = Infinity;
  for (let expanded = 0; expanded < maxExpansions; expanded++) {
    const cur = heap.pop();
    if (cur < 0) break;
    if (cur === goal.id) {
      found = true;
      break;
    }
    const spot = graph.spots[cur]!;
    const dist = Math.hypot(spot.x - goal.x, spot.y - goal.y);
    if (dist < closestDist - 1e-9 || (Math.abs(dist - closestDist) <= 1e-9 && g[cur]! < g[closest]!)) {
      closest = spot.id;
      closestDist = dist;
    }
    for (const e of edgesOf(graph, spot, limits)) {
      const cost = g[cur]! + e.cost;
      if (cost >= g[e.to]!) continue;
      g[e.to] = cost;
      parent[e.to] = cur;
      via[e.to] = e.kind;
      heap.push(cost + heuristic(graph.spots[e.to]!), e.to);
    }
  }
  const end = found ? goal.id : closest;
  if (!found && end === start.id) return { steps: [], partial: true };

  const steps: SideStep[] = [];
  for (let id = end; parent[id]! >= 0; id = parent[id]!) {
    const s = graph.spots[id]!;
    const p = graph.spots[parent[id]!]!;
    steps.push({ x: s.x, y: s.y, kind: via[id]!, srcX: p.x, srcY: p.y, dir: s.x >= p.x ? 1 : -1 });
  }
  steps.reverse();
  return found ? { steps } : { steps, partial: true };
}
