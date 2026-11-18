import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { tipDegrees } from './crate-helpers';

/**
 * Piston heads and arm links push crates through the rigid-body engine while "Vật lý thật" is on: a crate pushed high tips, one
 * pushed low slides, and the pusher still stalls when its force (piston) or torque (joint) is not enough.
 * Crate: 0.4 x 1.2 x 0.4 m, 10 kg, mu 0.5. Sliding it takes mu * m * g = 49.05 N; tipping it about its far bottom edge takes
 * F * h = m * g * 0.2 m, so a push at 1.1 m needs 17.8 N and a push at 0.15 m would need 130.8 N (it slides instead).
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const TALL = { x: 0.4, y: 1.2, z: 0.4 };

interface PistonOpts {
  maxForce?: number;
  /** Height (m) of the piston axis above the floor. */
  y: number;
  head: number;
  kg?: number;
  size?: { x: number; y: number; z: number };
  /** x of the crate centre. */
  crateX?: number;
  wallX?: number;
  speed?: number;
}

function piston(o: PistonOpts) {
  const size = o.size ?? TALL;
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 6 } }],
    ['p', 'linear-actuator', { position: { x: 0, y: o.y, z: 0 }, stroke: 2, maxForce: o.maxForce ?? 100, headSize: o.head, speed: o.speed ?? 0.3 }],
    ['e', 'key', { key: 'KeyE' }],
    ['c0', 'item', { shape: 'crate', position: { x: o.crateX ?? 3, y: size.y / 2, z: 0 }, size, mass: o.kg ?? 10, mu: 0.5 }],
  ];
  if (o.wallX !== undefined) nodes.push(['wall', 'block', { position: { x: o.wallX + 0.5, y: 1, z: 0 }, size: { x: 1, y: 2, z: 3 } }]);
  const r = rig(nodes, [['e', 'held', 'p', 'extend']], '3d', false, true, rapier);
  r.tick(10);
  r.hold('KeyE');
  return r;
}

/** Peak tilt (degrees) over the run, so a crate that tips and then lies flat still counts. `force` is the largest rod force read. */
function peakTilt(r: ReturnType<typeof piston>, ticks: number): number {
  let peak = 0;
  for (let i = 0; i < ticks; i++) {
    r.tick(1);
    peak = Math.max(peak, tipDegrees(r.entity('c0')!));
    peakForce = Math.max(peakForce, r.out('p', 'force') as number);
  }
  return peak;
}
let peakForce = 0;

describe('a piston pushes a crate through the engine', () => {
  it('pushed high (axis at 1.1 m, hand calc: tips at 17.8 N, piston has 100 N) the crate tips over', () => {
    const r = piston({ y: 1.1, head: 0.3 });
    const peak = peakTilt(r, 60 * 8);
    expect(peak).toBeGreaterThan(60);
    expect(r.out('p', 'overloaded')).toBe(false);
  });

  it('pushed low (axis at 0.15 m, tipping would need 130.8 N) the crate slides and stays upright', () => {
    peakForce = 0;
    const r = piston({ y: 0.15, head: 0.3 });
    const peak = peakTilt(r, 60 * 8);
    expect(peak).toBeLessThan(3);
    expect(r.entity('c0')!.position.x).toBeGreaterThan(3.6);
    // The rod needs mu * m * g = 49.05 N while it pushes.
    expect(peakForce).toBeCloseTo(49.05, 1);
  });

  it('a low piston weaker than mu * m * g (40 N against 49.05 N, tipping would need 130.8 N) stalls: overloaded, the crate does not move or tip', () => {
    peakForce = 0;
    const r = piston({ y: 0.15, head: 0.3, maxForce: 40 });
    const peak = peakTilt(r, 60 * 6);
    expect(r.entity('c0')!.position.x).toBeCloseTo(3, 2);
    expect(peak).toBeLessThan(1);
    expect(r.out('p', 'overloaded')).toBe(true);
    expect(peakForce).toBeCloseTo(40, 3);
  });

  it('a crate against a wall is not crushed into it: the rod stops short and holds the crate there', () => {
    const r = piston({ y: 0.15, head: 0.3, maxForce: 1000, size: { x: 0.4, y: 0.4, z: 0.4 }, wallX: 3.6, crateX: 3.2, speed: 1 });
    r.tick(60 * 6);
    const c = r.entity('c0')!.position;
    // The crate's right face may not pass the wall face at 3.6 by more than the engine's contact skin.
    expect(c.x + 0.2).toBeLessThan(3.6 + 0.02);
    expect(c.x).toBeGreaterThan(3.3);
    const headFront = r.entity('p')!.position.x;
    expect(headFront).toBeLessThan(3.6);
  });

  it('a 10 kg crate pushed as in the old model still needs the same force: 60 N pushes it far, the tipped crate leaves the head behind', () => {
    const r = piston({ y: 1.1, head: 0.3, maxForce: 60 });
    r.tick(60 * 8);
    expect(r.entity('c0')!.position.x).toBeGreaterThan(3.3);
    expect(r.out('p', 'overloaded')).toBe(false);
  });
});

