import { describe, expect, it } from 'vitest';
import {
  FORCE_PER_MOTOR,
  chassisAccel,
  createRobotBody,
  driveRobot,
  followWheels,
  motorRpmStep,
  motorTargetRpm,
  setWheel,
  solveDrive,
  wheelSpeed,
  type DriveWheel,
} from '../../src/world/robot-drive';

const R = 0.15;
const wheel = (side: number, rpm: number, extra: Partial<DriveWheel> = {}): DriveWheel => ({ side, forward: 0, radius: R, rpm, ...extra });
/** Metres per second of a wheel turning at 60 rpm. */
const V60 = 2 * Math.PI * R;

describe('wheel and kinematics maths', () => {
  it('wheel rim speed is rpm * 2 pi r / 60', () => {
    expect(wheelSpeed({ rpm: 60, radius: 0.5 })).toBeCloseTo(Math.PI, 9);
    expect(wheelSpeed({ rpm: -120, radius: 0.15 })).toBeCloseTo(-2 * V60, 9);
    expect(wheelSpeed({ rpm: 0, radius: 1 })).toBe(0);
  });

  it('no motors = no motion', () => {
    expect(solveDrive([])).toEqual({ speed: 0, turn: 0 });
  });

  it('two wheels at the same speed drive straight at that speed', () => {
    const m = solveDrive([wheel(-0.4, 60), wheel(0.4, 60)]);
    expect(m.speed).toBeCloseTo(V60, 9);
    expect(m.turn).toBeCloseTo(0, 9);
  });

  it('two wheels in opposite directions spin the robot on the spot, left faster = turn right', () => {
    const m = solveDrive([wheel(-0.4, 60), wheel(0.4, -60)]);
    expect(m.speed).toBeCloseTo(0, 9);
    // turn = (left - right) / track, track = 0.8
    expect(m.turn).toBeCloseTo((2 * V60) / 0.8, 9);
    expect(solveDrive([wheel(-0.4, -60), wheel(0.4, 60)]).turn).toBeCloseTo(-(2 * V60) / 0.8, 9);
  });

  it('the arc radius matches the differential-drive formula R = track/2 * (vL + vR) / (vL - vR)', () => {
    const left = 90;
    const right = 30;
    const track = 0.8;
    const m = solveDrive([wheel(-track / 2, left), wheel(track / 2, right)]);
    const vl = wheelSpeed({ rpm: left, radius: R });
    const vr = wheelSpeed({ rpm: right, radius: R });
    expect(m.speed / m.turn).toBeCloseTo((track / 2) * ((vl + vr) / (vl - vr)), 9);
    expect(m.speed).toBeCloseTo((vl + vr) / 2, 9);
  });

  it('works for any number of motors: four wheels, two a side, behave like one pair', () => {
    const four = solveDrive([wheel(-0.4, 90, { forward: 0.3 }), wheel(-0.4, 90, { forward: -0.3 }), wheel(0.4, 30, { forward: 0.3 }), wheel(0.4, 30, { forward: -0.3 })]);
    const two = solveDrive([wheel(-0.4, 90), wheel(0.4, 30)]);
    expect(four.speed).toBeCloseTo(two.speed, 9);
    expect(four.turn).toBeCloseTo(two.turn, 9);
  });

  it('three wheels at uneven offsets and equal speed still go straight (the fit uses the mean offset)', () => {
    const m = solveDrive([wheel(-0.5, 60), wheel(0.1, 60), wheel(0.3, 60)]);
    expect(m.speed).toBeCloseTo(V60, 9);
    expect(m.turn).toBeCloseTo(0, 9);
  });

  it('a stopped wheel on one side makes the robot pivot about it', () => {
    const m = solveDrive([wheel(-0.4, 60), wheel(0.4, 0)]);
    expect(m.speed).toBeCloseTo(V60 / 2, 9);
    expect(m.turn).toBeCloseTo(V60 / 0.8, 9);
    // the centre travels on a circle of radius = half the track around the stopped wheel
    expect(m.speed / m.turn).toBeCloseTo(0.4, 9);
  });

  it('one motor off centre drives the robot round a circle whose radius is its offset, away from that side', () => {
    const right = solveDrive([wheel(0.4, 60)]);
    expect(right.speed).toBeCloseTo(V60, 9);
    expect(right.turn).toBeLessThan(0); // right wheel pushes: the nose swings left
    expect(Math.abs(right.speed / right.turn)).toBeCloseTo(0.4, 9);
    expect(solveDrive([wheel(-0.4, 60)]).turn).toBeGreaterThan(0);
  });

  it('one motor on the centre line drives straight', () => {
    const m = solveDrive([wheel(0, 60)]);
    expect(m.speed).toBeCloseTo(V60, 9);
    expect(m.turn).toBe(0);
  });

  it('a reversed wheel pushes the other way', () => {
    expect(motorTargetRpm(1, 100, true)).toBe(-100);
    expect(motorTargetRpm(-0.5, 100, false)).toBe(-50);
    expect(motorTargetRpm(7, 100, false)).toBe(100);
    expect(motorTargetRpm(Number.NaN, 100, false)).toBe(0);
  });
});

