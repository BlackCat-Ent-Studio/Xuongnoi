import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT, type EntityView, type ViewMode } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { deepestOverlap, groundSpeed, overlapDepth } from '../helpers/chassis-metrics';

/**
 * Two (or more) robot chassis meeting with "Vật lý thật" on. Every tick the collision boxes are read back from the entity
 * views and measured by a helper that knows nothing of the physics code: they may touch, never overlap by a millimetre.
 * A chassis shoves another by the push rule it uses for loose things: the wheels turning its way give at most
 * min(motor force, grip) each; the other holds with min(brake force, grip) per wheel along its wheels (a brake force of 0
 * means only grip limits it) and with its whole grip μ·m·g sideways. More push than hold moves it, anything else stops.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

/** Overlap allowed between two chassis (m). */
const TOUCH = 0.001;
/** Two chassis this close (m) have met: a chassis stepped before the one ahead of it is one tick of that one's travel behind when the tick ends. */
const NEAR = 0.05;

interface Bot {
  id: string;
  x: number;
  z?: number;
  heading?: number;
  kg?: number;
  /** Motor force (N) and top speed (rpm) of each of the two motors, and the power both are given. */
  motorN?: number;
  maxRpm?: number;
  power?: number;
  brakeN?: number;
  length?: number;
}

const SIDE = 1.2;

function bot(b: Bot): { nodes: NodeSpec[]; wires: WireSpec[] } {
  const id = b.id;
  return {
    nodes: [
      [id, 'robot-body', { position: { x: b.x, y: 0.15, z: b.z ?? 0 }, heading: b.heading ?? 0, length: b.length ?? SIDE, width: 1, height: 0.3, mass: b.kg ?? 5, friction: 0.8, showPush: 'yes' }],
      [`${id}-ml`, 'motor', { side: -0.45, maxRpm: b.maxRpm ?? 120, maxForce: b.motorN ?? 30, brakeForce: b.brakeN ?? 0, showSlip: 'yes' }],
      [`${id}-mr`, 'motor', { side: 0.45, maxRpm: b.maxRpm ?? 120, maxForce: b.motorN ?? 30, brakeForce: b.brakeN ?? 0, showSlip: 'yes' }],
      [`${id}-p`, 'const', { value: b.power ?? 0 }],
    ],
    wires: [
      [id, 'self', `${id}-ml`, 'body'], [id, 'self', `${id}-mr`, 'body'],
      [`${id}-p`, 'value', `${id}-ml`, 'power'], [`${id}-p`, 'value', `${id}-mr`, 'power'],
    ],
  };
}

const FLOOR: NodeSpec = ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 120, y: 1, z: 60 } }];

function play(bots: Bot[], opts: { real?: boolean; extra?: NodeSpec[]; mode?: ViewMode } = {}) {
  const parts = bots.map(bot);
  const r = rig([FLOOR, ...parts.flatMap((p) => p.nodes), ...(opts.extra ?? [])], parts.flatMap((p) => p.wires), opts.mode ?? '3d', false, opts.real !== false, opts.real !== false ? rapier : undefined);
  const ids = bots.map((b) => b.id);
  return { ...r, ids, views: (): EntityView[] => ids.map((id) => r.entity(id)!) };
}

type Play = ReturnType<typeof play>;

interface Trace {
  /** Deepest overlap of any two chassis on any tick (m; negative = they never touched). */
  deepest: number;
  /** Fastest any chassis moved over the ground on any tick (m/s), measured from positions. */
  fastest: number;
  /** Fastest any chassis moved before two of them first met. */
  fastestBefore: number;
  /** Seconds at which two chassis first came within `NEAR` of each other (-1 = never). */
  contactAt: number;
}

