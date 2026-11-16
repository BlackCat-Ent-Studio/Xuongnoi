import { describe, expect, it } from 'vitest';
import { armRegistry } from '../../src/nodes/arm-parts';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import type { ViewMode } from '../../src/engine/types';

/**
 * A piston lying on the floor at x = 0 pushing +x: barrel 2.2 m (stroke 2 + 0.2), head 0.6 m, so the head front is at
 * x = 2.8 retracted and 4.8 fully out. The "E" key is the extend wire.
 */
interface Opts {
  maxForce?: number;
  crates?: { x: number; kg?: number; mu?: number; y?: number }[];
  wall?: number;
  mode?: ViewMode;
  wireExtend?: boolean;
  solid?: boolean;
}

function piston(o: Opts = {}) {
  const nodes: NodeSpec[] = [
    ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 6 } }],
    ['p', 'linear-actuator', { position: { x: 0, y: 0.3, z: 0 }, stroke: 2, maxForce: o.maxForce ?? 100, headSize: 0.6, speed: 1 }],
    ['e', 'key', { key: 'KeyE' }],
  ];
  (o.crates ?? [{ x: 4 }]).forEach((c, n) =>
    nodes.push([`c${n}`, 'item', { shape: 'crate', position: { x: c.x, y: c.y ?? 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, mass: c.kg ?? 10, ...(c.mu !== undefined ? { mu: c.mu } : {}) }]),
  );
  if (o.wall !== undefined) nodes.push(['wall', 'block', { position: { x: o.wall, y: 1, z: 0 }, size: { x: 0.4, y: 2, z: 4 } }]);
  const wires: WireSpec[] = o.wireExtend === false ? [] : [['e', 'held', 'p', 'extend']];
  const r = rig(nodes, wires, o.mode ?? '2d-side', o.solid ?? false);
  const crateX = (n = 0): number => r.entity(`c${n}`)!.position.x;
  return { ...r, crateX, seconds: (s: number) => r.tick(Math.round(s * 60)) };
}

describe('piston pushes with a force limit', () => {
  it('10 kg crate, mu 0.5: 40 N stalls it (Quá tải), 60 N pushes it', () => {
    const weak = piston({ maxForce: 40 });
    weak.tick(10);
    weak.hold('KeyE');
    weak.seconds(4);
    expect(weak.crateX()).toBeCloseTo(4, 3);
    expect(weak.out('p', 'overloaded')).toBe(true);
    expect(weak.out('p', 'force')).toBeCloseTo(40, 6);
    expect(weak.out('p', 'extended')).toBe(false);
    // The rod stopped where the head met the crate: head front 3.7 -> rod out 0.9 m.
    expect(weak.out('p', 'positionNow') as number).toBeGreaterThan(0.85);
    expect(weak.out('p', 'positionNow') as number).toBeLessThan(0.95);

    const strong = piston({ maxForce: 60 });
    strong.tick(10);
    strong.hold('KeyE');
    strong.seconds(4);
    expect(strong.crateX()).toBeGreaterThan(5);
    expect(strong.out('p', 'overloaded')).toBe(false);
    expect(strong.out('p', 'extended')).toBe(true);
  });

  it('reports 49.05 N while it is pushing the crate', () => {
    const r = piston({ maxForce: 60 });
    r.hold('KeyE');
    let peak = 0;
    for (let i = 0; i < 300; i++) {
      r.tick();
      peak = Math.max(peak, r.out('p', 'force') as number);
    }
    expect(peak).toBeCloseTo(49.05, 4);
  });

  it('two crates add up: 60 N stalls, 100 N pushes both', () => {
    const crates = [{ x: 4 }, { x: 4.6 }];
    const weak = piston({ maxForce: 60, crates });
    weak.hold('KeyE');
    weak.seconds(4);
    expect(weak.out('p', 'overloaded')).toBe(true);
    expect(weak.crateX(0)).toBeCloseTo(4, 3);
    expect(weak.crateX(1)).toBeCloseTo(4.6, 3);
    const strong = piston({ maxForce: 100, crates });
    strong.hold('KeyE');
    strong.seconds(4);
    expect(strong.out('p', 'overloaded')).toBe(false);
    expect(strong.crateX(0)).toBeGreaterThan(4.9);
    expect(strong.crateX(1)).toBeGreaterThan(5.5);
  });

  it('a heavier crate stalls until the maximum force is raised in the params', () => {
    const r = piston({ maxForce: 100, crates: [{ x: 4, kg: 30 }] });
    r.hold('KeyE');
    r.seconds(4);
    expect(r.out('p', 'overloaded')).toBe(true);
    expect(r.crateX()).toBeCloseTo(4, 3);
    r.set('p', { maxForce: 150 });
    r.seconds(4);
    expect(r.out('p', 'overloaded')).toBe(false);
    expect(r.crateX()).toBeGreaterThan(5);
  });

  it('a slippery crate (mu 0.1) goes with a small force', () => {
    const r = piston({ maxForce: 12, crates: [{ x: 4, mu: 0.1 }] });
    r.hold('KeyE');
    r.seconds(4);
    expect(r.out('p', 'overloaded')).toBe(false);
    expect(r.crateX()).toBeGreaterThan(5);
  });
});

