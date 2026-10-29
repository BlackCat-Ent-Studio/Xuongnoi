import { beforeAll, describe, expect, it } from 'vitest';
import { createRuntime } from '../../src/engine/runtime';
import { TICK_DT, type EntityId, type Graph, type Params, type VehicleSpec, type ViewMode, type World } from '../../src/engine/types';
import { registerAllNodes } from '../../src/nodes';
import { cargoNode } from '../../src/nodes/cargo';
import { vehicleNode } from '../../src/nodes/vehicle';
import { vehicleSize } from '../../src/world/vehicles';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx, makeWorld } from '../nodes/fake-world';

beforeAll(() => registerAllNodes());

function floor(w: World): void {
  w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 400, y: 1, z: w.mode === '2d-side' ? 1 : 400 }, color: '#888', solid: true });
}
function car(w: World, x: number, z: number, over: Partial<VehicleSpec> = {}): EntityId {
  return w.spawn({
    kind: 'vehicle',
    ownerNodeId: `car${x}`,
    position: { x, y: vehicleSize('car').y / 2, z },
    size: vehicleSize('car'),
    color: '#f00',
    solid: true,
    vehicle: { model: 'car', steerMode: 'throttle', maxSpeed: 8, accel: 8, ...over },
  });
}
function run(w: World, ticks: number, each?: () => void): void {
  for (let i = 0; i < ticks; i++) {
    each?.();
    w.step(TICK_DT);
  }
}
const speedOf = (w: World, id: EntityId): number => w.getEntity(id)!.vehicle!.speed;

describe('vehicle handling params', () => {
  /** Speed left a short while after the stick is released from full speed. */
  function speedAfterBrake(over: Partial<VehicleSpec>): number {
    const w = createWorld('2d-top');
    floor(w);
    const id = car(w, 0, 0, over);
    run(w, 60, () => w.setVehicleInput(id, 0, 1));
    run(w, 6, () => w.setVehicleInput(id, 0, 0));
    return speedOf(w, id);
  }

  it('brake factor: weaker brakes leave more speed; the default matches an unset value', () => {
    expect(speedAfterBrake({ brakeFactor: 0.5 })).toBeGreaterThan(speedAfterBrake({}));
    expect(speedAfterBrake({ brakeFactor: 2 })).toBe(speedAfterBrake({}));
    expect(speedAfterBrake({ brakeFactor: 6 })).toBeLessThan(speedAfterBrake({}));
  });

  function reverseSpeed(over: Partial<VehicleSpec>): number {
    const w = createWorld('2d-top');
    floor(w);
    const id = car(w, 0, 0, over);
    run(w, 90, () => w.setVehicleInput(id, 0, -1));
    return speedOf(w, id);
  }

  it('reverse share: scales the top reverse speed (default 0.4)', () => {
    expect(reverseSpeed({})).toBeCloseTo(-8 * 0.4, 5);
    expect(reverseSpeed({ reverseShare: 0.4 })).toBe(reverseSpeed({}));
    expect(reverseSpeed({ reverseShare: 0.8 })).toBeCloseTo(-8 * 0.8, 5);
  });

  /** Rear-end: a drives into the parked b. Returns crash count seen by b and how far b was shoved. */
  function rearEnd(over: Partial<VehicleSpec>): { hits: number; shoved: number } {
    const w = createWorld('2d-top');
    floor(w);
    const a = car(w, -10, 0, { steerMode: 'direction', ...over });
    const b = car(w, 0, 0, { steerMode: 'direction' });
    run(w, 240, () => w.setVehicleInput(a, 1, 0));
    const view = w.getEntity(b)!;
    return { hits: view.vehicle!.hitSeq ?? 0, shoved: view.position.x };
  }

  it('crash speed: a high threshold turns the same bump into a nudge; default unchanged', () => {
    expect(rearEnd({}).hits).toBeGreaterThanOrEqual(1);
    expect(rearEnd({ crashSpeed: 1.5 })).toEqual(rearEnd({}));
    expect(rearEnd({ crashSpeed: 50 }).hits).toBe(0);
  });

  it('shove share: 0 leaves the parked vehicle in place, a larger share pushes it further', () => {
    const base = rearEnd({});
    expect(base.shoved).toBeGreaterThan(0.05);
    expect(rearEnd({ shoveShare: 0.25 })).toEqual(base);
    expect(rearEnd({ shoveShare: 0 }).shoved).toBeCloseTo(0, 5);
    expect(rearEnd({ shoveShare: 0.8 }).shoved).toBeGreaterThan(base.shoved);
  });

  it('vehicle node: defaults spawn the plain spec, changed values land in the spec', () => {
    const w = makeWorld();
    vehicleNode.create!(makeCtx(w), defaultParams(vehicleNode));
    expect(w.spawned[0]!.vehicle).toEqual({ model: 'car', steerMode: 'direction', maxSpeed: 9, accel: 8 });
    vehicleNode.create!(makeCtx(w), defaultParams(vehicleNode, { brake: 4, reverseShare: 0.7, crashSpeed: 3, shove: 0 }));
    expect(w.spawned[1]!.vehicle).toMatchObject({ brakeFactor: 4, reverseShare: 0.7, crashSpeed: 3, shoveShare: 0 });
    for (const id of ['brake', 'reverseShare', 'crashSpeed', 'shove']) {
      expect(vehicleNode.params.find((p) => p.id === id)!.advanced).toBe(true);
    }
  });
});

