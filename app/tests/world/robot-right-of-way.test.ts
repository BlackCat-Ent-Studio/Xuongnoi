import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT, type EntityView } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import type { NodeSpec, WireSpec } from '../helpers/arm-rig';
import { deepestOverlap } from '../helpers/chassis-metrics';
import { marker, navBot, navRig, poseOf, stateHash, type NavRig } from '../helpers/nav-rig';

/**
 * Traffic on an open floor, built from general pieces only: every robot is a chassis, two motors, "Đi tới điểm", and
 * "Dò phía trước" sensors that switch its "Chạy" off. No robot knows about another one except through its sensors.
 * Measured from the chassis boxes on every tick for 120 simulated seconds with "Vật lý thật" on: how deep any two are
 * inside each other, how near they come, how many legs each one finishes and how long it ever stands waiting.
 *
 * What works: a queue in a one-way loop (stop and wait behind), and crossings where each robot gives way to what comes
 * from its right and a robot already in the crossing drives on. What does not: two robots nose to nose in one lane (both
 * stop for good), and a crossing with only a straight-ahead sensor (no standstill, but they bump). Those are shown too.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const SECONDS = 120;
/** Collision boxes may touch; deeper than this is an overlap (m). */
const TOUCH = 0.001;
const BODY = 0.9;

/** Straight-ahead eye: as wide as the body's lane, sees 1.2 m past the nose. */
const FRONT_EYE = { reach: 1.2 };
/**
 * Right-hand eye: a 3 m wide strip that starts 0.45 m to the right of the middle and lies 1.7 to 3.7 m ahead. What is in it
 * is coming from the right toward the place the robot will reach in a moment. Nearer than 1.7 m ahead it does not look: a
 * robot that close to the other's lane can no longer stop short of it and must drive on (the other one's front eye sees it).
 */
const RIGHT_EYE = { reach: 2, mountSide: 1.95, beam: 3, mountForward: 1.7 };

interface Car {
  id: string;
  x: number;
  z: number;
  heading: number;
  power?: number;
  /** 'front' = stops for what is straight ahead; 'right' = also gives way to what comes from the right. */
  rule: 'front' | 'right';
}

/** Chassis + motors + controller + eyes; "Chạy" = has a marker to go to AND no eye sees anything. `${id}-n` gives the marker number on `numberPort`. */
function car(c: Car, numberPort: 'value' | 'out'): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const id = c.id;
  const bot = navBot({ id, x: c.x, z: c.z, heading: c.heading, length: BODY, width: 0.7, drive: { power: c.power ?? 0.6 } });
  const nodes: NodeSpec[] = [
    ...bot.nodes,
    [`${id}-find`, 'floor-marker-find', {}],
    [`${id}-eye`, 'ahead-sensor', FRONT_EYE],
    [`${id}-free`, 'not', {}],
    [`${id}-run`, 'and', {}],
  ];
  const wires: WireSpec[] = [
    ...bot.wires,
    [`${id}-n`, numberPort, `${id}-find`, 'number'],
    [`${id}-find`, 'marker', `${id}-go`, 'target'],
    [id, 'self', `${id}-eye`, 'who'],
    [`${id}-free`, 'out', `${id}-run`, 'a'],
    [`${id}-find`, 'found', `${id}-run`, 'b'],
    [`${id}-run`, 'out', `${id}-go`, 'go'],
  ];
  if (c.rule === 'front') {
    wires.push([`${id}-eye`, 'blocked', `${id}-free`, 'in']);
  } else {
    nodes.push([`${id}-eyeR`, 'ahead-sensor', RIGHT_EYE], [`${id}-any`, 'or', {}]);
    wires.push([id, 'self', `${id}-eyeR`, 'who'], [`${id}-eye`, 'blocked', `${id}-any`, 'a'], [`${id}-eyeR`, 'blocked', `${id}-any`, 'b'], [`${id}-any`, 'out', `${id}-free`, 'in']);
  }
  return { nodes, wires };
}

