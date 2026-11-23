import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type EntitySpec, type SteerMode, type VehicleModel, type ViewMode, type World } from '../../src/engine/types';
import { vehicleSize } from '../../src/world/vehicles';
import { createWorld } from '../../src/world/world';

const floor = (mode: ViewMode, w: World): void => {
  w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: mode === '2d-side' ? 1 : 200 }, color: '#888', solid: true });
};
const wall = (w: World, x: number, z: number, sx = 1, sz = 1): void => {
  w.spawn({ kind: 'block', ownerNodeId: 'wall', position: { x, y: 0.5, z }, size: { x: sx, y: 1, z: sz }, color: '#444', solid: true });
};
const car = (w: World, x: number, z: number, over: Partial<{ model: VehicleModel; steerMode: SteerMode; solid: boolean; maxSpeed: number; accel: number }> = {}): EntityId => {
  const model = over.model ?? 'car';
  const spec: EntitySpec = {
    kind: 'vehicle',
    ownerNodeId: 'car',
    position: { x, y: vehicleSize(model).y / 2, z },
    size: vehicleSize(model),
    color: '#f00',
    solid: over.solid ?? true,
    vehicle: { model, steerMode: over.steerMode ?? 'direction', maxSpeed: over.maxSpeed ?? 8, accel: over.accel ?? 8 },
  };
  return w.spawn(spec);
};
const person = (w: World, x: number, z: number): EntityId =>
  w.spawn({ kind: 'character', ownerNodeId: 'p', position: { x, y: 0.5, z }, size: { x: 1, y: 1, z: 1 }, color: '#00f', solid: true });
const run = (w: World, ticks: number, each?: () => void): void => {
  for (let i = 0; i < ticks; i++) {
    each?.();
    w.step(TICK_DT);
  }
};
const pos = (w: World, id: EntityId) => w.getEntity(id)!.position;
const speedOf = (w: World, id: EntityId) => w.getEntity(id)!.vehicle!.speed;

