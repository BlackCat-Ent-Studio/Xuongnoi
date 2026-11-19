import { beforeAll, describe, expect, it } from 'vitest';
import { expandBoard, expandCircuitAlone } from '../../src/circuits/expand';
import { listNodeDefs } from '../../src/engine/registry';
import type { Board, Circuit, Graph, GraphNode, Vec3 } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { circuit, copyOf, node, wire } from './circuit-helpers';

beforeAll(() => registerAllNodes());

const board = (graph: Graph, circuits: Circuit[]): Board => ({ name: 't', mode: '3d', graph, circuits });
const byId = (g: Graph, id: string): GraphNode => g.nodes.find((n) => n.id === id)!;
const v = (x: number, y: number, z: number): Vec3 => ({ x, y, z });
const near = (got: unknown, want: Vec3): void => {
  const p = got as Vec3;
  expect(p.x).toBeCloseTo(want.x, 9);
  expect(p.y).toBeCloseTo(want.y, 9);
  expect(p.z).toBeCloseTo(want.z, 9);
};

/** A robot at (2, 0.8, 1) looking along +x, a crate, a zone, a spawner and a camera. */
const cell = (extra: Partial<Circuit> = {}): Circuit =>
  circuit(
    'cell',
    {
      nodes: [
        node('bot', 'robot-body', { position: v(2, 0.8, 1), heading: 30, length: 0.9 }),
        node('crate', 'item', { position: v(0, 1, 3), size: v(0.5, 0.5, 0.5) }),
        node('zone', 'zone', { center: v(1, 1, 0), size: v(4, 3, 2) }),
        node('drop', 'spawner', { position: v(0, 5, 2) }),
        node('cam', 'camera', { mode: 'fixed', point: v(1, 0, 1) }),
        node('ram', 'linear-actuator', { position: v(3, 0.3, 0), direction: 45 }),
      ],
      wires: [],
    },
    extra,
  );

describe('placing a copy', () => {
  it('does not touch anything at the identity placement', () => {
    const c = cell();
    const { graph } = expandBoard(board({ nodes: [copyOf('a', 'cell')], wires: [] }, [c]));
    for (const inner of c.graph.nodes) expect(byId(graph, `a/${inner.id}`).params).toBe(inner.params);
  });

  it('shifts every world point and leaves sizes, lengths and other settings alone', () => {
    const { graph } = expandBoard(board({ nodes: [copyOf('a', 'cell', { x: 10, z: -4 })], wires: [] }, [cell()]));
    expect(byId(graph, 'a/bot').params).toMatchObject({ position: v(12, 0.8, -3), heading: 30, length: 0.9 });
    expect(byId(graph, 'a/crate').params).toMatchObject({ position: v(10, 1, -1), size: v(0.5, 0.5, 0.5) });
    expect(byId(graph, 'a/zone').params).toMatchObject({ center: v(11, 1, -4), size: v(4, 3, 2) });
    expect(byId(graph, 'a/drop').params.position).toEqual(v(10, 5, -2));
    expect(byId(graph, 'a/cam').params.point).toEqual(v(11, 0, -3));
    expect(byId(graph, 'a/ram').params).toMatchObject({ position: v(13, 0.3, -4), direction: 45 });
  });

  it('turns about the vertical axis: 90 degrees takes +x onto +z, and headings add', () => {
    const { graph } = expandBoard(board({ nodes: [copyOf('a', 'cell', { x: 10, z: 0, heading: 90 })], wires: [] }, [cell()]));
    // (2, 1) -> (-1, 2), then +10 on x. Quarter turns are exact.
    expect(byId(graph, 'a/bot').params).toMatchObject({ position: v(9, 0.8, 2), heading: 120 });
    expect(byId(graph, 'a/crate').params.position).toEqual(v(7, 1, 0));
    expect(byId(graph, 'a/ram').params).toMatchObject({ position: v(10, 0.3, 3), direction: 135 });
  });

  it('turns by any angle', () => {
    const { graph } = expandBoard(board({ nodes: [copyOf('a', 'cell', { x: 0, z: 0, heading: 45 })], wires: [] }, [cell()]));
    const r = Math.SQRT1_2;
    near(byId(graph, 'a/bot').params.position, v(2 * r - 1 * r, 0.8, 2 * r + 1 * r));
    expect(byId(graph, 'a/bot').params.heading).toBe(75);
  });

  it('writes out a default position that the card did not store, so the copy still moves', () => {
    const bare = circuit('bare', { nodes: [node('bot', 'robot-body')], wires: [] });
    const { graph } = expandBoard(board({ nodes: [copyOf('a', 'bare', { x: 5, z: 5, heading: 180 })], wires: [] }, [bare]));
    expect(byId(graph, 'a/bot').params).toMatchObject({ position: v(5, 0.5, 5), heading: 180 });
  });

  it('places a copy inside a copy in the outer copy\'s frame', () => {
    const line = circuit('line', { nodes: [copyOf('left', 'cell', { x: 0, z: 2 }), copyOf('right', 'cell', { x: 4, z: 0, heading: 90 })], wires: [] });
    const { graph } = expandBoard(board({ nodes: [copyOf('hall', 'line', { x: 100, z: 0, heading: 90 })], wires: [] }, [cell(), line]));
    // left: bot (2, 1) -> in line (2, 3) -> turned 90: (-3, 2) -> +100.
    expect(byId(graph, 'hall/left/bot').params).toMatchObject({ position: v(97, 0.8, 2), heading: 120 });
    // right: bot (2, 1) -> turned 90: (-1, 2) -> +4: (3, 2) -> turned 90: (-2, 3) -> +100.
    expect(byId(graph, 'hall/right/bot').params).toMatchObject({ position: v(98, 0.8, 3), heading: 210 });
  });

  it('lets a copy set its own value of an exposed position, given in the circuit\'s own frame', () => {
    const c = cell({ exposed: [{ id: 'start', label: 'Chỗ xuất phát', inner: { node: 'bot', param: 'position' } }] });
    const b = board({ nodes: [copyOf('a', 'cell', { x: 10, z: 0 }, { start: v(0, 0.8, 0) }), copyOf('b', 'cell', { x: 20, z: 0 })], wires: [] }, [c]);
    const { graph } = expandBoard(b);
    expect(byId(graph, 'a/bot').params.position).toEqual(v(10, 0.8, 0));
    expect(byId(graph, 'b/bot').params.position).toEqual(v(22, 0.8, 1));
  });
});

