import { beforeAll, describe, expect, it } from 'vitest';
import { estimateNodeSize } from '../../src/editor/graph/graph-geometry';
import { createRuntime } from '../../src/engine/runtime';
import { activeInputs, getNodeDef, knownInputs } from '../../src/engine/registry';
import { TICK_DT, type Graph, type GraphNode, type Params, type Vec3 } from '../../src/engine/types';
import { canConnect } from '../../src/engine/wiring';
import { parseBoard, serializeBoard } from '../../src/io';
import { registerAllNodes } from '../../src/nodes';
import { createWorld } from '../../src/world/world';
import { wireStarts } from '../helpers/wire-starts';

beforeAll(() => registerAllNodes());

const v = (x: number, z: number): Vec3 => ({ x, y: 0.5, z });
const dist = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

interface Options {
  /** Route settings on top of the base ones. */
  route?: Params;
  /** Which marker objects are wired into "Điểm k (vật)" (1-based); default both. */
  wired?: number[];
}

/** A bot on a floor, two loose item markers A and B, and a two-point route whose presets are far from both markers. */
function setup(opts: Options = {}) {
  const wired = opts.wired ?? [1, 2];
  const nodes: [string, string, Params][] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 80, y: 1, z: 40 }, color: '#888' }],
    ['bot', 'character', { position: { x: 0, y: 1, z: 0 }, speed: 4, role: 'bot' }],
    ['a', 'item', { position: v(6, 0), size: { x: 0.4, y: 0.4, z: 0.4 } }],
    ['b', 'item', { position: v(6, 8), size: { x: 0.4, y: 0.4, z: 0.4 } }],
    ['route', 'route-follow', { count: 2, p1: v(-10, 0), p2: v(-10, 8), speed: 4, lookAhead: 0, arriveRadius: 0.3, ...opts.route }],
    ['hideKey', 'key', { key: 'KeyH' }],
  ];
  const wires: [string, string, string, string][] = [
    ['bot', 'self', 'route', 'self'],
    ['route', 'moveX', 'bot', 'moveX'],
    ['route', 'moveY', 'bot', 'moveY'],
    ['hideKey', 'held', 'a', 'hide'],
  ];
  if (wired.includes(1)) wires.push(['a', 'self', 'route', 'obj1']);
  if (wired.includes(2)) wires.push(['b', 'self', 'route', 'obj2']);
  const graph: Graph = {
    nodes: nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params, pos: { x: 0, y: 0 } })),
    wires: wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world = createWorld('3d');
  const rt = createRuntime(wireStarts(graph, '3d'), world, '3d');
  const ent = (owner: string) => world.entities().find((e) => e.ownerNodeId === owner)!;
  const step = (keys: string[] = []) => {
    rt.tick({ keysDown: new Set(keys) });
    world.step(TICK_DT);
  };
  /** Runs `ticks` ticks and returns the closest the bot came to `target`. */
  const closest = (target: Vec3, ticks: number): number => {
    let best = Infinity;
    for (let t = 0; t < ticks; t++) {
      step();
      best = Math.min(best, dist(ent('bot').position, target));
    }
    return best;
  };
  const path = (ticks: number): string => {
    const out: string[] = [];
    for (let t = 0; t < ticks; t++) {
      step();
      const p = ent('bot').position;
      out.push(`${p.x.toFixed(4)},${p.z.toFixed(4)}`);
    }
    return out.join(';');
  };
  return { world, rt, ent, step, closest, path, graph };
}

const ON = { pointsFrom: 'objects' };

