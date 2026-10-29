import type { Graph, Note } from '../../engine/types';
import { boxesOverlap, estimateNodeSize, type Box, type Point, type Size } from './graph-geometry';

const MARGIN = 24;
const STEP = 28;
const REACH = 30;

export type SizeOf = (nodeId: string) => Size | undefined;

/** Boxes of everything on the board except `ignoreId`. Uses measured sizes when `sizeOf` has them. */
export function occupiedBoxes(graph: Graph, notes: readonly Note[], sizeOf?: SizeOf, ignoreId?: string): Box[] {
  const nodes = graph.nodes
    .filter((n) => n.id !== ignoreId)
    .map((n) => ({ x: n.pos.x, y: n.pos.y, ...(sizeOf?.(n.id) ?? estimateNodeSize(n)) }));
  return [...nodes, ...notes.map((n) => ({ x: n.pos.x, y: n.pos.y, w: n.size.w, h: n.size.h }))];
}

/**
 * Where a new node of size `size` should go: `want` when it is clear, else the nearest clear spot.
 * Palette code can call this with the viewport centre or the drop point.
 * On a board too crowded to find a gap, returns a spot just below everything.
 */
export function findFreeNodeSpot(want: Point, size: Size, taken: readonly Box[]): Point {
  const free = (p: Point): boolean => taken.every((t) => !boxesOverlap({ ...p, ...size }, t, MARGIN));
  if (free(want)) return want;
  const offsets: Point[] = [];
  for (let i = -REACH; i <= REACH; i++) for (let j = -REACH; j <= REACH; j++) offsets.push({ x: i * STEP, y: j * STEP });
  offsets.sort((a, b) => Math.hypot(a.x, a.y) - Math.hypot(b.x, b.y));
  for (const o of offsets) {
    const p = { x: Math.round(want.x + o.x), y: Math.round(want.y + o.y) };
    if (free(p)) return p;
  }
  const bottom = Math.max(...taken.map((t) => t.y + t.h));
  return { x: want.x, y: bottom + MARGIN * 2 };
}
