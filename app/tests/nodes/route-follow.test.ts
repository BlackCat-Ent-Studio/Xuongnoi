import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntityView, type Graph, type GraphNode, type Params, type Runtime, type Vec3, type ViewMode, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { routeFollowNode } from '../../src/nodes/route-follow';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx, makeWorld } from './fake-world';
import { wireStarts } from '../helpers/wire-starts';

beforeAll(() => registerAllNodes());

const v = (x: number, z: number, y = 0.4): Vec3 => ({ x, y, z });
type NodeSpec = [id: string, kind: string, params?: Params];
type WireSpec = [from: string, fromPort: string, to: string, toPort: string];

interface Sim {
  world: World;
  rt: Runtime;
  /** Steps n ticks; `keys` held down during them. Returns the per-tick values of the given route outputs. */
  step(n: number, keys?: string[]): void;
  entity(ownerId: string): EntityView;
  out(node: string, port: string): unknown;
  /** Values of `index` at every tick where `reached` pulsed, since the last call. */
  reachedLog(): number[];
}

function sim(mode: ViewMode, nodes: NodeSpec[], wires: WireSpec[]): Sim {
  const graph: Graph = {
    nodes: nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
    wires: wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world = createWorld(mode);
  const rt = createRuntime(wireStarts(graph, mode), world, mode);
  let log: number[] = [];
  return {
    world,
    rt,
    step(n, keys = []) {
      for (let i = 0; i < n; i++) {
        rt.tick({ keysDown: new Set(keys) });
        world.step(TICK_DT);
        if (rt.getOutput('route', 'reached') === true) log.push(rt.getOutput('route', 'index') as number);
      }
    },
    entity: (id) => world.entities().find((e) => e.ownerNodeId === id)!,
    out: (node, port) => rt.getOutput(node, port),
    reachedLog() {
      const r = log;
      log = [];
      return r;
    },
  };
}

const floor: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: 200 }, color: '#888' }];
const carNode = (id: string, x: number, z: number, extra: Params = {}): NodeSpec => [
  id,
  'vehicle',
  { position: v(x, z), model: 'car', maxSpeed: 9, accel: 10, control: 'auto', ...extra },
];
const routeNode = (extra: Params = {}): NodeSpec => ['route', 'route-follow', extra];
const square = (r: number): Params => ({
  count: 4,
  p1: v(-r, -r),
  p2: v(r, -r),
  p3: v(r, r),
  p4: v(-r, r),
});
const attach: WireSpec[] = [['car', 'self', 'route', 'self']];

