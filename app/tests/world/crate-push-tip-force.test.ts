import { beforeAll, describe, expect, it } from 'vitest';
import { tipForceN } from '../../src/world/crate-tipping';
import { planPush } from '../../src/world/linear-actuator';
import { obbOf, rotateBy, type Quat } from '../../src/world/oriented-box';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { tipDegrees } from './crate-helpers';

/**
 * With "Vật lý thật" on a pusher needs only the smaller of the two forces that move a crate:
 *   sliding   F_slide = mu * m * g
 *   tipping   F_tip   = m * g * b / h      (b = half the base, h = height of the push)
 * Crate 0.4 x 1.2 x 0.4 m, 10 kg, mu 0.5: F_slide = 49.05 N; pushed at h = 1.1 m, F_tip = 10 * 9.81 * 0.2 / 1.1 = 17.84 N.
 * A row of crates needs the sum of what each needs. The rod gives a crate only the speed its spare force allows.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const TALL = { x: 0.4, y: 1.2, z: 0.4 };
const CUBE = { x: 0.4, y: 0.4, z: 0.4 };
const G = 9.81;
const F_TIP_HIGH = (10 * G * 0.2) / 1.1;
const F_SLIDE = 0.5 * 10 * G;

interface PistonOpts {
  y: number;
  maxForce: number;
  head?: number;
  speed?: number;
  /** Crates: x of the centre and size. */
  crates?: { x: number; size?: { x: number; y: number; z: number } }[];
  wallX?: number;
  stroke?: number;
  originX?: number;
}

function piston(o: PistonOpts) {
  const crates = o.crates ?? [{ x: 3, size: TALL }];
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 6 } }],
    ['p', 'linear-actuator', { position: { x: o.originX ?? 0, y: o.y, z: 0 }, stroke: o.stroke ?? 2, maxForce: o.maxForce, headSize: o.head ?? 0.3, speed: o.speed ?? 0.3 }],
    ['e', 'key', { key: 'KeyE' }],
    ...crates.map((c, i): NodeSpec => [`c${i}`, 'item', { shape: 'crate', position: { x: c.x, y: (c.size ?? TALL).y / 2, z: 0 }, size: c.size ?? TALL, mass: 10, mu: 0.5 }]),
  ];
  if (o.wallX !== undefined) nodes.push(['wall', 'block', { position: { x: o.wallX + 0.5, y: 1, z: 0 }, size: { x: 1, y: 2, z: 3 } }]);
  const r = rig(nodes, [['e', 'held', 'p', 'extend']], '3d', false, true, rapier);
  r.tick(10);
  r.hold('KeyE');
  return r;
}

type Piston = ReturnType<typeof piston>;

/** Runs `ticks`; returns the peak tilt of crate c0 and the largest force read from the rod. */
function run(r: Piston, ticks: number): { tilt: number; force: number } {
  let tilt = 0;
  let force = 0;
  for (let i = 0; i < ticks; i++) {
    r.tick(1);
    tilt = Math.max(tilt, tipDegrees(r.entity('c0')!));
    force = Math.max(force, r.out('p', 'force') as number);
  }
  return { tilt, force };
}

describe('tipping needs less force than sliding', () => {
  it('30 N pushing at h = 1.1 m tips the crate (hand: F_tip 17.84 N < 30 N < F_slide 49.05 N); the rod reads 17.84 N', () => {
    const r = piston({ y: 1.1, maxForce: 30 });
    const m = run(r, 60 * 8);
    expect(m.tilt).toBeGreaterThan(60);
    expect(m.force).toBeCloseTo(F_TIP_HIGH, 1);
    expect(r.out('p', 'overloaded')).toBe(false);
  });

  it('15 N at the same height stalls: below F_tip, the crate stays upright where it was and the rod is overloaded at 15 N', () => {
    const r = piston({ y: 1.1, maxForce: 15 });
    const m = run(r, 60 * 6);
    expect(r.entity('c0')!.position.x).toBeCloseTo(3, 2);
    expect(m.tilt).toBeLessThan(1);
    expect(m.force).toBeCloseTo(15, 3);
    expect(r.out('p', 'overloaded')).toBe(true);
  });

  it('the same piston low (h = 0.15 m, F_tip would be 130.8 N) slides the crate: 45 N stalls, 55 N pushes it and reads 49.05 N', () => {
    const weak = piston({ y: 0.15, maxForce: 45 });
    const w = run(weak, 60 * 6);
    expect(weak.entity('c0')!.position.x).toBeCloseTo(3, 2);
    expect(w.force).toBeCloseTo(45, 3);
    expect(weak.out('p', 'overloaded')).toBe(true);

    const strong = piston({ y: 0.15, maxForce: 55 });
    const s = run(strong, 60 * 8);
    expect(s.tilt).toBeLessThan(3);
    expect(strong.entity('c0')!.position.x).toBeGreaterThan(3.6);
    expect(s.force).toBeCloseTo(F_SLIDE, 1);
    expect(strong.out('p', 'overloaded')).toBe(false);
  });
});