/** Back and forth between markers `a` and `b`: a memory switch flips on every arrival and picks the number. */
function shuttle(c: Car, a: number, b: number): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const base = car(c, 'value');
  return {
    nodes: [...base.nodes, [`${c.id}-flip`, 'latch', {}], [`${c.id}-n`, 'bool-to-number', { whenOff: a, whenOn: b }]],
    wires: [...base.wires, [`${c.id}-go`, 'arrivedPulse', `${c.id}-flip`, 'toggle'], [`${c.id}-flip`, 'on', `${c.id}-n`, 'on']],
  };
}

/** Round and round markers 1..count: a counter steps on every arrival, "chia lấy dư" wraps it, plus one. */
function looper(c: Car, first: number, count: number): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const base = car(c, 'out');
  const id = c.id;
  return {
    nodes: [...base.nodes, [`${id}-step`, 'counter', { start: first - 1, target: 1e9 }], [`${id}-count`, 'const', { value: count }], [`${id}-wrap`, 'math', { op: 'mod' }], [`${id}-one`, 'const', { value: 1 }], [`${id}-n`, 'math', { op: 'add' }]],
    wires: [
      ...base.wires,
      [`${id}-go`, 'arrivedPulse', `${id}-step`, 'up'],
      [`${id}-step`, 'value', `${id}-wrap`, 'a'],
      [`${id}-count`, 'value', `${id}-wrap`, 'b'],
      [`${id}-wrap`, 'out', `${id}-n`, 'a'],
      [`${id}-one`, 'value', `${id}-n`, 'b'],
    ],
  };
}

interface Traffic {
  /** Deepest any two chassis boxes were inside each other (m; negative = they never touched). */
  deepest: number;
  /** Ticks on which two chassis touched (closer than a millimetre). */
  touching: number;
  /** Legs finished per robot. */
  legs: number[];
  /** Longest time a robot went without moving 5 cm (s), per robot. */
  longestWait: number[];
  /** Seconds at which the last leg of any robot ended. */
  lastArrival: number;
  hash: number;
}

function watch(r: NavRig, ids: string[], seconds = SECONDS): Traffic {
  const out: Traffic = { deepest: -Infinity, touching: 0, legs: ids.map(() => 0), longestWait: ids.map(() => 0), lastArrival: 0, hash: 2166136261 };
  const anchor = ids.map((id) => ({ ...poseOf(r.entity(id)!), since: 0 }));
  for (let k = 0; k < Math.round(seconds / TICK_DT); k++) {
    r.tick();
    const t = (k + 1) * TICK_DT;
    const views: EntityView[] = ids.map((id) => r.entity(id)!);
    out.hash = stateHash(out.hash, views);
    const depth = deepestOverlap(views);
    out.deepest = Math.max(out.deepest, depth);
    if (depth > -TOUCH) out.touching += 1;
    ids.forEach((id, i) => {
      if (r.out(`${id}-go`, 'arrivedPulse') === true) {
        out.legs[i]! += 1;
        out.lastArrival = t;
      }
      const p = poseOf(views[i]!);
      const a = anchor[i]!;
      // Turning on the spot at a lane end is work, not waiting.
      if (Math.hypot(p.x - a.x, p.z - a.z) > 0.05 || Math.abs(p.heading - a.heading) > 5) anchor[i] = { ...p, since: t };
      else out.longestWait[i] = Math.max(out.longestWait[i]!, t - a.since);
    });
  }
  return out;
}

function board(parts: { nodes: NodeSpec[]; wires: WireSpec[] }[], markers: NodeSpec[]): NavRig {
  return navRig([...markers, ...parts.flatMap((p) => p.nodes)], parts.flatMap((p) => p.wires), rapier);
}

const report = (name: string, t: Traffic): void =>
  console.log(`${name}: deepest ${(t.deepest * 1000).toFixed(1)} mm, touching ticks ${t.touching}, legs ${t.legs.join('/')}, longest wait ${t.longestWait.map((w) => w.toFixed(1)).join('/')} s, last arrival ${t.lastArrival.toFixed(1)} s`);

