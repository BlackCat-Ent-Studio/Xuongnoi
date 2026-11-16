import { describe, expect, it } from 'vitest';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';

/** Gripper on a small block at the origin: the grasp point is 0.3 m ahead of it (x = 0.3). */
function gripperRig(crateX: number, gripper: Record<string, number> = {}, crateSize = 0.4) {
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 20, y: 1, z: 4 } }],
    ['hand', 'block', { position: { x: 0, y: 0.3, z: 0 }, size: { x: 0.1, y: 0.1, z: 0.1 }, type: 'pickup' }],
    ['g', 'gripper', { reach: 0.5, width: 1, ...gripper }],
    ['c', 'item', { shape: 'crate', position: { x: crateX, y: 0.3, z: 0 }, size: { x: crateSize, y: crateSize, z: crateSize }, mass: 1 }],
    ['k', 'key', { key: 'Space' }],
  ];
  const wires: WireSpec[] = [
    ['hand', 'self', 'g', 'base'],
    ['k', 'held', 'g', 'close'],
  ];
  const r = rig(nodes, wires);
  r.tick(20);
  return r;
}

describe('gripper: object in reach', () => {
  it('true when a crate is within reach, false when it is too far', () => {
    const near = gripperRig(0.6);
    expect(near.out('g', 'inReach')).toBe(true);
    expect(near.out('g', 'candidate')).toBe(near.entity('c')!.id);
    const far = gripperRig(1.2);
    expect(far.out('g', 'inReach')).toBe(false);
    expect(far.out('g', 'candidate')).toBeNull();
  });

  it('false when the crate is wider than the opening, true for a narrower one', () => {
    const wide = gripperRig(0.6, { width: 0.3 }, 0.4);
    expect(wide.out('g', 'inReach')).toBe(false);
    expect(wide.out('g', 'candidate')).toBeNull();
    const fits = gripperRig(0.6, { width: 0.5 }, 0.4);
    expect(fits.out('g', 'inReach')).toBe(true);
  });

  it('is held state: it stays true while the crate is gripped, and tracks the crate as it moves away', () => {
    const r = gripperRig(0.6);
    r.hold('Space');
    r.tick(10);
    expect(r.out('g', 'holding')).toBe(true);
    expect(r.out('g', 'inReach')).toBe(true);
    expect(r.out('g', 'candidate')).toBe(r.entity('c')!.id);
    r.hold();
    r.tick(5);
    expect(r.out('g', 'holding')).toBe(false);
    expect(r.out('g', 'inReach')).toBe(true);
  });
});

/** Joint on a block at the origin, aimed at `target` degrees; a heavy link makes it overload. */
function jointRig(target: number, joint: Record<string, number> = {}, linkKg = 0) {
  const nodes: NodeSpec[] = [
    ['base', 'block', { position: { x: 0, y: 1, z: 0 }, size: { x: 0.5, y: 0.5, z: 0.5 }, type: 'pickup' }],
    ['go', 'on-start'],
    ['t', 'const', { value: target }],
    ['j', 'joint', { start: 0, min: -90, max: 90, maxTorque: 50, maxSpeed: 10, ...joint }],
    ['l', 'link', { length: 1, mass: linkKg }],
  ];
  const wires: WireSpec[] = [
    ['base', 'self', 'j', 'base'],
    ['go', 'started', 'j', 'power'],
    ['t', 'value', 'j', 'angle'],
    ['j', 'tip', 'l', 'base'],
  ];
  return rig(nodes, wires);
}

describe('joint: reached', () => {
  it('turns true once the angle is within the tolerance of the target', () => {
    const r = jointRig(30);
    r.tick(5);
    expect(r.out('j', 'reached')).toBe(false);
    r.tick(60 * 3 + 10);
    expect(r.out('j', 'angleNow')).toBeCloseTo(30, 6);
    expect(r.out('j', 'reached')).toBe(true);
  });

  it('a wide tolerance counts earlier, a zero tolerance only on the dot', () => {
    // 10 deg/s: after 1 s the joint is at about 10 deg, still 20 deg from the target.
    const wide = jointRig(30, { tolerance: 20 });
    wide.tick(5);
    expect(wide.out('j', 'reached')).toBe(false);
    wide.tick(60);
    expect(wide.out('j', 'reached')).toBe(true);
    const tight = jointRig(30, { tolerance: 0 });
    tight.tick(60);
    expect(tight.out('j', 'reached')).toBe(false);
    tight.tick(150);
    expect(tight.out('j', 'reached')).toBe(true);
  });

  it('is false while the joint is overloaded, even when the angle matches', () => {
    // A 100 kg link 0.5 m out needs 490 N m; the joint holds 50: it sags and never reaches 0 deg.
    const r = jointRig(0, { maxTorque: 50 }, 100);
    r.tick(60);
    expect(r.out('j', 'overloaded')).toBe(true);
    expect(r.out('j', 'reached')).toBe(false);
  });
});
