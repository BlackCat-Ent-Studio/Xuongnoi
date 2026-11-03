import { describe, expect, it } from 'vitest';
import { getNodeDef } from '../../src/engine/registry';
import { canConnect } from '../../src/engine/wiring';
import type { GraphNode, Wire } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { level07 } from '../../src/puzzle/levels/level-07';
import { buildPlayGraph, piecesUsed, runLevel } from '../../src/puzzle/run-level';
import { isPortShown } from '../../src/puzzle/ui/board-state';
import type { PuzzleAnswer } from '../../src/puzzle/types';

registerAllNodes();

const sol = level07.solution;
/** The spare tray piece. */
const decoy: GraphNode = { id: 'decoy', kind: 'not', params: {}, pos: { x: 0, y: 0 } };
/** A cheaper answer still has to win in about the time the reference needs. */
const SEARCH_SECONDS = 25;

/** Every wire the board would accept between an output and a still-free input of the answer's graph. */
function acceptedWires(answer: PuzzleAnswer): Wire[] {
  const graph = buildPlayGraph(level07, answer);
  const outs: [string, string][] = [];
  const ins: [string, string][] = [];
  for (const n of graph.nodes) {
    const def = getNodeDef(n.kind)!;
    for (const p of def.outputs) if (isPortShown(level07, n.id, p.id, 'out')) outs.push([n.id, p.id]);
    for (const p of def.inputs) if (isPortShown(level07, n.id, p.id, 'in')) ins.push([n.id, p.id]);
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

describe('level 7: the spare "Đảo ngược" gives no cheaper win', () => {
  it('par is the number of solution pieces and the spare is not part of it', () => {
    expect(level07.par).toBe(sol.nodes.length);
    expect(sol.nodes.map((n) => n.kind)).not.toContain(decoy.kind);
  });

  it('the spare cannot even replace a piece: with it added, no answer wins that is built from fewer pieces than the solution', () => {
    let tried = 0;
    for (const missing of sol.nodes) {
      // Everything of the solution except one piece, plus the spare; then every way of adding one wire, or one wire into the
      // spare and one out of it (the spare standing in for the missing piece).
      const nodes = [...sol.nodes.filter((n) => n.id !== missing.id), decoy];
      const wires = sol.wires.filter((w) => w.from.node !== missing.id && w.to.node !== missing.id);
      const base: PuzzleAnswer = { nodes, wires };
      expect(piecesUsed({ nodes: nodes.filter((n) => n.id !== decoy.id), wires })).toBeLessThan(level07.par);
      const candidates = acceptedWires(base);
      const into = candidates.filter((w) => w.to.node === decoy.id);
      const outOf = candidates.filter((w) => w.from.node === decoy.id);
      const tries: Wire[][] = [[], ...candidates.map((w) => [w]), ...into.flatMap((a) => outOf.map((b) => [a, b]))];
      for (const extra of tries) {
        tried++;
        const r = runLevel(level07, { nodes, wires: [...wires, ...extra] }, SEARCH_SECONDS);
        expect(r.outcome, `without ${missing.id} + ${extra.map((w) => w.id).join(' , ')}`).not.toBe('win');
      }
    }
    expect(tried).toBeGreaterThan(300);
  }, 900_000);

  it('the spare wired into the grab path breaks the grab, it is only an extra piece', () => {
    const over: PuzzleAnswer = {
      nodes: [...sol.nodes, decoy],
      wires: [...sol.wires.filter((w) => w.id !== 'sw9'), { id: 'x1', from: { node: 's-and', port: 'out' }, to: { node: 'decoy', port: 'in' } }],
    };
    expect(piecesUsed(over)).toBe(level07.par + 1);
    expect(runLevel(level07, over).outcome).not.toBe('win');
  });
});
