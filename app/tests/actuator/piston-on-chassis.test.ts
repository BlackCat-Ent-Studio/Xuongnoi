import { describe, expect, it } from 'vitest';
import { rig, type NodeSpec } from '../helpers/arm-rig';
import type { EntityView } from '../../src/engine/types';

/**
 * A piston bolted on a robot chassis (nose to +x, centre at x = 0, floor at y = 0). Barrel 1.2 m (stroke 1 + 0.2) and a
 * 0.6 m head: the head front sits 1.8 m ahead of the chassis centre while the rod is in. The two motors give
 * 2 x motorN newtons at full power; a crate of m kg with mu 0.5 needs  0.5 * m * 9.81 N  to be pushed.
 */
interface Opts {
  motorN?: number;
  crates?: { x: number; kg?: number; y?: number }[];
  wall?: number;
}

function chassisPiston(o: Opts = {}) {
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 60, y: 1, z: 6 } }],
    ['body', 'robot-body', { position: { x: 0, y: 0.15, z: 0 }, height: 0.3, pushObjects: 'yes' }],
    ['ml', 'motor', { side: -0.4, maxForce: o.motorN ?? 30 }],
    ['mr', 'motor', { side: 0.4, maxForce: o.motorN ?? 30 }],
    ['pw', 'const', { value: 1 }],
    ['p', 'linear-actuator', { stroke: 1, maxForce: 100, headSize: 0.6, mount: { x: 0, y: 0.2, z: 0 } }],
  ];
  (o.crates ?? []).forEach((c, n) =>
    nodes.push([`c${n}`, 'item', { shape: 'crate', position: { x: c.x, y: c.y ?? 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, mass: c.kg ?? 10 }]),
  );
  if (o.wall !== undefined) nodes.push(['wall', 'block', { position: { x: o.wall, y: 1, z: 0 }, size: { x: 0.4, y: 2, z: 4 } }]);
  const r = rig(
    nodes,
    [
      ['body', 'self', 'ml', 'body'],
      ['body', 'self', 'mr', 'body'],
      ['pw', 'value', 'ml', 'power'],
      ['pw', 'value', 'mr', 'power'],
      ['body', 'self', 'p', 'base'],
    ],
    '2d-side',
  );
  const head = (): EntityView => r.world.getEntity(String(r.out('p', 'tip')))!;
  return {
    ...r,
    head,
    headFront: (): number => head().position.x + head().size.x / 2,
    botX: (): number => r.entity('body')!.position.x,
    crateX: (n = 0): number => r.entity(`c${n}`)!.position.x,
    seconds: (s: number) => r.tick(Math.round(s * 60)),
  };
}

describe('a piston on a driving chassis', () => {
  it('free run: the head rides ahead of the chassis at the same distance', () => {
    const r = chassisPiston();
    r.seconds(1);
    expect(r.head().position.x - r.botX()).toBeCloseTo(1.5, 1);
  });

  it('does not tunnel into a wall: the head stops at the wall face and the chassis is held back with it', () => {
    const r = chassisPiston({ wall: 4 });
    r.seconds(6);
    // Wall face at 3.8: the head may touch it, never enter it.
    expect(r.headFront()).toBeLessThanOrEqual(3.8 + 1e-3);
    expect(r.headFront()).toBeGreaterThan(3.8 - 0.1);
    expect(r.head().position.x - r.botX()).toBeCloseTo(1.5, 1);
  });

  it('a 200 kg crate (981 N) is not shoved by motors giving 60 N, and the head stays out of it', () => {
    const r = chassisPiston({ crates: [{ x: 4, kg: 200 }], motorN: 30 });
    r.seconds(6);
    expect(r.crateX()).toBeCloseTo(4, 3);
    expect(r.headFront()).toBeLessThanOrEqual(3.7 + 1e-3);
    expect(r.out('p', 'overloaded')).toBe(true);
    expect(r.out('p', 'force')).toBeCloseTo(60, 3);
  });

  it('a 10 kg crate (49.05 N) is pushed ahead of the head by 60 N motors, never inside it', () => {
    const r = chassisPiston({ crates: [{ x: 4, kg: 10 }], motorN: 30 });
    let inside = false;
    for (let i = 0; i < 400; i++) {
      r.tick();
      const c = r.entity('c0')!;
      if (c.position.x - 0.3 < r.headFront() - 1e-3 && r.headFront() < c.position.x + 0.3) inside = true;
    }
    expect(inside).toBe(false);
    expect(r.crateX()).toBeGreaterThan(5.5);
    expect(r.out('p', 'overloaded')).toBe(false);
  });

  it('the same crate with only 40 N of motors is not shoved (49.05 N needed)', () => {
    const r = chassisPiston({ crates: [{ x: 4, kg: 10 }], motorN: 20 });
    r.seconds(6);
    expect(r.crateX()).toBeCloseTo(4, 3);
    expect(r.headFront()).toBeLessThanOrEqual(3.7 + 1e-3);
  });
});