describe('an arm link sweeping across the floor pushes a crate through the engine', () => {
  /** Yaw joint on a post (pivot at the origin, 1 m up), a 2 m solid link along +x; it swings toward -z and meets a crate about 1.5 m out. */
  function sweep(torque: number, kg: number, pivotY: number) {
    const nodes: NodeSpec[] = [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 40 } }],
      ['pivot', 'block', { position: { x: -1, y: 0.3, z: 0 }, size: { x: 1.2, y: 0.6, z: 0.6 } }],
      ['go', 'on-start'],
      ['ang', 'const', { value: 60 }],
      ['j', 'joint', { axis: 'yaw', min: -90, max: 90, start: 0, maxTorque: torque, mount: { x: 1, y: pivotY - 0.3, z: 0 }, solid: 'yes', maxSpeed: 15 }],
      ['l', 'link', { length: 2, mass: 1, thickness: 0.2, solid: 'yes' }],
      ['c', 'item', { shape: 'crate', position: { x: 1.5, y: 0.6, z: -0.5 }, size: TALL, mass: kg, mu: 0.5 }],
    ];
    const wires: WireSpec[] = [
      ['pivot', 'self', 'j', 'base'],
      ['go', 'started', 'j', 'power'],
      ['ang', 'value', 'j', 'angle'],
      ['j', 'tip', 'l', 'base'],
    ];
    return rig(nodes, wires, '3d', false, true, rapier);
  }

  function peak(r: ReturnType<typeof sweep>, ticks: number): number {
    let p = 0;
    for (let i = 0; i < ticks; i++) {
      r.tick(1);
      p = Math.max(p, tipDegrees(r.entity('c')!));
    }
    return p;
  }

  it('a link at 1.0 m high sweeps a tall crate: it tips over', () => {
    const r = sweep(500, 10, 1.0);
    expect(peak(r, 60 * 8)).toBeGreaterThan(45);
    expect(r.entity('c')!.position.z).toBeLessThan(-0.6);
    expect(r.out('j', 'overloaded')).toBe(false);
  });

  it('a link at 0.15 m high slides the same crate without tipping it', () => {
    const r = sweep(500, 10, 0.15);
    expect(peak(r, 60 * 8)).toBeLessThan(5);
    expect(r.entity('c')!.position.z).toBeLessThan(-0.6);
  });

  it('a low link and a servo with too little torque (40 N m against about 74 N m) stays: the crate is not touched', () => {
    const r = sweep(40, 10, 0.15);
    expect(peak(r, 60 * 4)).toBeLessThan(0.5);
    expect(r.entity('c')!.position.z).toBeCloseTo(-0.5, 2);
    expect(r.out('j', 'overloaded')).toBe(true);
  });
});
