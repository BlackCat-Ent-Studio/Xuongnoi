import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type EntitySpec, type SteerMode, type VehicleModel, type ViewMode, type World } from '../../src/engine/types';
import { vehicleSize } from '../../src/world/vehicles';
import { createWorld } from '../../src/world/world';

const floor = (mode: ViewMode, w: World): void => {
  w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 400, y: 1, z: mode === '2d-side' ? 1 : 400 }, color: '#888', solid: true });
};
const car = (
  w: World,
  x: number,
  z: number,
  over: Partial<{ model: VehicleModel; steerMode: SteerMode; collide: boolean; maxSpeed: number; accel: number }> = {},
): EntityId => {
  const model = over.model ?? 'car';
  const spec: EntitySpec = {
    kind: 'vehicle',
    ownerNodeId: 'car',
    position: { x, y: vehicleSize(model).y / 2, z },
    size: vehicleSize(model),
    color: '#f00',
    solid: true,
    vehicle: {
      model,
      steerMode: over.steerMode ?? 'direction',
      maxSpeed: over.maxSpeed ?? 8,
      accel: over.accel ?? 8,
      ...(over.collide === false ? { collide: false } : {}),
    },
  };
  return w.spawn(spec);
};
const pos = (w: World, id: EntityId) => w.getEntity(id)!.position;
const hits = (w: World, id: EntityId) => w.getEntity(id)!.vehicle!.hitSeq ?? 0;

/** Planar overlap depth of two vehicles (0 when apart or just touching). */
function depth(w: World, a: EntityId, b: EntityId): number {
  const A = w.getEntity(a)!;
  const B = w.getEntity(b)!;
  const ox = (A.size.x + B.size.x) / 2 - Math.abs(A.position.x - B.position.x);
  const oz = (A.size.z + B.size.z) / 2 - Math.abs(A.position.z - B.position.z);
  return ox > 0 && oz > 0 ? Math.min(ox, oz) : 0;
}

function run(w: World, ticks: number, each?: (tick: number) => void): number {
  let worst = 0;
  for (let i = 0; i < ticks; i++) {
    each?.(i);
    w.step(TICK_DT);
  }
  return worst;
}

function runTracking(w: World, ticks: number, a: EntityId, b: EntityId, each: () => void): number {
  let worst = 0;
  for (let i = 0; i < ticks; i++) {
    each();
    w.step(TICK_DT);
    worst = Math.max(worst, depth(w, a, b));
  }
  return worst;
}

describe('vehicle against vehicle', () => {
  it('rear-end in the top view: the driver stops behind the parked car, which is shoved only a little', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, -10, 0);
    const b = car(w, 0, 0);
    const worst = runTracking(w, 240, a, b, () => w.setVehicleInput(a, 1, 0));
    expect(worst).toBeLessThan(0.02);
    expect(pos(w, a).x).toBeLessThan(pos(w, b).x - 1.5 + 0.02);
    expect(pos(w, b).x).toBeGreaterThan(0.05); // nudged
    expect(pos(w, b).x).toBeLessThan(a === b ? 0 : pos(w, a).x + 10); // not launched
    expect(pos(w, a).x).toBeGreaterThan(-3); // really drove up to it
  });

  it('head-on in the side view: both stop, nobody tunnels through', () => {
    const w = createWorld('2d-side');
    floor('2d-side', w);
    const a = car(w, -8, 0);
    const b = car(w, 8, 0);
    const worst = runTracking(w, 300, a, b, () => {
      w.setVehicleInput(a, 1, 0);
      w.setVehicleInput(b, -1, 0);
    });
    expect(worst).toBeLessThan(0.02);
    expect(pos(w, a).x).toBeLessThan(pos(w, b).x);
    expect(Math.abs(w.getEntity(a)!.vehicle!.speed)).toBeLessThan(0.5);
    expect(Math.abs(w.getEntity(b)!.vehicle!.speed)).toBeLessThan(0.5);
    // roughly symmetric: they meet near the middle
    expect(Math.abs(pos(w, a).x + pos(w, b).x)).toBeLessThan(3);
  });

  it('side-on: a vehicle crossing the path of another is blocked and both report one crash', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, -8, 0); // drives +x
    const b = car(w, 0, -8); // drives toward +z (stick down)
    const worst = runTracking(w, 300, a, b, () => {
      w.setVehicleInput(a, 1, 0);
      w.setVehicleInput(b, 0, -1);
    });
    expect(worst).toBeLessThan(0.05);
    expect(hits(w, a)).toBeGreaterThanOrEqual(1);
    expect(hits(w, b)).toBe(hits(w, a));
    expect(w.getEntity(a)!.vehicle!.hitWith).toBe(b);
    expect(w.getEntity(b)!.vehicle!.hitWith).toBe(a);
  });

  it('a very fast vehicle does not tunnel through a parked one', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, -40, 0, { maxSpeed: 40, accel: 200 });
    const b = car(w, 0, 0);
    const worst = runTracking(w, 300, a, b, () => w.setVehicleInput(a, 1, 0));
    expect(worst).toBeLessThan(0.02);
    expect(pos(w, a).x).toBeLessThan(pos(w, b).x);
    expect(hits(w, a)).toBe(1);
  });

  it('works in the 3D view too (up on the stick drives away from the camera)', () => {
    const w = createWorld('3d');
    floor('3d', w);
    const a = car(w, 0, 10);
    const b = car(w, 0, 0);
    const worst = runTracking(w, 300, a, b, () => w.setVehicleInput(a, 0, 1));
    expect(worst).toBeLessThan(0.02);
    expect(pos(w, a).z).toBeGreaterThan(pos(w, b).z);
    expect(pos(w, a).z).toBeLessThan(pos(w, b).z + 4); // came up close behind it
    expect(hits(w, a)).toBe(1);
  });

  it('a crash is one event, not one per tick of pressing against the other car', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, -5, 0);
    const b = car(w, 0, 0);
    run(w, 60 * 6, () => w.setVehicleInput(a, 1, 0));
    expect(hits(w, a)).toBe(1);
    expect(hits(w, b)).toBe(1);
  });

  it('a gentle touch moves the other car but is not reported as a crash', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, -2.2, 0);
    const b = car(w, 0, 0);
    run(w, 90, () => w.setVehicleInput(a, 0.15, 0));
    expect(hits(w, a)).toBe(0);
    expect(depth(w, a, b)).toBeLessThan(0.02);
  });

  it('collide=false vehicles pass through each other as before', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, -6, 0, { collide: false });
    const b = car(w, 0, 0, { collide: false });
    run(w, 240, () => w.setVehicleInput(a, 1, 0));
    expect(pos(w, a).x).toBeGreaterThan(pos(w, b).x + 2);
    expect(hits(w, a)).toBe(0);
  });

  it('a vehicle that opted out of collisions also does not stop the others', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, -6, 0);
    car(w, 0, 0, { collide: false });
    run(w, 240, () => w.setVehicleInput(a, 1, 0));
    expect(pos(w, a).x).toBeGreaterThan(3);
  });

  it('vehicles that start overlapped drive apart instead of jumping through each other', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, 0, 0);
    const b = car(w, 0.5, 0);
    let worstJump = 0;
    for (let i = 0; i < 60; i++) {
      const before = pos(w, a).x;
      w.setVehicleInput(a, 1, 0);
      w.step(TICK_DT);
      worstJump = Math.max(worstJump, Math.abs(pos(w, a).x - before));
    }
    expect(worstJump).toBeLessThan(0.3); // never snapped across the other car
    expect(pos(w, a).x).toBeGreaterThan(pos(w, b).x); // drove out the far side
  });
});

