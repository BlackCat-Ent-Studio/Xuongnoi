import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';

/**
 * A solid arm is bolted to its mount (the pillar or cap it stands on). The first link cubes and the hub sit on the pillar top, so they
 * overlap it where they stand: the arm does not count its own mount as in the way, but everything else (a floor, a wall) still stops it,
 * and so does the mount itself for any cube that is not touching it at the start of a step.
 *
 * Hand numbers. Pillar top at y = 1.0, pivot on it. Link 2 m, thickness 0.2: its cubes are at 0.1, 0.3 ... 1.9 m along the link.
 *   Up to +40 deg: nothing in the way, the joint reaches 40 deg and reads no overload.
 *   Down: the outermost cube (centre 1.9 m along the link, upright cover 0.2 m high) meets the floor when 1.0 - 1.9 sin a - 0.1 = 0,
 *   sin a = 0.9 / 1.9 = 0.4737, a = 28.3 deg down.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

function arm(target: number) {
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 30 } }],
    ['ped', 'block', { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 1, z: 0.4 } }],
    ['go', 'on-start'],
    ['ang', 'const', { value: target }],
    ['j', 'joint', { axis: 'pitch', start: 0, min: -90, max: 90, maxTorque: 200, maxSpeed: 30, mount: { x: 0, y: 0.5, z: 0 }, solid: 'yes' }],
    ['l', 'link', { length: 2, mass: 0, thickness: 0.2, solid: 'yes' }],
  ];
  const wires: WireSpec[] = [
    ['ped', 'self', 'j', 'base'],
    ['go', 'started', 'j', 'power'],
    ['ang', 'value', 'j', 'angle'],
    ['j', 'tip', 'l', 'base'],
  ];
  const r = rig(nodes, wires, '3d', false, true, rapier);
  r.tick(60 * 6);
  return r;
}

describe('a solid arm does not block itself on its own mount', () => {
  it('up 40 degrees: the cubes on the pillar top do not stop it', () => {
    const r = arm(40);
    expect(r.out('j', 'angleNow') as number).toBeCloseTo(40, 0);
    expect(r.out('j', 'overloaded')).toBe(false);
  });

  it('down: the floor still stops the link, at about 28.3 deg (-27 to -30.6), and the joint says so', () => {
    const r = arm(-60);
    const a = r.out('j', 'angleNow') as number;
    expect(a).toBeLessThan(-27);
    expect(a).toBeGreaterThan(-30.6);
    expect(r.out('j', 'overloaded')).toBe(true);
  });
});