describe('motor and chassis response', () => {
  it('a motor ramps toward its target at its own acceleration and then holds', () => {
    let rpm = 0;
    for (let i = 0; i < 6; i++) rpm = motorRpmStep(rpm, 100, 600, 1 / 60);
    expect(rpm).toBeCloseTo(60, 6);
    for (let i = 0; i < 60; i++) rpm = motorRpmStep(rpm, 100, 600, 1 / 60);
    expect(rpm).toBe(100);
  });

  const settle = (mass: number, friction: number): number => {
    let m = { speed: 0, turn: 0 };
    let t = 0;
    while (Math.abs(m.speed - 1) > 1e-6 && t < 60) {
      m = followWheels(m, { speed: 1, turn: 0 }, { mass, friction, width: 0.7 }, 2, 1 / 60);
      t += 1 / 60;
    }
    return t;
  };

  it('a heavier chassis takes longer to reach the same speed', () => {
    expect(settle(20, 0.8)).toBeGreaterThan(settle(2, 0.8) * 5);
  });

  it('push is shared by the mass and is limited by grip', () => {
    expect(chassisAccel({ mass: 2, friction: 5, width: 1 }, 2, false)).toBeCloseTo((2 * FORCE_PER_MOTOR) / 2, 9);
    expect(chassisAccel({ mass: 0.1, friction: 0.5, width: 1 }, 2, false)).toBeCloseTo(0.5 * 9.81, 9);
    // stopping needs grip only
    expect(chassisAccel({ mass: 50, friction: 0.5, width: 1 }, 1, true)).toBeCloseTo(0.5 * 9.81, 9);
  });

  it('a slippery floor makes the robot coast further after the wheels stop', () => {
    const coast = (friction: number): number => {
      let m = { speed: 1.5, turn: 0 };
      let dist = 0;
      for (let i = 0; i < 60 * 30 && m.speed > 0; i++) {
        m = followWheels(m, { speed: 0, turn: 0 }, { mass: 2, friction, width: 0.7 }, 2, 1 / 60);
        dist += m.speed / 60;
      }
      return dist;
    };
    expect(coast(0.1)).toBeGreaterThan(coast(0.8) * 5);
  });
});

describe('robot body state', () => {
  const dt = 1 / 60;

  it('does not move without wheels', () => {
    const b = createRobotBody({ length: 1, width: 0.7, mass: 2, friction: 0.8 });
    for (let i = 0; i < 120; i++) expect(driveRobot(b, dt, false)).toEqual({ x: 0, z: 0 });
    expect(b.heading).toBe(0);
  });

  it('a wheel that is not refreshed for a tick is dropped; a refreshed one stays', () => {
    const b = createRobotBody({ length: 1, width: 0.7, mass: 2, friction: 0.8 });
    setWheel(b, 'a', { side: -0.4, forward: 0, radius: R, rpm: 60 });
    setWheel(b, 'b', { side: 0.4, forward: 0, radius: R, rpm: 60 });
    driveRobot(b, dt, false);
    expect(b.wheels.size).toBe(2);
    setWheel(b, 'a', { side: -0.4, forward: 0, radius: R, rpm: 60 });
    driveRobot(b, dt, false);
    expect([...b.wheels.keys()]).toEqual(['a']);
    setWheel(b, 'a', null);
    expect(b.wheels.size).toBe(0);
  });

  it('ignores unusable wheel numbers', () => {
    const b = createRobotBody(undefined);
    setWheel(b, 'a', { side: Number.NaN, forward: 0, radius: R, rpm: 60 });
    setWheel(b, 'b', { side: 0, forward: 0, radius: 0, rpm: 60 });
    expect(b.wheels.size).toBe(0);
  });

  it('turns the heading with the wheels', () => {
    const b = createRobotBody({ length: 1, width: 0.7, mass: 1, friction: 1 });
    for (let i = 0; i < 240; i++) {
      setWheel(b, 'l', { side: -0.4, forward: 0, radius: R, rpm: 60 });
      setWheel(b, 'r', { side: 0.4, forward: 0, radius: R, rpm: -60 });
      driveRobot(b, dt, false);
    }
    expect(b.speed).toBeCloseTo(0, 6);
    // 4 s at (2 * V60 / 0.8) rad/s, wrapped to (-pi, pi]
    const turned = ((2 * V60) / 0.8) * 4;
    expect(Math.cos(b.heading)).toBeCloseTo(Math.cos(turned), 1);
  });

  it('the side view does not turn: it only rolls along x', () => {
    const b = createRobotBody({ length: 1, width: 0.7, mass: 1, friction: 1 });
    let vel = { x: 0, z: 0 };
    for (let i = 0; i < 120; i++) {
      setWheel(b, 'l', { side: -0.4, forward: 0, radius: R, rpm: 60 });
      setWheel(b, 'r', { side: 0.4, forward: 0, radius: R, rpm: 0 });
      vel = driveRobot(b, dt, true);
    }
    expect(b.heading).toBe(0);
    expect(vel.z).toBe(0);
    expect(vel.x).toBeCloseTo(V60 / 2, 6);
  });
});