describe('piston and solids', () => {
  it('stalls against a wall: the crate stops at the wall, never through it', () => {
    // Wall face at x = 5.0 (centre 5.2, 0.4 wide): the crate front can reach 5.0, so its centre stops at about 4.7.
    const r = piston({ wall: 5.2, maxForce: 500 });
    r.hold('KeyE');
    r.seconds(5);
    expect(r.crateX()).toBeGreaterThan(4.6);
    expect(r.crateX()).toBeLessThan(4.72);
    expect(r.out('p', 'extended')).toBe(false);
    expect(r.out('p', 'overloaded')).toBe(false);
    expect(r.out('p', 'force')).toBeCloseTo(500, 6);
    const head = r.entity('p')!;
    expect(head.position.x + head.size.x / 2).toBeLessThanOrEqual(5.02);
  });

  it('retracting leaves what was pushed where it is', () => {
    const r = piston({ maxForce: 100 });
    r.hold('KeyE');
    r.seconds(4);
    const pushedTo = r.crateX();
    expect(pushedTo).toBeGreaterThan(5);
    r.hold();
    r.seconds(4);
    expect(r.out('p', 'retracted')).toBe(true);
    expect(r.out('p', 'positionNow')).toBe(0);
    expect(r.crateX()).toBeCloseTo(pushedTo, 3);
  });

  it('without the extend wire it stays retracted and the crate never moves', () => {
    const r = piston({ wireExtend: false });
    r.hold('KeyE');
    r.seconds(4);
    expect(r.out('p', 'retracted')).toBe(true);
    expect(r.out('p', 'force')).toBe(0);
    expect(r.crateX()).toBeCloseTo(4, 3);
  });
});

