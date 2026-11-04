import { beforeAll, describe, expect, it } from 'vitest';
import {
  createGroup,
  deriveGroupPorts,
  nodesInScope,
  patchGroup,
  pruneGroups,
  sceneGraph,
  ungroup,
} from '../../src/editor/groups/group-model';
import { layoutStubs } from '../../src/editor/graph/group-view';
import type { Graph } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { fixture } from './groups-fixture';

beforeAll(() => registerAllNodes());

describe('group model', () => {
  it('creates a group at the top-left of its members with a default name', () => {
    const res = createGroup(fixture(), ['c1', 'c2']);
    if (!res.ok) throw new Error('expected ok');
    const g = res.graph.groups![0]!;
    expect(g).toMatchObject({ id: 'grp1', name: 'Nhóm 1', nodeIds: ['c1', 'c2'], x: 300, y: 40 });
    expect(res.graph.nodes).toEqual(fixture().nodes);
    expect(res.graph.wires).toEqual(fixture().wires);
    const second = createGroup(res.graph, ['k1', 'lone']);
    expect(second.ok && second.graph.groups![1]!.name).toBe('Nhóm 2');
  });

  it('refuses a single node, nodes already grouped and unknown ids', () => {
    const base = fixture();
    expect(createGroup(base, ['c1'])).toEqual({ ok: false, reason: 'too-few' });
    expect(createGroup(base, ['ghost', 'c1'])).toEqual({ ok: false, reason: 'too-few' });
    const res = createGroup(base, ['c1', 'c2']);
    if (!res.ok) throw new Error('expected ok');
    expect(createGroup(res.graph, ['c2', 'k1'])).toEqual({ ok: false, reason: 'has-group' });
  });

  it('derives one port per inner port crossed by wires, typed and labelled', () => {
    const res = createGroup(fixture(), ['c1', 'c2']);
    if (!res.ok) throw new Error('expected ok');
    const ports = deriveGroupPorts(res.graph, res.graph.groups![0]!);
    expect(ports.map((p) => [p.node, p.port, p.dir, p.type])).toEqual([
      ['c1', 'jump', 'in', 'bool'],
      ['c2', 'jump', 'in', 'bool'],
      ['c1', 'self', 'out', 'object'],
    ]);
    expect(ports.map((p) => p.label)).toEqual(['Nhân vật · Nhảy (1)', 'Nhân vật · Nhảy (2)', 'Nhân vật · Đối tượng']);
    // c1.self feeds two outside nodes through the same group port.
    expect(ports[2]!.wires.map((w) => w.id)).toEqual(['w3', 'w4']);
  });

  it('has no ports when no wire crosses and ignores wires inside the group', () => {
    const g = fixture();
    const res = createGroup({ ...g, wires: [] }, ['c1', 'c2']);
    if (!res.ok) throw new Error('expected ok');
    expect(deriveGroupPorts(res.graph, res.graph.groups![0]!)).toEqual([]);
  });

  it('ungroup restores the flat graph, following a dragged block', () => {
    const res = createGroup(fixture(), ['c1', 'c2']);
    if (!res.ok) throw new Error('expected ok');
    expect(ungroup(res.graph, 'grp1')).toEqual(fixture());
    const dragged = patchGroup(res.graph, 'grp1', { x: 350, y: 90 });
    const flat = ungroup(dragged, 'grp1');
    expect(flat.groups).toBeUndefined();
    expect(flat.nodes.find((n) => n.id === 'c1')!.pos).toEqual({ x: 350, y: 90 });
    expect(flat.nodes.find((n) => n.id === 'c2')!.pos).toEqual({ x: 350, y: 250 });
  });

  it('prunes dangling ids, repeated members and empty groups; same object when clean', () => {
    const res = createGroup(fixture(), ['c1', 'c2']);
    if (!res.ok) throw new Error('expected ok');
    expect(pruneGroups(res.graph)).toBe(res.graph);
    const dirty: Graph = {
      ...res.graph,
      groups: [
        { id: 'a', name: 'A', nodeIds: ['c1', 'ghost'], x: 0, y: 0 },
        { id: 'b', name: 'B', nodeIds: ['c1', 'c2'], x: 0, y: 0 },
        { id: 'c', name: 'C', nodeIds: ['ghost'], x: 0, y: 0 },
      ],
    };
    expect(pruneGroups(dirty).groups).toEqual([
      { id: 'a', name: 'A', nodeIds: ['c1'], x: 0, y: 0 },
      { id: 'b', name: 'B', nodeIds: ['c2'], x: 0, y: 0 },
    ]);
  });

  it('scopes nodes and builds the scene graph the canvas lays out', () => {
    const res = createGroup(fixture(), ['c1', 'c2']);
    if (!res.ok) throw new Error('expected ok');
    expect(nodesInScope(res.graph, null).map((n) => n.id)).toEqual(['k1', 'cr1', 'cr2', 'lone']);
    expect(nodesInScope(res.graph, 'grp1').map((n) => n.id)).toEqual(['c1', 'c2']);
    const top = sceneGraph(res.graph, null);
    expect(top.nodes.map((n) => n.id)).toEqual(['k1', 'cr1', 'cr2', 'lone', 'grp1']);
    expect(top.wires.map((w) => [w.from.node, w.to.node])).toEqual([
      ['k1', 'grp1'],
      ['grp1', 'cr1'],
      ['grp1', 'cr2'],
    ]);
    expect(sceneGraph(res.graph, 'grp1').wires).toEqual([]);
  });

  it('lays boundary stubs left for inputs and right for outputs without overlapping', () => {
    const res = createGroup(fixture(), ['c1', 'c2']);
    if (!res.ok) throw new Error('expected ok');
    const g = res.graph.groups![0]!;
    const members = nodesInScope(res.graph, g.id);
    const spots = layoutStubs(deriveGroupPorts(res.graph, g), members);
    const ins = spots.filter((p) => p.port.dir === 'in');
    const outs = spots.filter((p) => p.port.dir === 'out');
    expect(ins.every((p) => p.x < 300) && outs.every((p) => p.x > 300)).toBe(true);
    const ys = ins.map((p) => p.y).sort((a, b) => a - b);
    expect(ys[1]! - ys[0]!).toBeGreaterThanOrEqual(30);
    expect(layoutStubs([], members)).toEqual([]);
  });
});