describe('route-follow: "Lấy điểm từ vật"', () => {
  it('walks to the objects, not to the preset coordinates', () => {
    const s = setup({ route: ON });
    expect(s.closest(v(6, 0), 400)).toBeLessThan(0.7);
    // The preset points (x = -10) are never visited.
    expect(s.ent('bot').position.x).toBeGreaterThan(-5);
  });

  it('follows an object that moves (read every tick)', () => {
    const s = setup({ route: ON });
    for (let t = 0; t < 60; t++) s.step();
    s.world.teleport(s.ent('a').id, v(14, -6), false);
    s.world.teleport(s.ent('b').id, v(14, 6), false);
    expect(s.closest(v(14, -6), 600)).toBeLessThan(0.7);
    expect(s.closest(v(14, 6), 600)).toBeLessThan(0.7);
  });

  it('an unwired point falls back to its preset coordinate', () => {
    const s = setup({ route: ON, wired: [1] });
    expect(s.closest(v(6, 0), 300)).toBeLessThan(0.7);
    expect(s.closest(v(-10, 8), 900)).toBeLessThan(0.7);
  });

  it('a hidden object keeps its last seen place; it never sends the bot back to the preset', () => {
    const s = setup({ route: ON });
    for (let t = 0; t < 30; t++) s.step();
    // "Ẩn đi" on A for the rest of the run.
    for (let t = 0; t < 5; t++) s.step(['KeyH']);
    expect(s.ent('a').visible).toBe(false);
    expect(s.closest(v(6, 0), 600)).toBeLessThan(0.7);
    expect(s.ent('bot').position.x).toBeGreaterThan(-5);
  });

  it('a hidden object that was never seen uses its preset point', () => {
    const s = setup({ route: ON, wired: [2] });
    s.world.hide(s.ent('b').id);
    expect(s.closest(v(-10, 8), 900)).toBeLessThan(0.7);
  });

  it('the option off ignores wires on the object inputs and moves exactly as the old piece', () => {
    const plain = setup({ wired: [] }).path(300);
    const wiredButOff = setup({ wired: [1, 2] }).path(300);
    expect(wiredButOff).toBe(plain);
    const explicitOff = setup({ route: { pointsFrom: 'preset' }, wired: [1, 2] }).path(300);
    expect(explicitOff).toBe(plain);
    // The old piece went to the presets.
    expect(setup({ wired: [] }).closest(v(-10, 0), 400)).toBeLessThan(0.7);
  });

  it('works leg by leg ("Chạy từng chặng")', () => {
    const s = setup({ route: { ...ON, legs: 'dash' } });
    // Holding Space is "Chạy": each push starts one dash to the next point.
    const g2: Graph = {
      ...s.graph,
      nodes: [...s.graph.nodes, { id: 'space', kind: 'key', params: { key: 'Space' }, pos: { x: 0, y: 0 } }],
      wires: [...s.graph.wires, { id: 'wg', from: { node: 'space', port: 'held' }, to: { node: 'route', port: 'go' } }],
    };
    const world = createWorld('3d');
    const rt = createRuntime(wireStarts(g2, '3d'), world, '3d');
    const bot = () => world.entities().find((e) => e.ownerNodeId === 'bot')!;
    let best = Infinity;
    for (let t = 0; t < 600; t++) {
      rt.tick({ keysDown: new Set(['Space']) });
      world.step(TICK_DT);
      best = Math.min(best, dist(bot().position, v(6, 8)));
    }
    expect(best).toBeLessThan(0.7);
    expect(bot().position.x).toBeGreaterThan(-5);
  });

  it('works on a rail', () => {
    const s = setup({ route: { ...ON, follow: 'rail', railCorner: 0 } });
    let best = Infinity;
    for (let t = 0; t < 900; t++) {
      s.step();
      best = Math.min(best, dist(s.ent('bot').position, v(6, 8)));
    }
    expect(best).toBeLessThan(1.5);
    expect(s.ent('bot').position.x).toBeGreaterThan(-5);
  });
});

describe('route-follow: ports with the option', () => {
  const def = () => getNodeDef('route-follow')!;

  it('off: the default card has the same ports and size as before', () => {
    expect(activeInputs(def(), {}).map((p) => p.id)).toEqual(['self', 'on', 'stop', 'go']);
    const node: GraphNode = { id: 'r', kind: 'route-follow', params: {}, pos: { x: 0, y: 0 } };
    const size = estimateNodeSize(node);
    // 40 header + 26 per row (4 inputs + 9 outputs) + 8, width from the longest label "Đang bị chặn" / title.
    expect(size.h).toBe(40 + 13 * 26 + 8);
    expect(estimateNodeSize({ ...node, params: { pointsFrom: 'objects' } }).h).toBe(40 + (13 + 4) * 26 + 8);
  });

  it('on: one object input per point, capped at 8', () => {
    const ids = (params: Params) => activeInputs(def(), params).map((p) => p.id).slice(4);
    expect(ids({ pointsFrom: 'objects' })).toEqual(['obj1', 'obj2', 'obj3', 'obj4']);
    expect(ids({ pointsFrom: 'objects', count: 2 })).toEqual(['obj1', 'obj2']);
    expect(ids({ pointsFrom: 'objects', count: 32 })).toHaveLength(8);
    expect(activeInputs(def(), { pointsFrom: 'objects' }).find((p) => p.id === 'obj1')?.label).toBe('Điểm 1');
    expect(activeInputs(def(), { pointsFrom: 'objects' }).every((p) => p.labelEn)).toBe(true);
  });

  it('a saved wire on an object input loads whether the option is on or off, and keeps its place', () => {
    for (const params of [{ pointsFrom: 'objects' }, {}] as Params[]) {
      const s = setup({ route: params });
      const text = serializeBoard({ name: 'x', mode: '3d', graph: s.graph });
      const back = parseBoard(text);
      expect(back.ok).toBe(true);
      if (back.ok) expect(back.board.graph.wires.some((w) => w.to.port === 'obj1')).toBe(true);
    }
    expect(knownInputs(def()).filter((p) => p.id.startsWith('obj'))).toHaveLength(8);
  });

  it('rejects wires to an object input that does not exist, and to an object input from a number', () => {
    const s = setup({ route: ON });
    const g = { ...s.graph, wires: s.graph.wires.filter((w) => w.to.port !== 'obj1') };
    expect(canConnect(g, { node: 'a', port: 'self' }, { node: 'route', port: 'obj1' }).ok).toBe(true);
    expect(canConnect(g, { node: 'a', port: 'self' }, { node: 'route', port: 'obj9' }).ok).toBe(false);
    expect(canConnect(g, { node: 'a', port: 'usedOn' }, { node: 'route', port: 'obj1' }).ok).toBe(false);
  });
});
