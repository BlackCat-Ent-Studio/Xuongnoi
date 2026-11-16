import { describe, expect, it } from 'vitest';
import {
  G,
  accelFromForce,
  crushed,
  frictionForce,
  gripHolds,
  jointCanLift,
  maxPayloadKg,
  maxStaticAngle,
  slopeHold,
  torque,
  weight,
} from '../../src/world/mechanics';

describe('weight, torque, acceleration', () => {
  it('weight = m g', () => {
    expect(weight(5)).toBeCloseTo(49.05, 6);
    expect(weight(5, 1.62)).toBeCloseTo(8.1, 6);
    expect(weight(5, G, 0)).toBe(0);
    expect(weight(5, G, 2)).toBeCloseTo(98.1, 6);
  });
  it('bad input gives 0, never NaN', () => {
    expect(weight(NaN)).toBe(0);
    expect(weight(-3)).toBe(0);
    expect(accelFromForce(10, 0)).toBe(0);
    expect(accelFromForce(NaN, 2)).toBe(0);
  });
  it('torque = F r and a = F / m', () => {
    expect(torque(20, 0.5)).toBe(10);
    expect(accelFromForce(30, 6)).toBe(5);
  });
  it('friction = mu N', () => {
    expect(frictionForce(0.5, 49.05)).toBeCloseTo(24.525, 6);
    expect(frictionForce(-1, 10)).toBe(0);
  });
});

describe('gripHolds: 2 mu F >= m g', () => {
  it('5 kg, mu 0.5, 2 fingers needs 49.05 N per finger', () => {
    const w = weight(5);
    const exact = gripHolds({ gripForceN: 49.05, mu: 0.5, weightN: w });
    expect(exact.requiredForceN).toBeCloseTo(49.05, 6);
    expect(exact.holds).toBe(true);
    expect(exact.marginN).toBeCloseTo(0, 6);
    const weak = gripHolds({ gripForceN: 40, mu: 0.5, weightN: w });
    expect(weak.holds).toBe(false);
    expect(weak.marginN).toBeCloseTo(-9.05, 6);
  });
  it('a slicker surface or fewer fingers needs more force', () => {
    const w = weight(5);
    expect(gripHolds({ gripForceN: 0, mu: 0.25, weightN: w }).requiredForceN).toBeCloseTo(98.1, 6);
    expect(gripHolds({ gripForceN: 0, mu: 0.5, fingers: 3, weightN: w }).requiredForceN).toBeCloseTo(32.7, 6);
    expect(gripHolds({ gripForceN: 0, mu: 0.5, fingers: 1, weightN: w }).requiredForceN).toBeCloseTo(98.1, 6);
  });
  it('lifting upward at 9.81 m/s2 doubles the load', () => {
    const r = gripHolds({ gripForceN: 0, mu: 0.5, weightN: weight(5), accel: G });
    expect(r.requiredForceN).toBeCloseTo(98.1, 6);
    expect(gripHolds({ gripForceN: 0, mu: 0.5, weightN: weight(5), accel: -G }).requiredForceN).toBe(0);
  });
  it('no friction or no fingers never holds a weight; nothing to hold always holds', () => {
    expect(gripHolds({ gripForceN: 1e6, mu: 0, weightN: 10 })).toMatchObject({ holds: false, requiredForceN: Infinity });
    expect(gripHolds({ gripForceN: 1e6, mu: 0.5, fingers: 0, weightN: 10 }).holds).toBe(false);
    expect(gripHolds({ gripForceN: 0, mu: 0, weightN: 0 }).holds).toBe(true);
  });
});

describe('crushed', () => {
  it('breaks only above a positive limit', () => {
    expect(crushed(200, 200)).toBe(false);
    expect(crushed(200.1, 200)).toBe(true);
    expect(crushed(1e9, 0)).toBe(false);
    expect(crushed(NaN, 200)).toBe(false);
  });
});

describe('joint torque', () => {
  it('30 N·m at 0.5 m lifts 6.1 kg', () => {
    expect(maxPayloadKg(30, 0.5)).toBeCloseTo(6.116, 3);
    expect(jointCanLift({ torqueMaxNm: 30, loads: [{ massKg: 6, armM: 0.5 }] })).toMatchObject({ ok: true });
    const over = jointCanLift({ torqueMaxNm: 30, loads: [{ massKg: 6.2, armM: 0.5 }] });
    expect(over.ok).toBe(false);
    expect(over.requiredNm).toBeCloseTo(30.411, 3);
    expect(over.marginNm).toBeCloseTo(-0.411, 3);
  });
  it('sums loads and takes the cosine of the arm angle', () => {
    const loads = [{ massKg: 2, armM: 0.25 }, { massKg: 4, armM: 0.5 }];
    expect(jointCanLift({ torqueMaxNm: 100, loads }).requiredNm).toBeCloseTo(24.525, 6);
    expect(jointCanLift({ torqueMaxNm: 100, loads, angle: Math.PI / 3 }).requiredNm).toBeCloseTo(12.2625, 6);
    expect(jointCanLift({ torqueMaxNm: 1, loads, angle: Math.PI / 2 }).ok).toBe(true);
  });
  it('the arm own weight reduces the payload', () => {
    // 30 N·m minus a 2 kg link at 0.25 m (4.905 N·m) leaves 25.095 N·m for the payload at 0.5 m.
    expect(maxPayloadKg(30, 0.5, [{ massKg: 2, armM: 0.25 }])).toBeCloseTo(25.095 / (G * 0.5), 6);
    expect(maxPayloadKg(3, 0.5, [{ massKg: 2, armM: 0.25 }])).toBe(0);
    expect(maxPayloadKg(30, 0)).toBe(Infinity);
  });
});

describe('slope', () => {
  it('holds while mu >= tan(angle)', () => {
    expect(maxStaticAngle(1)).toBeCloseTo(Math.PI / 4, 9);
    expect(slopeHold(0.5, 10, Math.atan(0.4)).holds).toBe(true);
    const slide = slopeHold(0.5, 10, Math.atan(0.6));
    expect(slide.holds).toBe(false);
    expect(slide.marginN).toBeLessThan(0);
  });
});