/** Runs `seconds`, measuring every tick. */
function watch(p: Play, seconds: number, each?: (t: number) => void): Trace {
  const out: Trace = { deepest: -Infinity, fastest: 0, fastestBefore: 0, contactAt: -1 };
  let prev = p.views();
  const n = Math.round(seconds / TICK_DT);
  for (let k = 0; k < n; k++) {
    each?.(k * TICK_DT);
    p.tick();
    const now = p.views();
    const depth = deepestOverlap(now);
    out.deepest = Math.max(out.deepest, depth);
    if (out.contactAt < 0 && depth > -NEAR) out.contactAt = (k + 1) * TICK_DT;
    now.forEach((v, i) => {
      const s = groundSpeed(prev[i]!, v, TICK_DT);
      out.fastest = Math.max(out.fastest, s);
      if (out.contactAt < 0) out.fastestBefore = Math.max(out.fastestBefore, s);
    });
    prev = now;
  }
  return out;
}

/** How far each chassis moves over `seconds` (m), and the largest forward speed any of them reports. */
function restOver(p: Play, seconds: number): { drift: number; speed: number; deepest: number } {
  const from = p.views();
  let speed = 0;
  let deepest = -Infinity;
  let drift = 0;
  for (let k = 0; k < Math.round(seconds / TICK_DT); k++) {
    p.tick();
    const now = p.views();
    deepest = Math.max(deepest, deepestOverlap(now));
    now.forEach((v, i) => {
      speed = Math.max(speed, Math.abs(v.robot!.speed));
      drift = Math.max(drift, Math.hypot(v.position.x - from[i]!.position.x, v.position.z - from[i]!.position.z));
    });
  }
  return { drift, speed, deepest };
}

const NORMAL = { motorN: 6, maxRpm: 90, power: 0.7 };
const MAX = { motorN: 30, maxRpm: 120, power: 1 };

