import { describe, expect, it } from 'vitest';
import {
  DEG,
  advance,
  dirOf,
  extentAlong,
  horizontalArm,
  lateralOf,
  localToWorld,
  normalOf,
  rotateFrame,
  sagDirection,
  stepJoint,
  wrapDeg,
  type Frame,
} from '../../src/world/arm-kinematics';

const origin: Frame = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0 };

describe('forward kinematics', () => {
  it('a level frame points along +x, up is +y, sideways is +z', () => {
    const near = (v: { x: number; y: number; z: number }, x: number, y: number, z: number): void => {
      expect(v.x).toBeCloseTo(x, 12);
      expect(v.y).toBeCloseTo(y, 12);
      expect(v.z).toBeCloseTo(z, 12);
    };
    near(dirOf(origin), 1, 0, 0);
    near(normalOf(origin), 0, 1, 0);
    near(lateralOf(origin), 0, 0, 1);
  });

  it('pitch 90 points straight up; yaw 90 points toward -z (the 3D view turn)', () => {
    const up = dirOf({ ...origin, pitch: 90 * DEG });
    expect(up.x).toBeCloseTo(0, 12);
    expect(up.y).toBeCloseTo(1, 12);
    const left = dirOf({ ...origin, yaw: 90 * DEG });
    expect(left.x).toBeCloseTo(0, 12);
    expect(left.z).toBeCloseTo(-1, 12);
  });

  it('chains base -> joint -> link -> joint -> link: 1 m at 90 deg then 1 m bent -90 deg ends at (1, 1)', () => {
    let f: Frame = { pos: { x: 0, y: 0, z: 0 }, yaw: 0, pitch: 0 };
    f = rotateFrame(f, 'pitch', 90 * DEG, '2d-side');
    f = advance(f, 1);
    f = rotateFrame(f, 'pitch', -90 * DEG, '2d-side');
    f = advance(f, 1);
    expect(f.pos.x).toBeCloseTo(1, 12);
    expect(f.pos.y).toBeCloseTo(1, 12);
    expect(f.pitch).toBeCloseTo(0, 12);
  });

  it('a 30 deg arm of 2 m reaches (1.732, 1) and its lever arm about the pivot is 1.732 m', () => {
    const pivot: Frame = { ...origin, pitch: 30 * DEG };
    const tip = advance(pivot, 2);
    expect(tip.pos.x).toBeCloseTo(Math.sqrt(3), 12);
    expect(tip.pos.y).toBeCloseTo(1, 12);
    expect(horizontalArm(pivot, tip.pos)).toBeCloseTo(Math.sqrt(3), 12);
  });

  it('the lever arm follows the heading in 3D: a point 2 m along yaw 90 has arm 2 whatever its height', () => {
    const pivot: Frame = { pos: { x: 1, y: 1, z: 1 }, yaw: 90 * DEG, pitch: 0 };
    expect(horizontalArm(pivot, { x: 1, y: 5, z: -1 })).toBeCloseTo(2, 12);
    expect(horizontalArm(pivot, { x: 3, y: 1, z: 1 })).toBeCloseTo(0, 12);
  });

  it('local offsets turn with the frame', () => {
    const f: Frame = { pos: { x: 1, y: 1, z: 0 }, yaw: 0, pitch: 90 * DEG };
    const p = localToWorld(f, { x: 1, y: 0, z: 0 });
    expect(p.x).toBeCloseTo(1, 12);
    expect(p.y).toBeCloseTo(2, 12);
    const side = localToWorld(f, { x: 0, y: 1, z: 0 });
    expect(side.x).toBeCloseTo(0, 12);
    expect(side.y).toBeCloseTo(1, 12);
  });

  it('the flat views show one turn only: the side view ignores yaw, the top view ignores pitch', () => {
    expect(rotateFrame(origin, 'yaw', 1, '2d-side')).toEqual(origin);
    expect(rotateFrame(origin, 'pitch', 1, '2d-top')).toEqual(origin);
    expect(rotateFrame(origin, 'yaw', 1, '2d-top').yaw).toBe(1);
    expect(rotateFrame(origin, 'pitch', 1, '3d').pitch).toBe(1);
  });

  it('measures a box between the fingers along any axis', () => {
    expect(extentAlong({ x: 0, y: 1, z: 0 }, { x: 0.4, y: 0.6, z: 0.8 })).toBeCloseTo(0.6, 12);
    const d = Math.SQRT1_2;
    expect(extentAlong({ x: d, y: d, z: 0 }, { x: 0.6, y: 0.6, z: 0.6 })).toBeCloseTo(0.6 * 2 * d, 12);
  });
});

describe('joint dynamics', () => {
  const base = { min: -90, max: 90, maxSpeedDegPerS: 90, maxTorqueNm: 30, powered: true, sag: -1 as const, dt: 1 / 60 };

  it('wraps degrees and finds which way gravity turns the joint', () => {
    expect(wrapDeg(190)).toBeCloseTo(-170, 12);
    expect(wrapDeg(-180)).toBe(180);
    expect(sagDirection(30)).toBe(-1);
    expect(sagDirection(-45)).toBe(-1);
    expect(sagDirection(120)).toBe(1);
    expect(sagDirection(-120)).toBe(1);
  });

  it('within its torque the joint moves toward the target at max speed and lands exactly', () => {
    let angle = 0;
    for (let i = 0; i < 30; i++) angle = stepJoint({ ...base, angle, target: 20, requiredNm: 10 }).angle;
    expect(angle).toBeCloseTo(20, 9);
    const r = stepJoint({ ...base, angle: 0, target: 80, requiredNm: 10 });
    expect(r.angle).toBeCloseTo(1.5, 9);
    expect(r.overloaded).toBe(false);
  });

  it('beyond its torque it cannot rise and sags at a speed that grows with the excess', () => {
    const small = stepJoint({ ...base, angle: 10, target: 80, requiredNm: 33 });
    const large = stepJoint({ ...base, angle: 10, target: 80, requiredNm: 60 });
    expect(small.overloaded).toBe(true);
    expect(small.angle).toBeLessThan(10);
    expect(large.angle).toBeLessThan(small.angle);
    // excess 3 of 30 N m: one tenth of 90 deg/s for one tick
    expect(10 - small.angle).toBeCloseTo(0.15, 9);
    // never faster than the max speed
    expect(10 - stepJoint({ ...base, angle: 10, target: 80, requiredNm: 1e6 }).angle).toBeCloseTo(1.5, 9);
  });

  it('an unpowered joint holds nothing: a load sags it, no load leaves it alone', () => {
    expect(stepJoint({ ...base, angle: 10, target: 80, requiredNm: 5, powered: false }).angle).toBeLessThan(10);
    expect(stepJoint({ ...base, angle: 10, target: 80, requiredNm: 0, powered: false }).angle).toBe(10);
  });

  it('keeps the angle inside min and max', () => {
    expect(stepJoint({ ...base, angle: -89.9, target: 0, requiredNm: 500, min: -90 }).angle).toBe(-90);
    expect(stepJoint({ ...base, angle: 89.9, target: 200, requiredNm: 0, max: 90 }).angle).toBeLessThanOrEqual(90);
  });
});
