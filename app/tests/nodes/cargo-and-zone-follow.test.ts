import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type Vec3, type ViewMode, type World } from '../../src/engine/types';
import { cargoNode } from '../../src/nodes/cargo';
import { zoneSensorNode } from '../../src/nodes/zone-sensor';
import { vehicleSize } from '../../src/world/vehicles';
import { createWorld } from '../../src/world/world';
import { defaultParams, makeCtx } from './fake-world';

const MODES: ViewMode[] = ['2d-side', '2d-top', '3d'];

function floor(w: World): void {
  w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: w.mode === '2d-side' ? 1 : 200 }, color: '#888', solid: true });
}
function truck(w: World, x = 0, z = 0): EntityId {
  return w.spawn({
    kind: 'vehicle',
    ownerNodeId: 'truck',
    position: { x, y: vehicleSize('truck').y / 2, z },
    size: vehicleSize('truck'),
    color: '#f00',
    solid: true,
    vehicle: { model: 'truck', steerMode: 'direction', maxSpeed: 8, accel: 8 },
  });
}
function crate(w: World, x: number, z = 0, over: { carryable?: boolean } = {}): EntityId {
  return w.spawn({ kind: 'item', ownerNodeId: 'crate', position: { x, y: 0.25, z }, size: { x: 0.5, y: 0.5, z: 0.5 }, color: '#a60', solid: false, ...over });
}
function person(w: World, x: number, z = 0): EntityId {
  return w.spawn({ kind: 'character', ownerNodeId: 'p', position: { x, y: 0.5, z }, size: { x: 1, y: 1, z: 1 }, color: '#00f', solid: true });
}
function run(w: World, ticks: number, each?: () => void): void {
  for (let i = 0; i < ticks; i++) {
    each?.();
    w.step(TICK_DT);
  }
}

/** Drives one cargo node against a real world; each call is one tick. */
function cargoRig(w: World, vehicle: EntityId, over: Record<string, number> = {}) {
  const params = defaultParams(cargoNode, over);
  const state = cargoNode.create!(makeCtx(w), params);
  let tick = 0;
  return (inputs: { load?: boolean; unload?: boolean; unloadAll?: boolean } = {}) => {
    const out = cargoNode.evaluate(makeCtx(w, { tick: tick++ }), { vehicle, ...inputs }, params, state);
    w.step(TICK_DT);
    return out;
  };
}
/** A press is a rising edge: one tick on, one tick off. */
function press(tick: ReturnType<typeof cargoRig>, key: 'load' | 'unload' | 'unloadAll') {
  const out = tick({ [key]: true });
  tick({});
  return out;
}

describe('zone sensor follow input', () => {
  function zone(w: World, center: Vec3) {
    const params = { center, size: { x: 2, y: 2, z: 2 }, filter: 'item', color: '#22c55e' };
    const state = zoneSensorNode.create!(makeCtx(w), params);
    return (follow?: string | null) => zoneSensorNode.evaluate(makeCtx(w), follow === undefined ? {} : { follow }, params, state);
  }

  it.each(MODES)('moves with the followed entity, centre acting as an offset (%s)', (mode) => {
    const w = createWorld(mode);
    floor(w);
    const t = truck(w, 0);
    const read = zone(w, { x: 0, y: 0.6, z: 0 });
    const far = crate(w, 20);
    expect(read(t).count).toBe(0);
    // Drive the zone's anchor over to the crate.
    w.teleport(t, { x: 20, y: 0.6, z: 0 }, false);
    const out = read(t);
    expect(out.count).toBe(1);
    expect(out.first).toBe(far);
  });

  it('applies the offset on top of the followed position', () => {
    const w = createWorld('3d');
    floor(w);
    const t = truck(w, 0);
    const read = zone(w, { x: 6, y: 0.6, z: 0 });
    const c = crate(w, 6);
    expect(read(null).first).toBe(c); // unwired: fixed centre
    expect(read(t).first).toBe(c); // truck at x=0 + offset 6
    w.teleport(t, { x: 20, y: 0.6, z: 0 }, false);
    expect(read(t).count).toBe(0); // zone now at x=26
    expect(read(null).first).toBe(c); // unwired still at 6
  });

  it('behaves as before when the input is empty or unknown', () => {
    const w = createWorld('3d');
    floor(w);
    const read = zone(w, { x: 3, y: 0.25, z: 0 });
    const c = crate(w, 3);
    expect(read().first).toBe(c);
    expect(read(null).first).toBe(c);
    expect(read('missing').first).toBe(c);
  });
});

