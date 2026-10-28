import type { SolidBox } from '../../engine/types';
import { MinHeap } from './min-heap';

/**
 * Grid navigation on the ground plane (x, z) for the top-down and 3D views.
 * A cell is blocked when a character standing on its center would overlap a solid block, so a path
 * of free cells is walkable by a body of that size. Pure: depends on block boxes only.
 */

export const PLANE_CELL = 0.5;
/** Free space kept around the outermost blocks so paths can run along the outside walls. */
const MARGIN = 3;
/** Refuse to build grids bigger than this many cells (fall back to straight steering). */
const MAX_CELLS = 40000;
/** How far (in cells) a blocked start or goal may be moved to the nearest free cell. */
const SNAP_RADIUS = 4;
/** Default search cap: bounds the work of one replan. */
export const DEFAULT_MAX_EXPANSIONS = 20000;
const SQRT2 = Math.SQRT2;
/** Line-of-sight sample spacing, in world units. */
const LOS_STEP = 0.125;
/** A body standing against a wall already touches blocked cells; the first stretch of a sight line is not held against it. */
const LOS_START_GRACE = 0.3;

export interface PlaneBody {
  /** Half of the footprint width (the larger of x and z size). */
  halfWidth: number;
  height: number;
}

export interface PlanePoint {
  x: number;
  z: number;
}

export interface PlaneGrid {
  readonly ox: number;
  readonly oz: number;
  readonly w: number;
  readonly h: number;
  /** 1 = a body centered here would hit a block. Row-major, index = iz * w + ix. */
  readonly blocked: Uint8Array;
  // Search scratch, reused between searches (stamped so it never needs clearing).
  readonly g: Float64Array;
  readonly parent: Int32Array;
  readonly stamp: Uint32Array;
  generation: number;
  readonly heap: MinHeap;
}

/**
 * Builds the grid for a body whose vertical extent is [feetY, feetY + height]. Blocks lower than a small step
 * above the feet (the floor) do not count. Returns null when no block matters or the level is too big.
 */
export function buildPlaneGrid(boxes: readonly SolidBox[], body: PlaneBody, feetY: number): PlaneGrid | null {
  const lo = feetY + 0.1;
  const hi = feetY + body.height;
  const rel = boxes.filter((b) => b.position.y - b.size.y / 2 < hi && b.position.y + b.size.y / 2 > lo);
  if (rel.length === 0) return null;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const b of rel) {
    minX = Math.min(minX, b.position.x - b.size.x / 2);
    maxX = Math.max(maxX, b.position.x + b.size.x / 2);
    minZ = Math.min(minZ, b.position.z - b.size.z / 2);
    maxZ = Math.max(maxZ, b.position.z + b.size.z / 2);
  }
  if (![minX, maxX, minZ, maxZ].every(Number.isFinite)) return null;
  const ox = Math.floor((minX - MARGIN) / PLANE_CELL) * PLANE_CELL;
  const oz = Math.floor((minZ - MARGIN) / PLANE_CELL) * PLANE_CELL;
  const w = Math.ceil((maxX + MARGIN - ox) / PLANE_CELL);
  const h = Math.ceil((maxZ + MARGIN - oz) / PLANE_CELL);
  if (w * h > MAX_CELLS) return null;

  const blocked = new Uint8Array(w * h);
  const reach = Math.max(0, body.halfWidth - 0.01);
  for (const b of rel) {
    const x0 = b.position.x - b.size.x / 2 - reach;
    const x1 = b.position.x + b.size.x / 2 + reach;
    const z0 = b.position.z - b.size.z / 2 - reach;
    const z1 = b.position.z + b.size.z / 2 + reach;
    const ix0 = Math.max(0, Math.floor((x0 - ox) / PLANE_CELL - 0.5));
    const ix1 = Math.min(w - 1, Math.ceil((x1 - ox) / PLANE_CELL - 0.5));
    const iz0 = Math.max(0, Math.floor((z0 - oz) / PLANE_CELL - 0.5));
    const iz1 = Math.min(h - 1, Math.ceil((z1 - oz) / PLANE_CELL - 0.5));
    for (let iz = iz0; iz <= iz1; iz++) {
      const cz = oz + (iz + 0.5) * PLANE_CELL;
      if (cz <= z0 || cz >= z1) continue;
      for (let ix = ix0; ix <= ix1; ix++) {
        const cx = ox + (ix + 0.5) * PLANE_CELL;
        if (cx > x0 && cx < x1) blocked[iz * w + ix] = 1;
      }
    }
  }
  return {
    ox,
    oz,
    w,
    h,
    blocked,
    g: new Float64Array(w * h),
    parent: new Int32Array(w * h),
    stamp: new Uint32Array(w * h),
    generation: 0,
    heap: new MinHeap(),
  };
}

