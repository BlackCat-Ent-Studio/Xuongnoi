import { describe, expect, it } from 'vitest';
import { activeOutputs, getNodeDef } from '../../src/engine/registry';
import { rig, type NodeSpec } from '../helpers/arm-rig';
import type { ViewMode } from '../../src/engine/types';

/**
 * A two-motor robot (1 m long, nose to +x, centre at x = 0) drives into crates lying on a floor. A 10 kg crate with
 * friction 0.5 needs 10 * 9.81 * 0.5 = 49.05 N; the motors give  maxForce * |power|  each.
 */
interface Opts {
  motorN?: number;
  power?: number;
  crates?: { x: number; z?: number; kg?: number; mu?: number; y?: number }[];
  heading?: number;
  wall?: number;
  mode?: ViewMode;
  pushObjects?: 'yes' | 'no';
  extra?: NodeSpec[];
}

function robot(o: Opts = {}) {
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 60 } }],
    ['body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, heading: o.heading ?? 0, height: 0.3, showPush: 'yes', pushObjects: o.pushObjects ?? 'yes' }],
    ['ml', 'motor', { side: -0.4, maxForce: o.motorN ?? 30, showTurns: 'yes' }],
    ['mr', 'motor', { side: 0.4, maxForce: o.motorN ?? 30 }],
    ['p', 'const', { value: o.power ?? 1 }],
    ...(o.extra ?? []),
  ];
  (o.crates ?? [{ x: 3 }]).forEach((c, n) =>
    nodes.push([`c${n}`, 'item', { shape: 'crate', position: { x: c.x, y: c.y ?? 0.3, z: c.z ?? 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, mass: c.kg ?? 10, ...(c.mu !== undefined ? { mu: c.mu } : {}) }]),
  );
  if (o.wall !== undefined) nodes.push(['wall', 'block', { position: { x: o.wall, y: 1, z: 0 }, size: { x: 0.4, y: 2, z: 6 } }]);
  const r = rig(
    nodes,
    [
      ['body', 'self', 'ml', 'body'],
      ['body', 'self', 'mr', 'body'],
      ['p', 'value', 'ml', 'power'],
      ['p', 'value', 'mr', 'power'],
    ],
    o.mode ?? '2d-side',
  );
  return {
    ...r,
    crateX: (n = 0): number => r.entity(`c${n}`)!.position.x,
    botX: (): number => r.entity('body')!.position.x,
    seconds: (s: number) => r.tick(Math.round(s * 60)),
  };
}