describe('settings whose meaning changes with a wire or a mode', () => {
  const placedCell = (c: Circuit): Graph => expandBoard(board({ nodes: [copyOf('a', 'cell', { x: 10, z: 0, heading: 90 })], wires: [] }, [c])).graph;

  it('zone centre: a world point alone; following something it is an offset (turned, not shifted); turning with the body it is left alone', () => {
    expect(byId(placedCell(cell()), 'a/zone').params.center).toEqual(v(10, 1, 1));

    const following = cell();
    following.graph.wires.push(wire('w1', 'bot.self', 'zone.follow'));
    expect(byId(placedCell(following), 'a/zone').params.center).toEqual(v(0, 1, 1));

    const turning = cell();
    turning.graph.wires.push(wire('w1', 'bot.self', 'zone.follow'));
    turning.graph.nodes[2]!.params.rotate = 'yes';
    expect(byId(placedCell(turning), 'a/zone').params.center).toEqual(v(1, 1, 0));
  });

  it('spawner position: a world point alone, an offset once "Tại đối tượng" has a wire', () => {
    expect(byId(placedCell(cell()), 'a/drop').params.position).toEqual(v(8, 5, 0));
    const anchored = cell();
    anchored.graph.wires.push(wire('w1', 'bot.self', 'drop.at'));
    expect(byId(placedCell(anchored), 'a/drop').params.position).toEqual(v(-2, 5, 0));
  });

  it('a wire that reaches the input through a pin counts as a wire', () => {
    const c = cell({ pins: [{ id: 'at', label: 'Tại', dir: 'in', type: 'object', inner: { node: 'drop', port: 'at' } }] });
    const b = board({ nodes: [node('box', 'block'), copyOf('a', 'cell', { x: 10, z: 0, heading: 90 })], wires: [wire('w1', 'box.self', 'a.at')] }, [c]);
    expect(byId(expandBoard(b).graph, 'a/drop').params.position).toEqual(v(-2, 5, 0));
    b.graph.wires = [];
    expect(byId(expandBoard(b).graph, 'a/drop').params.position).toEqual(v(8, 5, 0));
  });

  it('camera point: a world point in "fixed", an offset from the followed body in "follow"', () => {
    expect(byId(placedCell(cell()), 'a/cam').params.point).toEqual(v(9, 0, 1));
    const follow = cell();
    follow.graph.nodes[4]!.params.mode = 'follow';
    expect(byId(placedCell(follow), 'a/cam').params.point).toEqual(v(-1, 0, 1));
  });

  it('piston direction: a world direction alone, left alone once it is mounted on something', () => {
    expect(byId(placedCell(cell()), 'a/ram').params.direction).toBe(135);
    const mounted = cell();
    mounted.graph.wires.push(wire('w1', 'bot.self', 'ram.base'));
    expect(byId(placedCell(mounted), 'a/ram').params.direction).toBe(45);
  });
});

