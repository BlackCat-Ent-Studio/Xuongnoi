import { describe, expect, it } from 'vitest';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';

/**
 * A horizontal arm: pedestal, one shoulder joint, a 0.8 m link and a gripper, with a crate on a table where the
 * fingers are. `crate` and `grip` tune the numbers each test is about.
 */
function arm(opts: { massKg: number; mu?: number; crush?: number; torque?: number; force?: number; linkKg?: number; gripperKg?: number; link?: number; unpowered?: boolean; start?: number }) {
  const crateX = (opts.link ?? 0.8) + 0.3;
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 30, y: 1, z: 4 } }],
    ['ped', 'block', { position: { x: -0.5, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 1 } }],
    ['table', 'block', { position: { x: crateX + 0.3, y: 0.35, z: 0 }, size: { x: 1.2, y: 0.7, z: 1.5 } }],
    ['crate', 'item', { position: { x: crateX, y: 1.0, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, shape: 'crate', mass: opts.massKg, ...(opts.mu !== undefined ? { mu: opts.mu } : {}), ...(opts.crush ? { crushLimit: opts.crush } : {}) }],
    ['go', 'on-start'],
    ['k', 'key', { key: 'Space' }],
    ['up', 'const', { value: 0 }],
    ['f', 'const', { value: opts.force ?? 50 }],
    ['j', 'joint', { start: opts.start ?? 0, min: -90, max: 90, maxTorque: opts.torque ?? 30 }],
    ['l', 'link', { length: opts.link ?? 0.8, mass: opts.linkKg ?? 0 }],
    ['g', 'gripper', { mass: opts.gripperKg ?? 0, width: 0.8, reach: 0.5 }],
  ];
  const wires: WireSpec[] = [
    ['ped', 'self', 'j', 'base'],
    ...(opts.unpowered ? [] : ([['go', 'started', 'j', 'power']] as WireSpec[])),
    ['up', 'value', 'j', 'angle'],
    ['j', 'tip', 'l', 'base'],
    ['l', 'tip', 'g', 'base'],
    ['k', 'held', 'g', 'close'],
    ['f', 'value', 'g', 'force'],
  ];
  // The pedestal's top is at y = 1 and its centre at x = -0.5: the pivot sits on its top right edge, at the origin.
  const r = rig(nodes.map((n) => (n[0] === 'j' ? ([n[0], n[1], { ...n[2], mount: { x: 0.5, y: 0.5, z: 0 } }] as NodeSpec) : n)), wires);
  r.tick(30);
  r.hold('Space');
  return r;
}

describe('gripper numbers', () => {
  it('5 kg, mu 0.5: 40 N per finger slips once lifted, 50 N holds', () => {
    const weak = arm({ massKg: 5, force: 40 });
    weak.tick(10);
    expect(weak.out('g', 'holding')).toBe(true);
    weak.set('up', { value: 30 });
    let slipped = false;
    for (let i = 0; i < 120; i++) {
      weak.tick();
      if (weak.out('g', 'slipped') === true) slipped = true;
    }
    expect(slipped).toBe(true);
    expect(weak.out('g', 'holding')).toBe(false);
    expect(weak.entity('crate')!.position.y).toBeLessThan(1.1);

    const strong = arm({ massKg: 5, force: 50, torque: 200 });
    strong.tick(10);
    strong.set('up', { value: 30 });
    let slips = 0;
    for (let i = 0; i < 120; i++) {
      strong.tick();
      if (strong.out('g', 'slipped') === true) slips++;
    }
    expect(slips).toBe(0);
    expect(strong.out('g', 'holding')).toBe(true);
    expect(strong.entity('crate')!.position.y).toBeGreaterThan(1.3);
  });

  it('a fragile 60 N crate breaks when squeezed with 2 x 35 N but not with 2 x 25 N', () => {
    const hard = arm({ massKg: 2, crush: 60, force: 35 });
    let crushed = false;
    for (let i = 0; i < 60; i++) {
      hard.tick();
      if (hard.out('g', 'crushedOut') === true) crushed = true;
    }
    expect(crushed).toBe(true);
    expect(hard.entity('crate')!.damaged).toBe(true);
    const soft = arm({ massKg: 2, crush: 60, force: 25 });
    soft.tick(60);
    expect(soft.entity('crate')!.damaged).toBeUndefined();
    expect(soft.out('g', 'holding')).toBe(true);
  });
});

describe('joint torque', () => {
  /** Lifts toward 20 degrees for 3 s; reports whether "Quá tải" ever came on, the highest the crate got and the final angle. */
  function lift(massKg: number) {
    const r = arm({ massKg, torque: 30, link: 0.2, force: 80 });
    r.set('up', { value: 20 });
    let everOverloaded = false;
    let topY = 0;
    for (let i = 0; i < 180; i++) {
      r.tick();
      if (r.out('j', 'overloaded') === true) everOverloaded = true;
      topY = Math.max(topY, r.entity('crate')!.position.y);
    }
    return { everOverloaded, topY, angle: Number(r.out('j', 'angleNow')) };
  }

  it('30 N m at 0.5 m lifts a 6 kg crate (29.43 N m needed)', () => {
    const res = lift(6);
    expect(res.everOverloaded).toBe(false);
    expect(res.angle).toBeCloseTo(20, 0);
    expect(res.topY).toBeGreaterThan(1.1);
  });

  it('with 7 kg (34.3 N m needed) the joint cannot rise: Quá tải comes on and the crate stays on the table', () => {
    const res = lift(7);
    expect(res.everOverloaded).toBe(true);
    expect(res.topY).toBeLessThan(1.05);
  });

  it('a loaded joint sags toward the down position at a speed that grows with the excess, never snapping', () => {
    const r = arm({ massKg: 5, torque: 60, link: 0.2, force: 80, linkKg: 0 });
    r.set('up', { value: 20 });
    r.tick(120);
    expect(r.out('j', 'overloaded')).toBe(false);
    r.set('j', { maxTorque: 10 });
    const before = Number(r.out('j', 'angleNow'));
    r.tick(6);
    const after = Number(r.out('j', 'angleNow'));
    expect(r.out('j', 'overloaded')).toBe(true);
    expect(before - after).toBeGreaterThan(0);
    expect(before - after).toBeLessThan(10);
  });

  it('without a signal on Bật the servo holds nothing: the loaded arm falls, with no load it stays where it is', () => {
    const loaded = arm({ massKg: 1, link: 0.6, linkKg: 2, unpowered: true, start: 40 });
    loaded.tick(60);
    expect(Number(loaded.out('j', 'angleNow'))).toBeLessThan(40);
    const empty = arm({ massKg: 1, link: 0.6, linkKg: 0, gripperKg: 0, unpowered: true, start: 40 });
    empty.tick(60);
    expect(Number(empty.out('j', 'angleNow'))).toBe(40);
  });
});