describe('a load needs the sum of what each body needs', () => {
  const row = [{ x: 3, size: CUBE }, { x: 3.4, size: CUBE }];

  it('two touching 10 kg crates pushed low need 2 * 49.05 = 98.1 N: 80 N stalls, 110 N moves both', () => {
    const weak = piston({ y: 0.15, maxForce: 80, crates: row });
    run(weak, 60 * 6);
    expect(weak.entity('c0')!.position.x).toBeCloseTo(3, 2);
    expect(weak.entity('c1')!.position.x).toBeCloseTo(3.4, 2);
    expect(weak.out('p', 'overloaded')).toBe(true);
    expect(weak.out('p', 'force')).toBeCloseTo(80, 3);

    const strong = piston({ y: 0.15, maxForce: 110, crates: row });
    const s = run(strong, 60 * 8);
    expect(strong.entity('c1')!.position.x).toBeGreaterThan(3.9);
    expect(s.force).toBeCloseTo(2 * F_SLIDE, 1);
    expect(strong.out('p', 'overloaded')).toBe(false);
  });

  it('a crate pressed against a wall does not move: the head stops short and the rod reads all it has (1000 N)', () => {
    const r = piston({ y: 0.15, maxForce: 1000, crates: [{ x: 3.4, size: CUBE }], wallX: 3.6, speed: 1 });
    run(r, 60 * 6);
    expect(r.entity('c0')!.position.x + 0.2).toBeLessThan(3.6 + 0.02);
    expect(r.entity('c0')!.position.x).toBeGreaterThan(3.38);
    expect(r.entity('p')!.position.x + 0.15).toBeLessThanOrEqual(3.2 + 0.02);
    expect(r.out('p', 'force')).toBeCloseTo(1000, 3);
  });

  it('a crate against a wall with a piston weaker than sliding (30 N < 49.05 N) is overloaded at 30 N', () => {
    const r = piston({ y: 0.15, maxForce: 30, crates: [{ x: 3.4, size: CUBE }], wallX: 3.6 });
    run(r, 60 * 6);
    expect(r.entity('c0')!.position.x).toBeCloseTo(3.4, 2);
    expect(r.out('p', 'overloaded')).toBe(true);
    expect(r.out('p', 'force')).toBeCloseTo(30, 3);
  });
});

