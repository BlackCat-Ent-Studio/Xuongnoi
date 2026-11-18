import { beforeAll, describe, expect, it } from 'vitest';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { gripperNode } from '../../src/nodes/gripper';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';

/**
 * "Vật lý thật": how fast the fingers close ("Tốc độ khép ngón"), when a crate counts as held (both pads touch its faces) and
 * what a finger that cannot go on reports ("Ngón bị chặn", "Lực ngón đang ép").
 *
 * Hand numbers (hand hangs from a joint, grasp point 1.7 m up; palm 0.15 deep, fingers 0.3 long and 0.12 thick, grasp point 0.3 from the wrist):
 *   opening 1 m: a pad's middle starts 0.5 + 0.06 = 0.56 m from the grasp point; closed on nothing it ends 0.02 + 0.06 = 0.08 m from it
 *   (0.48 m of travel); closed on a 0.4 m wide crate it ends 0.2 + 0.06 = 0.26 m from the crate's middle (0.30 m of travel).
 *   Travel time = distance / speed. One tick = 1/60 s.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const MM = 0.001;
const TICK = 1 / 60;

function hand(opts: { crate?: { y: number; z?: number; size?: { x: number; y: number; z: number } }; gripper?: Record<string, number | string>; crateExtra?: Record<string, number | string> } = {}) {
  const crate = opts.crate;
  const size = crate?.size ?? { x: 0.6, y: 0.6, z: 0.6 };
  const z = crate?.z ?? 0;
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 30 } }],
    ['ped', 'block', { position: { x: 0, y: 0.5, z: 0 }, size: { x: 0.4, y: 1, z: 0.4 } }],
    ['go', 'on-start'],
    ['ang', 'const', { value: -90 }],
    ['j', 'joint', { axis: 'pitch', start: -90, min: -90, max: 90, maxTorque: 100, mount: { x: 0, y: 2.5, z: 0 } }],
    ['l', 'link', { length: 1, mass: 0 }],
    ['g', 'gripper', { width: 1, grip: 'between', mass: 0, defaultForce: 25, maxForce: 120, showFingerOuts: 'yes', ...(opts.gripper ?? {}) }],
    ['k', 'key', { key: 'Space' }],
  ];
  if (crate) {
    nodes.push(['shelf', 'block', { position: { x: 0, y: crate.y - size.y / 2 - 0.25, z }, size: { x: 2, y: 0.5, z: 3 } }]);
    nodes.push(['c', 'item', { shape: 'crate', position: { x: 0, y: crate.y, z }, size, mass: 2, mu: 0.5, ...(opts.crateExtra ?? {}) }]);
  }
  const wires: WireSpec[] = [
    ['ped', 'self', 'j', 'base'],
    ['go', 'started', 'j', 'power'],
    ['ang', 'value', 'j', 'angle'],
    ['j', 'tip', 'l', 'base'],
    ['l', 'tip', 'g', 'base'],
    ['k', 'held', 'g', 'close'],
  ];
  const r = rig(nodes, wires, '3d', false, true, rapier);
  r.tick(40);
  return r;
}

type Rig = ReturnType<typeof hand>;

/** Drawn pads of the gripper: the second and third entity it made (palm first). */
function pads(r: Rig): [number, number] {
  const [, f1, f2] = r.world.entities().filter((e) => e.ownerNodeId === 'g');
  return [f1!.position.z, f2!.position.z];
}

/** Ticks of closing until `done` is true (after pressing Space), or -1. */
function ticksUntil(r: Rig, done: () => boolean, limit = 400): number {
  r.hold('Space');
  for (let n = 1; n <= limit; n++) {
    r.tick();
    if (done()) return n;
  }
  return -1;
}