describe('vehicle dynamics', () => {
  it('speeds up gradually, reaches top speed and rolls to a stop with inertia', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const v = car(w, 0, 0);
    run(w, 6, () => w.setVehicleInput(v, 1, 0));
    expect(speedOf(w, v)).toBeGreaterThan(0.5);
    expect(speedOf(w, v)).toBeLessThan(2);
    run(w, 120, () => w.setVehicleInput(v, 1, 0));
    expect(speedOf(w, v)).toBeCloseTo(8, 3);
    run(w, 6, () => w.setVehicleInput(v, 0, 0));
    expect(speedOf(w, v)).toBeGreaterThan(3); // still rolling
    run(w, 120, () => w.setVehicleInput(v, 0, 0));
    expect(speedOf(w, v)).toBe(0);
    expect(pos(w, v).x).toBeGreaterThan(10);
  });

  it('direction steering turns toward the stick and drives that way', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const v = car(w, 0, 0);
    run(w, 90, () => w.setVehicleInput(v, 1, 0)); // east
    const x0 = pos(w, v).x;
    run(w, 150, () => w.setVehicleInput(v, 0, 1)); // north = -z
    expect(pos(w, v).z).toBeLessThan(-8);
    expect(pos(w, v).x - x0).toBeLessThan(8);
    expect(w.getEntity(v)!.vehicle!.heading).toBeCloseTo(-Math.PI / 2, 1);
  });

  it('gas/steer: stick up is gas, down reverses, steering needs rolling speed', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const v = car(w, 0, 0, { steerMode: 'throttle' });
    run(w, 30, () => w.setVehicleInput(v, 1, 0)); // steering while parked does nothing
    expect(w.getEntity(v)!.vehicle!.heading).toBe(0);
    expect(pos(w, v).x).toBeCloseTo(0, 5);
    run(w, 90, () => w.setVehicleInput(v, 0, 1));
    expect(pos(w, v).x).toBeGreaterThan(5);
    run(w, 60, () => w.setVehicleInput(v, 1, 1)); // steer right while rolling: heading grows (clockwise from above)
    expect(w.getEntity(v)!.vehicle!.heading).toBeGreaterThan(0.5);
    expect(pos(w, v).z).toBeGreaterThan(0.5);
    run(w, 240, () => w.setVehicleInput(v, 0, -1));
    expect(speedOf(w, v)).toBeLessThan(0); // reversing
    expect(speedOf(w, v)).toBeGreaterThan(-8 * 0.41);
  });

  it('side view: left and right drive the car and the nose flips', () => {
    const w = createWorld('2d-side');
    floor('2d-side', w);
    const v = car(w, 0, 0);
    run(w, 90, () => w.setVehicleInput(v, 1, 0));
    expect(pos(w, v).x).toBeGreaterThan(5);
    expect(w.getEntity(v)!.vehicle!.heading).toBe(0);
    run(w, 240, () => w.setVehicleInput(v, -1, 0));
    expect(pos(w, v).x).toBeLessThan(0);
    expect(w.getEntity(v)!.vehicle!.heading).toBeCloseTo(Math.PI, 5);
    expect(pos(w, v).z).toBe(0);
  });

  it('3D: the stick is relative to the camera yaw like a character, and the vehicle stays on the floor', () => {
    const w = createWorld('3d');
    floor('3d', w);
    const v = car(w, 0, 0);
    run(w, 120, () => w.setVehicleInput(v, 0, 1)); // up = forward = -z at yaw 0
    expect(pos(w, v).z).toBeLessThan(-5);
    expect(pos(w, v).y).toBeCloseTo(0.4, 3);
    expect(w.isOnGround(v)).toBe(true);
  });

  it('a wall stops it dead', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    wall(w, 6, 0, 1, 10);
    const v = car(w, 0, 0);
    run(w, 180, () => w.setVehicleInput(v, 1, 0));
    expect(pos(w, v).x).toBeCloseTo(6 - 0.5 - 0.75, 2);
    expect(speedOf(w, v)).toBeCloseTo(0, 3);
  });

  it('ignores garbage input and keeps a finite state', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const v = car(w, 0, 0);
    run(w, 10, () => w.setVehicleInput(v, Number.NaN, Number.POSITIVE_INFINITY));
    expect(Number.isFinite(pos(w, v).x)).toBe(true);
    w.setVehicleInput('nope', 1, 1);
  });

  it('every model has its own footprint, and the boxes stay square so turning never snags', () => {
    for (const m of ['car', 'bike', 'truck'] as const) {
      const s = vehicleSize(m);
      expect(s.x).toBe(s.z);
    }
    expect(vehicleSize('bike').x).toBeLessThan(vehicleSize('car').x);
    expect(vehicleSize('truck').x).toBeGreaterThan(vehicleSize('car').x);
  });
});