describe('robot chassis are solid against each other with "Vật lý thật" on', () => {
  for (const [name, d] of [['normal speed', NORMAL], ['top speed', MAX]] as const) {
    it(`head-on, two equal robots at ${name}: they stop at each other and stay still`, () => {
      const p = play([{ id: 'a', x: -3, ...d }, { id: 'b', x: 3, heading: 180, ...d }]);
      const run = watch(p, 6);
      expect(run.contactAt).toBeGreaterThan(0);
      expect(run.deepest).toBeLessThan(TOUCH);
      // Neither got past the other, and the meeting point is the middle (equal forces: nobody is pushed).
      const [a, b] = p.views();
      expect(a!.position.x).toBeLessThan(b!.position.x);
      expect(Math.abs(a!.position.x + b!.position.x)).toBeLessThan(0.05);
      expect(run.fastest).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
      expect(p.out('a', 'pushing')).toBe(true);
      expect(p.out('b', 'pushing')).toBe(true);
      // Pressing on each other for 3 more seconds: no creep, no shaking, no speed out of nowhere.
      const rest = restOver(p, 3);
      expect(rest.drift).toBeLessThan(0.001);
      expect(rest.speed).toBeLessThan(0.01);
      expect(rest.deepest).toBeLessThan(TOUCH);
      p.world.dispose?.();
    });
  }

  it('head-on, 40 kg against 2 kg: the heavy one shoves the light one back, whose wheels slip', () => {
    const p = play([{ id: 'heavy', x: -3, kg: 40, ...MAX }, { id: 'light', x: 3, heading: 180, kg: 2, ...MAX }]);
    const run = watch(p, 4);
    expect(run.contactAt).toBeGreaterThan(0);
    expect(run.deepest).toBeLessThan(TOUCH);
    expect(run.fastest).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
    const meet = p.entity('light')!.position.x;
    let slipped = false;
    const more = watch(p, 2, () => {
      if (p.out('light-ml', 'slipping') === true) slipped = true;
    });
    expect(more.deepest).toBeLessThan(TOUCH);
    // The light robot is carried backwards (its nose points to -x, it travels to +x), staying against the heavy one.
    expect(p.entity('light')!.position.x).toBeGreaterThan(meet + 1);
    expect(p.entity('light')!.robot!.speed).toBeLessThan(-0.5);
    expect(overlapDepth(p.entity('heavy')!, p.entity('light')!)).toBeGreaterThan(-NEAR);
    expect(slipped).toBe(true);
    expect(p.out('heavy', 'pushing')).toBe(true);
    expect(more.fastest).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
    p.world.dispose?.();
  });

  it('head-on, 40 kg against 2 kg with weak motors: the push (2 x 4.2 N) is below the light robot\'s grip (15.7 N), both stop', () => {
    const p = play([{ id: 'heavy', x: -3, kg: 40, ...NORMAL }, { id: 'light', x: 3, heading: 180, kg: 2, ...NORMAL }]);
    const run = watch(p, 14);
    expect(run.contactAt).toBeGreaterThan(0);
    expect(run.deepest).toBeLessThan(TOUCH);
    const rest = restOver(p, 3);
    expect(rest.drift).toBeLessThan(0.001);
    expect(p.out('heavy', 'pushing')).toBe(true);
    expect(Number(p.out('heavy', 'pushForce'))).toBeCloseTo(8.4, 3);
    p.world.dispose?.();
  });

  it('rear-end into a parked robot whose wheels are locked (brake force 0 = grip decides, 39.2 N): the driver stops, the parked one does not move', () => {
    const p = play([{ id: 'a', x: -3, ...NORMAL }, { id: 'parked', x: 1 }]);
    const at = p.entity('parked')!.position.x;
    const run = watch(p, 8);
    expect(run.contactAt).toBeGreaterThan(0);
    expect(run.deepest).toBeLessThan(TOUCH);
    expect(Math.abs(p.entity('parked')!.position.x - at)).toBeLessThan(0.001);
    expect(Math.abs(p.entity('a')!.robot!.speed)).toBeLessThan(0.01);
    expect(p.out('a', 'pushing')).toBe(true);
    expect(restOver(p, 3).drift).toBeLessThan(0.001);
    p.world.dispose?.();
  });

  for (const order of ['driver stepped first', 'parked one stepped first'] as const) {
    it(`rear-end into a parked robot with a weak brake (2 x 2 N, below the 8.4 N push), ${order}: it is pushed along, and reads the speed it really has`, () => {
    const pair: Bot[] = [{ id: 'a', x: -3, ...NORMAL }, { id: 'parked', x: 1, brakeN: 2 }];
    const p = play(order === 'driver stepped first' ? pair : [pair[1]!, pair[0]!]);
    const at = p.entity('parked')!.position.x;
    const run = watch(p, 6);
    expect(run.contactAt).toBeGreaterThan(0);
    expect(run.deepest).toBeLessThan(TOUCH);
    const parked = p.entity('parked')!;
    expect(parked.position.x).toBeGreaterThan(at + 0.5);
    // Still against the pusher and moving with it.
    expect(overlapDepth(p.entity('a')!, parked)).toBeGreaterThan(-NEAR);
    expect(parked.robot!.speed).toBeGreaterThan(0.5);
    expect(parked.robot!.speed).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
    expect(run.fastest).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
    expect(p.out('a', 'pushing')).toBe(true);
    expect(Number(p.out('a', 'pushForce'))).toBeCloseTo(4, 3);
    // The pusher lets go: the brake stops the pushed robot, and nothing moves afterwards.
    p.set('a-p', { value: 0 });
    watch(p, 2);
    expect(restOver(p, 2).drift).toBeLessThan(0.001);
    p.world.dispose?.();
    });
  }

  for (const mode of ['2d-side', '2d-top'] as const) {
    it(`head-on in the ${mode} view: they stop at each other too`, () => {
      // The side view has no turning: the second robot comes back by reversing.
      const coming: Bot = mode === '2d-side' ? { id: 'b', x: 3, ...MAX, power: -1 } : { id: 'b', x: 3, heading: 180, ...MAX };
      const p = play([{ id: 'a', x: -3, ...MAX }, coming], { mode });
      const run = watch(p, 6);
      expect(run.contactAt).toBeGreaterThan(0);
      expect(run.deepest).toBeLessThan(TOUCH);
      expect(p.entity('a')!.position.x).toBeLessThan(p.entity('b')!.position.x);
      expect(restOver(p, 2).drift).toBeLessThan(0.001);
      p.world.dispose?.();
    });
  }

  it('rear-end into a parked robot with a strong brake (2 x 10 N, above the push): it holds', () => {
    const p = play([{ id: 'a', x: -3, ...NORMAL }, { id: 'parked', x: 1, brakeN: 10 }]);
    const at = p.entity('parked')!.position.x;
    const run = watch(p, 8);
    expect(run.deepest).toBeLessThan(TOUCH);
    expect(Math.abs(p.entity('parked')!.position.x - at)).toBeLessThan(0.001);
    p.world.dispose?.();
  });

  it('a faster robot catching a slower one follows it at its speed without shaking', () => {
    const p = play([{ id: 'fast', x: -4, ...MAX }, { id: 'slow', x: 0, ...NORMAL }]);
    const run = watch(p, 6);
    expect(run.contactAt).toBeGreaterThan(0);
    expect(run.deepest).toBeLessThan(TOUCH);
    // Held to the slow robot's pace from then on.
    const speeds: number[] = [];
    let prev = p.entity('fast')!;
    const more = watch(p, 2, () => {
      const now = p.entity('fast')!;
      speeds.push(groundSpeed(prev, now, TICK_DT));
      prev = now;
    });
    expect(more.deepest).toBeLessThan(TOUCH);
    const slow = p.entity('slow')!.robot!.speed;
    expect(Math.max(...speeds.slice(2))).toBeLessThan(slow + 0.2);
    expect(overlapDepth(p.entity('fast')!, p.entity('slow')!)).toBeGreaterThan(-NEAR);
    p.world.dispose?.();
  });

  for (const [name, d] of [['normal speed', NORMAL], ['top speed', MAX]] as const) {
    it(`crossing at a right angle at ${name}: they meet and stay out of each other`, () => {
      const p = play([{ id: 'a', x: -4, z: 0, heading: 0, ...d }, { id: 'b', x: 0, z: -4, heading: 90, ...d }]);
      const run = watch(p, 8);
      expect(run.contactAt).toBeGreaterThan(0);
      expect(run.deepest).toBeLessThan(TOUCH);
      expect(run.fastest).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
      expect(restOver(p, 2).deepest).toBeLessThan(TOUCH);
      p.world.dispose?.();
    });

    it(`glancing contact at 30 degrees at ${name}: no overlap, no gain in speed`, () => {
      const p = play([{ id: 'a', x: -3, z: -1.9, heading: 30, ...d }, { id: 'parked', x: 0.6, z: 0.5 }]);
      const run = watch(p, 8);
      expect(run.contactAt).toBeGreaterThan(0);
      expect(run.deepest).toBeLessThan(TOUCH);
      expect(run.fastest).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
      p.world.dispose?.();
    });
  }

  // Chassis are 1.2 m long and 1 m wide: at 45 degrees a corner reaches 0.778 m from the middle, the faces lie 0.6 and 0.5 m out.
  const CORNER = (SIDE + 1) / 2 / Math.SQRT2;

  for (const [name, d] of [['normal speed', NORMAL], ['top speed', MAX]] as const) {
    it(`driving straight into a parked robot that stands at 45 degrees, at ${name}: it stops at the corner that is drawn, and stays there`, () => {
      const p = play([{ id: 'a', x: -3, ...d }, { id: 'parked', x: 1, heading: 45 }]);
      const at = { ...p.entity('parked')!.position };
      const run = watch(p, 8);
      expect(run.contactAt).toBeGreaterThan(0);
      expect(run.deepest).toBeLessThan(TOUCH);
      expect(run.fastest).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
      // Nose (0.6 m ahead of its middle) against the corner: 18 cm before the place the upright squares would have met.
      const a = p.entity('a')!;
      expect(a.position.x).toBeCloseTo(1 - CORNER - SIDE / 2, 3);
      expect(overlapDepth(a, p.entity('parked')!)).toBeGreaterThan(-TOUCH);
      const parked = p.entity('parked')!.position;
      expect(Math.hypot(parked.x - at.x, parked.z - at.z)).toBeLessThan(0.001);
      expect(p.out('a', 'pushing')).toBe(true);
      const rest = restOver(p, 3);
      expect(rest.drift).toBeLessThan(0.001);
      expect(rest.deepest).toBeLessThan(TOUCH);
      p.world.dispose?.();
    });

    it(`two robots meeting nose to nose along a diagonal (45 and 225 degrees), at ${name}: they stop face to face in the middle`, () => {
      const far = 2.5;
      const p = play([{ id: 'a', x: -far, z: -far, heading: 45, ...d }, { id: 'b', x: far, z: far, heading: 225, ...d }]);
      const run = watch(p, 8);
      expect(run.contactAt).toBeGreaterThan(0);
      expect(run.deepest).toBeLessThan(TOUCH);
      expect(run.fastest).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
      const [a, b] = p.views();
      // Flush: the middles are one chassis length apart along the diagonal, and neither was pushed off it.
      expect(Math.hypot(b!.position.x - a!.position.x, b!.position.z - a!.position.z)).toBeCloseTo(SIDE, 2);
      expect(Math.abs(a!.position.x + b!.position.x)).toBeLessThan(0.05);
      expect(Math.abs(a!.position.x - a!.position.z)).toBeLessThan(0.02);
      const rest = restOver(p, 3);
      expect(rest.drift).toBeLessThan(0.001);
      expect(rest.speed).toBeLessThan(0.01);
      expect(rest.deepest).toBeLessThan(TOUCH);
      p.world.dispose?.();
    });

    it(`a robot driving at 45 degrees into the side of a parked one, at ${name}: its corner meets the face and it never goes in`, () => {
      const p = play([{ id: 'a', x: -2.5, z: -2.5, heading: 45, ...d }, { id: 'parked', x: 0.3, z: 0 }]);
      const at = { ...p.entity('parked')!.position };
      const run = watch(p, 8);
      expect(run.contactAt).toBeGreaterThan(0);
      expect(run.deepest).toBeLessThan(TOUCH);
      expect(run.fastest).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
      expect(restOver(p, 2).deepest).toBeLessThan(TOUCH);
      const parked = p.entity('parked')!.position;
      expect(Math.hypot(parked.x - at.x, parked.z - at.z)).toBeLessThan(0.001);
      p.world.dispose?.();
    });
  }

  it('two robots 1 m wide pass each other in lanes 1.1 m apart: they are as wide as drawn, not as wide as they are long', () => {
    const p = play([{ id: 'a', x: -3, z: 0, ...NORMAL }, { id: 'b', x: 3, z: 1.1, heading: 180, ...NORMAL }]);
    const alone = play([{ id: 'a', x: -3, z: 0, ...NORMAL }]);
    let deepest = -Infinity;
    for (let k = 0; k < Math.round(7 / TICK_DT); k++) {
      p.tick();
      alone.tick();
      deepest = Math.max(deepest, deepestOverlap(p.views()));
      // Nothing touched it: it drives exactly as it does alone.
      expect(p.entity('a')!.position).toEqual(alone.entity('a')!.position);
    }
    // 10 cm of room between them as they passed; the squares round them overlap by 10 cm there.
    expect(deepest).toBeCloseTo(-0.1, 3);
    expect(p.entity('a')!.position.x).toBeGreaterThan(2);
    expect(p.entity('b')!.position.x).toBeLessThan(-2);
    expect(p.out('a', 'pushing')).toBe(false);
    p.world.dispose?.();
    alone.world.dispose?.();
  });

  it('eight robots in a row, each driving into the next, the first one parked: every pair stays apart and the row comes to rest', () => {
    const bots: Bot[] = [{ id: 'r0', x: 12 }];
    for (let k = 1; k < 8; k++) bots.push({ id: `r${k}`, x: 12 - k * 1.7, ...MAX });
    const p = play(bots);
    const run = watch(p, 8);
    expect(run.contactAt).toBeGreaterThan(0);
    expect(run.deepest).toBeLessThan(TOUCH);
    expect(run.fastest).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
    const rest = restOver(p, 3);
    expect(rest.deepest).toBeLessThan(TOUCH);
    expect(rest.drift).toBeLessThan(0.001);
    expect(rest.speed).toBeLessThan(0.01);
    // In the order they started in.
    const xs = p.views().map((v) => v.position.x);
    for (let k = 1; k < xs.length; k++) expect(xs[k]!).toBeLessThan(xs[k - 1]! - SIDE + TOUCH);
    p.world.dispose?.();
  });

  it('eight robots in a row at top speed with a strong one at the back: the row is pushed as one and never overlaps', () => {
    const bots: Bot[] = [];
    for (let k = 0; k < 7; k++) bots.push({ id: `r${k}`, x: 10 - k * 1.5, brakeN: 1 });
    bots.push({ id: 'pusher', x: 10 - 7 * 1.5 - 1, kg: 40, ...MAX, motorN: 60 });
    const p = play(bots);
    const first = p.entity('r0')!.position.x;
    const run = watch(p, 8);
    expect(run.deepest).toBeLessThan(TOUCH);
    expect(run.fastest).toBeLessThanOrEqual(run.fastestBefore + 1e-9);
    // 7 parked robots hold with 2 N each (14 N); the pusher gives 2 x min(60 N, grip 157 N).
    expect(p.entity('r0')!.position.x).toBeGreaterThan(first + 1);
    expect(Number(p.out('pusher', 'pushForce'))).toBeCloseTo(14, 3);
    p.world.dispose?.();
  });

  it('a crate riding on either robot stays on it through a head-on stop and does not creep while they press on each other', () => {
    const crate = (id: string, x: number): NodeSpec => [id, 'item', { shape: 'crate', position: { x, y: 0.3 + 0.2 + 0.005, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, mass: 1 }];
    const p = play([{ id: 'a', x: -3, ...NORMAL }, { id: 'b', x: 3, heading: 180, ...NORMAL }], { extra: [crate('ca', -3), crate('cb', 3)] });
    const rel = (c: string, b: string): number => p.entity(c)!.position.x - p.entity(b)!.position.x;
    const run = watch(p, 7);
    expect(run.contactAt).toBeGreaterThan(0);
    expect(run.deepest).toBeLessThan(TOUCH);
    for (const [c, b] of [['ca', 'a'], ['cb', 'b']] as const) {
      // Still standing on its chassis (a 0.4 m crate on a 1.2 m top), upright.
      expect(Math.abs(rel(c, b))).toBeLessThan(0.4);
      expect(p.entity(c)!.position.y).toBeCloseTo(0.5, 2);
    }
    const before = { a: rel('ca', 'a'), b: rel('cb', 'b') };
    restOver(p, 3);
    expect(Math.abs(rel('ca', 'a') - before.a)).toBeLessThan(0.001);
    expect(Math.abs(rel('cb', 'b') - before.b)).toBeLessThan(0.001);
    p.world.dispose?.();
  });

  it('a chassis that does not block ("Chặn người đi bộ" = Không) is passed through as before', () => {
    const parts = [bot({ id: 'a', x: -3, ...NORMAL }), bot({ id: 'ghost', x: 1 })];
    parts[1]!.nodes[0]![2]!.solid = 'no';
    const r = rig([FLOOR, ...parts.flatMap((x) => x.nodes)], parts.flatMap((x) => x.wires), '3d', false, true, rapier);
    r.tick(Math.round(8 / TICK_DT));
    expect(r.entity('a')!.position.x).toBeGreaterThan(2.5);
    expect(r.entity('ghost')!.position.x).toBeCloseTo(1, 6);
    r.world.dispose?.();
  });
});

describe('with "Vật lý thật" off robots still pass through each other, exactly as before', () => {
  it('head-on: each robot ends where it ends when it drives alone', () => {
    const both = play([{ id: 'a', x: -3, ...MAX }, { id: 'b', x: 3, heading: 180, ...MAX }], { real: false });
    const onlyA = play([{ id: 'a', x: -3, ...MAX }], { real: false });
    const onlyB = play([{ id: 'b', x: 3, heading: 180, ...MAX }], { real: false });
    let deepest = -Infinity;
    for (let k = 0; k < Math.round(6 / TICK_DT); k++) {
      both.tick();
      onlyA.tick();
      onlyB.tick();
      deepest = Math.max(deepest, deepestOverlap(both.views()));
      expect(both.entity('a')!.position).toEqual(onlyA.entity('a')!.position);
      expect(both.entity('b')!.position).toEqual(onlyB.entity('b')!.position);
    }
    expect(deepest).toBeGreaterThan(0.25);
    expect(both.out('a', 'pushing')).toBe(false);
  });
});
