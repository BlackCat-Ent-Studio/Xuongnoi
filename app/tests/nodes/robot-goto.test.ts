import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { gotoStep, wrapDeg, type GotoGains, type GotoMemory } from '../../src/world/robot-goto';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { marker, motion, navBot, navRig, poseOf, stateHash, turnBetween, type NavRig, type Pose } from '../helpers/nav-rig';

/**
 * "Đi tới điểm" drives a chassis only through its two motors. Everything below is measured from where the chassis really
 * is after each world step ("Vật lý thật" on unless said otherwise): how close it stops, whether it stays stopped, how far
 * it travelled and turned on the way.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const TOLERANCE = 0.1;
const GAINS: GotoGains = { power: 0.6, turnGain: 0.02, turnDamp: 0.002, pivotAngle: 45, slowDistance: 1, tolerance: TOLERANCE, minPower: 0.08 };
const fresh = (): GotoMemory => ({ near: false, faced: false, last: null });
const RAD = Math.PI / 180;

describe('steering maths', () => {
  it('a goal to the right gives the left side more power, a goal to the left the right side (heading grows clockwise)', () => {
    // Facing +x; +z is "down" in the top view, which is the robot's right.
    const right = gotoStep({ x: 0, z: 0, heading: 0, turnRate: 0 }, { x: 5, z: 1 }, GAINS, fresh(), true, false);
    expect(right.headingError).toBeCloseTo(Math.atan2(1, 5) / RAD, 9);
    expect(right.left).toBeGreaterThan(right.right);
    const left = gotoStep({ x: 0, z: 0, heading: 0, turnRate: 0 }, { x: 5, z: -1 }, GAINS, fresh(), true, false);
    expect(left.headingError).toBeCloseTo(-Math.atan2(1, 5) / RAD, 9);
    expect(left.right).toBeGreaterThan(left.left);
    expect(left.left).toBeCloseTo(right.right, 12);
  });

  it('straight ahead and far away: both sides at the top power, never above it', () => {
    const c = gotoStep({ x: 0, z: 0, heading: 90 * RAD, turnRate: 0 }, { x: 0, z: 8 }, GAINS, fresh(), true, false);
    expect(c.left).toBeCloseTo(0.6, 9);
    expect(c.right).toBeCloseTo(0.6, 9);
    for (let deg = -180; deg <= 180; deg += 7) {
      const any = gotoStep({ x: 0, z: 0, heading: deg * RAD, turnRate: 0 }, { x: 3, z: -2 }, GAINS, fresh(), true, false);
      expect(Math.max(Math.abs(any.left), Math.abs(any.right))).toBeLessThanOrEqual(0.6 + 1e-12);
    }
  });

  it('from the pivot angle on the robot turns on the spot: the two sides are opposite', () => {
    for (const deg of [45, 60, 90, 135, 180, -45, -90, -179]) {
      const c = gotoStep({ x: 0, z: 0, heading: -deg * RAD, turnRate: 0 }, { x: 4, z: 0 }, GAINS, fresh(), true, false);
      expect(c.headingError).toBeCloseTo(wrapDeg(deg), 6);
      expect(c.left).toBeCloseTo(-c.right, 12);
      expect(Math.sign(c.left)).toBe(Math.sign(wrapDeg(deg)));
    }
    // Just under it there is some forward power again.
    const c = gotoStep({ x: 0, z: 0, heading: -40 * RAD, turnRate: 0 }, { x: 4, z: 0 }, GAINS, fresh(), true, false);
    expect(c.left + c.right).toBeGreaterThan(0);
  });

  it('forward power falls with the distance inside the slow-down distance, but not under the lowest power', () => {
    const at = (d: number): number => gotoStep({ x: 0, z: 0, heading: 0, turnRate: 0 }, { x: d, z: 0 }, GAINS, fresh(), true, false).left;
    expect(at(2)).toBeCloseTo(0.6, 9);
    expect(at(1)).toBeCloseTo(0.6, 9);
    expect(at(0.5)).toBeCloseTo(0.3, 9);
    expect(at(0.12)).toBeCloseTo(0.08, 9);
  });

  it('"Chạy" off: no power, the read-outs stay true', () => {
    const c = gotoStep({ x: 0, z: 0, heading: 0, turnRate: 0 }, { x: 3, z: 4 }, GAINS, fresh(), false, false);
    expect([c.left, c.right]).toEqual([0, 0]);
    expect(c.distance).toBeCloseTo(5, 9);
    expect(c.headingError).toBeCloseTo(Math.atan2(4, 3) / RAD, 9);
    expect(c.arrived).toBe(false);
    // Standing on the goal counts as arrived whether or not it is allowed to drive.
    expect(gotoStep({ x: 3, z: 4.05, heading: 0, turnRate: 0 }, { x: 3, z: 4 }, GAINS, fresh(), false, false).arrived).toBe(true);
  });

  it('arrived does not flicker on the rim: it takes 1.5 tolerances (and a centimetre) to leave again', () => {
    const m = fresh();
    const at = (d: number): boolean => gotoStep({ x: -d, z: 0, heading: 0, turnRate: 0 }, { x: 0, z: 0 }, GAINS, m, true, false).arrived;
    expect(at(0.5)).toBe(false);
    // Inside the tolerance but still rolling toward the middle: not there yet.
    expect(at(0.09)).toBe(false);
    expect(at(0.02)).toBe(true);
    expect(at(0.12)).toBe(true);
    expect(at(0.159)).toBe(true);
    expect(at(0.17)).toBe(false);
  });

  it('side view: drives forward or backward along x and never turns', () => {
    const ahead = gotoStep({ x: 0, z: 0, heading: 0, turnRate: 0 }, { x: 4, z: 9 }, GAINS, fresh(), true, true);
    expect([ahead.left, ahead.right]).toEqual([0.6, 0.6]);
    expect(ahead.distance).toBe(4);
    const behind = gotoStep({ x: 0, z: 0, heading: 0, turnRate: 0 }, { x: -4, z: 0 }, GAINS, fresh(), true, true);
    expect([behind.left, behind.right]).toEqual([-0.6, -0.6]);
  });

  it('final heading: at the goal it turns to the asked heading and only then has arrived', () => {
    const m = fresh();
    const c = gotoStep({ x: 0, z: 0, heading: 0, turnRate: 0 }, { x: 0.01, z: 0 }, GAINS, m, true, false, 90);
    expect(c.near).toBe(true);
    expect(c.arrived).toBe(false);
    expect(c.headingError).toBeCloseTo(90, 9);
    expect(c.left).toBeGreaterThan(0);
    expect(c.right).toBeCloseTo(-c.left, 12);
    const done = gotoStep({ x: 0, z: 0, heading: 89 * RAD, turnRate: 0 }, { x: 0.01, z: 0 }, GAINS, m, true, false, 90);
    expect(done.arrived).toBe(true);
    expect([done.left, done.right]).toEqual([0, 0]);
  });
});

interface Leg {
  /** Seconds from the command to "Đã tới". */
  seconds: number;
  /** Metres from the chassis middle to the marker middle when "Đã tới" came on. */
  error: number;
  /** Ground path travelled divided by the straight distance at the start of the leg. */
  detour: number;
  /** Degrees turned in total (every wiggle adds up). */
  turned: number;
  /** Largest growth of the distance to the goal between two ticks (m): a robot that orbits or overshoots moves away again. */
  backward: number;
}

