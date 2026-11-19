import { describe, expect, it } from 'vitest';
import { compileGraph, type CompiledGraph } from '../../src/engine/compile';
import { getNodeDef, knownInputs } from '../../src/engine/registry';
import type { Graph } from '../../src/engine/types';
import { listAllSamples } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { allBoards } from '../editor/solid-helpers';
import { cloneBoard } from '../perf/many-machines';

registerAllNodes();

/**
 * The evaluation order is part of how a board plays (cards on a loop read last tick's value from whichever card comes later), so
 * it must not move when the sort is made faster. This is the sort written the plain way, straight from its rule: over and over,
 * take the smallest id that waits for nothing; when every card left waits, force the smallest id out and cut the wires it waits for.
 */
const byString = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

function plainOrder(graph: Graph): CompiledGraph {
  const ids = new Set(graph.nodes.map((n) => n.id));
  const live = graph.wires.filter((w) => ids.has(w.from.node) && ids.has(w.to.node));
  const kinds = new Map(graph.nodes.map((n) => [n.id, n.kind]));
  const reaches = (from: string, goal: string): boolean => {
    const seen = new Set<string>([from]);
    const stack = [from];
    while (stack.length > 0) {
      const at = stack.pop()!;
      if (at === goal) return true;
      for (const w of live) if (w.from.node === at && !seen.has(w.to.node)) (seen.add(w.to.node), stack.push(w.to.node));
    }
    return false;
  };
  const backEdges = new Set<string>();
  for (const w of live) {
    const def = getNodeDef(kinds.get(w.to.node)!);
    if (def && knownInputs(def).some((p) => p.id === w.to.port && p.feedback) && reaches(w.to.node, w.from.node)) backEdges.add(w.id);
  }
  const pending = new Map<string, Set<string>>();
  for (const id of ids) pending.set(id, new Set());
  for (const w of live) if (!backEdges.has(w.id)) pending.get(w.to.node)!.add(w.id);
  const remaining = new Set(ids);
  const order: string[] = [];
  const emit = (id: string): void => {
    remaining.delete(id);
    order.push(id);
    for (const w of live) if (w.from.node === id) pending.get(w.to.node)!.delete(w.id);
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

function expectSame(graph: Graph): void {
  const got = compileGraph(graph);
  const want = plainOrder(graph);
  expect(got.order).toEqual(want.order);
  // Same wires, cut in the same sequence.
  expect([...got.backEdges]).toEqual([...want.backEdges]);
}

/** Small repeatable generator (mulberry32), so a failing graph can be found again. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('compileGraph keeps the order of the plain sort', () => {
  it('on every shipped board', () => {
    const boards = allBoards();
    expect(boards.length).toBeGreaterThan(20);
    for (const b of boards) expectSame(b.board.graph);
  });

  it('on 16 copies of the AGV sample in one graph', () => {
    const agv = listAllSamples().find((s) => s.id === 'agv-shuttle')!.board;
    const graph = cloneBoard(agv, 16, 14);
    expect(graph.nodes.length).toBe(agv.graph.nodes.length * 16);
    expectSame(graph);
  });

  it('on random graphs with loops, self-wires, feedback inputs, wires to missing cards and repeated wire ids', () => {
    const kinds = ['math', 'const', 'not', 'sequence', 'counter', 'timer', 'toggle', 'compare'].filter((k) => getNodeDef(k));
    expect(kinds.length).toBeGreaterThan(2);
    const next = rng(20261119);
    const pick = <T>(xs: readonly T[]): T => xs[Math.floor(next() * xs.length)]!;
    for (let round = 0; round < 300; round++) {
      const n = 1 + Math.floor(next() * 24);
      // Ids that do not sort the way they were made (10 before 9, capitals before small letters).
      const nodes = Array.from({ length: n }, (_, k) => ({ id: `${pick(['n', 'N', 'a-', ''])}${k}`, kind: pick(kinds), params: {}, pos: { x: 0, y: 0 } }));
      const wires: Graph['wires'] = [];
      const count = Math.floor(next() * n * 2.5);
      for (let k = 0; k < count; k++) {
        const to = pick(nodes);
        const ports = knownInputs(getNodeDef(to.kind)!).map((p) => p.id);
        wires.push({
          id: next() < 0.05 && k > 0 ? `w${k - 1}` : `w${k}`,
          from: { node: next() < 0.04 ? 'gone' : pick(nodes).id, port: 'out' },
          to: { node: to.id, port: ports.length > 0 ? pick(ports) : 'in' },
        });
      }
      expectSame({ nodes, wires });
    }
  });
});
