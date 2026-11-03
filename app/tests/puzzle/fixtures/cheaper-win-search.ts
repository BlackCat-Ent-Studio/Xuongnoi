import { getNodeDef } from '../../../src/engine/registry';
import type { GraphNode, Wire } from '../../../src/engine/types';
import { canConnect } from '../../../src/engine/wiring';
import { buildPlayGraph, runLevel } from '../../../src/puzzle/run-level';
import type { PuzzleAnswer, PuzzleLevel } from '../../../src/puzzle/types';
import { isPortShown } from '../../../src/puzzle/ui/board-state';

/** Every wire the board would accept between a shown output and a still-free shown input of the answer's graph. */
export function acceptedWires(level: PuzzleLevel, answer: PuzzleAnswer): Wire[] {
  const graph = buildPlayGraph(level, answer);
  const outs: [string, string][] = [];
  const ins: [string, string][] = [];
  for (const n of graph.nodes) {
    const def = getNodeDef(n.kind)!;
    for (const p of def.outputs) if (isPortShown(level, n.id, p.id, 'out')) outs.push([n.id, p.id]);
    for (const p of def.inputs) if (isPortShown(level, n.id, p.id, 'in')) ins.push([n.id, p.id]);
  }
  const used = new Set(graph.wires.map((w) => `${w.to.node}.${w.to.port}`));
  const found: Wire[] = [];
  for (const [fn, fp] of outs) {
    for (const [tn, tp] of ins) {
      if (fn === tn || used.has(`${tn}.${tp}`)) continue;
      const w: Wire = { id: `${fn}.${fp}>${tn}.${tp}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } };
      if (canConnect(graph, w.from, w.to).ok) found.push(w);
    }
  }
  return found;
}

export interface SearchResult {
  /** How many answers were played. */
  tried: number;
  /** Descriptions of answers that won although they use fewer pieces than the reference solution. */
  wins: string[];
}

/**
 * Bounded search for a cheaper win: drop each solution piece in turn (with the spare tray piece in its place, or without),
 * then try no extra wire, every single extra wire the board accepts, and every pair "one wire into the spare + one wire
 * out of it". None of these answers uses more pieces than the reference, and a piece is always missing, so any win
 * found means the level can be solved with fewer pieces than `par` (or the spare piece does a needed piece's work).
 */
export function searchCheaperWins(level: PuzzleLevel, spare: GraphNode | null, seconds: number): SearchResult {
  const sol = level.solution;
  const wins: string[] = [];
  let tried = 0;
  for (const missing of sol.nodes) {
    const keptNodes = sol.nodes.filter((n) => n.id !== missing.id);
    const keptWires = sol.wires.filter((w) => w.from.node !== missing.id && w.to.node !== missing.id);
    const variants: { nodes: GraphNode[]; spare: boolean }[] = [{ nodes: keptNodes, spare: false }];
    // A spare of the same kind as the missing piece is just that piece again: same piece count, not cheaper.
    if (spare && spare.kind !== missing.kind) variants.push({ nodes: [...keptNodes, spare], spare: true });
    for (const v of variants) {
      const base: PuzzleAnswer = { nodes: v.nodes, wires: keptWires };
      const candidates = acceptedWires(level, base);
      const into = spare && v.spare ? candidates.filter((w) => w.to.node === spare.id) : [];
      const outOf = spare && v.spare ? candidates.filter((w) => w.from.node === spare.id) : [];
      const tries: Wire[][] = [[], ...candidates.map((w) => [w]), ...into.flatMap((a) => outOf.map((b) => [a, b]))];
      for (const extra of tries) {
        tried++;
        const r = runLevel(level, { nodes: base.nodes, wires: [...keptWires, ...extra] }, seconds);
        if (r.outcome === 'win') wins.push(`without ${missing.id}${v.spare ? ' + spare' : ''} + ${extra.map((w) => w.id).join(' , ')}`);
      }
    }
  }
  return { tried, wins };
}