describe('cargo node', () => {
  it('has the expected ports', () => {
    expect(cargoNode.inputs.map((p) => p.id)).toEqual(['vehicle', 'load', 'unload', 'unloadAll']);
    expect(cargoNode.outputs.map((p) => p.id)).toEqual(['count', 'loaded', 'unloaded', 'top', 'typeCount']);
  });

  it.each(MODES)('loads the nearest crate, pulses once and ignores a held button (%s)', (mode) => {
    const w = createWorld(mode);
    floor(w);
    const t = truck(w, 0);
    const near = crate(w, 2.2);
    const farther = crate(w, 2.9);
    const tick = cargoRig(w, t);
    const out = tick({ load: true });
    expect(out).toMatchObject({ loaded: true, count: 1, top: near });
    expect(tick({ load: true })).toMatchObject({ loaded: false, count: 1 }); // still held: no new edge
    expect(w.cargoOf(t)).toEqual([near]);
    tick({});
    expect(tick({ load: true })).toMatchObject({ loaded: true, count: 2, top: farther });
  });

  it('does not load what is out of reach, not carryable or already held', () => {
    const w = createWorld('3d');
    floor(w);
    const t = truck(w, 0);
    crate(w, 9);
    crate(w, 1.5, 0, { carryable: false });
    const p = person(w, 0, 3);
    const held = crate(w, 0, 3);
    expect(w.grab(p, 1.5)).toBe(held);
    const tick = cargoRig(w, t);
    expect(press(tick, 'load')).toMatchObject({ loaded: false, count: 0, top: null });
  });

  it('stops at capacity', () => {
    const w = createWorld('3d');
    floor(w);
    const t = truck(w, 0);
    for (let i = 0; i < 4; i++) crate(w, 2 + i * 0.1, i * 0.1);
    const tick = cargoRig(w, t, { capacity: 3 });
    const results = [1, 2, 3, 4].map(() => press(tick, 'load'));
    expect(results.map((r) => r.loaded)).toEqual([true, true, true, false]);
    expect(results[3]!.count).toBe(3);
  });

  it.each(MODES)('unloads the top item beside the vehicle; empty gives nothing (%s)', (mode) => {
    const w = createWorld(mode);
    floor(w);
    const t = truck(w, 0);
    const a = crate(w, 2);
    const b = crate(w, 2.4);
    const tick = cargoRig(w, t);
    expect(press(tick, 'unload')).toMatchObject({ unloaded: false, count: 0 });
    press(tick, 'load');
    press(tick, 'load');
    expect(w.cargoOf(t)).toEqual([a, b]);
    const out = press(tick, 'unload');
    expect(out).toMatchObject({ unloaded: true, count: 1, top: a });
    expect(w.getEntity(b)!.position.x).toBeLessThan(-1); // behind the nose (+x)
    run(w, 30);
    // Settled on the ground next to the truck, no longer riding.
    expect(w.cargoOf(t)).toEqual([a]);
    if (mode !== '2d-top') expect(w.getEntity(b)!.position.y).toBeLessThan(0.6);
    expect(Math.abs(w.getEntity(b)!.position.x - w.getEntity(t)!.position.x)).toBeGreaterThan(1);
  });

  it('unload all empties the bed', () => {
    const w = createWorld('3d');
    floor(w);
    const t = truck(w, 0);
    for (let i = 0; i < 3; i++) crate(w, 2, i * 0.3);
    const tick = cargoRig(w, t);
    for (let i = 0; i < 3; i++) press(tick, 'load');
    expect(w.cargoOf(t)).toHaveLength(3);
    expect(press(tick, 'unloadAll')).toMatchObject({ unloaded: true, count: 0, top: null });
    expect(w.cargoOf(t)).toEqual([]);
  });

  it.each(MODES)('cargo follows the truck while driving and stays stacked on the bed (%s)', (mode) => {
    const w = createWorld(mode);
    floor(w);
    const t = truck(w, 0);
    const ids = [crate(w, 2), crate(w, 2.3), crate(w, 2.6)];
    const tick = cargoRig(w, t);
    for (let i = 0; i < 3; i++) press(tick, 'load');
    const p = person(w, 0, mode === '2d-side' ? 0 : 1.2);
    expect(w.enterVehicle(p, 3)).toBe(t);
    run(w, 90, () => w.setVehicleInput(t, 1, 0));
    const truckPos = w.getEntity(t)!.position;
    expect(truckPos.x).toBeGreaterThan(3);
    run(w, 1);
    for (const id of ids) {
      const c = w.getEntity(id)!.position;
      expect(Math.abs(c.x - w.getEntity(t)!.position.x)).toBeLessThan(1);
      if (mode !== '2d-top') expect(c.y).toBeGreaterThan(w.getEntity(t)!.position.y + 0.6 - 1e-6); // on top of the bed
    }
    expect(w.cargoOf(t)).toEqual(ids);
    // The driver getting out does not drop the cargo.
    w.exitVehicle(p);
    run(w, 5);
    expect(w.cargoOf(t)).toEqual(ids);
  });

  it('stacks higher once the first layer is full (3d)', () => {
    const w = createWorld('3d');
    floor(w);
    const t = truck(w, 0);
    for (let i = 0; i < 5; i++) crate(w, 2 + (i % 2) * 0.4, (i - 2) * 0.4);
    const tick = cargoRig(w, t, { capacity: 6 });
    for (let i = 0; i < 5; i++) press(tick, 'load');
    const ids = w.cargoOf(t);
    expect(ids).toHaveLength(5);
    const p = (id: EntityId) => w.getEntity(id)!.position;
    expect(p(ids[4]!).y).toBeGreaterThan(p(ids[0]!).y + 0.4);
    expect(p(ids[4]!).x).toBeCloseTo(p(ids[0]!).x, 5);
  });

  it('unloads next to a wall without putting the crate inside it', () => {
    const w = createWorld('3d');
    floor(w);
    const t = truck(w, 0);
    // Wall right behind the truck (the truck faces +x, so behind is -x).
    w.spawn({ kind: 'block', ownerNodeId: 'wall', position: { x: -1.9, y: 1, z: 0 }, size: { x: 1.4, y: 2, z: 10 }, color: '#444', solid: true });
    const c = crate(w, 2);
    const tick = cargoRig(w, t);
    press(tick, 'load');
    expect(press(tick, 'unload').unloaded).toBe(true);
    const pos = w.getEntity(c)!.position;
    const insideWall = Math.abs(pos.x - -1.9) < 0.7 + 0.25;
    expect(insideWall).toBe(false);
    expect(Math.hypot(pos.x, pos.z)).toBeGreaterThan(1);
  });

  it('refuses to unload when nothing around is free', () => {
    const w = createWorld('3d');
    floor(w);
    const t = truck(w, 0);
    const c = crate(w, 2);
    const tick = cargoRig(w, t);
    press(tick, 'load');
    // A ring of walls around the truck.
    w.spawn({ kind: 'block', ownerNodeId: 'ring', position: { x: 0, y: 1, z: 0 }, size: { x: 8, y: 2, z: 8 }, color: '#444', solid: true });
    expect(press(tick, 'unload')).toMatchObject({ unloaded: false, count: 1 });
    expect(w.cargoOf(t)).toEqual([c]);
  });

  it('hiding the vehicle releases the cargo where it is', () => {
    const w = createWorld('3d');
    floor(w);
    const t = truck(w, 0);
    const c = crate(w, 2);
    const tick = cargoRig(w, t);
    press(tick, 'load');
    w.hide(t);
    expect(w.cargoOf(t)).toEqual([]);
    run(w, 40);
    const e = w.getEntity(c)!;
    expect(e.visible).toBe(true);
    expect(e.position.y).toBeLessThan(0.6); // fell to the ground, no longer riding
    expect(w.isHeld(c)).toBe(false);
  });

  it('hiding a loaded item removes it from the count', () => {
    const w = createWorld('3d');
    floor(w);
    const t = truck(w, 0);
    const a = crate(w, 2);
    crate(w, 2.4);
    const tick = cargoRig(w, t);
    press(tick, 'load');
    press(tick, 'load');
    w.hide(a);
    expect(w.cargoOf(t)).toHaveLength(1);
  });

  it('loaded items cannot be grabbed, equipped or reported as carried', () => {
    const w = createWorld('3d');
    floor(w);
    const t = truck(w, 0);
    const c = crate(w, 2);
    const tick = cargoRig(w, t);
    press(tick, 'load');
    const p = person(w, 2, 2);
    run(w, 5);
    expect(w.grab(p, 10)).toBeNull();
    expect(w.heldItem(p)).toBeNull();
    expect(w.isHeld(c)).toBe(false);
    expect(w.cargoOf(t)).toEqual([c]);
  });

  it('does nothing without a vehicle', () => {
    const w = createWorld('3d');
    floor(w);
    crate(w, 1);
    const params = defaultParams(cargoNode);
    const state = cargoNode.create!(makeCtx(w), params);
    const out = cargoNode.evaluate(makeCtx(w), { vehicle: null, load: true }, params, state);
    expect(out).toEqual({ count: 0, loaded: false, unloaded: false, top: null, typeCount: 0 });
  });
});