describe('getting in and out', () => {
  it('boards the nearest empty vehicle within reach, not one that is too far', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const near = car(w, 3, 0);
    const far = car(w, 12, 0);
    const p = person(w, 1.2, 0); // box gap to the near car: (3 - 1.2) - 0.75 - 0.5 = 0.55
    expect(w.enterVehicle(p, 0.3)).toBeNull();
    expect(w.enterVehicle(p, 1)).toBe(near);
    expect(w.getEntity(p)!.seatedIn).toBe(near);
    expect(w.getEntity(near)!.vehicle!.driver).toBe(p);
    expect(w.getEntity(far)!.vehicle!.driver).toBeNull();
    expect(w.enterVehicle(p, 5)).toBeNull(); // already seated
  });

  it('a second person cannot take an occupied seat', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const v = car(w, 0, 0);
    const a = person(w, 1.5, 0);
    const b = person(w, -1.5, 0);
    expect(w.enterVehicle(a, 2)).toBe(v);
    expect(w.enterVehicle(b, 2)).toBeNull();
  });

  it('the driver rides along, ignores its own controls and keeps touching the car', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const v = car(w, 0, 0);
    const p = person(w, 1.2, 0);
    w.enterVehicle(p, 2);
    run(w, 90, () => {
      w.setVehicleInput(v, 1, 0);
      w.setCharacterIntent(p, { moveX: -1, moveY: 0, jump: true, speed: 5, jumpPower: 10 });
    });
    expect(pos(w, v).x).toBeGreaterThan(5);
    expect(pos(w, p).x).toBeCloseTo(pos(w, v).x, 5);
    expect(pos(w, p).z).toBeCloseTo(pos(w, v).z, 5);
    expect(w.isTouching(p, v)).toBe(true);
  });

  it('gets out beside the car on the first free side, never inside a solid block', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const v = car(w, 0, 0);
    const p = person(w, 1.2, 0);
    w.enterVehicle(p, 2);
    expect(w.exitVehicle(p)).toBe(v);
    const out = pos(w, p);
    expect(w.getEntity(p)!.seatedIn).toBeUndefined();
    expect(w.getEntity(v)!.vehicle!.driver).toBeNull();
    expect(Math.abs(out.z)).toBeGreaterThan(1.2); // to the side of a car that points along +x
    expect(Math.abs(out.x)).toBeLessThan(0.01);

    // Wall the right side (+z for a car facing +x) off: it steps out on the left.
    const w2 = createWorld('2d-top');
    floor('2d-top', w2);
    const v2 = car(w2, 0, 0);
    wall(w2, 0, 1.4, 6, 1);
    const p2 = person(w2, 0, -2);
    expect(w2.enterVehicle(p2, 2)).toBe(v2);
    w2.exitVehicle(p2);
    expect(pos(w2, p2).z).toBeLessThan(-1.2);
  });

  it('falls back to the roof when walls surround the car', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const v = car(w, 0, 0);
    for (const [x, z, sx, sz] of [[0, 1.4, 6, 1], [0, -1.4, 6, 1], [-2, 0, 1, 4], [2, 0, 1, 4]] as const) wall(w, x, z, sx, sz);
    const p = person(w, 0, 0);
    expect(w.enterVehicle(p, 3)).toBe(v);
    w.exitVehicle(p);
    expect(pos(w, p).y).toBeGreaterThan(0.8);
    expect(w.getEntity(p)!.seatedIn).toBeUndefined();
  });

  it('side view: steps out behind or in front, on the floor', () => {
    const w = createWorld('2d-side');
    floor('2d-side', w);
    const v = car(w, 0, 0);
    const p = person(w, 1.5, 0);
    expect(w.enterVehicle(p, 1)).toBe(v);
    w.exitVehicle(p);
    run(w, 30);
    expect(Math.abs(pos(w, p).x)).toBeGreaterThan(1.2);
    expect(pos(w, p).y).toBeCloseTo(0.5, 2);
    expect(w.isOnGround(p)).toBe(true);
  });

  it('exit when not seated does nothing', () => {
    const w = createWorld('2d-top');
    const p = person(w, 0, 0);
    expect(w.exitVehicle(p)).toBeNull();
    expect(w.exitVehicle('missing')).toBeNull();
  });

  it('hiding the vehicle puts its driver out; hiding the driver empties the seat', () => {
    const w = createWorld('2d-top');
    floor('2d-top', w);
    const v = car(w, 0, 0);
    const a = person(w, 1.5, 0);
    w.enterVehicle(a, 2);
    w.hide(v);
    expect(w.getEntity(a)!.seatedIn).toBeUndefined();
    expect(w.getEntity(a)!.visible).toBe(true);

    const w2 = createWorld('2d-top');
    floor('2d-top', w2);
    const v2 = car(w2, 0, 0);
    const b = person(w2, 1.5, 0);
    w2.enterVehicle(b, 2);
    w2.hide(b);
    expect(w2.getEntity(v2)!.vehicle!.driver).toBeNull();
    expect(w2.enterVehicle(b, 2)).toBeNull(); // hidden people cannot board
  });
});

describe('solid vehicles', () => {
  it('stop people on foot unless set to non-solid', () => {
    for (const solid of [true, false]) {
      const w = createWorld('2d-top');
      floor('2d-top', w);
      car(w, 3, 0, { solid });
      const p = person(w, 0, 0);
      run(w, 120, () => w.setCharacterIntent(p, { moveX: 1, moveY: 0, jump: false, speed: 5, jumpPower: 10 }));
      if (solid) expect(pos(w, p).x).toBeCloseTo(3 - 0.75 - 0.5, 2);
      else expect(pos(w, p).x).toBeGreaterThan(5);
    }
  });
});