describe('a crate that is already tilted', () => {
  /** A 0.4 x 1.2 x 0.4 crate tipped forward (+x) by `deg`, resting on its far bottom edge at x = 1, y = 0. */
  function tilted(deg: number) {
    const t = (deg * Math.PI) / 180;
    const q: Quat = { x: 0, y: 0, z: -Math.sin(t / 2), w: Math.cos(t / 2) };
    const pivot = { x: 1, y: 0, z: 0 };
    const off = rotateBy(q, { x: 0.2, y: -0.6, z: 0 });
    return { q, centre: { x: pivot.x - off.x, y: pivot.y - off.y, z: 0 } };
  }

  it('upright: F_tip = m g b / h = 17.84 N at h = 1.1 m', () => {
    expect(tipForceN(obbOf({ x: 0, y: 0.6, z: 0 }, TALL), { x: 1, y: 0, z: 0 }, 1.1, 10)).toBeCloseTo(F_TIP_HIGH, 3);
  });

  it('tipped 10 degrees: the centre of mass is nearer the pivot, a = b cos(10) - (H/2) sin(10) = 0.0928 m, so a push 1.0 m above the pivot needs 9.10 N', () => {
    const { q, centre } = tilted(10);
    const a = 0.2 * Math.cos(Math.PI / 18) - 0.6 * Math.sin(Math.PI / 18);
    expect(tipForceN(obbOf(centre, TALL, q), { x: 1, y: 0, z: 0 }, 1.0, 10)).toBeCloseTo((10 * G * a) / 1.0, 3);
  });

  it('tipped past the balance point (about 18.4 degrees) it falls by itself: no force', () => {
    const { q, centre } = tilted(25);
    expect(tipForceN(obbOf(centre, TALL, q), { x: 1, y: 0, z: 0 }, 1.0, 10)).toBe(0);
  });

  it('a push level with or under the pivot cannot tip it', () => {
    expect(tipForceN(obbOf({ x: 0, y: 0.6, z: 0 }, TALL), { x: 1, y: 0, z: 0 }, 0, 10)).toBe(Infinity);
  });

  it('the plan of a lying crate (turned 90 degrees) uses its real outline: sliding, because h < b', () => {
    const q: Quat = { x: 0, y: 0, z: Math.sin(Math.PI / 4), w: Math.cos(Math.PI / 4) };
    const real = obbOf({ x: 3, y: 0.2, z: 0 }, TALL, q);
    const plan = planPush({
      head: { pos: { x: 2.3, y: 0.15, z: 0 }, size: { x: 0.3, y: 0.3, z: 0.3 } },
      dir: { x: 1, y: 0, z: 0 },
      step: 0.1,
      bodies: [{ id: 'c', box: { pos: { x: 3, y: 0.2, z: 0 }, size: { x: 1.2, y: 0.4, z: 0.4 } }, massKg: 10, mu: 0.5, real }],
      solids: [],
    });
    expect(plan.moves.map((m) => m.id)).toEqual(['c']);
    // Lying on its long side: b = 0.6, h = 0.15 -> F_tip = 392 N; sliding takes 49.05 N.
    expect(plan.requiredN).toBeCloseTo(F_SLIDE, 3);
  });
});

