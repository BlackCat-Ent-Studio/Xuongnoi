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
    const to = next.get(w.from.node);
    if (to) to.push(w.to.node);
    else next.set(w.from.node, [w.to.node]);
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

  // Ids by rank in id order: the smallest id is the smallest rank, so the two "smallest id" picks below work on numbers.
  const sorted = [...ids].sort(byString);
  const rank = new Map<string, number>();
  sorted.forEach((id, k) => rank.set(id, k));
  const emitted = new Array<boolean>(sorted.length).fill(false);
  const order: string[] = [];

  /**
   * The cards that wait for no wire and are not emitted yet, as a min-heap of ranks. A card enters it exactly once: at the start
   * when nothing leads into it, or at the moment its last unresolved wire is resolved. A card that is forced out never enters
   * (it is emitted on the spot), so the top of the heap is always the smallest id that is ready.
   */
  const ready: number[] = [];
  const push = (r: number): void => {
    let i = ready.length;
    ready.push(r);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (ready[up]! <= r) break;
      ready[i] = ready[up]!;
      i = up;
    }
    ready[i] = r;
  };
  const pop = (): number => {
    const top = ready[0]!;
    const last = ready.pop()!;
    const n = ready.length;
    if (n > 0) {
      let i = 0;
      for (;;) {
        let child = 2 * i + 1;
        if (child >= n) break;
        if (child + 1 < n && ready[child + 1]! < ready[child]!) child++;
        if (ready[child]! >= last) break;
        ready[i] = ready[child]!;
        i = child;
      }
      ready[i] = last;
    }
    return top;
  };

  const emit = (r: number): void => {
    const id = sorted[r]!;
    emitted[r] = true;
    order.push(id);
    for (const out of outgoing.get(id)!) {
      const waits = pending.get(out.to)!;
      if (waits.delete(out.id) && waits.size === 0 && !emitted[rank.get(out.to)!]) push(rank.get(out.to)!);
    }
  };

  sorted.forEach((id, k) => {
    if (pending.get(id)!.size === 0) push(k);
  });
  /** Every rank below this one is emitted, so the first rank from here that is not is the smallest remaining id. */
  let lowest = 0;
  while (order.length < sorted.length) {
    if (ready.length > 0) {
      emit(pop());
      continue;
    }
    while (emitted[lowest]) lowest++;
    const waits = pending.get(sorted[lowest]!)!;
    for (const wid of waits) backEdges.add(wid);
    waits.clear();
    emit(lowest);
  }
  return { order, backEdges };
}