describe('one-way loop: stop and wait behind', () => {
  const CORNERS = [marker(1, -5, -3), marker(2, 5, -3), marker(3, 5, 3), marker(4, -5, 3)];
  // Each starts on a side of the rectangle, facing the way round; next marker = the corner ahead.
  const STARTS: [number, number, number, number][] = [[-2, -3, 0, 2], [5, 0, 90, 3], [2, 3, 180, 4], [-5, 0, -90, 1]];

  function loop(count: number, powers: number[]): { t: Traffic; ids: string[] } {
    const ids = Array.from({ length: count }, (_, k) => `loop${k + 1}`);
    const parts = ids.map((id, k) => {
      const [x, z, heading, next] = STARTS[k]!;
      return looper({ id, x, z, heading, power: powers[k]!, rule: 'front' }, next, 4);
    });
    return { t: watch(board(parts, CORNERS), ids), ids };
  }

  it('two robots, the fast one behind the slow one: it queues and never touches it', () => {
    const { t } = loop(2, [0.35, 0.9]);
    report('loop 2', t);
    expect(t.deepest).toBeLessThan(-TOUCH);
    expect(t.touching).toBe(0);
    for (const legs of t.legs) expect(legs).toBeGreaterThanOrEqual(8);
    for (const wait of t.longestWait) expect(wait).toBeLessThan(10);
    expect(t.lastArrival).toBeGreaterThan(SECONDS - 15);
  });

  it('four robots at four speeds: all keep going round for 120 s', () => {
    const { t } = loop(4, [0.35, 0.9, 0.6, 0.75]);
    report('loop 4', t);
    expect(t.deepest).toBeLessThan(-TOUCH);
    expect(t.touching).toBe(0);
    for (const legs of t.legs) expect(legs).toBeGreaterThanOrEqual(8);
    for (const wait of t.longestWait) expect(wait).toBeLessThan(10);
    expect(t.lastArrival).toBeGreaterThan(SECONDS - 15);
  });

  it('the same loop twice gives the same state on every tick', () => {
    expect(loop(4, [0.35, 0.9, 0.6, 0.75]).t.hash).toBe(loop(4, [0.35, 0.9, 0.6, 0.75]).t.hash);
  });
});

