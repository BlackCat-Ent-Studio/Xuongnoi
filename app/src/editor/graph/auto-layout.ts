import type { Graph } from '../../engine/types';
import { estimateNodeSize, type Point, type Size } from './graph-geometry';

const COL_GAP = 90;
const ROW_GAP = 36;

/** Layer index per node: 0 for sources, otherwise one past the deepest producer. Cycles are cut safely. */
function layersOf(graph: Graph): Map<string, number> {
  const layer = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]));
  // Bellman-Ford style relaxation, capped at node count so a cycle cannot loop forever.
  for (let pass = 0; pass < graph.nodes.length; pass++) {
    let changed = false;
    for (const w of graph.wires) {
      const from = layer.get(w.from.node);
      const to = layer.get(w.to.node);
      if (from === undefined || to === undefined || w.from.node === w.to.node) continue;
      if (to < from + 1 && from + 1 < graph.nodes.length) {
        layer.set(w.to.node, from + 1);
        changed = true;
      }
    }
    if (!changed) break;
  }
  return layer;
}

/**
 * Layered left-to-right layout: producers on the left, consumers on the right, no overlaps.
 * Within a column nodes are ordered by the average row of their producers to keep wires short.
 * Returns the new top-left position of every node, anchored at `origin`.
 */
export function computeLayout(graph: Graph, sizeOf: (nodeId: string) => Size | undefined, origin: Point): Map<string, Point> {
  const layers = layersOf(graph);
  const sizes = new Map(graph.nodes.map((n) => [n.id, sizeOf(n.id) ?? estimateNodeSize(n)]));
  const columns: string[][] = [];
  for (const n of graph.nodes) {
    const l = layers.get(n.id) ?? 0;
    (columns[l] ??= []).push(n.id);
  }
  const result = new Map<string, Point>();
  const centerY = new Map<string, number>();
  let x = origin.x;
  for (const col of columns) {
    if (!col) continue;
    const order = col.map((id, i) => {
      const ins = graph.wires.filter((w) => w.to.node === id && centerY.has(w.from.node));
      const key = ins.length ? ins.reduce((s, w) => s + (centerY.get(w.from.node) ?? 0), 0) / ins.length : Number.POSITIVE_INFINITY;
      return { id, key, i };
    });
    order.sort((a, b) => (a.key === b.key ? a.i - b.i : a.key - b.key));
    let y = origin.y;
    let width = 0;
    for (const { id } of order) {
      const s = sizes.get(id) ?? { w: 168, h: 70 };
      result.set(id, { x: Math.round(x), y: Math.round(y) });
      centerY.set(id, y + s.h / 2);
      y += s.h + ROW_GAP;
      width = Math.max(width, s.w);
    }
    x += width + COL_GAP;
  }
  return result;
}