function cellX(grid: PlaneGrid, ix: number): number {
  return grid.ox + (ix + 0.5) * PLANE_CELL;
}
function cellZ(grid: PlaneGrid, iz: number): number {
  return grid.oz + (iz + 0.5) * PLANE_CELL;
}
function clampCell(n: number, max: number): number {
  return Math.min(max - 1, Math.max(0, n));
}

/** Cell index containing a point (clamped into the grid). */
export function planeCellOf(grid: PlaneGrid, p: PlanePoint): number {
  const ix = clampCell(Math.floor((p.x - grid.ox) / PLANE_CELL), grid.w);
  const iz = clampCell(Math.floor((p.z - grid.oz) / PLANE_CELL), grid.h);
  return iz * grid.w + ix;
}

/** The free cell closest to `cell` (searching square rings outward), or -1 when none is near. */
function nearestFree(grid: PlaneGrid, cell: number): number {
  if (grid.blocked[cell] === 0) return cell;
  const cx = cell % grid.w;
  const cz = Math.floor(cell / grid.w);
  for (let r = 1; r <= SNAP_RADIUS; r++) {
    let best = -1;
    let bestD = Infinity;
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const ix = cx + dx;
        const iz = cz + dz;
        if (ix < 0 || iz < 0 || ix >= grid.w || iz >= grid.h) continue;
        const idx = iz * grid.w + ix;
        if (grid.blocked[idx] !== 0) continue;
        const d = dx * dx + dz * dz;
        if (d < bestD) {
          bestD = d;
          best = idx;
        }
      }
    }
    if (best >= 0) return best;
  }
  return -1;
}

/** True when a body center can slide in a straight line from a to b without touching a block (conservative by half a cell). */
export function planeLineClear(grid: PlaneGrid, a: PlanePoint, b: PlanePoint): boolean {
  const len = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(len / LOS_STEP));
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    if (t * len < LOS_START_GRACE && i < n) continue;
    const fx = (a.x + (b.x - a.x) * t - grid.ox) / PLANE_CELL - 0.5;
    const fz = (a.z + (b.z - a.z) * t - grid.oz) / PLANE_CELL - 0.5;
    const ix = Math.floor(fx);
    const iz = Math.floor(fz);
    for (let dz = 0; dz <= 1; dz++) {
      for (let dx = 0; dx <= 1; dx++) {
        const x = ix + dx;
        const z = iz + dz;
        // Outside the grid is open ground (the grid ends MARGIN past the last block).
        if (x < 0 || z < 0 || x >= grid.w || z >= grid.h) continue;
        if (grid.blocked[z * grid.w + x] !== 0) return false;
      }
    }
  }
  return true;
}

export interface PlanePath {
  /** Points to walk through in order; the start is not included. Empty = walk straight to the goal (or, when `partial`, stay put). */
  points: PlanePoint[];
  /** True when the goal cannot be reached: the points lead to the reachable cell closest to it. */
  partial?: boolean;
}