describe('crossing lanes: give way to the right', () => {
  it('two robots shuttle on two lanes that cross, starting so that they meet in the middle: neither touches the other, both keep going', () => {
    const markers = [marker(1, -6, 0), marker(2, 6, 0), marker(3, 0, -6), marker(4, 0, 6)];
    const parts = [shuttle({ id: 'ew', x: -6, z: 0, heading: 0, rule: 'right' }, 2, 1), shuttle({ id: 'ns', x: 0, z: -6, heading: 90, rule: 'right' }, 4, 3)];
    const t = watch(board(parts, markers), ['ew', 'ns']);
    report('cross 2 (same speed)', t);
    expect(t.deepest).toBeLessThan(-TOUCH);
    expect(t.touching).toBe(0);
    for (const legs of t.legs) expect(legs).toBeGreaterThanOrEqual(6);
    for (const wait of t.longestWait) expect(wait).toBeLessThan(10);
    expect(t.lastArrival).toBeGreaterThan(SECONDS - 20);
  });

  it.each([[0.45, 0.8], [0.8, 0.45], [0.6, 0.7], [1, 0.5]])('two robots at powers %s and %s meet at ever different moments: still no touch, no standstill', (a, b) => {
    const markers = [marker(1, -6, 0), marker(2, 6, 0), marker(3, 0, -6), marker(4, 0, 6)];
    const parts = [shuttle({ id: 'ew', x: -6, z: 0, heading: 0, power: a, rule: 'right' }, 2, 1), shuttle({ id: 'ns', x: 0, z: -6, heading: 90, power: b, rule: 'right' }, 4, 3)];
    const t = watch(board(parts, markers), ['ew', 'ns']);
    report(`cross 2 (${a}, ${b})`, t);
    expect(t.deepest).toBeLessThan(-TOUCH);
    expect(t.touching).toBe(0);
    for (const legs of t.legs) expect(legs).toBeGreaterThanOrEqual(5);
    for (const wait of t.longestWait) expect(wait).toBeLessThan(10);
  });

  function grid(powers: number[]): Traffic {
    // Two lanes each way, 5 m apart: four crossings.
    const markers = [marker(1, -8, -2.5), marker(2, 8, -2.5), marker(3, 8, 2.5), marker(4, -8, 2.5), marker(5, -2.5, -8), marker(6, -2.5, 8), marker(7, 2.5, 8), marker(8, 2.5, -8)];
    const parts = [
      shuttle({ id: 'e1', x: -8, z: -2.5, heading: 0, power: powers[0]!, rule: 'right' }, 2, 1),
      shuttle({ id: 'w2', x: 8, z: 2.5, heading: 180, power: powers[1]!, rule: 'right' }, 4, 3),
      shuttle({ id: 's1', x: -2.5, z: -8, heading: 90, power: powers[2]!, rule: 'right' }, 6, 5),
      shuttle({ id: 'n2', x: 2.5, z: 8, heading: -90, power: powers[3]!, rule: 'right' }, 8, 7),
    ];
    return watch(board(parts, markers), ['e1', 'w2', 's1', 'n2']);
  }

  it.each([[[0.6, 0.6, 0.6, 0.6]], [[0.5, 0.8, 0.65, 0.95]], [[0.9, 0.4, 0.7, 0.55]]])('four robots on a grid of four crossings, powers %j: no overlap, no touch, nobody stuck', (powers) => {
    const t = grid(powers);
    report(`grid 4 ${powers.join(',')}`, t);
    expect(t.deepest).toBeLessThan(-TOUCH);
    expect(t.touching).toBe(0);
    // A lane is 16 m: the slowest robot here (power 0.4, 0.75 m/s) needs about 25 s for one, so four legs is all it can do.
    for (const legs of t.legs) expect(legs).toBeGreaterThanOrEqual(4);
    for (const wait of t.longestWait) expect(wait).toBeLessThan(12);
    expect(t.lastArrival).toBeGreaterThan(SECONDS - 25);
  });

  it('the same grid twice gives the same state on every tick', () => {
    expect(grid([0.5, 0.8, 0.65, 0.95]).hash).toBe(grid([0.5, 0.8, 0.65, 0.95]).hash);
  });
});

describe('what does not work', () => {
  it('two robots nose to nose in one lane: both stop for each other and stand for good (they never overlap)', () => {
    const markers = [marker(1, -6, 0), marker(2, 6, 0)];
    const parts = [shuttle({ id: 'a', x: -6, z: 0, heading: 0, rule: 'front' }, 2, 1), shuttle({ id: 'b', x: 6, z: 0, heading: 180, rule: 'front' }, 1, 2)];
    const r = board(parts, markers);
    const t = watch(r, ['a', 'b']);
    report('head-on', t);
    expect(t.deepest).toBeLessThan(-TOUCH);
    expect(t.legs).toEqual([0, 0]);
    for (const wait of t.longestWait) expect(wait).toBeGreaterThan(100);
    expect([r.out('a-eye', 'blocked'), r.out('b-eye', 'blocked')]).toEqual([true, true]);
  });

  it('a crossing with only straight-ahead eyes, both arriving at the same moment: they do not lock up, but one runs into the side of the other', () => {
    const markers = [marker(1, -6, 0), marker(2, 6, 0), marker(3, 0, -6), marker(4, 0, 6)];
    const parts = [shuttle({ id: 'ew', x: -6, z: 0, heading: 0, rule: 'front' }, 2, 1), shuttle({ id: 'ns', x: 0, z: -6, heading: 90, rule: 'front' }, 4, 3)];
    const t = watch(board(parts, markers), ['ew', 'ns']);
    report('cross 2, front eyes only', t);
    // Solid chassis: never inside each other. But the eye looks along the robot's own lane and sees the other too late to stop short.
    expect(t.deepest).toBeLessThanOrEqual(TOUCH);
    expect(t.touching).toBeGreaterThan(0);
    for (const legs of t.legs) expect(legs).toBeGreaterThanOrEqual(6);
  });
});
