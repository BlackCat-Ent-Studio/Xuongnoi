import { beforeAll, describe, expect, it } from 'vitest';
import { computeLayout } from '../../src/editor/graph/auto-layout';
import { boxesOverlap, fitView, nearestWithin, zoomAround, type Box } from '../../src/editor/graph/graph-geometry';
import { listMissingWires } from '../../src/editor/graph/missing-wires';
import { findFreeNodeSpot, occupiedBoxes } from '../../src/editor/graph/node-placement';
import { checkPortPair } from '../../src/editor/graph/port-compat';
import { listSamples } from '../../src/io/samples';
import { createNode } from '../../src/editor/editor-state';
import { registerAllNodes } from '../../src/nodes';
import type { Graph } from '../../src/engine/types';

beforeAll(() => registerAllNodes());

function build(kinds: [string, number, number][]): Graph {
  let graph: Graph = { nodes: [], wires: [] };
  for (const [kind, x, y] of kinds) {
    const node = createNode(graph, kind, { x, y });
    if (!node) throw new Error(kind);
    graph = { ...graph, nodes: [...graph.nodes, node] };
  }
  return graph;
}
const wire = (id: string, from: [string, string], to: [string, string]) => ({
  id,
  from: { node: from[0], port: from[1] },
  to: { node: to[0], port: to[1] },
});

describe('listMissingWires', () => {
  it('lists unwired required inputs and clears them when wired', () => {
    const g = build([['key', 0, 0], ['win-lose', 300, 0]]);
    const win = g.nodes[1]!.id;
    expect(listMissingWires(g)).toEqual([{ nodeId: win, portId: 'win', label: 'Thắng' }]);
    const wired = { ...g, wires: [wire('w1', [g.nodes[0]!.id, 'pressed'], [win, 'win'])] };
    expect(listMissingWires(wired)).toEqual([]);
  });

  it('ignores optional inputs and nodes without required ports', () => {
    expect(listMissingWires(build([['key', 0, 0], ['timer', 0, 100]]))).toEqual([]);
  });

  it('finds nothing missing in any bundled sample', () => {
    for (const sample of listSamples()) {
      expect(listMissingWires(sample.board.graph), sample.id).toEqual([]);
    }
  });

  it('reports every required port of a node in port order', () => {
    const g = build([['touch', 0, 0]]);
    expect(listMissingWires(g).map((m) => m.portId)).toEqual(['a', 'b']);
  });
});

describe('checkPortPair', () => {
  it('rejects mismatched types with a message naming both', () => {
    const g = build([['key', 0, 0], ['show-number', 300, 0]]);
    const res = checkPortPair(g, { node: g.nodes[0]!.id, port: 'pressed' }, 'out', { node: g.nodes[1]!.id, port: 'value' }, 'in');
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.message).toContain('Đúng/Sai');
      expect(res.message).toContain('Số');
    }
  });

  it('accepts a matching pair either way round and treats an occupied input as replaceable', () => {
    let g = build([['key', 0, 0], ['key', 0, 100], ['win-lose', 300, 0]]);
    const [k1, k2, wl] = g.nodes.map((n) => n.id) as [string, string, string];
    expect(checkPortPair(g, { node: wl, port: 'win' }, 'in', { node: k1, port: 'pressed' }, 'out').ok).toBe(true);
    g = { ...g, wires: [wire('w1', [k1, 'pressed'], [wl, 'win'])] };
    expect(checkPortPair(g, { node: k2, port: 'pressed' }, 'out', { node: wl, port: 'win' }, 'in').ok).toBe(true);
  });

  it('rejects same-side drops', () => {
    const g = build([['key', 0, 0], ['key', 0, 100]]);
    const [a, b] = g.nodes.map((n) => n.id) as [string, string];
    expect(checkPortPair(g, { node: a, port: 'held' }, 'out', { node: b, port: 'held' }, 'out').ok).toBe(false);
  });
});

describe('findFreeNodeSpot', () => {
  it('keeps the wanted spot when clear', () => {
    expect(findFreeNodeSpot({ x: 10, y: 10 }, { w: 170, h: 90 }, [])).toEqual({ x: 10, y: 10 });
  });

  it('places five nodes added at the same point without any overlap', () => {
    let g = build([]);
    for (let i = 0; i < 5; i++) {
      const spot = findFreeNodeSpot({ x: 100, y: 100 }, { w: 180, h: 100 }, occupiedBoxes(g, []));
      const node = createNode(g, 'key', spot);
      if (!node) throw new Error('key');
      g = { ...g, nodes: [...g.nodes, node] };
    }
    const boxes = occupiedBoxes(g, []).map((b) => ({ ...b, w: 180, h: 100 }));
    for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) expect(boxesOverlap(boxes[i]!, boxes[j]!)).toBe(false);
  });
});