describe('piston inputs and outputs', () => {
  it('"Vị trí đặt" (0..1 of the stroke) wins over "Đẩy ra"', () => {
    const half = rig(
      [
        ['p', 'linear-actuator', { position: { x: 0, y: 0.3, z: 0 }, stroke: 2 }],
        ['k', 'const', { value: 0.5 }],
        ['e', 'key', { key: 'KeyE' }],
      ],
      [
        ['k', 'value', 'p', 'position'],
        ['e', 'held', 'p', 'extend'],
      ],
    );
    half.hold('KeyE');
    half.tick(300);
    expect(half.out('p', 'positionNow')).toBeCloseTo(1, 6);
    expect(half.out('p', 'extended')).toBe(false);
    expect(half.out('p', 'retracted')).toBe(false);
  });

  it('the tip frame sits on the front face of the head and moves with the rod (a piece can be mounted there)', () => {
    const r = piston({ crates: [{ x: 30 }] });
    const tipId = r.out('p', 'tip');
    r.tick(2);
    const id = r.out('p', 'tip') as string;
    expect(typeof id).toBe('string');
    expect(tipId === null || typeof tipId === 'string').toBe(true);
    const reg = armRegistry(r.world);
    expect(reg.frames.get(id)!.pos.x).toBeCloseTo(2.2 + 0.6, 6);
    r.hold('KeyE');
    r.seconds(1);
    const len = r.out('p', 'positionNow') as number;
    expect(len).toBeCloseTo(1, 1);
    expect(reg.frames.get(id)!.pos.x).toBeCloseTo(2.8 + len, 6);
  });

  it('a gripper mounted on the tip rides with the rod and sees a crate come into reach', () => {
    const r = rig(
      [
        ['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 6 } }],
        ['p', 'linear-actuator', { position: { x: 0, y: 0.3, z: 0 }, stroke: 2, maxForce: 100 }],
        ['g', 'gripper', { reach: 0.5, width: 1 }],
        ['c', 'item', { shape: 'crate', position: { x: 5.5, y: 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, mass: 1 }],
        ['e', 'key', { key: 'KeyE' }],
      ],
      [
        ['p', 'tip', 'g', 'base'],
        ['e', 'held', 'p', 'extend'],
      ],
    );
    r.tick(5);
    expect(r.out('g', 'inReach')).toBe(false);
    r.hold('KeyE');
    r.tick(300);
    // Grasp point = tip + 0.3 along the arm: 4.8 + 0.3 = 5.1; the crate centre 5.5 is 0.4 away.
    expect(r.out('g', 'inReach')).toBe(true);
    expect(r.out('g', 'candidate')).toBe(r.entity('c')!.id);
  });
});

describe('piston in every view', () => {
  for (const mode of ['2d-top', '3d'] as const) {
    it(`${mode}: pushes a crate along the ground plane and stalls when overloaded`, () => {
      // The top view has no ground to stand on: any solid block is a wall there, so only the 3D board gets a floor.
      const nodes: NodeSpec[] = [
        ...(mode === '3d' ? ([['floor', 'block', { position: { x: 0, y: -0.5, z: 0 }, size: { x: 40, y: 1, z: 20 } }]] as NodeSpec[]) : []),
        ['p', 'linear-actuator', { position: { x: 0, y: 0.3, z: 0 }, stroke: 2, maxForce: 60, direction: 0 }],
        ['e', 'key', { key: 'KeyE' }],
        ['c', 'item', { shape: 'crate', position: { x: 4, y: 0.3, z: 0 }, size: { x: 0.6, y: 0.6, z: 0.6 }, mass: 10 }],
      ];
      const r = rig(nodes, [['e', 'held', 'p', 'extend']], mode);
      r.hold('KeyE');
      r.tick(240);
      expect(r.entity('c')!.position.x).toBeGreaterThan(5);
      expect(r.out('p', 'overloaded')).toBe(false);
      const heavy = rig(
        nodes.map((n) => (n[0] === 'c' ? ([n[0], n[1], { ...n[2], mass: 30 }] as NodeSpec) : n)),
        [['e', 'held', 'p', 'extend']],
        mode,
      );
      heavy.hold('KeyE');
      heavy.tick(240);
      expect(heavy.entity('c')!.position.x).toBeCloseTo(4, 3);
      expect(heavy.out('p', 'overloaded')).toBe(true);
    });
  }

  it('direction 90 degrees pushes along +z in the top view', () => {
    const r = rig(
      [
        ['p', 'linear-actuator', { position: { x: 0, y: 0.3, z: 0 }, stroke: 2, maxForce: 100, direction: 90 }],
        ['e', 'key', { key: 'KeyE' }],
        ['c', 'item', { shape: 'crate', position: { x: 0, y: 0.3, z: 4 }, size: { x: 0.6, y: 0.6, z: 0.6 }, mass: 10 }],
      ],
      [['e', 'held', 'p', 'extend']],
      '2d-top',
    );
    r.hold('KeyE');
    r.tick(300);
    expect(r.entity('c')!.position.z).toBeGreaterThan(5);
    expect(Math.abs(r.entity('c')!.position.x)).toBeLessThan(0.05);
  });
});
