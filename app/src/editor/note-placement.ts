import { NOTE_DEFAULT_SIZE } from '../engine/notes';
import { getNodeDef } from '../engine/registry';
import type { Graph, Note } from '../engine/types';

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

const NODE_W = 180;
const MARGIN = 12;
const STEP = 40;
const REACH = 12;

/** Rough on-canvas size of a node: a fixed width and a height that grows with its port rows. */
function nodeBox(node: Graph['nodes'][number]): Box {
  const def = getNodeDef(node.kind);
  const rows = def ? Math.max(def.inputs.length, def.outputs.length, 1) : 2;
  return { x: node.pos.x, y: node.pos.y, w: NODE_W, h: 44 + rows * 34 };
}

const overlaps = (a: Box, b: Box): boolean =>
  a.x < b.x + b.w + MARGIN && a.x + a.w + MARGIN > b.x && a.y < b.y + b.h + MARGIN && a.y + a.h + MARGIN > b.y;

/**
 * Where to put a fresh sticky note: `want` when that spot is clear, else the nearest clear spot on a coarse grid.
 * Notes sit under the blocks, so one dropped onto a block would be hidden and could not be grabbed.
 * Falls back to `want` on a crowded board.
 */
export function findFreeNoteSpot(want: { x: number; y: number }, graph: Graph, notes: readonly Note[]): { x: number; y: number } {
  const taken: Box[] = [
    ...graph.nodes.map(nodeBox),
    ...notes.map((n) => ({ x: n.pos.x, y: n.pos.y, w: n.size.w, h: n.size.h })),
  ];
  const free = (x: number, y: number): boolean => {
    const box = { x, y, w: NOTE_DEFAULT_SIZE.w, h: NOTE_DEFAULT_SIZE.h };
    return taken.every((t) => !overlaps(box, t));
  };
  if (free(want.x, want.y)) return want;
  const offsets: { dx: number; dy: number }[] = [];
  for (let i = -REACH; i <= REACH; i++) for (let j = -REACH; j <= REACH; j++) offsets.push({ dx: i * STEP, dy: j * STEP });
  offsets.sort((a, b) => Math.hypot(a.dx, a.dy) - Math.hypot(b.dx, b.dy));
  for (const { dx, dy } of offsets) {
    if (free(want.x + dx, want.y + dy)) return { x: want.x + dx, y: want.y + dy };
  }
  return want;
}
