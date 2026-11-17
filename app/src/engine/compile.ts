import { getNodeDef, knownInputs } from './registry';
import type { Graph } from './types';

export interface CompiledGraph {
  /** Node ids in evaluation order. */
  order: string[];
  /** Wire ids that close a cycle; they carry the previous tick's value. */
  backEdges: Set<string>;
}

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Wires into a `feedback` input that sit on a loop: the card reads them from the previous tick, whatever the card ids are. */
function feedbackLoopWires(graph: Graph, ids: Set<string>): Set<string> {
  const cut = new Set<string>();
  const next = new Map<string, string[]>();
  for (const w of graph.wires) {
    if (!ids.has(w.from.node) || !ids.has(w.to.node)) continue;
    next.set(w.from.node, [...(next.get(w.from.node) ?? []), w.to.node]);
  }
  const kinds = new Map(graph.nodes.map((n) => [n.id, n.kind]));
  const reaches = (from: string, goal: string): boolean => {
    const seen = new Set<string>([from]);
    const stack = [from];
    while (stack.length > 0) {
      const at = stack.pop()!;
      if (at === goal) return true;
      for (const to of next.get(at) ?? []) if (!seen.has(to)) (seen.add(to), stack.push(to));
    }
    return false;
  };
  for (const w of graph.wires) {
    if (!ids.has(w.from.node) || !ids.has(w.to.node)) continue;
    const def = getNodeDef(kinds.get(w.to.node)!);
    if (!def || !knownInputs(def).some((p) => p.id === w.to.port && p.feedback)) continue;
    if (reaches(w.to.node, w.from.node)) cut.add(w.id);
  }
  return cut;
}

/**
 * Deterministic topological sort (Kahn, ties by node id). Wires into a `feedback` input that close a loop are cut first.
 * When only other cycles remain, the smallest remaining id is forced out and its unresolved incoming wires become back-edges.
 */
export function compileGraph(graph: Graph): CompiledGraph {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const pending = new Map<string, Set<string>>(); // node → incoming wire ids not yet resolved
  const outgoing = new Map<string, { id: string; to: string }[]>();
  for (const id of ids) {
    pending.set(id, new Set());
    outgoing.set(id, []);
  }
  const backEdges = feedbackLoopWires(graph, ids);
  for (const w of graph.wires) {
    if (!ids.has(w.from.node) || !ids.has(w.to.node)) continue;
    outgoing.get(w.from.node)!.push({ id: w.id, to: w.to.node });
    if (!backEdges.has(w.id)) pending.get(w.to.node)!.add(w.id);
  }

  const remaining = new Set(ids);
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
