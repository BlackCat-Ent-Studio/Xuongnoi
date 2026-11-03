import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type Graph, type GraphNode, type Params, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { nearestItemNode } from '../../src/nodes/nearest-item';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

type NodeSpec = [id: string, kind: string, params?: Params];
type WireSpec = [from: string, fromPort: string, toPort: string];

const floor: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 30 }, color: '#888' }];
const bot: NodeSpec = ['bot', 'character', { position: { x: 0, y: 1, z: 0 }, role: 'bot' }];
const crate = (id: string, x: number, z = 0, extra: Params = {}): NodeSpec => [id, 'item', { position: { x, y: 0.4, z }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', ...extra }];
const slot = (id: string, x: number, z = 0): NodeSpec => [id, 'block', { position: { x, y: 0.03, z }, size: { x: 1.1, y: 0.04, z: 1.1 }, color: '#f59e0b', type: 'pickup' }];

function play(nodes: NodeSpec[], wires: WireSpec[] = [], params: Params = {}, seconds = 0.5): { out: (p: string) => unknown; world: World; more: (sec: number) => void } {
  const all: NodeSpec[] = [...nodes, ['find', 'nearest-item', params]];
  const graph: Graph = {
    nodes: all.map(([id, kind, p]): GraphNode => ({ id, kind, params: p ?? {}, pos: { x: 0, y: 0 } })),
    wires: [
      { id: 'who', from: { node: 'bot', port: 'self' }, to: { node: 'find', port: 'who' } },
      ...wires.map(([from, fromPort, toPort], i) => ({ id: `w${i}`, from: { node: from, port: fromPort }, to: { node: 'find', port: toPort } })),
    ],
  };
  const world = createWorld('3d');
  const rt = createRuntime(graph, world, '3d');
  const run = (sec: number): void => {
    for (let i = 0; i < Math.ceil(sec / TICK_DT); i++) {
      rt.tick({ keysDown: new Set() });
      world.step(TICK_DT);
    }
  };
  run(seconds);
  return { out: (p) => rt.getOutput('find', p), world, more: run };
}

const idOf = (world: World, owner: string): string => world.listEntities().find((e) => e.ownerNodeId === owner)!.id;

describe('nearest-item node', () => {
  it('is a logic piece with Ai, Tạm nghỉ and four ignore inputs, and three outputs', () => {
    expect(nearestItemNode.category).toBe('logic');
    expect(nearestItemNode.inputs.map((p) => p.id)).toEqual(['who', 'pause', 'i1', 'i2', 'i3', 'i4']);
    expect(nearestItemNode.outputs.map((p) => p.id)).toEqual(['item', 'found', 'distance']);
    expect(nearestItemNode.label).toBe('Tìm vật gần nhất');
    expect(nearestItemNode.labelEn).toBe('Nearest Item');
  });

  it('points at the nearest loose item with its distance', () => {
    const r = play([floor, bot, crate('far', -8), crate('near', 3, 4)]);
    expect(r.out('item')).toBe(idOf(r.world, 'near'));
    expect(r.out('found')).toBe(true);
    expect(r.out('distance') as number).toBeCloseTo(5, 0);
  });

  it('measures along the floor and ignores height', () => {
    const r = play([floor, bot, crate('high', 2, 0, { position: { x: 2, y: 6, z: 0 } }), crate('low', 3)]);
    expect(r.out('item')).toBe(idOf(r.world, 'high'));
  });

  it('with two items the same distance away takes the one named first, every time', () => {
    const a = play([floor, bot, crate('c1', 4), crate('c2', -4)]);
    const b = play([floor, bot, crate('c2', -4), crate('c1', 4)]);
    expect(a.out('item')).toBe(idOf(a.world, 'c1') < idOf(a.world, 'c2') ? idOf(a.world, 'c1') : idOf(a.world, 'c2'));
    expect(b.out('item')).toBe(idOf(b.world, 'c1') < idOf(b.world, 'c2') ? idOf(b.world, 'c1') : idOf(b.world, 'c2'));
  });

  it('says not found and gives no item when the floor has no loose item', () => {
    const r = play([floor, bot]);
    expect(r.out('item')).toBeNull();
    expect(r.out('found')).toBe(false);
    expect(r.out('distance')).toBe(0);
  });

  it('skips an item the bot is carrying and offers the next one', () => {
    const r = play([floor, bot, crate('held', 1), crate('other', 6)]);
    expect(r.out('item')).toBe(idOf(r.world, 'held'));
    expect(r.world.grab(idOf(r.world, 'bot'), 2)).toBe(idOf(r.world, 'held'));
    r.more(0.1);
    expect(r.out('item')).toBe(idOf(r.world, 'other'));
  });

  it('skips items resting on a wired ignore marker and takes the next nearest', () => {
    const nodes = [floor, bot, slot('s1', 2), slot('s2', 4), crate('in1', 2.05), crate('in2', 4), crate('out', -7)];
    const wires: WireSpec[] = [['s1', 'self', 'i1'], ['s2', 'self', 'i2']];
    const r = play(nodes, wires);
    expect(r.out('item')).toBe(idOf(r.world, 'out'));
    const open = play(nodes, [['s2', 'self', 'i2']]);
    expect(open.out('item')).toBe(idOf(open.world, 'in1'));
  });

  it('a marker with nothing on it hides nothing', () => {
    const r = play([floor, bot, slot('s1', 9), crate('c', -3)], [['s1', 'self', 'i1']]);
    expect(r.out('item')).toBe(idOf(r.world, 'c'));
  });

  it('only offers the wanted goods type when one is set', () => {
    const nodes = [floor, bot, crate('apple', 1, 0, { tag: 'tao' }), crate('pear', 5, 0, { tag: 'le' })];
    const r = play(nodes, [], { goods: 'le' });
    expect(r.out('item')).toBe(idOf(r.world, 'pear'));
    const none = play(nodes, [], { goods: 'khong-co' });
    expect(none.out('found')).toBe(false);
  });

  it('Tạm nghỉ switches it off', () => {
    const open = play([floor, bot, crate('c', 3)]);
    expect(open.out('found')).toBe(true);
    // An unwired "Đảo ngược" gives ON.
    const paused = play([floor, bot, crate('c', 3), ['on', 'not', {}]], [['on', 'out', 'pause']]);
    expect(paused.out('found')).toBe(false);
    expect(paused.out('item')).toBeNull();
  });

  it('without "Ai" it finds nothing', () => {
    const graph: Graph = {
      nodes: [floor, crate('c', 2), ['find', 'nearest-item', {}] as NodeSpec].map(([id, kind, params]) => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } }) as GraphNode),
      wires: [],
    };
    const world = createWorld('3d');
    const rt = createRuntime(graph, world, '3d');
    rt.tick({ keysDown: new Set() });
    expect(rt.getOutput('find', 'found')).toBe(false);
  });
});
