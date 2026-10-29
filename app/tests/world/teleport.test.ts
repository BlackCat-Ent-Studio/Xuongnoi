import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type ViewMode, type World } from '../../src/engine/types';
import { vehicleSize } from '../../src/world/vehicles';
import { createWorld } from '../../src/world/world';

const floor = (w: World, mode: ViewMode): void => {
  w.spawn({ kind: 'block', ownerNodeId: 'floor', position: { x: 0, y: -0.5, z: 0 }, size: { x: 200, y: 1, z: mode === '2d-side' ? 1 : 200 }, color: '#888', solid: true });
};
const person = (w: World, x: number, z = 0, role: 'player' | 'bot' = 'player'): EntityId =>
  w.spawn({ kind: 'character', ownerNodeId: 'p', position: { x, y: 0.5, z }, size: { x: 1, y: 1, z: 1 }, color: '#00f', solid: true, role });
const portal = (w: World, x: number, z = 0): EntityId =>
  w.spawn({ kind: 'block', ownerNodeId: 'portal', position: { x, y: 1, z }, size: { x: 1.2, y: 2, z: 1.2 }, color: '#80f', look: 'portal', solid: false });
const run = (w: World, ticks: number, each?: () => void): void => {
  for (let i = 0; i < ticks; i++) {
    each?.();
    w.step(TICK_DT);
  }
};

