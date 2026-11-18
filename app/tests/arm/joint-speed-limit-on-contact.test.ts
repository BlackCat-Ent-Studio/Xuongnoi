import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';

/**
 * "Vật lý thật": a joint that swings a link into a crate gives it at most the speed its spare force allows, like a piston
 * (a = (available force - needed force) / m at the contact point). Without that a link swung fast hits the crate at its own speed
 * and the crate takes kinetic energy no motor could have given it.
 *
 * Hand numbers. Crate 10 kg, mu 0.5, 0.4 m cube, on a table 1.5 m from the joint axis (its near face 1.3 m).
 *   Needed to slide it   mu m g = 0.5 x 10 x 9.81 = 49.05 N (tipping a low cube needs far more).
 *   Joint torque 150 N m, lever of the touching slice about 1.3 m  ->  about 115 N, spare about 66 N, a = spare / m = about 6.6 m/s2.
 *   Energy rule: kinetic energy of the crate <= spare force x distance it was pushed (+ 1 J for the engine's contact noise).
 * Link tip speed at 1.3 m: 15 deg/s = 0.34 m/s, 40 deg/s = 0.91 m/s, 120 deg/s = 2.72 m/s.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const G = 9.81;
const DEG = Math.PI / 180;

function swing(degPerSecond: number, torque = 150) {
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 60 } }],
    ['ped', 'block', { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 1, z: 0.4 } }],
    ['table', 'block', { position: { x: 1.5, y: 0.45, z: 0 }, size: { x: 6, y: 0.9, z: 10 } }],
    ['go', 'on-start'],
    ['sw', 'const', { value: 85 }],
    ['j', 'joint', { axis: 'yaw', start: 0, min: -90, max: 90, maxTorque: torque, maxSpeed: degPerSecond, mount: { x: 0, y: 0.75, z: 0 }, solid: 'yes' }],
    ['l', 'link', { length: 2.2, mass: 0, thickness: 0.2, solid: 'yes' }],
    // 0.4 m cube on the table (top y 0.9), 1.5 m from the axis, 20 degrees round from the arm.
    ['c', 'item', { shape: 'crate', position: { x: 1.5 * Math.cos(20 * DEG), y: 1.1, z: -1.5 * Math.sin(20 * DEG) }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 10, mu: 0.5 }],
  ];
  const wires: WireSpec[] = [
    ['ped', 'self', 'j', 'base'],
    ['go', 'started', 'j', 'power'],
    ['sw', 'value', 'j', 'angle'],
    ['j', 'tip', 'l', 'base'],
  ];
  const r = rig(nodes, wires, '3d', false, true, rapier);
  r.tick(5);
  const c0 = { ...r.entity('c')!.position };
  let peakSpeed = 0;
  let worstExcessJ = -Infinity;
  let pushed = 0;
  let last = { ...c0 };
  let startedAt = -1;
  let everOverloaded = false;
  const seconds = 85 / degPerSecond + 1;
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    r.tick();
    const e = r.entity('c')!;
    const step = Math.hypot(e.position.x - last.x, e.position.z - last.z);
    pushed += step;
    last = { ...e.position };
    // Speed from the distance covered in one tick (the view carries no velocity).
    const v = step * 60;
    if (startedAt < 0 && Math.hypot(e.position.x - c0.x, e.position.z - c0.z) > 1e-3) startedAt = i;
    peakSpeed = Math.max(peakSpeed, v);
    everOverloaded = everOverloaded || r.out('j', 'overloaded') === true;
    worstExcessJ = Math.max(worstExcessJ, 0.5 * 10 * v * v - spareN(torque) * pushed);
  }
  return { r, peakSpeed, worstExcessJ, pushed, overloaded: everOverloaded };
}

/** Spare force (N) at the touching slice: the slice that meets the crate is about 1.3 m out (the crate's near face). */
const spareN = (torque: number): number => torque / 1.3 - 0.5 * 10 * G;

describe('a joint swinging a link into a crate: the crate gains at most what the spare force allows', () => {
  for (const speed of [15, 40, 120]) {
    it(`${speed} deg/s: kinetic energy never above spare force x distance (+ 1 J); crate speed under sqrt(2 a d)`, () => {
      const o = swing(speed);
      expect(o.pushed).toBeGreaterThan(0.3);
      // Energy: 0.5 m v^2 <= (F_available - mu m g) d.
      expect(o.worstExcessJ).toBeLessThan(1);
      // Speed: never above what the spare force gives over the whole distance (a = 6.6 m/s2 at least 66 N spare).
      const a = spareN(150) / 10;
      expect(o.peakSpeed).toBeLessThan(Math.sqrt(2 * a * o.pushed) + 0.2);
      expect(o.overloaded).toBe(false);
    });
  }

  it('a slow swing (15 deg/s) is not held back: the crate keeps up with the link (0.34 m/s at 1.3 m, 0.5 m/s at 1.9 m)', () => {
    const o = swing(15);
    expect(o.peakSpeed).toBeGreaterThan(0.25);
    expect(o.peakSpeed).toBeLessThan(0.55);
  });

  it('a fast swing still moves the crate and reaches the end of its travel, but never throws it faster than the link tip (120 deg/s x 2.2 m = 4.6 m/s)', () => {
    const o = swing(120);
    // Measured before the limit: the crate left the table at 17 m/s (40 deg/s: 24 m/s) with 1300 to 2700 J more than the force could give.
    expect(o.peakSpeed).toBeLessThan(4.6);
    expect(o.r.out('j', 'angleNow') as number).toBeGreaterThan(80);
  });
});
