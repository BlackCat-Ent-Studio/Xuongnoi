import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type GraphNode, type Params, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { nextFreeSlotNode } from '../../src/nodes/next-free-slot';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

type NodeSpec = [id: string, kind: string, params?: Params];

const slot = (id: string, x: number, z = 0): NodeSpec => [id, 'block', { position: { x, y: 0.03, z }, size: { x: 1.1, y: 0.04, z: 1.1 }, color: '#f59e0b', type: 'pickup' }];
const crate = (id: string, x: number, z = 0, y = 0.4): NodeSpec => [id, 'item', { position: { x, y, z }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate' }];
const floor: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 20 }, color: '#888' }];

function play(nodes: NodeSpec[], slots: string[], seconds = 0.5): { out: (p: string) => unknown; world: World } {
  const all: NodeSpec[] = [...nodes, ['pick', 'next-free-slot', {}]];
  const graph: Graph = {
    nodes: all.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
    wires: slots.map((id, i) => ({ id: `w${i}`, from: { node: id, port: 'self' }, to: { node: 'pick', port: `s${i + 1}` } })),
  };
  const world = createWorld('3d');
  const rt = createRuntime(graph, world, '3d');
  for (let i = 0; i < Math.ceil(seconds / TICK_DT); i++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
  }
  return { out: (p) => rt.getOutput('pick', p), world };
}

const idOf = (world: World, owner: string): string => world.listEntities().find((e) => e.ownerNodeId === owner)!.id;

describe('next-free-slot node', () => {
  it('has four slot inputs and outputs the free slot and the full flag', () => {
    expect(nextFreeSlotNode.inputs.map((p) => p.id)).toEqual(['s1', 's2', 's3', 's4']);
    expect(nextFreeSlotNode.outputs.map((p) => p.id)).toEqual(['slot', 'full']);
    expect(nextFreeSlotNode.category).toBe('logic');
  });

  it('picks the first slot while every slot is empty, and is not full', () => {
    const r = play([floor, slot('a', -4), slot('b', -2), slot('c', 0)], ['a', 'b', 'c']);
    expect(r.out('slot')).toBe(idOf(r.world, 'a'));
    expect(r.out('full')).toBe(false);
  });

  it('moves on to the next slot once a crate sits on the first, in the order of the inputs', () => {
    const r = play([floor, slot('a', -4), slot('b', -2), slot('c', 0), crate('k1', -4.1, 0.05)], ['a', 'b', 'c']);
    expect(r.out('slot')).toBe(idOf(r.world, 'b'));
    const r2 = play([floor, slot('a', -4), slot('b', -2), slot('c', 0), crate('k1', -4), crate('k2', -2)], ['a', 'b', 'c']);
    expect(r2.out('slot')).toBe(idOf(r2.world, 'c'));
  });

  it('a crate on a later slot does not fill the earlier one', () => {
    const r = play([floor, slot('a', -4), slot('b', -2), crate('k1', -2)], ['a', 'b']);
    expect(r.out('slot')).toBe(idOf(r.world, 'a'));
  });

  it('a crate lying elsewhere does not fill a slot', () => {
    const r = play([floor, slot('a', -4), crate('k1', -4, 3)], ['a']);
    expect(r.out('slot')).toBe(idOf(r.world, 'a'));
  });

  it('says it is full and gives no slot when every slot holds a crate', () => {
    const r = play([floor, slot('a', -4), slot('b', -2), crate('k1', -4), crate('k2', -2)], ['a', 'b']);
    expect(r.out('slot')).toBeNull();
    expect(r.out('full')).toBe(true);
  });

  it('with nothing wired there is no slot and it is not full', () => {
    const r = play([floor], []);
    expect(r.out('slot')).toBeNull();
    expect(r.out('full')).toBe(false);
  });
});