describe('finger speed is a parameter ("Tốc độ khép ngón")', () => {
  // Closed on nothing: 0.48 m of travel each. Time = 0.48 / speed, within 2 ticks (the first tick only sets the target).
  for (const speed of [0.5, 1, 2]) {
    it(`${speed} m/s closes the open hand in ${(0.48 / speed).toFixed(3)} s`, () => {
      const r = hand({ gripper: { fingerSpeed: speed } });
      const n = ticksUntil(r, () => Math.abs(pads(r)[0] - pads(r)[1]) < 0.16 + MM);
      expect(n).toBeGreaterThan(0);
      expect(Math.abs(n * TICK - 0.48 / speed)).toBeLessThan(2 * TICK);
    });
  }

  it('the default is 1 m/s (what the hand did before the parameter existed) and the limits are 0.05 to 5 m/s', () => {
    const p = gripperNode.params.find((q) => q.id === 'fingerSpeed')!;
    expect(p.default).toBe(1);
    expect(p.kind === 'number' && [p.min, p.max]).toEqual([0.05, 5]);
    expect(p.advanced).toBe(true);
  });

  it('a value outside the limits is clamped, never zero or negative speed', () => {
    const r = hand({ gripper: { fingerSpeed: 0 } });
    const n = ticksUntil(r, () => Math.abs(pads(r)[0] - pads(r)[1]) < 0.16 + MM, 1200);
    // 0.05 m/s: 0.48 / 0.05 = 9.6 s
    expect(Math.abs(n * TICK - 9.6)).toBeLessThan(2 * TICK);
  });
});

describe('a crate counts as held when both pads touch its faces, not when closing starts', () => {
  const CRATE = { y: 1.5, size: { x: 0.6, y: 0.6, z: 0.4 } };

  it('1 m/s: not held for the 0.30 s the pads travel, held when they touch (pads on both faces within 0.5 mm)', () => {
    const r = hand({ crate: CRATE });
    expect(r.out('g', 'inReach')).toBe(true);
    let first = -1;
    r.hold('Space');
    for (let n = 1; n <= 60; n++) {
      r.tick();
      if (r.out('g', 'holding') === true) {
        first = n;
        break;
      }
    }
    // 0.30 m at 1 m/s = 18 ticks (+1 tick to see it); never before the pads got there.
    expect(first).toBeGreaterThanOrEqual(18);
    expect(first).toBeLessThanOrEqual(21);
    const c = r.entity('c')!;
    const [a, b] = pads(r);
    // Inner faces of the pads (pad middle -/+ 0.06) against the crate faces (centre -/+ 0.2).
    expect(Math.abs(a - 0.06 - (c.position.z + 0.2))).toBeLessThan(0.5 * MM);
    expect(Math.abs(b + 0.06 - (c.position.z - 0.2))).toBeLessThan(0.5 * MM);
    expect(r.out('g', 'held')).toBe(c.id);
    expect(r.out('g', 'gripForce')).toBe(25);
  });

  it('0.25 m/s: the same grip comes 4 times later (1.2 s), "Có vật trong tầm" is on the whole time', () => {
    const r = hand({ crate: CRATE, gripper: { fingerSpeed: 0.25 } });
    r.hold('Space');
    let first = -1;
    let reachAlways = true;
    for (let n = 1; n <= 120; n++) {
      r.tick();
      reachAlways = reachAlways && r.out('g', 'inReach') === true;
      if (r.out('g', 'holding') === true) {
        first = n;
        break;
      }
    }
    expect(first).toBeGreaterThanOrEqual(72);
    expect(first).toBeLessThanOrEqual(75);
    expect(reachAlways).toBe(true);
  });

  it('until then the crate is a free body: opening again before the pads arrive lets it go untouched', () => {
    const r = hand({ crate: CRATE });
    const at = r.entity('c')!.position;
    r.hold('Space');
    r.tick(8);
    expect(r.out('g', 'holding')).toBe(false);
    r.hold();
    r.tick(60);
    expect(r.out('g', 'holding')).toBe(false);
    const c = r.entity('c')!;
    // It rests on the shelf where it was.
    expect(Math.hypot(c.position.x - at.x, c.position.y - at.y, c.position.z - at.z)).toBeLessThan(MM);
  });

  // The pad that arrives first meets the crate at the closing speed: a 2 kg crate on a shelf is shoved by the contact (X
  // at 1 m/s, 0.4 mm at 0.2 m/s: it goes with the square of the speed), so the grasp is taken where the crate ends up.
  for (const [speed, shove] of [[1, 0.005], [0.2, 0.001]] as const) {
    it(`an off-centre crate, ${speed} m/s: each pad stops on its own face (0.5 mm), the crate was shoved by less than ${shove * 1000} mm`, () => {
      const r = hand({ crate: { ...CRATE, z: 0.1 }, gripper: { fingerSpeed: speed } });
      const z0 = r.entity('c')!.position.z;
      const n = ticksUntil(r, () => r.out('g', 'holding') === true);
      expect(n).toBeGreaterThan(0);
      const c = r.entity('c')!;
      const [a, b] = pads(r);
      expect(Math.abs(c.position.z - z0)).toBeLessThan(shove);
      expect(Math.abs(a - 0.06 - (c.position.z + 0.2))).toBeLessThan(0.5 * MM);
      expect(Math.abs(b + 0.06 - (c.position.z - 0.2))).toBeLessThan(0.5 * MM);
    });
  }
});

