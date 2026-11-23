import { describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type World } from '../../src/engine/types';
import { vehicleSize } from '../../src/world/vehicles';
import { createWorld } from '../../src/world/world';

const run = (w: World, ticks: number): void => {
  for (let i = 0; i < ticks; i++) w.step(TICK_DT);
};
const car = (w: World, x: number): EntityId =>
  w.spawn({
    kind: 'vehicle', ownerNodeId: 'car', position: { x, y: 0, z: 0 }, size: vehicleSize('car'), color: '#f00', solid: true,
    vehicle: { model: 'car', steerMode: 'direction', maxSpeed: 8, accel: 8 },
  });
const person = (w: World, x: number, hp?: number): EntityId => {
  const id = w.spawn({ kind: 'character', ownerNodeId: 'p', position: { x, y: 0, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#00f', solid: true });
  if (hp !== undefined) w.setHealth(id, hp, true);
  return id;
};
const sword = (w: World, x: number): EntityId =>
  w.spawn({ kind: 'item', ownerNodeId: 'i', position: { x, y: 0, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#ff0', solid: false, shape: 'sword' });

/** Attacker at x=0 facing +x with a sword in hand, a car at x=1.2 and its driver. */
function scene() {
  const w = createWorld('2d-top');
  const attacker = person(w, -1);
  const v = car(w, 1.5);
  const driver = person(w, 1.5, 5);
  const blade = sword(w, -1);
  w.setCharacterIntent(attacker, { moveX: 1, moveY: 0, jump: false, speed: 0.01, jumpPower: 0 });
  run(w, 2);
  w.setCharacterIntent(attacker, { moveX: 0, moveY: 0, jump: false, speed: 0, jumpPower: 0 });
  w.equip(attacker, 2);
  expect(w.enterVehicle(driver, 2)).toBe(v);
  return { w, attacker, v, driver, blade };
}

describe('combat and vehicles', () => {
  it('a hand-tool swing at a car does no damage and the car is not a health target', () => {
    const w = createWorld('2d-top');
    const attacker = person(w, 0);
    const v = car(w, 1.5);
    w.setHealth(v, 5, true);
    w.setCharacterIntent(attacker, { moveX: 1, moveY: 0, jump: false, speed: 0.01, jumpPower: 0 });
    run(w, 2);
    w.useTool(attacker, 2);
    run(w, 3);
    const view = w.getEntity(v)!;
    expect(view.health).toBeUndefined();
    expect(view.visible).toBe(true);
  });

  it('a seated driver cannot be hit by a swing or by a thrown item', () => {
    const { w, attacker, driver, blade } = scene();
    expect(w.useTool(attacker, 3)).not.toBeNull();
    run(w, 5);
    expect(w.getEntity(driver)!.health!.hp).toBe(5);
    expect(w.wasHurt(driver)).toBe(false);

    w.throwHeld(attacker, 14);
    run(w, 30);
    expect(w.getEntity(blade)).toBeDefined();
    expect(w.getEntity(driver)!.health!.hp).toBe(5);
  });

  it('an exited driver can be hurt again', () => {
    const { w, v, driver } = scene();
    w.exitVehicle(driver);
    w.hide(v); // out of the way so the swing reaches the person
    const at = w.getEntity(driver)!.position;
    const foe = w.spawn({ kind: 'character', ownerNodeId: 'f', position: { x: at.x - 1, y: 0, z: at.z }, size: { x: 1, y: 1, z: 1 }, color: '#0f0', solid: true });
    w.setCharacterIntent(foe, { moveX: 1, moveY: 0, jump: false, speed: 0.01, jumpPower: 0 });
    run(w, 2);
    w.useTool(foe, 1.5);
    run(w, 2);
    expect(w.getEntity(driver)!.health!.hp).toBeLessThan(5);
  });

  it('hiding a driver empties the seat and releases what the driver held', () => {
    const w = createWorld('2d-top');
    const v = car(w, 0);
    const driver = person(w, 0, 5);
    const blade = sword(w, 0);
    w.equip(driver, 2);
    w.enterVehicle(driver, 2);
    w.hide(driver);
    expect(w.getEntity(v)!.vehicle!.driver).toBeNull();
    expect(w.getEntity(v)!.visible).toBe(true);
    expect(w.getEntity(driver)!.seatedIn).toBeUndefined();
    expect(w.isInHand(blade)).toBe(false);
  });

  it('hiding the vehicle ejects the driver who stays visible and free', () => {
    const w = createWorld('2d-top');
    const v = car(w, 0);
    const driver = person(w, 0, 5);
    w.enterVehicle(driver, 2);
    w.hide(v);
    const d = w.getEntity(driver)!;
    expect(d.visible).toBe(true);
    expect(d.seatedIn).toBeUndefined();
    run(w, 10);
    expect(w.getEntity(driver)!.seatedIn).toBeUndefined();
  });

  it('reports the height of an item carried overhead so the health bar can clear it', () => {
    const w = createWorld('2d-side');
    w.spawn({ kind: 'block', ownerNodeId: 'f', position: { x: 0, y: -0.5, z: 0 }, size: { x: 20, y: 1, z: 1 }, color: '#888', solid: true });
    const p = w.spawn({ kind: 'character', ownerNodeId: 'p', position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#00f', solid: true });
    const box = w.spawn({ kind: 'item', ownerNodeId: 'i', position: { x: 0.2, y: 0.4, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, color: '#ff0', solid: false });
    run(w, 5);
    expect(w.getEntity(p)!.carriedHeight).toBeUndefined();
    expect(w.grab(p, 2)).toBe(box);
    expect(w.getEntity(p)!.carriedHeight).toBeCloseTo(0.65, 5);
  });
});
