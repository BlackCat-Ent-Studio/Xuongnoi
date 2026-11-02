import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import {
  TICK_DT,
  type EntityId,
  type EntitySpec,
  type Graph,
  type GraphNode,
  type InputSnapshot,
  type Params,
  type Vec3,
  type ViewMode,
} from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { vehicleSize } from '../../src/world/vehicles';
import { createWorld } from '../../src/world/world';

beforeAll(() => registerAllNodes());

const v = (x: number, y: number, z = 0): Vec3 => ({ x, y, z });
type NodeSpec = [id: string, kind: string, params?: Params];
type WireSpec = [from: string, fromPort: string, to: string, toPort: string];

function sim(mode: ViewMode, nodes: NodeSpec[], wires: WireSpec[] = []) {
  const graph: Graph = {
    nodes: nodes.map(([id, kind, params]): GraphNode => ({ id, kind, params: params ?? {}, pos: { x: 0, y: 0 } })),
    wires: wires.map(([fn, fp, tn, tp], i) => ({ id: `w${i}`, from: { node: fn, port: fp }, to: { node: tn, port: tp } })),
  };
  const world = createWorld(mode);
  const rt = createRuntime(graph, world, mode);
  return {
    world,
    step(n = 1, keys: string[] = []) {
      const input: InputSnapshot = { keysDown: new Set(keys) };
      for (let i = 0; i < n; i++) {
        rt.tick(input);
        world.step(TICK_DT);
      }
    },
    view: (owner: string) => world.entities().find((e) => e.ownerNodeId === owner)!,
  };
}

const floor3: NodeSpec = ['floor', 'block', { position: v(0, -0.5), size: v(60, 1, 60), color: '#0a0' }];
const floor2: NodeSpec = ['floor', 'block', { position: v(0, -0.5), size: v(60, 1, 1), color: '#0a0' }];
/** A 6 x 1 x 2 belt whose top is at y = 1. */
const belt = (over: Params = {}): NodeSpec => ['belt', 'block', { position: v(0, 0.5), size: v(6, 1, 2), color: '#888', beltSpeed: 2, ...over }];

const crate = (world: ReturnType<typeof createWorld>, x: number, y: number, z = 0): EntityId =>
  world.spawn({ kind: 'item', ownerNodeId: 'crate', position: v(x, y, z), size: v(0.5, 0.5, 0.5), color: '#c80', solid: false, carryable: false });
const walker = (world: ReturnType<typeof createWorld>, x: number, y: number, z = 0): EntityId =>
  world.spawn({ kind: 'character', ownerNodeId: 'hero', position: v(x, y, z), size: v(0.6, 1, 0.6), color: '#00f', solid: true });
const pos = (world: ReturnType<typeof createWorld>, id: EntityId) => world.getEntity(id)!.position;