describe('a joint turns a link into a crate: torque = force x lever arm', () => {
  /** Yaw joint on a post (pivot 1 m up, mount x = 1 gives the joint at x = 0), a 2 m solid link along +x swinging toward -z onto a crate at x 1.3..1.7. */
  function sweep(torque: number, pivotY: number) {
    const nodes: NodeSpec[] = [
      ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 40 } }],
      ['pivot', 'block', { position: { x: -1, y: 0.3, z: 0 }, size: { x: 1.2, y: 0.6, z: 0.6 } }],
      ['go', 'on-start'],
      ['ang', 'const', { value: 60 }],
      ['j', 'joint', { axis: 'yaw', min: -90, max: 90, start: 0, maxTorque: torque, mount: { x: 1, y: pivotY - 0.3, z: 0 }, solid: 'yes', maxSpeed: 15 }],
      ['l', 'link', { length: 2, mass: 1, thickness: 0.2, solid: 'yes' }],
      ['c', 'item', { shape: 'crate', position: { x: 1.5, y: 0.6, z: -0.5 }, size: TALL, mass: 10, mu: 0.5 }],
    ];
    const wires: WireSpec[] = [
      ['pivot', 'self', 'j', 'base'],
      ['go', 'started', 'j', 'power'],
      ['ang', 'value', 'j', 'angle'],
      ['j', 'tip', 'l', 'base'],
    ];
    return rig(nodes, wires, '3d', false, true, rapier);
  }

  function go(r: ReturnType<typeof sweep>, ticks: number): { tilt: number; load: number } {
    let tilt = 0;
    let load = 0;
    for (let i = 0; i < ticks; i++) {
      r.tick(1);
      tilt = Math.max(tilt, tipDegrees(r.entity('c')!));
      load = Math.max(load, r.out('j', 'load') as number);
    }
    return { tilt, load };
  }

  // The link cubes that can meet the crate lie 1.3 to 1.9 m from the axis (the outermost one hits first). A push at h = 1.0 m needs F_tip = 98.1 * 0.2 / 1.0 = 19.62 N,
  // so the torque is 19.62 * (1.3..1.9) = 25.5 .. 37.3 N m; sliding would need 49.05 N, 63.8 .. 93.2 N m.
  it('a link 1.0 m high: 20 N m stalls (overloaded, crate untouched), 40 N m tips the crate', () => {
    const weak = sweep(20, 1.0);
    const w = go(weak, 60 * 4);
    expect(w.tilt).toBeLessThan(0.5);
    expect(weak.entity('c')!.position.z).toBeCloseTo(-0.5, 2);
    expect(weak.out('j', 'overloaded')).toBe(true);
    expect(w.load).toBeGreaterThan(19.62 * 1.3 - 1e-6);
    expect(w.load).toBeLessThan(19.62 * 1.9 + 1e-6);

    const strong = sweep(40, 1.0);
    const s = go(strong, 60 * 8);
    expect(s.tilt).toBeGreaterThan(45);
    expect(strong.out('j', 'overloaded')).toBe(false);
  });

  it('a link 0.15 m high needs the sliding torque (63.8 .. 93.2 N m): 40 N m stalls, 100 N m pushes it without tipping', () => {
    const weak = sweep(40, 0.15);
    const w = go(weak, 60 * 4);
    expect(w.tilt).toBeLessThan(0.5);
    expect(weak.out('j', 'overloaded')).toBe(true);
    expect(w.load).toBeGreaterThan(F_SLIDE * 1.3 - 1e-6);
    expect(w.load).toBeLessThan(F_SLIDE * 1.9 + 1e-6);

    const strong = sweep(100, 0.15);
    const s = go(strong, 60 * 8);
    expect(s.tilt).toBeLessThan(5);
    expect(strong.entity('c')!.position.z).toBeLessThan(-0.6);
  });
});

describe('a fast piston gives a crate only the speed its spare force allows', () => {
  /** Piston 100 N, rod out 3 m, head 0.4 m cube at crate height; crate 10 kg, mu 0.5, face at x = 2.0. Spare force 100 - 49.05 = 50.95 N, so a = 5.095 m/s2. */
  function fast(speed: number) {
    const r = piston({ y: 0.2, maxForce: 100, head: 0.4, speed, stroke: 3, originX: -3, crates: [{ x: 2.2, size: CUBE }] });
    let prev = 2.2;
    let peakV = 0;
    let deepest = -Infinity;
    let pushedTo = 2.2;
    for (let i = 0; i < 100; i++) {
      r.tick(1);
      const c = r.entity('c0')!.position.x;
      const frontOfHead = r.entity('p')!.position.x + 0.2;
      const rearOfCrate = c - 0.2;
      peakV = Math.max(peakV, (c - prev) * 60);
      prev = c;
      deepest = Math.max(deepest, frontOfHead - rearOfCrate);
      if (frontOfHead >= rearOfCrate - 0.005) pushedTo = c;
    }
    return { peakV, deepest, distance: pushedTo - 2.2 };
  }

  const SPARE = 100 - F_SLIDE;

  for (const speed of [2, 6, 12]) {
    it(`rod at ${speed} m/s: the head never ends inside the crate and the crate's energy stays within spare force x distance`, () => {
      const m = fast(speed);
      // The head stays at the crate's face (the engine's contact skin is a few millimetres).
      expect(m.deepest).toBeLessThan(0.02);
      // Hand: v^2 = 2 a d  <=>  1/2 m v^2 = (F - mu m g) d. A tick of slack on the distance (it is measured at tick ends).
      const kinetic = 0.5 * 10 * m.peakV ** 2;
      expect(kinetic).toBeLessThan(SPARE * (m.distance + 0.2) + 1);
      // And it is not stuck either: it reaches the speed the rod asked for, or what the force allows over the stroke.
      expect(m.peakV).toBeGreaterThan(Math.min(speed, 3) * 0.9);
      expect(m.peakV).toBeLessThan(speed * 1.05);
    });
  }
});