describe('route-follow node: driving a driverless vehicle', () => {
  it('loops through the points in order, forever', () => {
    const s = sim('2d-top', [floor, carNode('car', -6, -6), routeNode({ ...square(6), speed: 6 })], attach);
    s.step(60 * 40);
    const log = s.reachedLog();
    // Starts on point 1, so the first pulse heads for 2; then 3, 4, 1, 2...
    expect(log.slice(0, 9)).toEqual([2, 3, 4, 1, 2, 3, 4, 1, 2]);
    expect(log.length).toBeGreaterThan(8);
  });

  it('ping-pong turns around at the ends instead of wrapping', () => {
    const s = sim(
      '2d-top',
      [floor, carNode('car', -8, 0), routeNode({ count: 3, p1: v(-8, 0), p2: v(0, 0), p3: v(8, 0), style: 'pingpong', speed: 7 })],
      attach,
    );
    s.step(60 * 30);
    const log = s.reachedLog();
    expect(log.slice(0, 7)).toEqual([2, 3, 2, 1, 2, 3, 2]);
  });

  it('works for a throttle-steered car (wheel and gas)', () => {
    const s = sim('2d-top', [floor, carNode('car', -6, -6, { steerMode: 'throttle' }), routeNode({ ...square(6), speed: 5 })], attach);
    s.step(60 * 40);
    expect(s.reachedLog().slice(0, 5)).toEqual([2, 3, 4, 1, 2]);
  });

  it('works in the side view and in 3D', () => {
    const side = sim('2d-side', [floor, carNode('car', -8, 0), routeNode({ count: 2, p1: v(-8, 0), p2: v(8, 0), style: 'pingpong', speed: 7 })], attach);
    side.step(60 * 12);
    expect(side.reachedLog().slice(0, 3)).toEqual([2, 1, 2]);
    const d3 = sim('3d', [floor, carNode('car', -6, -6), routeNode({ ...square(6), speed: 6 })], attach);
    d3.step(60 * 25);
    expect(d3.reachedLog().slice(0, 4)).toEqual([2, 3, 4, 1]);
  });

  it('reports the point it is heading to as "Điểm hiện tại"', () => {
    const s = sim('2d-top', [floor, carNode('car', -6, -6), routeNode({ ...square(6) })], attach);
    s.step(2);
    expect(s.out('route', 'index')).toBe(2);
  });

  it('stops behind a parked truck without touching it, and says it is blocked', () => {
    const s = sim(
      '2d-top',
      [
        floor,
        carNode('car', -12, 0),
        ['truck', 'vehicle', { position: v(2, 0, 0.6), model: 'truck', control: 'driver' }],
        routeNode({ count: 2, p1: v(-12, 0), p2: v(12, 0), style: 'pingpong', speed: 8 }),
      ],
      attach,
    );
    s.step(60 * 10);
    const car = s.entity('car');
    const truck = s.entity('truck');
    expect(s.out('route', 'blocked')).toBe(true);
    expect(car.vehicle!.speed).toBe(0);
    expect(car.vehicle!.hitSeq ?? 0).toBe(0);
    const gap = truck.position.x - truck.size.x / 2 - (car.position.x + car.size.x / 2);
    expect(gap).toBeGreaterThan(0.1);
    expect(gap).toBeLessThanOrEqual(2.5);
    expect(truck.position.x).toBeCloseTo(2, 6); // untouched
  });

  it('keeps going when the look-ahead is switched off (0) and the crash is then reported', () => {
    const s = sim(
      '2d-top',
      [
        floor,
        carNode('car', -12, 0),
        ['truck', 'vehicle', { position: v(2, 0, 0.6), model: 'truck', control: 'driver' }],
        routeNode({ count: 2, p1: v(-12, 0), p2: v(12, 0), style: 'pingpong', speed: 8, lookAhead: 0 }),
      ],
      attach,
    );
    s.step(60 * 6);
    expect(s.entity('car').vehicle!.hitSeq).toBeGreaterThanOrEqual(1);
    expect(s.out('route', 'blocked')).toBe(false);
  });

  it('resumes when the obstacle leaves', () => {
    const s = sim(
      '2d-top',
      [
        floor,
        carNode('car', -12, 0),
        ['truck', 'vehicle', { position: v(0, 0, 0.6), model: 'truck', control: 'driver' }],
        routeNode({ count: 2, p1: v(-12, 0), p2: v(12, 0), style: 'pingpong', speed: 8 }),
      ],
      attach,
    );
    s.step(60 * 6);
    const stuckAt = s.entity('car').position.x;
    s.world.hide(s.entity('truck').id);
    s.step(60);
    expect(s.entity('car').position.x).toBeGreaterThan(stuckAt + 3);
  });

  it('the Dừng input holds the vehicle (a red light) and releasing it resumes', () => {
    const s = sim(
      '2d-top',
      [
        floor,
        carNode('car', -12, 0),
        ['light', 'key', { key: 'KeyR' }],
        routeNode({ count: 2, p1: v(-12, 0), p2: v(12, 0), style: 'pingpong', speed: 8, lookAhead: 0 }),
      ],
      [...attach, ['light', 'held', 'route', 'stop']],
    );
    s.step(60 * 2);
    const moving = s.entity('car').position.x;
    expect(moving).toBeGreaterThan(-10);
    s.step(60 * 3, ['KeyR']);
    const parked = s.entity('car').position.x;
    expect(s.entity('car').vehicle!.speed).toBe(0);
    s.step(60, ['KeyR']);
    expect(s.entity('car').position.x).toBeCloseTo(parked, 6);
    s.step(60 * 2);
    expect(s.entity('car').position.x).toBeGreaterThan(parked + 3);
  });

  it('the Bật input off leaves the vehicle alone', () => {
    const s = sim(
      '2d-top',
      [floor, carNode('car', -12, 0), ['sw', 'key', { key: 'KeyO' }], routeNode({ count: 2, p1: v(-12, 0), p2: v(12, 0) })],
      [...attach, ['sw', 'held', 'route', 'on']],
    );
    s.step(120);
    expect(s.entity('car').position.x).toBeCloseTo(-12, 6);
    s.step(120, ['KeyO']);
    expect(s.entity('car').position.x).toBeGreaterThan(-10);
  });
});