describe('conveyor surface', () => {
  it.each<ViewMode>(['2d-side', '3d'])('carries an item at belt speed (%s)', (mode) => {
    const g = sim(mode, [mode === '3d' ? floor3 : floor2, belt()]);
    const c = crate(g.world, -2, 1.3);
    g.step(60);
    expect(pos(g.world, c).x).toBeCloseTo(0, 1); // 2 units/s for one second
    expect(pos(g.world, c).y).toBeCloseTo(1.25, 2);
  });

  it('runs along z and honours a negative direction', () => {
    const g = sim('3d', [floor3, belt({ size: v(2, 1, 6), beltDir: '-z' })]);
    const c = crate(g.world, 0, 1.3, 0);
    g.step(60);
    expect(pos(g.world, c).z).toBeCloseTo(-2, 1);
    expect(pos(g.world, c).x).toBeCloseTo(0, 2);
  });

  it('carries a standing character on top of its own walking', () => {
    const g = sim('3d', [floor3, belt({ beltWalls: 'no' })]);
    const h = walker(g.world, -2, 1.55);
    g.step(60);
    expect(pos(g.world, h).x).toBeCloseTo(0, 1);
    g.world.setCharacterIntent(h, { moveX: 1, moveY: 0, jump: false, speed: 1, jumpPower: 0 });
    const x0 = pos(g.world, h).x;
    g.step(30);
    expect(pos(g.world, h).x - x0).toBeCloseTo(0.5 + 1, 1); // walk 1 u/s + belt 2 u/s for half a second
  });

  it('carries a resting vehicle', () => {
    const g = sim('3d', [floor3, belt({ size: v(12, 1, 6), position: v(0, 0.5, 0) })]);
    const size = vehicleSize('car');
    const car = g.world.spawn({
      kind: 'vehicle', ownerNodeId: 'car', position: v(-4, 1 + size.y / 2, 0), size, color: '#f00', solid: true,
      vehicle: { model: 'car', steerMode: 'direction', maxSpeed: 8, accel: 8 },
    });
    g.step(60);
    expect(pos(g.world, car).x).toBeCloseTo(-2, 1);
  });

  it('reverses with Đảo chiều and stops with Chạy băng chuyền off', () => {
    const g = sim('2d-side', [floor2, belt(), ['kr', 'key', { key: 'KeyR' }], ['kg', 'key', { key: 'KeyG' }]], [
      ['kr', 'held', 'belt', 'reverse'],
      ['kg', 'held', 'belt', 'run'],
    ]);
    const c = crate(g.world, 0, 1.3);
    g.step(30); // run is wired but not held: stopped
    expect(pos(g.world, c).x).toBeCloseTo(0, 3);
    g.step(30, ['KeyG']);
    expect(pos(g.world, c).x).toBeCloseTo(1, 1);
    g.step(30, ['KeyG', 'KeyR']);
    expect(pos(g.world, c).x).toBeCloseTo(0, 1);
  });

  it('does nothing while hidden and again after Hiện lại (1 nhịp)', () => {
    const g = sim('2d-side', [floor2, belt(), ['kh', 'key', { key: 'KeyH' }], ['ks', 'key', { key: 'KeyS' }]], [
      ['kh', 'pressed', 'belt', 'hide'],
      ['ks', 'pressed', 'belt', 'show'],
    ]);
    const c = crate(g.world, 0, 1.3);
    g.step(1, ['KeyH']);
    g.step(1);
    const x = pos(g.world, c).x;
    g.step(30);
    expect(pos(g.world, c).y).toBeLessThan(1); // fell: the belt is gone
    expect(pos(g.world, c).x).toBeCloseTo(x, 2);
  });

  it('carries a body lying on a floor-strip belt in the top-down view', () => {
    const g = sim('2d-top', [
      ['belt', 'block', { position: v(0, 0, 0), size: v(6, 1, 2), color: '#888', type: 'pickup', beltSpeed: 2, beltDir: 'z' }],
    ]);
    const c = crate(g.world, 0, 0, 0);
    g.step(30);
    expect(pos(g.world, c).z).toBeCloseTo(1, 1);
  });

  it('does not push a body into a solid', () => {
    const g = sim('3d', [floor3, belt({ beltWalls: 'no' }), ['stop', 'block', { position: v(-0.5 + 3.4, 1.5), size: v(0.8, 1, 2), color: '#444' }]]);
    const c = crate(g.world, 2.3, 1.3);
    g.step(120);
    expect(pos(g.world, c).x).toBeLessThanOrEqual(2.9 - 0.25 + 1e-3);
  });
});

describe('belt style', () => {
  it('runs at speed 2 along the longer side when the speed is left at 0', () => {
    const g = sim('3d', [floor3, ['belt', 'block', { position: v(0, 0.5), size: v(2, 1, 6), color: '#888', style: 'conveyor', beltWalls: 'no' }]]);
    const c = crate(g.world, 0, 1.3, -2);
    g.step(60);
    expect(pos(g.world, c).z).toBeCloseTo(0, 1);
    expect(g.view('belt').belt).toMatchObject({ axis: 'z', speed: 2 });
  });

  it('reports a scroll phase that follows the live speed and direction', () => {
    const g = sim('3d', [floor3, ['belt', 'block', { position: v(0, 0.5), size: v(6, 1, 2), color: '#888', style: 'conveyor' }], ['kr', 'key', { key: 'KeyR' }]], [
      ['kr', 'held', 'belt', 'reverse'],
    ]);
    g.step(60);
    const fwd = g.view('belt').belt!.phase;
    expect(fwd).toBeCloseTo(2, 1);
    g.step(60, ['KeyR']);
    expect(g.view('belt').belt!.phase).toBeCloseTo(0, 1);
  });

  it('has real side walls that keep a walker on the belt', () => {
    const run = (walls: string): number => {
      const g = sim('3d', [floor3, ['belt', 'block', { position: v(0, 0.5), size: v(6, 1, 2), color: '#888', style: 'conveyor', beltWalls: walls }]]);
      const h = walker(g.world, 0, 1.55, 0);
      g.world.setCharacterIntent(h, { moveX: 0, moveY: 1, jump: false, speed: 3, jumpPower: 0 }); // forward = -z
      g.step(60);
      return pos(g.world, h).z;
    };
    expect(run('yes')).toBeGreaterThan(-1);
    expect(run('no')).toBeLessThan(-1.2);
  });

  it('walls hide with the belt and the 2d-side belt gets none', () => {
    const g = sim('3d', [floor3, ['belt', 'block', { position: v(0, 0.5), size: v(6, 1, 2), color: '#888', style: 'conveyor' }]]);
    const before = g.world.entities().filter((e) => e.ownerNodeId === 'belt');
    expect(before).toHaveLength(3);
    const side = sim('2d-side', [floor2, ['belt', 'block', { position: v(0, 0.5), size: v(6, 1, 1), color: '#888', style: 'conveyor' }]]);
    expect(side.world.entities().filter((e) => e.ownerNodeId === 'belt')).toHaveLength(1);
  });

  it('a decorative rail changes nothing but the picture', () => {
    const g = sim('3d', [floor3, ['rail', 'block', { position: v(0, 0.5), size: v(6, 1, 2), color: '#888', style: 'rail' }]]);
    const c = crate(g.world, 0, 1.3);
    g.step(60);
    expect(pos(g.world, c).x).toBeCloseTo(0, 3);
    expect(g.view('rail').belt).toBeUndefined();
    expect(g.world.entities().filter((e) => e.ownerNodeId === 'rail')).toHaveLength(1);
  });
});