describe('cargo layout params', () => {
  function truckWithCrates(mode: ViewMode, count: number): { w: World; truck: EntityId; crates: EntityId[] } {
    const w = createWorld(mode);
    floor(w);
    const truck = w.spawn({
      kind: 'vehicle',
      ownerNodeId: 'truck',
      position: { x: 0, y: vehicleSize('truck').y / 2, z: 0 },
      size: vehicleSize('truck'),
      color: '#f00',
      solid: true,
      vehicle: { model: 'truck', steerMode: 'direction', maxSpeed: 8, accel: 8 },
    });
    const crates: EntityId[] = [];
    for (let i = 0; i < count; i++) {
      crates.push(w.spawn({ kind: 'item', ownerNodeId: `c${i}`, position: { x: 1.5 + i * 0.1, y: 0.25, z: 0 }, size: { x: 0.5, y: 0.5, z: 0.5 }, color: '#a60', solid: false }));
    }
    return { w, truck, crates };
  }
  function loaded(count: number, layout?: { cellsPerLayer?: number }) {
    const rig = truckWithCrates('3d', count);
    for (let i = 0; i < count; i++) expect(rig.w.loadCargo(rig.truck, 5, 12, '', layout)).not.toBeNull();
    rig.w.step(TICK_DT);
    return rig.crates.map((id) => rig.w.getEntity(id)!.position);
  }
  const distinctSpots = (ps: { x: number; z: number }[]): number => new Set(ps.map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`)).size;

  it('cells per layer: 1 stacks in one spot, 2 uses two spots, 4 (default) four, 6 six', () => {
    expect(distinctSpots(loaded(6, { cellsPerLayer: 1 }))).toBe(1);
    expect(distinctSpots(loaded(6, { cellsPerLayer: 2 }))).toBe(2);
    expect(distinctSpots(loaded(6, { cellsPerLayer: 4 }))).toBe(4);
    expect(distinctSpots(loaded(6, { cellsPerLayer: 6 }))).toBe(6);
    expect(loaded(6, { cellsPerLayer: 4 })).toEqual(loaded(6));
  });

  it('cells per layer: a value outside the allowed set falls back to the default grid', () => {
    expect(loaded(6, { cellsPerLayer: 5 })).toEqual(loaded(6));
    expect(loaded(6, { cellsPerLayer: Number.NaN })).toEqual(loaded(6));
  });

  function unloadDistance(layout?: { unloadGap?: number }): number {
    const { w, truck, crates } = truckWithCrates('2d-top', 1);
    expect(w.loadCargo(truck, 5, 4)).not.toBeNull();
    expect(w.unloadCargo(truck, '', layout)).toBe(crates[0]);
    const p = w.getEntity(crates[0]!)!.position;
    return Math.hypot(p.x, p.z);
  }

  it('unload gap: the crate lands further out by exactly the extra gap; default is 0.1', () => {
    const base = unloadDistance();
    expect(unloadDistance({ unloadGap: 0.1 })).toBeCloseTo(base, 9);
    expect(unloadDistance({ unloadGap: 1.1 })).toBeCloseTo(base + 1, 9);
    expect(unloadDistance({ unloadGap: -5 })).toBeCloseTo(base - 0.1, 9);
  });

  it('cargo node passes the params to the world', () => {
    const { w, truck, crates } = truckWithCrates('2d-top', 2);
    const params = defaultParams(cargoNode, { cellsPerLayer: '1', unloadGap: 0.5 });
    const state = cargoNode.create!(makeCtx(w), params);
    for (let i = 0; i < 2; i++) {
      cargoNode.evaluate(makeCtx(w), { vehicle: truck, load: true }, params, state);
      cargoNode.evaluate(makeCtx(w), { vehicle: truck, load: false }, params, state);
    }
    w.step(TICK_DT);
    const [a, b] = crates.map((id) => w.getEntity(id)!.position);
    expect(w.cargoOf(truck)).toHaveLength(2);
    expect([a!.x, a!.z]).toEqual([b!.x, b!.z]);
    expect(cargoNode.params.find((p) => p.id === 'cellsPerLayer')!.advanced).toBe(true);
    expect(cargoNode.params.find((p) => p.id === 'unloadGap')!.advanced).toBe(true);
  });
});

describe('route-follow tuning params', () => {
  function rig(extra: Params, carExtra: Params = {}) {
    const graph: Graph = {
      nodes: [
        { id: 'floor', kind: 'block', params: { position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: 200 }, color: '#888' }, pos: { x: 0, y: 0 } },
        { id: 'car', kind: 'vehicle', params: { position: { x: 0, y: 0.4, z: 0 }, model: 'car', control: 'auto', steerMode: 'throttle', ...carExtra }, pos: { x: 0, y: 0 } },
        { id: 'route', kind: 'route-follow', params: { count: 2, speed: 5, lookAhead: 0, ...extra }, pos: { x: 0, y: 0 } },
      ],
      wires: [{ id: 'w0', from: { node: 'car', port: 'self' }, to: { node: 'route', port: 'self' } }],
    };
    const world = createWorld('2d-top');
    const rt = createRuntime(graph, world, '2d-top');
    return { first: () => (rt.tick({ keysDown: new Set() }), world.step(TICK_DT), rt) };
  }

  it('arrive radius: a wider radius reaches a near point at once; 0 equals the vehicle default 1.2', () => {
    const near = { p1: { x: 1.8, y: 0.4, z: 0 }, p2: { x: 40, y: 0.4, z: 0 } };
    const reached = (extra: Params): unknown => rig({ ...near, ...extra }).first().getOutput('route', 'reached');
    expect(reached({})).toBe(false);
    expect(reached({ arriveRadius: 1.2 })).toBe(false);
    expect(reached({ arriveRadius: 2.5 })).toBe(true);
    const close = { p1: { x: 1, y: 0.4, z: 0 }, p2: { x: 40, y: 0.4, z: 0 } };
    expect(rig(close).first().getOutput('route', 'reached')).toBe(true);
    expect(rig({ ...close, arriveRadius: 1.2 }).first().getOutput('route', 'reached')).toBe(true);
    expect(rig({ ...close, arriveRadius: 0.5 }).first().getOutput('route', 'reached')).toBe(false);
  });

  it('steer gain: a softer gain turns the wheel less for the same heading error; 2 equals the default', () => {
    const pts = { p1: { x: 20, y: 0.4, z: 5 }, p2: { x: 60, y: 0.4, z: 60 } };
    const wheel = (extra: Params): number => Math.abs(rig({ ...pts, ...extra }).first().getOutput('route', 'moveX') as number);
    expect(wheel({})).toBeGreaterThan(0);
    expect(wheel({ steerGain: 2 })).toBe(wheel({}));
    expect(wheel({ steerGain: 0.5 })).toBeLessThan(wheel({}));
    expect(wheel({ steerGain: 4 })).toBeGreaterThan(wheel({}));
  });
});