describe('route-follow node: a vehicle crash can stall a car with its own Dừng', () => {
  it('"Vừa va chạm" pulses once and "Va với" names the other car', () => {
    const s = sim(
      '2d-top',
      [
        floor,
        carNode('car', -12, 0),
        ['truck', 'vehicle', { position: v(2, 0, 0.6), model: 'truck', control: 'driver' }],
        routeNode({ count: 2, p1: v(-12, 0), p2: v(12, 0), style: 'pingpong', speed: 8, lookAhead: 0 }),
      ],
      attach,
    );
    let pulses = 0;
    for (let i = 0; i < 60 * 6; i++) {
      s.step(1);
      if (s.out('car', 'crashed') === true) pulses++;
    }
    expect(pulses).toBe(1);
    expect(s.out('car', 'crashedWith')).toBe(s.entity('truck').id);
  });

  it('wiring the crash into the vehicle Dừng input through a latch-like hold stops it', () => {
    const s = sim(
      '2d-top',
      [floor, carNode('car', -12, 0), ['k', 'key', { key: 'KeyS' }], routeNode({ count: 2, p1: v(-12, 0), p2: v(12, 0), speed: 8 })],
      [...attach, ['k', 'held', 'car', 'stop']],
    );
    s.step(60);
    expect(s.entity('car').vehicle!.speed).toBeGreaterThan(1);
    s.step(120, ['KeyS']);
    expect(s.entity('car').vehicle!.speed).toBe(0);
  });
});

describe('route-follow node: a character on foot', () => {
  it('walks the points like go-to when its outputs drive the character', () => {
    const s = sim(
      '2d-top',
      [
        floor,
        ['hero', 'character', { position: v(-4, -4, 0.5), speed: 5, role: 'bot' }],
        ['route', 'route-follow', { count: 2, p1: v(-4, -4, 0.5), p2: v(4, -4, 0.5), style: 'pingpong', speed: 5, lookAhead: 0 }],
      ],
      [
        ['hero', 'self', 'route', 'self'],
        ['route', 'moveX', 'hero', 'moveX'],
        ['route', 'moveY', 'hero', 'moveY'],
      ],
    );
    s.step(60 * 6);
    const log = s.reachedLog();
    expect(log.slice(0, 3)).toEqual([2, 1, 2]);
  });

  it('stops for a car in front', () => {
    const s = sim(
      '2d-top',
      [
        floor,
        ['hero', 'character', { position: v(-4, 0, 0.5), speed: 5, role: 'bot' }],
        ['car', 'vehicle', { position: v(0, 0), control: 'driver' }],
        ['route', 'route-follow', { count: 2, p1: v(-4, 0, 0.5), p2: v(8, 0, 0.5), speed: 5, lookAhead: 2 }],
      ],
      [
        ['hero', 'self', 'route', 'self'],
        ['route', 'moveX', 'hero', 'moveX'],
        ['route', 'moveY', 'hero', 'moveY'],
      ],
    );
    s.step(60 * 5);
    expect(s.out('route', 'blocked')).toBe(true);
    expect(s.entity('hero').position.x).toBeLessThan(s.entity('car').position.x - 1);
  });
});

describe('route-follow node: unit behaviour', () => {
  it('is idle without a valid "Ai"', () => {
    const w = makeWorld();
    const params = defaultParams(routeFollowNode);
    const state = routeFollowNode.create!(makeCtx(w), params);
    expect(routeFollowNode.evaluate(makeCtx(w), {}, params, state)).toMatchObject({ moveX: 0, moveY: 0, blocked: false, reached: false });
    expect(routeFollowNode.evaluate(makeCtx(w), { self: 'ghost' }, params, state)).toMatchObject({ reached: false, index: 0 });
  });

  it('clamps the point count to 2..8', () => {
    const w = makeWorld();
    const calls: number[] = [];
    w.entities.set('c', { id: 'c', kind: 'vehicle', ownerNodeId: 'x', position: v(0, 0), size: { x: 1.5, y: 0.8, z: 1.5 }, color: '#f00', visible: true, vehicle: { model: 'car', speed: 0, wheelSpin: 0, heading: 0, driver: null }, drive: { speed: 9, jumpPower: 0 } });
    w.setVehicleInput = (_id, x) => void calls.push(x);
    for (const count of [1, 99]) {
      const params = defaultParams(routeFollowNode, { count, p1: v(10, 0), p2: v(10, 0), p3: v(-10, 0), p4: v(-10, 0) });
      const state = routeFollowNode.create!(makeCtx(w), params);
      const out = routeFollowNode.evaluate(makeCtx(w), { self: 'c', on: true }, params, state);
      expect(out.index).toBeGreaterThanOrEqual(1);
      expect(out.index).toBeLessThanOrEqual(8);
    }
    expect(calls.length).toBe(2);
  });
});
