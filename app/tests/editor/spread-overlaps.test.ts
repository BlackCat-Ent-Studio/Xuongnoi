import { describe, expect, it } from 'vitest';
import { boxesOverlap, estimateNodeSize, spreadOverlaps } from '../../src/editor/graph/graph-geometry';
import type { Graph, GraphNode } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';

registerAllNodes();

const node = (id: string, x: number, y: number, kind = 'block'): GraphNode => ({ id, kind, params: {}, pos: { x, y } });
const boxes = (g: Graph) => g.nodes.map((n) => ({ id: n.id, x: n.pos.x, y: n.pos.y, ...estimateNodeSize(n) }));

describe('spreadOverlaps', () => {
  it('returns the same graph when no cards overlap', () => {
    const g: Graph = { nodes: [node('a', 0, 0), node('b', 600, 0)], wires: [] };
    expect(spreadOverlaps(g)).toBe(g);
  });

  it('pushes overlapping cards down in their column until none overlap', () => {
    const g: Graph = { nodes: [node('a', 0, 0), node('b', 10, 40), node('c', 0, 80)], wires: [] };
    const out = spreadOverlaps(g);
    const bs = boxes(out);
    for (const a of bs) for (const b of bs) if (a !== b) expect(boxesOverlap(a, b)).toBe(false);
    expect(out.nodes.map((n) => n.pos.x)).toEqual([0, 10, 0]);
    expect(out.nodes[0]!.pos).toEqual({ x: 0, y: 0 });
  });

  it('spreads each group separately from the main board', () => {
    const g: Graph = {
      nodes: [node('a', 0, 0), node('in1', 0, 0), node('in2', 0, 20)],
      wires: [],
      groups: [{ id: 'g1', name: 'Nhóm', nodeIds: ['in1', 'in2'], x: 400, y: 0 }],
    };
    const out = spreadOverlaps(g);
    expect(out.nodes.find((n) => n.id === 'a')!.pos).toEqual({ x: 0, y: 0 });
    expect(out.nodes.find((n) => n.id === 'in1')!.pos).toEqual({ x: 0, y: 0 });
    expect(out.nodes.find((n) => n.id === 'in2')!.pos.y).toBeGreaterThan(20);
  });
});
