import type { Graph } from '../engine/types';

export function nextNodeId(graph: Graph): string {
  let max = 0;
  for (const n of graph.nodes) {
    const m = /^n(\d+)$/.exec(n.id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let i = max + 1;
  const used = new Set(graph.nodes.map((n) => n.id));
  while (used.has(`n${i}`)) i++;
  return `n${i}`;
}