describe('world.teleport', () => {
  it('moves a character, zeroes or keeps its velocity', () => {
    const w = createWorld('2d-side');
    floor(w, '2d-side');
    const c = person(w, 0);
    w.setCharacterIntent(c, { moveX: 1, moveY: 0, jump: false, speed: 5, jumpPower: 8 });
    run(w, 10);
    expect(w.teleport(c, { x: 20, y: 0.5, z: 0 }, false)).toEqual({ x: 20, y: 0.5, z: 0 });
    expect(w.getEntity(c)!.position.x).toBe(20);
    run(w, 1);
    expect(w.getEntity(c)!.position.x).toBeGreaterThan(20); // intent still applied, started from rest
    const w2 = createWorld('2d-side');
    floor(w2, '2d-side');
    const a = person(w2, 0);
    w2.setCharacterIntent(a, { moveX: 1, moveY: 0, jump: false, speed: 5, jumpPower: 8 });
    run(w2, 10);
    w2.teleport(a, { x: 20, y: 0.5, z: 0 }, true);
    expect(w2.getEntity(a)!.position.x).toBe(20);
  });

  it('finds a free spot when the destination is inside a solid block', () => {
    const w = createWorld('2d-side');
    floor(w, '2d-side');
    w.spawn({ kind: 'block', ownerNodeId: 'wall', position: { x: 10, y: 1, z: 0 }, size: { x: 2, y: 2, z: 1 }, color: '#444', solid: true });
    const c = person(w, 0);
    const spot = w.teleport(c, { x: 10, y: 1, z: 0 }, false)!;
    expect(spot).not.toBeNull();
    expect(w.solidAt({ x: spot.x, y: spot.y, z: 0 })).toBe(false);
    run(w, 30);
    const p = w.getEntity(c)!.position;
    expect(Math.abs(p.x - 10)).toBeLessThan(5);
    expect(w.isOnGround(c)).toBe(true);
  });

  it('refuses blocks, hidden or unknown entities, and fully enclosed spots', () => {
    const w = createWorld('2d-side');
    floor(w, '2d-side');
    const block = w.spawn({ kind: 'block', ownerNodeId: 'b', position: { x: 3, y: 1, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#444', solid: true });
    const c = person(w, 0);
    expect(w.teleport(block, { x: 0, y: 5, z: 0 }, false)).toBeNull();
    expect(w.teleport('nope', { x: 0, y: 5, z: 0 }, false)).toBeNull();
    expect(w.teleport(c, { x: Number.NaN, y: 0, z: 0 }, false)).toBeNull();
    w.hide(c);
    expect(w.teleport(c, { x: 5, y: 1, z: 0 }, false)).toBeNull();
  });

  it('moves held items with the holder, and refuses an item that is held', () => {
    const w = createWorld('2d-side');
    floor(w, '2d-side');
    const c = person(w, 0);
    const item = w.spawn({ kind: 'item', ownerNodeId: 'i', position: { x: 0.5, y: 0.4, z: 0 }, size: { x: 0.5, y: 0.5, z: 0.5 }, color: '#fa0', solid: false });
    const tool = w.spawn({ kind: 'item', ownerNodeId: 't', position: { x: 0.6, y: 0.4, z: 0 }, size: { x: 0.5, y: 0.5, z: 0.5 }, color: '#fa0', solid: false, holdStyle: 'hand' });
    expect(w.grab(c, 3)).toBe(item);
    expect(w.equip(c, 3)).toBe(tool);
    expect(w.teleport(item, { x: 30, y: 0.5, z: 0 }, false)).toBeNull();
    w.teleport(c, { x: 30, y: 0.5, z: 0 }, false);
    expect(Math.abs(w.getEntity(item)!.position.x - 30)).toBeLessThan(1);
    expect(Math.abs(w.getEntity(tool)!.position.x - 30)).toBeLessThan(1.5);
    expect(w.heldItem(c)).toBe(item);
    expect(w.handItem(c)).toBe(tool);
    run(w, 5);
    expect(Math.abs(w.getEntity(item)!.position.x - 30)).toBeLessThan(1);
  });

  it('teleporting a vehicle brings its driver; teleporting the driver brings the vehicle', () => {
    const w = createWorld('2d-top');
    floor(w, '2d-top');
    const size = vehicleSize('car');
    const car = w.spawn({ kind: 'vehicle', ownerNodeId: 'car', position: { x: 0, y: size.y / 2, z: 0 }, size, color: '#f00', solid: true, vehicle: { model: 'car', steerMode: 'direction', maxSpeed: 8, accel: 8 } });
    const c = person(w, 0, 3);
    w.step(TICK_DT);
    expect(w.enterVehicle(c, 5)).toBe(car);
    w.teleport(car, { x: 40, y: size.y / 2, z: 10 }, false);
    expect(w.getEntity(car)!.position.x).toBe(40);
    expect(w.getEntity(c)!.position.x).toBe(40);
    expect(w.getEntity(c)!.seatedIn).toBe(car);
    w.teleport(c, { x: -20, y: size.y / 2, z: -5 }, false);
    expect(w.getEntity(car)!.position.x).toBe(-20);
    expect(w.getEntity(c)!.position.x).toBe(-20);
    expect(w.getEntity(c)!.seatedIn).toBe(car);
    expect(w.getEntity(car)!.vehicle!.driver).toBe(c);
  });

  it('nudges the solidRevision so bots replan from the new place', () => {
    const w = createWorld('2d-top');
    floor(w, '2d-top');
    const c = person(w, 0, 0, 'bot');
    const before = w.solidRevision();
    w.teleport(c, { x: 5, y: 0.5, z: 5 }, false);
    expect(w.solidRevision()).toBeGreaterThan(before);
  });
});

describe('portals', () => {
  const link = (w: World, a: EntityId, b: EntityId): void => {
    w.setPortal(a, { partner: b, pair: '', enabled: true, cooldown: 0.5 });
    w.setPortal(b, { partner: null, pair: '', enabled: true, cooldown: 0.5 });
  };

  it('sends a toucher to the partner, once, with no ping-pong while standing there', () => {
    const w = createWorld('2d-side');
    floor(w, '2d-side');
    const a = portal(w, 0);
    const b = portal(w, 20);
    link(w, a, b);
    const c = person(w, -3);
    w.step(TICK_DT);
    w.setCharacterIntent(c, { moveX: 1, moveY: 0, jump: false, speed: 5, jumpPower: 8 });
    let used: EntityId | null = null;
    run(w, 90, () => {
      link(w, a, b);
      used = used ?? w.portalUser(a);
    });
    expect(used).toBe(c);
    expect(w.getEntity(c)!.position.x).toBeGreaterThan(19);
    // Idling on the far side for a long time never bounces it back.
    w.setCharacterIntent(c, { moveX: 0, moveY: 0, jump: false, speed: 5, jumpPower: 8 });
    run(w, 240, () => link(w, a, b));
    expect(w.getEntity(c)!.position.x).toBeGreaterThan(19);
  });

  it('works both ways: walking back out of the partner and in again returns', () => {
    const w = createWorld('2d-side');
    floor(w, '2d-side');
    const a = portal(w, 0);
    const b = portal(w, 20);
    link(w, a, b);
    const c = person(w, 0);
    w.step(TICK_DT);
    run(w, 5, () => link(w, a, b));
    expect(w.getEntity(c)!.position.x).toBeGreaterThan(15);
    // Step off to the right, then back into B.
    w.teleport(c, { x: 24, y: 0.5, z: 0 }, false);
    run(w, 60, () => link(w, a, b));
    w.setCharacterIntent(c, { moveX: -1, moveY: 0, jump: false, speed: 5, jumpPower: 8 });
    run(w, 90, () => link(w, a, b));
    expect(w.getEntity(c)!.position.x).toBeLessThan(5);
  });

  it('pairs portals by shared code and ignores a disabled partner', () => {
    const w = createWorld('2d-side');
    floor(w, '2d-side');
    const a = portal(w, 0);
    const b = portal(w, 20);
    const c = person(w, 0);
    const set = (enabledB: boolean): void => {
      w.setPortal(a, { partner: null, pair: 'x', enabled: true, cooldown: 0.5 });
      w.setPortal(b, { partner: null, pair: 'x', enabled: enabledB, cooldown: 0.5 });
    };
    set(false);
    run(w, 10, () => set(false));
    expect(w.getEntity(c)!.position.x).toBeLessThan(2);
    run(w, 5, () => set(true));
    expect(w.getEntity(c)!.position.x).toBeGreaterThan(15);
  });

  it('carries a vehicle with its driver and lets items through, but not held items', () => {
    const w = createWorld('2d-top');
    floor(w, '2d-top');
    const a = portal(w, 0, 0);
    const b = portal(w, 30, 0);
    link(w, a, b);
    const item = w.spawn({ kind: 'item', ownerNodeId: 'i', position: { x: 0, y: 0.25, z: 0 }, size: { x: 0.5, y: 0.5, z: 0.5 }, color: '#fa0', solid: false });
    run(w, 3, () => link(w, a, b));
    expect(w.getEntity(item)!.position.x).toBeGreaterThan(25);
    const size = vehicleSize('car');
    const car = w.spawn({ kind: 'vehicle', ownerNodeId: 'car', position: { x: 60, y: size.y / 2, z: 5 }, size, color: '#f00', solid: false, vehicle: { model: 'car', steerMode: 'direction', maxSpeed: 8, accel: 8 } });
    const d = person(w, 60, 8);
    w.step(TICK_DT);
    w.enterVehicle(d, 5);
    w.teleport(car, { x: 0, y: size.y / 2, z: 0 }, false);
    run(w, 3, () => link(w, a, b));
    expect(w.getEntity(car)!.position.x).toBeGreaterThan(25);
    expect(w.getEntity(d)!.position.x).toBeGreaterThan(25);
    expect(w.getEntity(d)!.seatedIn).toBe(car);
  });
});