describe('computeLayout', () => {
  it('puts producers left of consumers and never overlaps nodes', () => {
    const g0 = build([['win-lose', 0, 0], ['key', 0, 0], ['key', 0, 0], ['touch', 0, 0]]);
    const [wl, k1, k2, t] = g0.nodes.map((n) => n.id) as [string, string, string, string];
    const g = { ...g0, wires: [wire('w1', [t, 'touching'], [wl, 'win'])] };
    const size = { w: 170, h: 100 };
    const pos = computeLayout(g, () => size, { x: 0, y: 0 });
    expect(pos.size).toBe(4);
    expect(pos.get(t)!.x).toBeLessThan(pos.get(wl)!.x);
    const all = [wl, k1, k2, t].map((id) => ({ ...pos.get(id)!, ...size }));
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(boxesOverlap(all[i]!, all[j]!)).toBe(false);
  });

  it('terminates on a cycle', () => {
    const g0 = build([['latch', 0, 0], ['latch', 0, 0]]);
    const [a, b] = g0.nodes.map((n) => n.id) as [string, string];
    const g = { ...g0, wires: [wire('w1', [a, 'on'], [b, 'set']), wire('w2', [b, 'on'], [a, 'set'])] };
    expect(computeLayout(g, () => undefined, { x: 0, y: 0 }).size).toBe(2);
  });
});

describe('geometry', () => {
  it('keeps the point under the cursor fixed while zooming', () => {
    const v = zoomAround({ panX: 40, panY: 20, zoom: 1 }, 2, 300, 200);
    expect((300 - v.panX) / v.zoom).toBeCloseTo(260);
    expect((200 - v.panY) / v.zoom).toBeCloseTo(180);
  });

  it('fit never goes below 0.6 and never above 1', () => {
    expect(fitView({ x: 0, y: 0, w: 5000, h: 3000 }, { w: 1000, h: 600 }).zoom).toBe(0.6);
    expect(fitView({ x: 0, y: 0, w: 100, h: 100 }, { w: 1000, h: 600 }).zoom).toBe(1);
  });

  it('snaps only within the radius', () => {
    const pts = [{ x: 100, y: 100 }, { x: 10, y: 10 }];
    expect(nearestWithin(pts, { x: 90, y: 100 }, 24)).toEqual({ x: 100, y: 100 });
    expect(nearestWithin(pts, { x: 60, y: 60 }, 24)).toBeNull();
  });
});

describe('findFreeNodeSpot with a visible area', () => {
  const visible: Box = { x: 0, y: 0, w: 900, h: 560 };
  const size = { w: 168, h: 99 };
  const rail: Box = { x: -4, y: 328, w: 270, h: 254 };

  it('keeps a clear drop point exactly where it was dropped', () => {
    expect(findFreeNodeSpot({ x: 300, y: 340 }, size, [rail], visible)).toEqual({ x: 300, y: 340 });
  });

  it('nudges a drop on the corner rail to a close spot that is fully in view', () => {
    const want = { x: 20, y: 340 };
    const spot = findFreeNodeSpot(want, size, [rail, { x: 20, y: 164, w: 168, h: 99 }], visible);
    const box = { ...spot, ...size };
    expect(boxesOverlap(box, rail)).toBe(false);
    expect(spot.x >= 0 && spot.y >= 0 && spot.x + size.w <= 900 && spot.y + size.h <= 560).toBe(true);
    expect(Math.hypot(spot.x - want.x, spot.y - want.y)).toBeLessThan(400);
  });

  it('never picks a spot outside the visible area, even when a hidden one is nearer', () => {
    const left: Box = { x: 0, y: 0, w: 900, h: 560 };
    const spot = findFreeNodeSpot({ x: 20, y: 220 }, size, [{ x: 20, y: 220, w: 168, h: 99 }], left);
    expect(spot.x).toBeGreaterThanOrEqual(0);
    expect(spot.y + size.h).toBeLessThanOrEqual(560);
  });

  it('on a packed view stays at the drop point instead of jumping below the board', () => {
    const wall: Box = { x: -100, y: -100, w: 1200, h: 800 };
    const spot = findFreeNodeSpot({ x: 40, y: 700 }, size, [wall], visible);
    expect(spot).toEqual({ x: 40, y: 461 });
  });
});
