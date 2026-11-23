import { describe, expect, it } from 'vitest';
import { dirOf } from '../../src/world/arm-kinematics';
import { actuatorFrame, approach, exceeds, planPush, targetLength, type Box, type PushBody } from '../../src/world/linear-actuator';
import { obbOf } from '../../src/world/oriented-box';

const X = { x: 1, y: 0, z: 0 };
/** Floor top at y = 0; head 0.6 m cube resting on it, front face at x = 0.3 (centre 0). */
const head: Box = { pos: { x: 0, y: 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 } };
const floor: Box = { pos: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 4 } };

function crate(id: string, x: number, massKg = 10, mu = 0.5, y = 0.3, size = 0.6): PushBody {
  return { id, box: { pos: { x, y, z: 0 }, size: { x: size, y: size, z: size } }, massKg, mu };
}

const plan = (bodies: PushBody[], extra: Partial<Parameters<typeof planPush>[0]> = {}) =>
  planPush({ head, dir: X, step: 0.05, bodies, solids: [floor], flat: 'z', ...extra });

describe('push force', () => {
  it('10 kg crate with mu 0.5 needs 49.05 N', () => {
    const p = plan([crate('a', 0.62)]);
    expect(p.requiredN).toBeCloseTo(0.5 * 10 * 9.81, 6);
    expect(p.moves.map((m) => m.id)).toEqual(['a']);
    expect(exceeds(p.requiredN, 40)).toBe(true);
    expect(exceeds(p.requiredN, 60)).toBe(false);
    expect(exceeds(p.requiredN, 49.05)).toBe(false);
  });

  it('two crates in a row add up', () => {
    const p = plan([crate('a', 0.62), crate('b', 1.22)]);
    expect(p.moves.map((m) => m.id).sort()).toEqual(['a', 'b']);
    expect(p.requiredN).toBeCloseTo(2 * 49.05, 6);
  });

  it('a crate standing on a pushed crate rides along and its weight loads the friction', () => {
    const p = plan([crate('a', 0.62), crate('top', 0.62, 5, 0.9, 0.9)]);
    const rider = p.moves.find((m) => m.id === 'top');
    expect(rider?.role).toBe('rider');
    expect(rider?.delta.x).toBeCloseTo(p.moves.find((m) => m.id === 'a')!.delta.x, 9);
    // 0.5 (the lower crate's own mu) x (10 + 5) kg x 9.81
    expect(p.requiredN).toBeCloseTo(0.5 * 15 * 9.81, 6);
  });

  it('a body the head does not reach costs nothing', () => {
    const p = plan([crate('far', 3)]);
    expect(p.requiredN).toBe(0);
    expect(p.moves).toEqual([]);
    expect(p.advance).toBe(0.05);
  });

  it('pushing straight up adds the weight on top of the friction', () => {
    const up: Box = { pos: { x: 0, y: 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 } };
    const p = planPush({ head: up, dir: { x: 0, y: 1, z: 0 }, step: 0.05, bodies: [crate('a', 0, 10, 0.5, 0.85)], solids: [], flat: 'z', lifting: true });
    expect(p.requiredN).toBeCloseTo(49.05 + 98.1, 6);
  });
});

describe('a pushed robot chassis', () => {
  /** A chassis 0.9 by 0.7 m and 0.24 m high on the floor, its back at x = 0.31 (the head's face is at 0.3). */
  const chassisBox: Box = { pos: { x: 0.76, y: 0.12, z: 0 }, size: { x: 0.9, y: 0.24, z: 0.7 } };
  const outline = obbOf(chassisBox.pos, chassisBox.size);
  const chassis = (extra: Partial<PushBody> = {}): PushBody => ({ id: 'r', box: chassisBox, outline, massKg: 5, mu: 0.8, ...extra });
  /** A 3 kg carton on the chassis top, sunk `sink` m into it (the crate engine rests a crate a hair inside what holds it). */
  const carton = (sink: number): PushBody => ({ id: 'c', box: { pos: { x: 0.76, y: 0.24 + 0.15 - sink, z: 0 }, size: { x: 0.3, y: 0.3, z: 0.3 } }, massKg: 3, mu: 0.5 });
  const push = (bodies: PushBody[]) => planPush({ head, dir: X, step: 0.05, bodies, solids: [floor], flat: null });

  it('needs its own friction times its own mass', () => {
    expect(push([chassis()]).requiredN).toBeCloseTo(0.8 * 5 * 9.81, 6);
    expect(push([chassis({ massKg: 20 })]).requiredN).toBeCloseTo(0.8 * 20 * 9.81, 6);
  });

  for (const sink of [0, 0.0005]) {
    it(`carries a carton that stands on its top (${sink} m into it): the carton rides, and only its weight on the chassis counts`, () => {
      const p = push([chassis(), carton(sink)]);
      expect(p.moves.find((m) => m.id === 'c')?.role).toBe('rider');
      expect(p.moves.find((m) => m.id === 'c')?.delta.x).toBeCloseTo(p.moves.find((m) => m.id === 'r')!.delta.x, 9);
      expect(p.requiredN).toBeCloseTo(0.8 * (5 + 3) * 9.81, 6);
      expect([...p.needs.keys()]).toEqual(['r']);
    });
  }

  it('with a hold force of its own, takes that force, whatever rides on it', () => {
    const p = push([chassis({ holdN: 70 }), carton(0.0005)]);
    expect(p.requiredN).toBe(70);
  });

  it('still shoves a carton that stands on the floor ahead of it', () => {
    const ahead: PushBody = { id: 'c', box: { pos: { x: 1.36, y: 0.15, z: 0 }, size: { x: 0.3, y: 0.3, z: 0.3 } }, massKg: 3, mu: 0.5 };
    const p = push([chassis(), ahead]);
    expect(p.moves.find((m) => m.id === 'c')?.role).toBe('pushed');
    expect(p.requiredN).toBeCloseTo(0.8 * 5 * 9.81 + 0.5 * 3 * 9.81, 6);
  });
});

