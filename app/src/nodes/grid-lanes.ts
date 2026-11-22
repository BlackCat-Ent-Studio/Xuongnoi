import { EXIT_DIRS, EXIT_STEP, type ExitDir, type MarkerSpot } from './floor-marker';

/**
 * One-way lanes read off the floor: every marker with arrows is a cell, and each arrow leads to the nearest marker that
 * lies in that direction on the same floor. Nothing here knows about rows, columns or any particular layout.
 */

/** Cell number -> the cells a robot may drive to from it, in the fixed order of the arrow letters. */
export type LaneGraph = ReadonlyMap<number, readonly number[]>;

/** Markers whose heights differ by more than this are on different floors: an arrow never leads from one to the other. */
const SAME_FLOOR = 0.3;

/** The marker an arrow on `from` leads to: the nearest one ahead whose middle lies within the width of the tile. */
function ahead(from: MarkerSpot, dir: ExitDir, cells: readonly MarkerSpot[]): MarkerSpot | null {
  const step = EXIT_STEP[dir];
  let best: MarkerSpot | null = null;
  let bestAlong = Infinity;
  for (const c of cells) {
    if (c === from || Math.abs(c.y - from.y) > SAME_FLOOR) continue;
    const dx = c.x - from.x;
    const dz = c.z - from.z;
    const along = dx * step.x + dz * step.z;
    const across = Math.abs(dx * step.z - dz * step.x);
    if (along <= 1e-6 || across > from.size / 2) continue;
    if (along < bestAlong) {
      best = c;
      bestAlong = along;
    }
  }
  return best;
}

/** The lanes the arrows of these markers make. Two markers with one number: the one made first counts, as everywhere. */
export function laneGraph(markers: readonly MarkerSpot[]): LaneGraph {
  const cells: MarkerSpot[] = [];
  const seen = new Set<number>();
  for (const m of markers) {
    if (seen.has(m.number)) continue;
    seen.add(m.number);
    cells.push(m);
  }
  const graph = new Map<number, number[]>();
  for (const m of cells) {
    const exits: number[] = [];
    for (const dir of EXIT_DIRS) {
      if (!m.exits.includes(dir)) continue;
      const to = ahead(m, dir, cells);
      if (to && !exits.includes(to.number)) exits.push(to.number);
    }
    graph.set(m.number, exits);
  }
  return graph;
}

/**
 * Shortest way along the lanes, breadth first: the cells to drive through, the goal last. Empty when `from` is the goal,
 * when either is not a cell, or when no lane leads there.
 */
export function routeOnLanes(graph: LaneGraph, from: number, goal: number): number[] {
  if (from === goal || !graph.has(from) || !graph.has(goal)) return [];
  const prev = new Map<number, number>();
  const seen = new Set<number>([from]);
  let frontier = [from];
  while (frontier.length > 0) {
    const next: number[] = [];
    for (const at of frontier) {
      for (const n of graph.get(at) ?? []) {
        if (seen.has(n)) continue;
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

/**
 * The way to the goal that does NOT start with the first step of the shortest one: through another exit of `from`, the one
 * from which the goal is nearest. Empty when `from` has no other exit that leads to the goal.
 */
export function detourOnLanes(graph: LaneGraph, from: number, goal: number): number[] {
  const usual = routeOnLanes(graph, from, goal)[0];
  let best: number[] = [];
  for (const exit of graph.get(from) ?? []) {
    if (exit === usual) continue;
    const rest = exit === goal ? [] : routeOnLanes(graph, exit, goal);
    if (exit !== goal && rest.length === 0) continue;
    if (best.length === 0 || rest.length + 1 < best.length) best = [exit, ...rest];
  }
  return best;
}