/**
 * 8-direction A* (no corner cutting) from `from` to `to`, then straightened by line-of-sight.
 * When the goal cannot be reached (or the search hit `maxExpansions`) the path leads to the explored cell closest
 * to the goal and is marked `partial`. Returns null only when the start or goal cannot be placed on the grid.
 */
export function findPlanePath(
  grid: PlaneGrid,
  from: PlanePoint,
  to: PlanePoint,
  maxExpansions: number = DEFAULT_MAX_EXPANSIONS,
): PlanePath | null {
  const rawGoalCell = planeCellOf(grid, to);
  const goalFree = grid.blocked[rawGoalCell] === 0;
  const fromCell = planeCellOf(grid, from);
  const start = nearestFree(grid, fromCell);
  const goal = nearestFree(grid, rawGoalCell);
  if (start < 0 || goal < 0) return null;

  const { w, h, blocked, g, parent, stamp, heap } = grid;
  const gen = ++grid.generation;
  const gx = goal % w;
  const gz = Math.floor(goal / w);
  const heuristic = (idx: number): number => {
    const dx = Math.abs((idx % w) - gx);
    const dz = Math.abs(Math.floor(idx / w) - gz);
    return Math.max(dx, dz) + (SQRT2 - 1) * Math.min(dx, dz);
  };

  heap.clear();
  g[start] = 0;
  parent[start] = -1;
  stamp[start] = gen;
  heap.push(heuristic(start), start);
  let found = false;
  let closest = start;
  let closestH = Infinity;
  let closestG = Infinity;
  for (let expanded = 0; expanded < maxExpansions; expanded++) {
    const cur = heap.pop();
    if (cur < 0) break;
    if (cur === goal) {
      found = true;
      break;
    }
    const cx = cur % w;
    const cz = Math.floor(cur / w);
    const gc = g[cur]!;
    const hc = heuristic(cur);
    if (hc < closestH - 1e-9 || (Math.abs(hc - closestH) <= 1e-9 && gc < closestG)) {
      closest = cur;
      closestH = hc;
      closestG = gc;
    }
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dz === 0) continue;
        const nx = cx + dx;
        const nz = cz + dz;
        if (nx < 0 || nz < 0 || nx >= w || nz >= h) continue;
        const n = nz * w + nx;
        if (blocked[n] !== 0) continue;
        const diagonal = dx !== 0 && dz !== 0;
        if (diagonal && (blocked[cz * w + nx] !== 0 || blocked[nz * w + cx] !== 0)) continue;
        const cost = gc + (diagonal ? SQRT2 : 1);
        if (stamp[n] === gen && cost >= g[n]!) continue;
        stamp[n] = gen;
        g[n] = cost;
        parent[n] = cur;
        heap.push(cost + heuristic(n), n);
      }
    }
  }
  // Unreachable goal: head for the closest cell the search got to.
  const end = found ? goal : closest;
  if (!found && end === start) return { points: [], partial: true };

  const cells: number[] = [];
  for (let c = end; c >= 0; c = parent[c]!) cells.push(c);
  cells.reverse();

  // Cell centers after the start cell (kept when the start had to be moved out of a blocked cell),
  // then the exact goal when its own cell was free.
  const pts: PlanePoint[] = [from];
  for (let i = start === fromCell ? 1 : 0; i < cells.length; i++) {
    const c = cells[i]!;
    pts.push({ x: cellX(grid, c % w), z: cellZ(grid, Math.floor(c / w)) });
  }
  if (found && goalFree) pts.push({ x: to.x, z: to.z });

  // Greedy string pulling: from each kept point, jump to the farthest point still in clear sight.
  const out: PlanePoint[] = [];
  let i = 0;
  while (i < pts.length - 1) {
    let j = pts.length - 1;
    while (j > i + 1 && !planeLineClear(grid, pts[i]!, pts[j]!)) j--;
    out.push(pts[j]!);
    i = j;
  }
  return found ? { points: out } : { points: out, partial: true };
}
