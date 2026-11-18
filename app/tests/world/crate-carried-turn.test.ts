import { describe, expect, it } from 'vitest';
import { crate, crateWorld, floor, run, tipDegrees, view } from './crate-helpers';

/**
 * A crate taken up while tilted keeps the tilt it had against its holder while it is carried (drawn and sensed that way) and
 * goes back into the simulation with it when it is let go. A crate taken up upright stays upright (no turn is invented).
 */

/** 30 degrees about the z axis (half angle 15 degrees). */
const TILT30 = { x: 0, y: 0, z: Math.sin(Math.PI / 12), w: Math.cos(Math.PI / 12) };

async function tiltedCrate() {
  const w = await crateWorld();
  floor(w);
  const c = crate(w, 0.5, 0.2, 0, { x: 0.4, y: 0.4, z: 0.4 }, { carryable: true });
  run(w, 0.5);
  // Turned and taken up in the same tick, before the engine can lay it back down.
  expect(w.setItemRotation(c, TILT30)).toBe(true);
  return { w, c };
}

describe('crate carried by a character', () => {
  it('rides tilted 30 degrees and is let go still tilted 30 degrees', async () => {
    const { w, c } = await tiltedCrate();
    const hero = w.spawn({ kind: 'character', ownerNodeId: 'hero', position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#f00', solid: true });
    expect(w.grab(hero, 2)).toBe(c);
    run(w, 1);
    // Drawn and sensed turned while carried: 30 degrees from upright, measured as the angle of its own up axis (hand value 30).
    expect(tipDegrees(view(w, c))).toBeCloseTo(30, 3);
    expect(w.drop(hero)).toBe(c);
    w.step(1 / 60);
    // One tick after the release, before it has fallen far: still 30 degrees (a free crate in the engine, tilting on from there).
    const v = view(w, c);
    expect(v.rotation).toBeDefined();
    expect(tipDegrees(v)).toBeGreaterThan(25);
    expect(tipDegrees(v)).toBeLessThan(35);
  });

  it('a crate carried upright stays upright (no turn is made up)', async () => {
    const w = await crateWorld();
    floor(w);
    const hero = w.spawn({ kind: 'character', ownerNodeId: 'hero', position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#f00', solid: true });
    const c = crate(w, 0.5, 0.2, 0, { x: 0.4, y: 0.4, z: 0.4 }, { carryable: true });
    run(w, 0.5);
    expect(w.grab(hero, 2)).toBe(c);
    run(w, 0.5);
    expect(view(w, c).rotation).toBeUndefined();
  });

  it('a tool crate in the hand keeps its tilt too', async () => {
    const w = await crateWorld();
    floor(w);
    const hero = w.spawn({ kind: 'character', ownerNodeId: 'hero', position: { x: 0, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 }, color: '#f00', solid: true });
    const c = crate(w, 0.5, 0.2, 0, { x: 0.4, y: 0.4, z: 0.4 }, { carryable: true, holdStyle: 'hand' });
    run(w, 0.5);
    expect(w.setItemRotation(c, TILT30)).toBe(true);
    expect(w.equip(hero, 2)).toBe(c);
    run(w, 0.5);
    expect(tipDegrees(view(w, c))).toBeCloseTo(30, 3);
    expect(w.unequip(hero)).toBe(c);
    w.step(1 / 60);
    expect(tipDegrees(view(w, c))).toBeGreaterThan(25);
    expect(tipDegrees(view(w, c))).toBeLessThan(35);
  });
});

describe('crate riding as vehicle cargo', () => {
  it('keeps its 30 degree tilt on board and when unloaded', async () => {
    const { w, c } = await tiltedCrate();
    const truck = w.spawn({ kind: 'vehicle', ownerNodeId: 'truck', position: { x: -2, y: 0.5, z: 0 }, size: { x: 2.5, y: 1, z: 1.4 }, color: '#f00', solid: true, vehicle: { model: 'truck', steerMode: 'direction', maxSpeed: 8, accel: 8 } });
    expect(w.loadCargo(truck, 6, 4)).toBe(c);
    run(w, 1);
    expect(tipDegrees(view(w, c))).toBeCloseTo(30, 3);
    expect(w.unloadCargo(truck)).toBe(c);
    w.step(1 / 60);
    const v = view(w, c);
    expect(v.rotation).toBeDefined();
    expect(tipDegrees(v)).toBeGreaterThan(25);
    expect(tipDegrees(v)).toBeLessThan(35);
  });
});