/** Drives until the controller says it has arrived (or the time runs out) and measures the leg from the chassis itself. */
function driveLeg(r: NavRig, bot: string, goal: { x: number; z: number }, maxSeconds: number, each?: () => void): Leg | null {
  let prev = poseOf(r.entity(bot)!);
  const straight = Math.hypot(goal.x - prev.x, goal.z - prev.z);
  let path = 0;
  let turned = 0;
  let backward = 0;
  let lastD = straight;
  for (let k = 0; k < Math.round(maxSeconds / TICK_DT); k++) {
    r.tick();
    each?.();
    const now = poseOf(r.entity(bot)!);
    path += Math.hypot(now.x - prev.x, now.z - prev.z);
    turned += turnBetween(now.heading, prev.heading);
    const d = Math.hypot(goal.x - now.x, goal.z - now.z);
    backward = Math.max(backward, d - lastD);
    lastD = d;
    prev = now;
    if (r.out(`${bot}-go`, 'arrived') === true) return { seconds: (k + 1) * TICK_DT, error: d, detour: path / straight, turned, backward };
  }
  return null;
}

/** After arriving: the largest ground speed and turn speed seen, and how far the chassis ends from where it stood. */
function restFor(r: NavRig, bot: string, seconds: number): { speed: number; turn: number; drift: number; left: boolean } {
  const from = poseOf(r.entity(bot)!);
  let prev: Pose = from;
  let speed = 0;
  let turn = 0;
  let left = false;
  for (let k = 0; k < Math.round(seconds / TICK_DT); k++) {
    r.tick();
    const now = poseOf(r.entity(bot)!);
    const m = motion(prev, now);
    // The first half second is the stop itself.
    if (k >= 30) {
      speed = Math.max(speed, m.speed);
      turn = Math.max(turn, m.turn);
    }
    if (r.out(`${bot}-go`, 'arrived') !== true) left = true;
    prev = now;
  }
  return { speed, turn, drift: Math.hypot(prev.x - from.x, prev.z - from.z), left };
}