describe('which settings are marked as places', () => {
  it('exactly the world positions and world directions of the pieces', () => {
    const points: string[] = [];
    const headings: string[] = [];
    for (const def of listNodeDefs()) {
      for (const p of def.params) {
        if (p.place === 'point') points.push(`${def.kind}.${p.id}`);
        if (p.place === 'heading') headings.push(`${def.kind}.${p.id}`);
        if (p.place === 'point') expect(p.kind, `${def.kind}.${p.id}`).toBe('vec3');
        if (p.place === 'heading') expect(p.kind, `${def.kind}.${p.id}`).toBe('number');
        if (p.placeAs) expect(p.place, `${def.kind}.${p.id}`).toBeDefined();
      }
    }
    const numbered = (kind: string, n: number): string[] => Array.from({ length: n }, (_, i) => `${kind}.p${i + 1}`);
    expect(points.sort()).toEqual(
      [
        'block.position', 'character.position', 'item.position', 'vehicle.position', 'robot-body.position', 'portal.position',
        'rotating-platform.position', 'moving-platform.position', 'moving-platform.to', 'patrol.pointA', 'patrol.pointB',
        'line-track.center', 'zone.center', 'spawner.position', 'camera.point', 'linear-actuator.position', 'teleport.position',
        'go-to.targetPos', ...numbered('route-follow', 32), ...numbered('line-track', 16),
      ].sort(),
    );
    expect(headings.sort()).toEqual(['linear-actuator.direction', 'robot-body.heading']);
  });
});

describe('pair codes', () => {
  const gates = (): Circuit =>
    circuit(
      'gates',
      { nodes: [node('in', 'portal', { pair: 'A' }), node('out', 'portal', { pair: 'A' }), node('free', 'portal', { pair: '' })], wires: [] },
      { exposed: [{ id: 'code', label: 'Mã cặp', inner: { node: 'out', param: 'pair' } }] },
    );

  it('are private to each copy, so two copies never link to each other', () => {
    const b = board({ nodes: [node('own', 'portal', { pair: 'A' }), copyOf('a', 'gates'), copyOf('b', 'gates')], wires: [] }, [gates()]);
    const { graph } = expandBoard(b);
    expect(byId(graph, 'own').params.pair).toBe('A');
    expect(byId(graph, 'a/in').params.pair).toBe('a/A');
    expect(byId(graph, 'a/out').params.pair).toBe('a/A');
    expect(byId(graph, 'b/in').params.pair).toBe('b/A');
    expect(byId(graph, 'a/free').params.pair).toBe('');
  });

  it('a code given from outside through an exposed setting belongs to the board that gave it', () => {
    const b = board({ nodes: [node('own', 'portal', { pair: 'X' }), copyOf('a', 'gates', undefined, { code: 'X' })], wires: [] }, [gates()]);
    const { graph } = expandBoard(b);
    expect(byId(graph, 'a/out').params.pair).toBe('X');
    expect(byId(graph, 'a/in').params.pair).toBe('a/A');

    // One level further in: the value is written by circuit "hall", so it is private to each copy of "hall".
    const hall = circuit('hall', { nodes: [copyOf('g', 'gates', undefined, { code: 'H' }), node('door', 'portal', { pair: 'H' })], wires: [] });
    const deep = expandBoard(board({ nodes: [copyOf('h1', 'hall'), copyOf('h2', 'hall')], wires: [] }, [gates(), hall])).graph;
    expect(byId(deep, 'h1/g/out').params.pair).toBe('h1/H');
    expect(byId(deep, 'h1/door').params.pair).toBe('h1/H');
    expect(byId(deep, 'h2/g/out').params.pair).toBe('h2/H');
    expect(byId(deep, 'h1/g/in').params.pair).toBe('h1/g/A');
  });

  it('stay as written when the circuit is run alone', () => {
    const b = board({ nodes: [], wires: [] }, [gates()]);
    expect(byId(expandCircuitAlone(b, 'gates').graph, 'in').params.pair).toBe('A');
  });
});