describe('robot shoves loose items with the push model of the piston', () => {
  it('10 kg crate, mu 0.5: motors giving 40 N stall against it, 60 N push it', () => {
    const weak = robot({ motorN: 20 });
    weak.seconds(5);
    expect(weak.crateX()).toBeCloseTo(3, 2);
    expect(weak.out('body', 'pushing')).toBe(true);
    expect(weak.out('body', 'pushForce')).toBeCloseTo(40, 6);
    // Stopped at the crate: nose (centre + 0.5) at the crate face (3 - 0.3), within one tick of travel.
    expect(weak.botX()).toBeGreaterThan(2.2 - 0.05);
    expect(weak.botX()).toBeLessThan(2.2 + 0.05);
    // The wheels keep counting turns while the robot is held back.
    expect(weak.out('ml', 'turns') as number).toBeGreaterThan(5);

    const strong = robot({ motorN: 30 });
    strong.seconds(1.8);
    expect(strong.out('body', 'pushing')).toBe(true);
    expect(strong.out('body', 'pushForce')).toBeCloseTo(49.05, 6);
    strong.seconds(4);
    expect(strong.crateX()).toBeGreaterThan(6);
    expect(strong.botX()).toBeGreaterThan(5);
  });

  it('the push force scales with |power|: half power gives half the force', () => {
    const half = robot({ motorN: 30, power: 0.5 });
    half.seconds(5);
    expect(half.crateX()).toBeCloseTo(3, 2);
    expect(half.out('body', 'pushForce')).toBeCloseTo(30, 6);
    const full = robot({ motorN: 30, power: 1 });
    full.seconds(5);
    expect(full.crateX()).toBeGreaterThan(3.5);
  });

  it('two crates add up: 98.1 N needed, 90 N stalls and 100 N pushes both', () => {
    const crates = [{ x: 3 }, { x: 3.6 }];
    const weak = robot({ motorN: 45, crates });
    weak.seconds(5);
    expect(weak.crateX(0)).toBeCloseTo(3, 2);
    expect(weak.crateX(1)).toBeCloseTo(3.6, 2);
    const strong = robot({ motorN: 50, crates });
    strong.seconds(1.8);
    expect(strong.out('body', 'pushForce')).toBeCloseTo(98.1, 6);
    strong.seconds(3);
    expect(strong.crateX(0)).toBeGreaterThan(5);
    expect(strong.crateX(1)).toBeGreaterThan(5.6);
    expect(strong.crateX(1) - strong.crateX(0)).toBeGreaterThan(0.599);
  });

  it('a wall stops the pushed crate and the robot behind it; nothing tunnels through', () => {
    const r = robot({ motorN: 30, wall: 6 });
    r.seconds(8);
    // Wall face at 5.8; the crate (0.6 wide) stops flush at 5.5, the robot nose behind it.
    expect(r.crateX()).toBeLessThanOrEqual(5.5 + 1e-6);
    expect(r.crateX()).toBeGreaterThan(5.4);
    expect(r.botX() + 0.5).toBeLessThan(r.crateX() - 0.3 + 0.05);
    expect(r.botX()).toBeGreaterThan(4.4);
    expect(r.out('body', 'pushing')).toBe(true);
  });

  it('a crate resting on top of the chassis is carried, never shoved', () => {
    const on = robot({ crates: [{ x: 0, kg: 1, y: 0.62 }], });
    const off = robot({ pushObjects: 'no', crates: [{ x: 0, kg: 1, y: 0.62 }] });
    on.seconds(1);
    off.seconds(1);
    expect(on.crateX()).toBeCloseTo(off.crateX(), 9);
    expect(on.entity('c0')!.position.y).toBeCloseTo(off.entity('c0')!.position.y, 9);
    expect(on.out('body', 'pushing')).toBe(false);
  });

  it('with "Đẩy được vật" off the robot drives through the crate like before', () => {
    const r = robot({ pushObjects: 'no' });
    r.seconds(4);
    expect(r.crateX()).toBeCloseTo(3, 6);
    expect(r.botX()).toBeGreaterThan(4);
    expect(r.out('body', 'pushing')).toBe(false);
  });

  it('a slippery crate (mu 0.1) needs only 9.81 N', () => {
    const r = robot({ motorN: 6, crates: [{ x: 3, mu: 0.1 }] });
    r.seconds(5);
    expect(r.crateX()).toBeGreaterThan(5);
  });

  it('works in the top-down view too (stall and push)', () => {
    const weak = robot({ motorN: 20, mode: '2d-top' });
    weak.seconds(5);
    expect(weak.crateX()).toBeCloseTo(3, 2);
    const strong = robot({ motorN: 30, mode: '2d-top' });
    strong.seconds(6);
    expect(strong.crateX()).toBeGreaterThan(5);
  });

  it('works in 3D along a rotated heading (nose to +z)', () => {
    const r = robot({ motorN: 30, mode: '3d', heading: 90, crates: [{ x: 0, z: 3 }] });
    r.seconds(6);
    const c = r.entity('c0')!.position;
    expect(c.z).toBeGreaterThan(5);
    expect(Math.abs(c.x)).toBeLessThan(0.05);
    const weak = robot({ motorN: 20, mode: '3d', heading: 90, crates: [{ x: 0, z: 3 }] });
    weak.seconds(5);
    expect(weak.entity('c0')!.position.z).toBeCloseTo(3, 2);
  });

  it('adds no ports to the chassis card unless the push switch is on', () => {
    const def = getNodeDef('robot-body')!;
    expect(activeOutputs(def, {}).map((p) => p.id)).toEqual(['self', 'speed', 'heading', 'turnRate']);
    expect(activeOutputs(def, { showPush: 'yes' }).map((p) => p.id)).toEqual(['self', 'speed', 'heading', 'turnRate', 'pushing', 'pushForce']);
  });
});