const START: WireSpec[] = [['on', 'started', 'r-go', 'go']];
const ON: NodeSpec = ['on', 'on-start', {}];

describe('one robot, one goal', () => {
  const HEADINGS = [0, 45, 90, 135, 180, -135, -90, -45, 36.87, -143.13, 179.9];

  it.each(HEADINGS)('from a start heading of %s degrees it reaches the marker, stops within the tolerance and stays', (heading) => {
    const bot = navBot({ id: 'r', x: 0, z: 0, heading });
    const r = navRig([...bot.nodes, marker(1, 4, 3), ON], [...bot.wires, ['m1', 'self', 'r-go', 'target'], ...START], rapier);
    const leg = driveLeg(r, 'r', { x: 4, z: 3 }, 12);
    expect(leg, 'arrives within 12 s').not.toBeNull();
    expect(leg!.error).toBeLessThanOrEqual(TOLERANCE);
    // 5 m at 1.13 m/s, plus the turn on the spot and the slow last metre.
    expect(leg!.seconds).toBeLessThan(8);
    // No orbit, no weaving: hardly longer than the straight line, at most the first turn plus a little, never moving away.
    expect(leg!.detour).toBeLessThan(1.02);
    expect(leg!.turned).toBeLessThan(turnBetween(36.87, heading) + 10);
    expect(leg!.backward).toBeLessThan(0.001);
    const rest = restFor(r, 'r', 4);
    expect(rest.speed).toBe(0);
    expect(rest.turn).toBe(0);
    expect(rest.drift).toBeLessThan(0.03);
    expect(rest.left).toBe(false);
    const end = poseOf(r.entity('r')!);
    expect(Math.hypot(end.x - 4, end.z - 3)).toBeLessThanOrEqual(TOLERANCE);
    expect([r.out('r-go', 'left'), r.out('r-go', 'right')]).toEqual([0, 0]);
  });

  it('a goal close by and beside or behind the robot: it turns first and still arrives, without circling it', () => {
    for (const [gx, gz] of [[0, 0.5], [-0.4, 0], [0.3, -0.3], [-0.2, 0.25], [0.6, 0]] as const) {
      const bot = navBot({ id: 'r', x: 0, z: 0, heading: 0 });
      const r = navRig([...bot.nodes, marker(1, gx, gz, 0.3), ON], [...bot.wires, ['m1', 'self', 'r-go', 'target'], ...START], rapier);
      const leg = driveLeg(r, 'r', { x: gx, z: gz }, 10);
      expect(leg, `${gx}, ${gz}`).not.toBeNull();
      expect(leg!.error, `${gx}, ${gz}`).toBeLessThanOrEqual(TOLERANCE);
      expect(leg!.turned, `${gx}, ${gz}`).toBeLessThan(200);
      expect(restFor(r, 'r', 2).speed).toBe(0);
    }
  });

  it('"Chạy" off holds the robot; on again it carries on; "Khi tới nơi" is one tick long', () => {
    const bot = navBot({ id: 'r', x: 0, z: 0, heading: 0 });
    const r = navRig([...bot.nodes, marker(1, 6, 0), ['sw', 'const', { value: 0 }], ['run', 'compare', { op: '>' }], ['half', 'const', { value: 0.5 }]], [...bot.wires, ['m1', 'self', 'r-go', 'target'], ['sw', 'value', 'run', 'a'], ['half', 'value', 'run', 'b'], ['run', 'out', 'r-go', 'go']], rapier);
    r.tick(120);
    expect(poseOf(r.entity('r')!).x).toBe(0);
    expect(r.out('r-go', 'distance')).toBeCloseTo(6, 9);
    r.set('sw', { value: 1 });
    r.tick(120);
    const mid = poseOf(r.entity('r')!).x;
    expect(mid).toBeGreaterThan(1.5);
    r.set('sw', { value: 0 });
    r.tick(60);
    const held = poseOf(r.entity('r')!).x;
    r.tick(60);
    expect(poseOf(r.entity('r')!).x).toBe(held);
    expect(held).toBeLessThan(5);
    r.set('sw', { value: 1 });
    let pulses = 0;
    for (let k = 0; k < 600; k++) {
      r.tick();
      if (r.out('r-go', 'arrivedPulse') === true) pulses += 1;
    }
    expect(pulses).toBe(1);
    expect(r.out('r-go', 'arrived')).toBe(true);
  });

  it('anti-forced: with the two wires to the motors cut the controller still asks for power, and the robot never moves', () => {
    const bot = navBot({ id: 'r', x: 0, z: 0, heading: 30, cutMotorWires: true });
    const r = navRig([...bot.nodes, marker(1, 4, 3), ON], [...bot.wires, ['m1', 'self', 'r-go', 'target'], ...START], rapier);
    const from = poseOf(r.entity('r')!);
    let asked = 0;
    for (let k = 0; k < 600; k++) {
      r.tick();
      asked = Math.max(asked, Math.abs(r.out('r-go', 'left') as number), Math.abs(r.out('r-go', 'right') as number));
    }
    expect(asked).toBeGreaterThan(0.5);
    expect(poseOf(r.entity('r')!)).toEqual(from);
    expect(r.out('r-go', 'arrived')).toBe(false);
    expect(r.out('r-go', 'distance')).toBeCloseTo(5, 9);
  });

  it('anti-forced: one motor wire cut = the robot only circles on the wheel that is left and does not arrive', () => {
    const bot = navBot({ id: 'r', x: 0, z: 0, heading: 0 });
    const wires = bot.wires.filter((w) => !(w[1] === 'right' && w[2] === 'r-mr'));
    const r = navRig([...bot.nodes, marker(1, 6, 0), ON], [...wires, ['m1', 'self', 'r-go', 'target'], ...START], rapier);
    expect(driveLeg(r, 'r', { x: 6, z: 0 }, 15)).toBeNull();
  });

  it('weak motors and a heavy chassis: slower, same stop', () => {
    const bot = navBot({ id: 'r', x: 0, z: 0, heading: 90, kg: 20, motor: { maxForce: 6, maxRpm: 90 } });
    const r = navRig([...bot.nodes, marker(1, 4, 3), ON], [...bot.wires, ['m1', 'self', 'r-go', 'target'], ...START], rapier);
    const leg = driveLeg(r, 'r', { x: 4, z: 3 }, 30);
    expect(leg).not.toBeNull();
    expect(leg!.error).toBeLessThanOrEqual(TOLERANCE);
    expect(leg!.backward).toBeLessThan(0.001);
    expect(restFor(r, 'r', 3).speed).toBe(0);
  });

  it('a slippery floor (grip 0.1): the stop takes longer but it settles inside the tolerance', () => {
    const bot = navBot({ id: 'r', x: 0, z: 0, heading: 0 });
    const nodes = bot.nodes.map((n): NodeSpec => (n[0] === 'r' ? [n[0], n[1], { ...n[2], friction: 0.1 }] : n));
    const r = navRig([...nodes, marker(1, 5, 2), ON], [...bot.wires, ['m1', 'self', 'r-go', 'target'], ...START], rapier);
    expect(driveLeg(r, 'r', { x: 5, z: 2 }, 30)).not.toBeNull();
    const rest = restFor(r, 'r', 5);
    expect(rest.speed).toBe(0);
    const end = poseOf(r.entity('r')!);
    expect(Math.hypot(end.x - 5, end.z - 2)).toBeLessThanOrEqual(TOLERANCE * 1.5 + 0.01);
  });

  it('the goal comes from what the card is set to: the wired object, the point of the settings, or the two number ports', () => {
    const run = (drive: Record<string, number | string | { x: number; y: number; z: number }>, extra: NodeSpec[], wires: WireSpec[]): NavRig => {
      const bot = navBot({ id: 'r', x: 0, z: 0, heading: 0, drive });
      const r = navRig([...bot.nodes, ON, ...extra], [...bot.wires, ...START, ...wires], rapier);
      r.tick(600);
      return r;
    };
    const near = (r: NavRig, x: number, z: number): void => {
      expect(r.out('r-go', 'arrived')).toBe(true);
      const p = poseOf(r.entity('r')!);
      expect(Math.hypot(p.x - x, p.z - z)).toBeLessThanOrEqual(TOLERANCE);
    };
    near(run({ targetFrom: 'point', targetPos: { x: 2, y: 0, z: -2 } }, [], []), 2, -2);
    const numbers: NodeSpec[] = [['cx', 'const', { value: -1 }], ['cz', 'const', { value: 3 }]];
    const numberWires: WireSpec[] = [['cx', 'value', 'r-go', 'x'], ['cz', 'value', 'r-go', 'z']];
    near(run({ targetFrom: 'ports', targetPos: { x: 2, y: 0, z: -2 } }, numbers, numberWires), -1, 3);
    near(run({ targetPos: { x: 2, y: 0, z: -2 } }, [marker(1, 3, 1)], [['m1', 'self', 'r-go', 'target']]), 3, 1);
    // A marker's own X and Z outputs are numbers like any other.
    near(run({ targetFrom: 'ports' }, [marker(4, -2, -2)], [['m4', 'x', 'r-go', 'x'], ['m4', 'z', 'r-go', 'z']]), -2, -2);
  });

  it('no goal = the robot waits: nothing wired to "Đích", or a marker number nobody carries', () => {
    for (const wires of [[], [['find', 'marker', 'r-go', 'target']]] as WireSpec[][]) {
      const bot = navBot({ id: 'r', x: 1, z: 1, heading: 0, drive: { targetPos: { x: 5, y: 0, z: 5 } } });
      const r = navRig([...bot.nodes, ON, marker(2, 4, 4), ['n', 'const', { value: 7 }], ['find', 'floor-marker-find', {}]], [...bot.wires, ...START, ['n', 'value', 'find', 'number'], ...wires], rapier);
      const from = poseOf(r.entity('r')!);
      r.tick(300);
      expect(poseOf(r.entity('r')!)).toEqual(from);
      expect([r.out('r-go', 'left'), r.out('r-go', 'right'), r.out('r-go', 'arrived'), r.out('r-go', 'distance')]).toEqual([0, 0, false, 0]);
      // The number changes to a marker that exists: off it goes.
      r.set('n', { value: 2 });
      r.tick(600);
      expect(r.out('r-go', 'arrived')).toBe(wires.length > 0);
    }
  });

  it('final heading on: it turns to the asked heading at the goal, within 2 degrees, and then stands still', () => {
    for (const face of [0, 90, 180, -90]) {
      const bot = navBot({ id: 'r', x: 0, z: 0, heading: 20, drive: { faceOnArrive: 'yes' } });
      const r = navRig([...bot.nodes, marker(1, 3, 2), ON, ['f', 'const', { value: face }]], [...bot.wires, ['m1', 'self', 'r-go', 'target'], ...START, ['f', 'value', 'r-go', 'face']], rapier);
      expect(driveLeg(r, 'r', { x: 3, z: 2 }, 15), `${face}`).not.toBeNull();
      const rest = restFor(r, 'r', 3);
      expect(rest.turn, `${face}`).toBe(0);
      expect(rest.left).toBe(false);
      const end = poseOf(r.entity('r')!);
      expect(turnBetween(end.heading, face), `${face}`).toBeLessThanOrEqual(4);
      expect(Math.hypot(end.x - 3, end.z - 2)).toBeLessThanOrEqual(TOLERANCE);
    }
  });

  it('with "Vật lý thật" off the same board arrives too (the plain drive of older boards)', () => {
    for (const heading of [0, 90, 180, -135]) {
      const bot = navBot({ id: 'r', x: 0, z: 0, heading });
      const r = navRig([...bot.nodes, marker(1, 4, 3), ON], [...bot.wires, ['m1', 'self', 'r-go', 'target'], ...START], undefined, false);
      const leg = driveLeg(r, 'r', { x: 4, z: 3 }, 12);
      expect(leg, `${heading}`).not.toBeNull();
      expect(leg!.error).toBeLessThanOrEqual(TOLERANCE);
      expect(leg!.backward).toBeLessThan(0.001);
      expect(restFor(r, 'r', 3).speed).toBe(0);
    }
  });

  it('top view plays like 3D; side view rolls along x to the goal and back', () => {
    const bot = navBot({ id: 'r', x: 0, z: 0, heading: 0 });
    const top = navRig([...bot.nodes, marker(1, 4, 3), ON], [...bot.wires, ['m1', 'self', 'r-go', 'target'], ...START], rapier);
    expect(driveLeg(top, 'r', { x: 4, z: 3 }, 12)).not.toBeNull();
    for (const gx of [5, -5]) {
      const b = navBot({ id: 'r', x: 0, z: 0, heading: 0, drive: { targetFrom: 'point', targetPos: { x: gx, y: 0, z: 0 } } });
      // The side view shows the floor edge-on: a strip of floor, the same cards.
      const side = rig([['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 120, y: 1, z: 1 } }], ...b.nodes, ON], [...b.wires, ...START], '2d-side');
      side.tick(900);
      expect(side.out('r-go', 'arrived'), `${gx}`).toBe(true);
      expect(Math.abs(side.entity('r')!.position.x - gx)).toBeLessThanOrEqual(TOLERANCE);
    }
  });
});

describe('six markers in a commanded order', () => {
  const PLACES: [number, number, number][] = [[1, 6, 0], [2, 6, 4], [3, 0, 4], [4, -5, 4], [5, -5, -3], [6, 2, -4]];
  const ORDER = [3, 1, 6, 2, 5, 4];

  /**
   * General pieces only: a counter steps on "Khi tới nơi", a value table turns the step into a marker number, "Tìm mốc sàn"
   * turns the number into the marker, and its "Có mốc" is the "Chạy" of the controller (after the sixth there is no marker 0).
   */
  function tour(real: boolean) {
    const bot = navBot({ id: 'r', x: 0, z: 0, heading: -90 });
    const table: Record<string, number | string> = { rows: 6, outside: 'zero' };
    ORDER.forEach((n, k) => (table[`v${k + 1}`] = n));
    const nodes: NodeSpec[] = [
      ...bot.nodes,
      ...PLACES.map(([n, x, z]) => marker(n, x, z)),
      ['step', 'counter', { start: 1, target: 99 }],
      ['plan', 'value-table', table],
      ['find', 'floor-marker-find', {}],
      ['read', 'floor-marker-sensor', {}],
    ];
    const wires: WireSpec[] = [
      ...bot.wires,
      ['r-go', 'arrivedPulse', 'step', 'up'],
      ['step', 'value', 'plan', 'index'],
      ['plan', 'value', 'find', 'number'],
      ['find', 'marker', 'r-go', 'target'],
      ['find', 'found', 'r-go', 'go'],
      ['r', 'self', 'read', 'who'],
    ];
    return navRig(nodes, wires, real ? rapier : undefined, real);
  }

  interface Visit {
    marker: number;
    seconds: number;
    error: number;
    read: number;
  }

  function play(real: boolean): { visits: Visit[]; hash: number; r: NavRig } {
    const r = tour(real);
    const visits: Visit[] = [];
    let hash = 2166136261;
    let legStart = 0;
    for (let k = 0; k < 90 * 60 && visits.length < 6; k++) {
      r.tick();
      hash = stateHash(hash, r.world.entities());
      if (r.out('r-go', 'arrivedPulse') !== true) continue;
      const n = ORDER[visits.length]!;
      const [, x, z] = PLACES.find((p) => p[0] === n)!;
      const at = poseOf(r.entity('r')!);
      visits.push({ marker: n, seconds: (k + 1 - legStart) * TICK_DT, error: Math.hypot(at.x - x, at.z - z), read: r.out('read', 'number') as number });
      legStart = k + 1;
    }
    return { visits, hash, r };
  }

  it('visits all six in the order of the table, each within the tolerance, and reads the number of the marker it stands on', () => {
    const { visits, r } = play(true);
    expect(visits.map((v) => v.marker)).toEqual(ORDER);
    expect(visits.map((v) => v.read)).toEqual(ORDER);
    for (const v of visits) {
      expect(v.error, `marker ${v.marker}`).toBeLessThanOrEqual(TOLERANCE);
      expect(v.seconds, `marker ${v.marker}`).toBeLessThan(15);
    }
    // After the last one the plan is empty: no marker, "Chạy" off, the robot stays on marker 4.
    const rest = restFor(r, 'r', 4);
    expect(rest.speed).toBe(0);
    expect(rest.turn).toBe(0);
    expect(r.out('find', 'found')).toBe(false);
    expect(r.out('read', 'number')).toBe(4);
    const end = poseOf(r.entity('r')!);
    expect(Math.hypot(end.x + 5, end.z - 4)).toBeLessThanOrEqual(TOLERANCE);
  });

  it('the same run twice gives the same state on every tick', () => {
    const a = play(true);
    const b = play(true);
    expect(a.visits).toEqual(b.visits);
    expect(a.hash).toBe(b.hash);
  });

  it('plays with "Vật lý thật" off too', () => {
    const { visits } = play(false);
    expect(visits.map((v) => v.marker)).toEqual(ORDER);
    for (const v of visits) expect(v.error).toBeLessThanOrEqual(TOLERANCE);
  });

  it('existing pieces alone also turn a number into a place: two value tables hold the X and Z of each marker', () => {
    const bot = navBot({ id: 'r', x: 0, z: 0, heading: 0, drive: { targetFrom: 'ports' } });
    const xs: Record<string, number> = { rows: 6 };
    const zs: Record<string, number> = { rows: 6 };
    PLACES.forEach(([n, x, z]) => {
      xs[`v${n}`] = x;
      zs[`v${n}`] = z;
    });
    const r = navRig(
      [...bot.nodes, ON, ['door', 'const', { value: 5 }], ['xs', 'value-table', xs], ['zs', 'value-table', zs]],
      [...bot.wires, ...START, ['door', 'value', 'xs', 'index'], ['door', 'value', 'zs', 'index'], ['xs', 'value', 'r-go', 'x'], ['zs', 'value', 'r-go', 'z']],
      rapier,
    );
    const leg = driveLeg(r, 'r', { x: -5, z: -3 }, 15);
    expect(leg).not.toBeNull();
    expect(leg!.error).toBeLessThanOrEqual(TOLERANCE);
  });
});
