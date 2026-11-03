import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntityView, type Graph, type GraphNode, type Params, type Vec3, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

type NodeSpec = [id: string, kind: string, params?: Params];
type WireSpec = [from: string, fromPort: string, to: string, toPort: string];

const v = (x: number, z: number, y = 0.5): Vec3 => ({ x, y, z });
const floor: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: 200 }, color: '#888' }];

/** A bot walking three points along a line, with a crate beside the first one. */
function board(extra: Params, extraNodes: NodeSpec[] = [], extraWires: WireSpec[] = []): { nodes: NodeSpec[]; wires: WireSpec[] } {
  return {
    nodes: [
      floor,
      ['hero', 'character', { position: v(-4, 0), speed: 5, role: 'bot' }],
      ['crate', 'item', { position: { x: -4, y: 0.5, z: 1 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate' }],
      ['route', 'route-follow', { count: 3, p1: v(-4, 0), p2: v(0, 0), p3: v(4, 0), speed: 5, lookAhead: 0, arriveRadius: 0.2, ...extra }],
      ...extraNodes,
    ],
    wires: [
      ['hero', 'self', 'route', 'self'],
      ['route', 'moveX', 'hero', 'moveX'],
      ['route', 'moveY', 'hero', 'moveY'],
      ...extraWires,
    ],
  };
}

interface Run {
  at: boolean[];
  xs: number[];
  hero: EntityView;
  world: World;
}

function run(nodes: NodeSpec[], wires: WireSpec[], ticks: number): Run {
  const graph: Graph = {
    nodes: nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
    wires: wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world = createWorld('3d');
  const rt = createRuntime(graph, world, '3d');
  const at: boolean[] = [];
  const xs: number[] = [];
  const hero = (): EntityView => world.entities().find((e) => e.ownerNodeId === 'hero')!;
  for (let i = 0; i < ticks; i++) {
    rt.tick({ keysDown: new Set() });
    world.step(TICK_DT);
    at.push(rt.getOutput('route', 'atPoint') === true);
    xs.push(hero().position.x);
  }
  return { at, xs, hero: hero(), world };
}

const go = (extra: Params, ticks: number): Run => {
  const b = board(extra);
  return run(b.nodes, b.wires, ticks);
};

describe('route-follow: stopping at each point', () => {
  it('by default it never stops and "Đang ở điểm" stays off', () => {
    const r = go({}, 60 * 4);
    expect(r.at.some(Boolean)).toBe(false);
    expect(r.xs[r.xs.length - 1]!).toBeGreaterThan(-4);
  });

  it('with "Dừng ở mỗi điểm" it stands still that long at each point, then walks on', () => {
    const r = go({ stopFor: 1 }, 60 * 5);
    const stopped = r.at.map((on, i) => (on ? i : -1)).filter((i) => i >= 0);
    expect(stopped.length).toBeGreaterThanOrEqual(58);
    const first = stopped[0]!;
    for (let i = first + 1; i < first + 58; i++) expect(Math.abs(r.xs[i]! - r.xs[i - 1]!), `tick ${i}`).toBeLessThan(1e-3);
    expect(r.xs[first + 100]! - r.xs[first + 61]!).toBeGreaterThan(1);
  });

  it('the stop is dropped while "Bật" is off, so nothing happens until it comes back', () => {
    const b = board({ stopFor: 5 }, [['zero', 'const', { value: 0 }], ['never', 'compare', { op: 'gt' }]], [['zero', 'value', 'never', 'a'], ['never', 'out', 'route', 'on']]);
    const r = run(b.nodes, b.wires, 60 * 2);
    expect(r.at.some(Boolean)).toBe(false);
    expect(Math.abs(r.xs[r.xs.length - 1]! - -4)).toBeLessThan(0.1);
  });

  it('"Khi dừng, quay mặt về" turns the bot toward the crate beside it', () => {
    const first = go({ stopFor: 1, faceAtStop: 'item' }, 60 * 3).at.indexOf(true);
    const f = go({ stopFor: 1, faceAtStop: 'item' }, first + 30).hero.facing!;
    expect(f.z).toBeGreaterThan(0.5);
  });

  it('without that setting the bot keeps facing along its way', () => {
    const first = go({ stopFor: 1 }, 60 * 3).at.indexOf(true);
    const f = go({ stopFor: 1 }, first + 30).hero.facing!;
    expect(Math.abs(f.z)).toBeLessThan(0.1);
  });

  it('the turn is so small that the speed sensor still reads "standing still"', () => {
    const r = go({ stopFor: 1, faceAtStop: 'item' }, 60 * 3);
    const first = r.at.indexOf(true);
    for (let i = first + 1; i < first + 58; i++) expect(Math.abs(r.xs[i]! - r.xs[i - 1]!) / TICK_DT, `tick ${i}`).toBeLessThan(0.05);
  });
});
