import type { Graph } from '../engine/types';

/**
 * Id for a new card on `graph`: `n<k>`, one past the highest `n<number>` card. The canvas tells cards, groups and notes apart
 * by id alone, so the id also stays clear of the graph's groups and of `alsoTaken` (the board's notes: shipped boards have
 * notes named `n1`, `n2`...). A board where nothing collides gets the same ids as ever.
 */
export function nextNodeId(graph: Graph, alsoTaken: Iterable<string> = []): string {
  let max = 0;
  for (const n of graph.nodes) {
    const m = /^n(\d+)$/.exec(n.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let i = max + 1;
  const used = new Set(graph.nodes.map((n) => n.id));
  for (const g of graph.groups ?? []) used.add(g.id);
  for (const id of alsoTaken) used.add(id);
  while (used.has(`n${i}`)) i++;
  return `n${i}`;
}