describe('solids in the way', () => {
  it('stops the crate just short of a wall and reports the block', () => {
    const wall: Box = { pos: { x: 1.2, y: 1, z: 0 }, size: { x: 0.2, y: 2, z: 1 } };
    // Wall face at x = 1.1; the crate (x 0.32..0.92) can travel 0.18 before its front touches it.
    const p = planPush({ head, dir: X, step: 0.3, bodies: [crate('a', 0.62)], solids: [floor, wall], flat: 'z' });
    expect(p.blocked).toBe(true);
    expect(p.advance).toBeLessThan(0.3);
    const a = p.moves.find((m) => m.id === 'a')!;
    expect(0.62 + a.delta.x + 0.3).toBeLessThanOrEqual(1.1 + 0.011);
    expect(0.62 + a.delta.x + 0.3).toBeGreaterThan(1.1 - 0.05);
  });

  it('stops the head itself at a wall with nothing pushed', () => {
    const wall: Box = { pos: { x: 0.5, y: 1, z: 0 }, size: { x: 0.2, y: 2, z: 1 } };
    const p = planPush({ head, dir: X, step: 0.3, bodies: [], solids: [floor, wall], flat: 'z' });
    expect(p.blocked).toBe(true);
    expect(p.advance).toBeLessThanOrEqual(0.1 + 0.011);
  });

  it('a crate resting on the floor is not "in the floor"', () => {
    expect(plan([crate('a', 0.62)]).blocked).toBe(false);
  });
});

describe('rod length', () => {
  it('moves at the set speed and never past the ends', () => {
    expect(approach(0, 2, 2, 1, 1 / 60)).toBeCloseTo(1 / 60, 9);
    expect(approach(1.99, 2, 2, 1, 1 / 60)).toBe(2);
    expect(approach(0.001, 0, 2, 1, 1 / 60)).toBe(0);
    expect(approach(0, 5, 2, 1, 10)).toBe(2);
  });

  it('wired position (0..1 of the stroke) wins over extend; unwired = retracted', () => {
    expect(targetLength(2, true, null)).toBe(2);
    expect(targetLength(2, false, null)).toBe(0);
    expect(targetLength(2, false, 0.25)).toBe(0.5);
    expect(targetLength(2, true, 0)).toBe(0);
    expect(targetLength(2, false, 7)).toBe(2);
    expect(targetLength(2, true, Number.NaN)).toBe(2);
  });
});

describe('frame', () => {
  const base = { pos: { x: 1, y: 2, z: 3 }, yaw: 0, pitch: 0 };
  it('direction 0 points along +x, 90 deg along +z (clockwise from above)', () => {
    const f0 = actuatorFrame(base, 0, 'ground', '3d');
    expect(f0.yaw).toBeCloseTo(0, 9);
    const f90 = actuatorFrame(base, 90, 'ground', '3d');
    expect(dirOf(f90).x).toBeCloseTo(0, 9);
    expect(dirOf(f90).z).toBeCloseTo(1, 9);
  });
  it('the side view only has forward, backward, up and down', () => {
    expect(actuatorFrame(base, 180, 'ground', '2d-side').pitch).toBeCloseTo(Math.PI, 9);
    expect(actuatorFrame(base, 30, 'ground', '2d-side').pitch).toBe(0);
    expect(actuatorFrame(base, 0, 'up', '2d-side').pitch).toBeCloseTo(Math.PI / 2, 9);
    expect(actuatorFrame(base, 0, 'down', '2d-side').pitch).toBeCloseTo(-Math.PI / 2, 9);
  });
  it('the top view has no up or down', () => {
    expect(actuatorFrame(base, 0, 'up', '2d-top').pitch).toBe(0);
  });
});