describe('vehicle stop flag', () => {
  it('brakes a moving vehicle to a standstill whatever the stick says, and releases', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, 0, 0);
    run(w, 120, () => w.setVehicleInput(a, 1, 0, false));
    expect(w.getEntity(a)!.vehicle!.speed).toBeGreaterThan(7);
    run(w, 90, () => w.setVehicleInput(a, 1, 0, true));
    expect(w.getEntity(a)!.vehicle!.speed).toBe(0);
    const x = pos(w, a).x;
    run(w, 30, () => w.setVehicleInput(a, 1, 0, true));
    expect(pos(w, a).x).toBeCloseTo(x, 6);
    run(w, 60, () => w.setVehicleInput(a, 1, 0, false));
    expect(pos(w, a).x).toBeGreaterThan(x + 1);
  });

  it('leaves the flag alone when a caller does not pass it', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, 0, 0);
    w.setVehicleInput(a, 1, 0, true);
    run(w, 60, () => w.setVehicleInput(a, 1, 0));
    expect(w.getEntity(a)!.vehicle!.speed).toBe(0);
  });
});

describe('probeAhead', () => {
  it('sees a vehicle in its lane within reach, not one beside it, behind it or too far', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, 0, 0);
    const near = car(w, 3.5, 0);
    car(w, 0, 3, {}); // beside
    car(w, -3, 0, {}); // behind
    car(w, 30, 0, {}); // far
    const hit = w.probeAhead(a, 2.5);
    expect(hit?.id).toBe(near);
    expect(hit!.distance).toBeCloseTo(2, 6);
    expect(w.probeAhead(a, 0.2)).toBeNull();
  });

  it('ignores the floor it drives on but sees a solid block and a character in the way', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, 0, 0);
    expect(w.probeAhead(a, 5)).toBeNull();
    const wall = w.spawn({ kind: 'block', ownerNodeId: 'wall', position: { x: 4, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 3 }, color: '#444', solid: true });
    expect(w.probeAhead(a, 5)?.id).toBe(wall);
    w.hide(wall);
    const walker = w.spawn({ kind: 'character', ownerNodeId: 'p', position: { x: 3, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#00f', solid: true });
    expect(w.probeAhead(a, 5)?.id).toBe(walker);
  });

  it('ignores zones and pickups (non-solid blocks)', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const a = car(w, 0, 0);
    w.spawn({ kind: 'block', ownerNodeId: 'z', position: { x: 3, y: 0.5, z: 0 }, size: { x: 2, y: 1, z: 2 }, color: '#0f0', solid: false });
    expect(w.probeAhead(a, 5)).toBeNull();
  });
});
