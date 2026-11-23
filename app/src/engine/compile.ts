import type { Graph } from './types';

export interface CompiledGraph {
  /** Node ids in evaluation order. */
  order: string[];
  /** Wire ids that close a cycle; they carry the previous tick's value. */
  backEdges: Set<string>;
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Deterministic topological sort (Kahn, ties by node id). When only cycles remain,
 * the smallest remaining id is forced out and its unresolved incoming wires become back-edges.
 */
export function compileGraph(graph: Graph): CompiledGraph {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const pending = new Map<string, Set<string>>(); // node → incoming wire ids not yet resolved
  const outgoing = new Map<string, { id: string; to: string }[]>();
  for (const id of ids) {
    pending.set(id, new Set());
    outgoing.set(id, []);
  }
  for (const w of graph.wires) {
    if (!ids.has(w.from.node) || !ids.has(w.to.node)) continue;
    pending.get(w.to.node)!.add(w.id);
    outgoing.get(w.from.node)!.push({ id: w.id, to: w.to.node });
  }

  const remaining = new Set(ids);
  const backEdges = new Set<string>();
  const order: string[] = [];

  const emit = (id: string) => {
    remaining.delete(id);
    order.push(id);
    for (const out of outgoing.get(id)!) pending.get(out.to)!.delete(out.id);
  };

  while (remaining.size > 0) {
    const sorted = [...remaining].sort(byString);
    const ready = sorted.find((id) => pending.get(id)!.size === 0);
    if (ready !== undefined) {
      emit(ready);
      continue;
    }
    const forced = sorted[0]!;
    for (const wid of pending.get(forced)!) backEdges.add(wid);
    pending.get(forced)!.clear();
    emit(forced);
  }
  return { order, backEdges };
}