describe('a finger that cannot go on reports it ("Ngón bị chặn", "Lực ngón đang ép")', () => {
  // Crate 0.4 x 0.3 x 0.4, 2 kg, mu 0.5, centre 0.25 off the middle and below the grasp point (not grippable): sliding needs 0.5 x 2 x 9.81 = 9.81 N.
  const SMALL = { x: 0.4, y: 0.3, z: 0.4 };
  function pushOff(forceN: number) {
    const r = hand({ crate: { y: 1.43, z: 0.25, size: SMALL }, gripper: { defaultForce: forceN } });
    expect(r.out('g', 'fingerStalled')).toBe(false);
    r.hold('Space');
    let stalled = 0;
    let maxN = 0;
    for (let i = 0; i < 90; i++) {
      r.tick();
      if (r.out('g', 'fingerStalled') === true) stalled++;
      maxN = Math.max(maxN, r.out('g', 'fingerForce') as number);
    }
    return { r, stalled, maxN };
  }

  it('8 N cannot push 9.81 N of friction: the finger stalls and reads its 8 N', () => {
    const { stalled, maxN, r } = pushOff(8);
    expect(stalled).toBeGreaterThan(30);
    expect(r.out('g', 'fingerStalled')).toBe(true);
    expect(Math.abs(maxN - 8)).toBeLessThan(0.1);
    expect(r.out('g', 'fingerForce')).toBeCloseTo(8, 1);
  });

  it('12 N pushes it: while it slides the finger reads the 9.81 N it takes, and nothing is stalled once the pads meet', () => {
    const { maxN, r } = pushOff(12);
    expect(Math.abs(maxN - 9.81)).toBeLessThan(0.3);
    // The crate is not grippable (the grasp point is outside it): it is pushed, never held.
    expect(r.out('g', 'holding')).toBe(false);
  });

  it('closed on nothing: not stalled, no force; held crate: not stalled, each pad presses with the grip force', () => {
    const r = hand();
    r.hold('Space');
    r.tick(60);
    expect(r.out('g', 'fingerStalled')).toBe(false);
    expect(r.out('g', 'fingerForce')).toBe(0);

    const h = hand({ crate: { y: 1.5, size: { x: 0.6, y: 0.6, z: 0.4 } } });
    h.hold('Space');
    h.tick(60);
    expect(h.out('g', 'holding')).toBe(true);
    expect(h.out('g', 'fingerStalled')).toBe(false);
    expect(h.out('g', 'fingerForce')).toBe(25);
  });

  it('the read-outs are optional: without "Hiện báo ngón bị chặn" the ports do not exist and the card is as before', () => {
    expect(gripperNode.optionalOutputs!.active({ showFingerOuts: 'no' })).toEqual([]);
    expect(gripperNode.optionalOutputs!.active({ showFingerOuts: 'yes' }).map((p) => p.id)).toEqual(['fingerStalled', 'fingerForce']);
    expect(gripperNode.params.find((p) => p.id === 'showFingerOuts')!.default).toBe('no');
  });
});