describe('defaults stay as before', () => {
  it('a plain block is no belt and carries nothing', () => {
    const g = sim('3d', [floor3, ['b', 'block', { position: v(0, 0.5), size: v(6, 1, 2), color: '#888' }]]);
    const c = crate(g.world, 0, 1.3);
    g.step(60);
    expect(pos(g.world, c).x).toBeCloseTo(0, 3);
    expect(g.view('b').belt).toBeUndefined();
    expect(g.world.entities()).toHaveLength(3);
  });
});

describe('riding on vehicles', () => {
  const spawnCar = (world: ReturnType<typeof createWorld>, steerMode: 'direction', over: Partial<EntitySpec> = {}): EntityId => {
    const size = vehicleSize('car');
    return world.spawn({
      kind: 'vehicle', ownerNodeId: 'car', position: v(0, size.y / 2, 0), size, color: '#f00', solid: true,
      vehicle: { model: 'car', steerMode, maxSpeed: 8, accel: 8 },
      ...over,
    });
  };

  it.each<ViewMode>(['2d-side', '3d'])('a character standing on a driving vehicle is carried along (%s)', (mode) => {
    const world = createWorld(mode);
    world.spawn({ kind: 'block', ownerNodeId: 'floor', position: v(0, -0.5), size: v(200, 1, mode === '3d' ? 200 : 1), color: '#888', solid: true });
    const car = spawnCar(world, 'direction');
    const top = vehicleSize('car').y;
    const h = walker(world, 0, top + 0.5);
    for (let i = 0; i < 90; i++) {
      world.setVehicleInput(car, 1, 0);
      world.step(TICK_DT);
    }
    const c = pos(world, car);
    expect(c.x).toBeGreaterThan(3);
    expect(Math.abs(pos(world, h).x - c.x)).toBeLessThan(0.3);
    expect(pos(world, h).y).toBeCloseTo(top + 0.5, 1);
  });

  it('turns the rider with the vehicle', () => {
    const world = createWorld('3d');
    world.spawn({ kind: 'block', ownerNodeId: 'floor', position: v(0, -0.5), size: v(200, 1, 200), color: '#888', solid: true });
    const car = spawnCar(world, 'direction');
    const top = vehicleSize('car').y;
    for (let i = 0; i < 30; i++) {
      world.setVehicleInput(car, 1, 0);
      world.step(TICK_DT);
    }
    const c0 = pos(world, car);
    const h = walker(world, c0.x + 0.5, top + 0.5, c0.z);
    for (let i = 0; i < 120; i++) {
      world.setVehicleInput(car, 0, 1); // steer north (-z)
      world.step(TICK_DT);
    }
    const c = pos(world, car);
    const r = pos(world, h);
    expect(c.z).toBeLessThan(-3);
    expect(Math.hypot(r.x - c.x, r.z - c.z)).toBeLessThan(1);
    expect(r.y).toBeCloseTo(top + 0.5, 1);
  });

  it('leaves a bystander next to the vehicle alone', () => {
    const world = createWorld('3d');
    world.spawn({ kind: 'block', ownerNodeId: 'floor', position: v(0, -0.5), size: v(200, 1, 200), color: '#888', solid: true });
    const car = spawnCar(world, 'direction');
    const bystander = walker(world, 0, 3.5, 5);
    for (let i = 0; i < 60; i++) {
      world.setVehicleInput(car, 1, 0);
      world.step(TICK_DT);
    }
    expect(pos(world, bystander).x).toBeCloseTo(0, 3);
  });
});
