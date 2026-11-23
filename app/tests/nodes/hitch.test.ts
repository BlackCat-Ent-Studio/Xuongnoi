import { beforeAll, describe, expect, it } from 'vitest';
import { TICK_DT, type EntityId, type EntityView, type Vec3 } from '../../src/engine/types';
import { HITCH_DEFAULT_REACH, HITCH_PULL_SPEED } from '../../src/nodes/hitch';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import type { NodeSpec, WireSpec } from '../helpers/arm-rig';
import { cageTear } from '../perf/cage-rig';
import { hitchRig, turnedDeg, type HitchRig } from '../world/hitch-rig';
import { measuredCage } from './container-rig';

/**
 * "Chốt gài" played on a real board: a two-motor chassis under "Đi tới điểm", a "Lồng chứa", the hitch between them.
 * Every reading is an output of a card or an entity view.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const MM = 0.001;
/** A route of 4 + 3 + 3 = 10 m with two quarter turns. */
const ROUTE: [number, number][] = [
  [4, 0],
  [4, 3],
  [1, 3],
];

const flat = (a: Vec3, b: Vec3): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Drives under the cage at the origin, switches the hitch on and waits until the cage has been drawn into its place. */
function takeCage(r: HitchRig): void {
  r.send(0, 0);
  expect(r.drive(20)).toBe(true);
  r.latch(true);
  r.play(1);
  expect(r.holding()).toBe(true);
}

describe.each([
  ['"Vật lý thật" on', true],
  ['the switch off', false],
] as const)('a tug takes a cage, carries it 10 m round two corners and sets it down (%s)', (_name, real) => {
  const make = (): HitchRig => hitchRig(real ? { rapier } : {});

  it('"Khi gài" comes on for one tick, "Đang gài" stays on, "Vật đang gài" is the floor plate of the cage', () => {
    const r = make();
    r.send(0, 0);
    r.drive(20);
    expect(r.holding()).toBe(false);
    expect(r.out('hitch', 'thing')).toBeNull();
    r.latch(true);
    const took: boolean[] = [];
    for (let t = 0; t < 30; t++) {
      r.tick();
      took.push(r.out('hitch', 'took') === true);
    }
    expect(took.filter(Boolean)).toHaveLength(1);
    expect(took[0]).toBe(true);
    expect(r.holding()).toBe(true);
    expect(r.out('hitch', 'thing')).toBe(r.cage().id);
  });

  it('the cage is drawn gently to the middle of the tug, never thrown there', () => {
    const r = make();
    r.send(0, 0);
    r.drive(20);
    const before = flat(r.tug().position, r.cage().position);
    // "Đi tới điểm" stops within its tolerance: the tug is a little off the middle of the cage.
    expect(before).toBeGreaterThan(5 * MM);
    r.latch(true);
    let last = r.cage().position;
    let fastest = 0;
    r.play(1, () => {
      const now = r.cage().position;
      fastest = Math.max(fastest, flat(now, last) / TICK_DT);
      last = now;
    });
    expect(fastest).toBeGreaterThan(0);
    expect(fastest).toBeLessThanOrEqual(HITCH_PULL_SPEED + 1e-9);
    expect(flat(r.tug().position, r.cage().position)).toBeLessThan(1e-9);
    // It stayed at the height it stood at.
    expect(r.cage().position.y).toBeCloseTo(0.375, 9);
  });

  it('on every tick of the way the cage is within 1 mm of its place over the tug and has not turned', () => {
    const r = make();
    takeCage(r);
    const cage = measuredCage(r.world, r.cage().id);
    const sizes = r.cageBlocks().map((id) => ({ ...r.world.getEntity(id)!.size }));
    let worst = 0;
    let tear = 0;
    let turned = 0;
    let travelled = 0;
    let last = r.tug().position;
    const headingAtStart = r.tug().robot!.heading;
    const each = (): void => {
      const t = r.tug();
      worst = Math.max(worst, flat(t.position, r.cage().position), Math.abs(r.cage().position.y - 0.375));
      tear = Math.max(tear, cageTear(r.world, cage));
      r.cageBlocks().forEach((id, k) => {
        const v = r.world.getEntity(id)!;
        // A block that turned would have swapped width and depth, or would be drawn at an angle.
        expect(v.size).toEqual(sizes[k]);
        expect(v.angle).toBeUndefined();
      });
      turned = Math.max(turned, turnedDeg(t.robot!.heading, headingAtStart));
      travelled += flat(t.position, last);
      last = t.position;
    };
    for (const [x, z] of ROUTE) {
      r.send(x, z);
      expect(r.drive(30, each)).toBe(true);
    }
    expect(travelled).toBeGreaterThan(9.8);
    // The tug did turn under it (two quarter turns, the second one further round from where it started).
    expect(turned).toBeGreaterThan(170);
    expect(worst).toBeLessThan(1 * MM);
    expect(tear).toBeLessThan(1e-9);
    expect(flat(r.cage().position, { x: 1, y: 0, z: 3 })).toBeLessThan(0.15);
  });

  it('"Gài" off: "Khi nhả" for one tick, the cage stays where it is and the tug drives away alone', () => {
    const r = make();
    takeCage(r);
    r.send(4, 0);
    r.drive(30);
    r.latch(false);
    const released: boolean[] = [];
    for (let t = 0; t < 30; t++) {
      r.tick();
      released.push(r.out('hitch', 'released') === true);
    }
    expect(released.filter(Boolean)).toHaveLength(1);
    expect(released[0]).toBe(true);
    expect(r.holding()).toBe(false);
    expect(r.out('hitch', 'thing')).toBeNull();
    const set = r.cageBlocks().map((id) => ({ ...r.world.getEntity(id)!.position }));
    r.send(4, 4);
    expect(r.drive(30)).toBe(true);
    expect(r.cageBlocks().map((id) => r.world.getEntity(id)!.position)).toEqual(set);
    expect(flat(r.tug().position, r.cage().position)).toBeGreaterThan(3.8);
  });

  it('a cage out of reach is not taken; it is taken the tick it comes into reach while "Gài" stays on', () => {
    const r = make();
    r.latch(true);
    r.play(0.5);
    expect(r.holding()).toBe(false);
    r.send(0, 0);
    let far = Infinity;
    r.drive(20, () => {
      if (far === Infinity && r.holding()) far = flat(r.tug().position, r.cage().position);
    });
    expect(r.holding()).toBe(true);
    // Taken on the way in, about one tick of travel inside the reach.
    expect(far).toBeLessThanOrEqual(HITCH_DEFAULT_REACH);
    expect(far).toBeGreaterThan(HITCH_DEFAULT_REACH - 0.05);
  });

  it('the payload of the tug: the empty cage (20 kg) with "Vật lý thật", nothing with the switch off', () => {
    const r = make();
    takeCage(r);
    expect(r.payload()).toBe(real ? 20 : 0);
    r.latch(false);
    r.play(0.2);
    expect(r.payload()).toBe(0);
  });
});

describe('what a hitch may take', () => {
  /** A second chassis right beside the first, with its own hitch and its own switch. */
  const second = (carrier: 'tug' | 'other'): { nodes: NodeSpec[]; wires: WireSpec[] } => ({
    nodes: [
      ['other', 'robot-body', { position: { x: 0, y: 0.12, z: 1.2 }, length: 0.9, width: 0.7, height: 0.24 }],
      ['switch2', 'const', { value: 0 }],
      ['on2', 'compare', { op: 'gt' }],
      ['hitch2', 'hitch', { reach: 2 }],
    ],
    wires: [
      ['switch2', 'value', 'on2', 'a'],
      ['half', 'value', 'on2', 'b'],
      ['on2', 'out', 'hitch2', 'on'],
      [carrier, 'self', 'hitch2', 'carrier'],
    ],
  });

  it.each(['tug', 'other'] as const)('a cage held by one hitch cannot be taken by another (second hitch on the %s); it can once the first lets go', (carrier) => {
    const r = hitchRig({ rapier, ...second(carrier) });
    takeCage(r);
    r.set('switch2', { value: 1 });
    r.play(1);
    expect(r.out('hitch2', 'holding')).toBe(false);
    expect(r.out('hitch2', 'thing')).toBeNull();
    expect(r.holding()).toBe(true);
    r.latch(false);
    r.play(0.1);
    expect(r.holding()).toBe(false);
    expect(r.out('hitch2', 'holding')).toBe(true);
    expect(r.out('hitch2', 'thing')).toBe(r.cage().id);
    // And now the first cannot have it back.
    r.latch(true);
    r.play(0.5);
    expect(r.holding()).toBe(false);
  });

  it('a cage one level up is out of reach however near it is on the plan', () => {
    const r = hitchRig({
      rapier,
      cage: { position: { x: 0, y: 2.6, z: 0 } },
      nodes: [['deck', 'block', { position: { x: 0, y: 2.5, z: 0 }, size: { x: 4, y: 0.2, z: 4 } }]],
    });
    r.send(0, 0);
    r.drive(20);
    r.latch(true);
    r.play(1);
    expect(r.holding()).toBe(false);
  });

  const CRATE: NodeSpec = ['crate', 'item', { shape: 'crate', position: { x: 0.9, y: 0.15, z: 0 }, size: { x: 0.3, y: 0.3, z: 0.3 }, mass: 3 }];
  /** The cage stands out of the way; the tug stops short of the crate and takes it onto its back. */
  const crateRig = (real: boolean, what: string): HitchRig =>
    hitchRig({ ...(real ? { rapier } : {}), cage: { position: { x: 0, y: 0, z: 5 } }, tug: { x: -3, z: 0 }, nodes: [CRATE], hitch: { what, reach: 1.2, offset: { x: 0, y: 0.3, z: 0 } } });

  it.each([
    ['"Vật lý thật" on', true],
    ['the switch off', false],
  ] as const)('"Đồ vật rời": a loose crate is lifted onto the back, carried without turning, and lies still 0.5 s after it is let go (%s)', (_n, real) => {
    const r = crateRig(real, 'item');
    const crate = (): EntityView => r.entity('crate')!;
    r.play(1);
    r.send(0, 0);
    r.drive(20);
    r.latch(true);
    // 0.9 m along and 0.3 m up at no more than 0.5 m/s.
    r.play(3);
    expect(r.out('hitch', 'thing')).toBe(crate().id);
    expect(flat(crate().position, r.tug().position)).toBeLessThan(1e-9);
    // Lifted 0.3 m from where it lay: clear of the top of the chassis (0.24 m).
    expect(crate().position.y - 0.15).toBeGreaterThan(0.24);
    expect(r.payload()).toBe(real ? 3 : 0);
    const turn = crate().rotation;
    let worst = 0;
    r.send(3, 0);
    r.drive(20, () => {
      worst = Math.max(worst, flat(crate().position, r.tug().position));
      expect(crate().rotation).toEqual(turn);
    });
    r.send(3, 3);
    r.drive(20, () => {
      worst = Math.max(worst, flat(crate().position, r.tug().position));
      expect(crate().rotation).toEqual(turn);
    });
    expect(worst).toBeLessThan(1 * MM);
    r.latch(false);
    r.play(0.5);
    const at = { ...crate().position };
    r.play(0.5);
    expect(Math.hypot(crate().position.x - at.x, crate().position.y - at.y, crate().position.z - at.z)).toBeLessThan(1 * MM);
    // It came down onto the top of the chassis and rides there as any crate does.
    expect(crate().position.y - 0.15).toBeGreaterThan(0.23);
    expect(crate().position.y - 0.15).toBeLessThan(0.26);
  });

  it('"Lồng chứa" leaves a loose crate alone, "Đồ vật rời" leaves the cage alone, "Cả hai" takes the nearer of the two', () => {
    const cages = crateRig(true, 'container');
    cages.send(0, 0);
    cages.drive(20);
    cages.latch(true);
    cages.play(1);
    expect(cages.holding()).toBe(false);

    const items = hitchRig({ rapier, hitch: { what: 'item' } });
    items.send(0, 0);
    items.drive(20);
    items.latch(true);
    items.play(1);
    expect(items.holding()).toBe(false);

    const both = hitchRig({ rapier, nodes: [['crate', 'item', { shape: 'crate', position: { x: -1.6, y: 0.15, z: 0.9 }, size: { x: 0.3, y: 0.3, z: 0.3 } }]], hitch: { what: 'both', reach: 2 } });
    both.send(0, 0);
    both.drive(20);
    both.latch(true);
    both.play(1);
    expect(both.out('hitch', 'thing')).toBe(both.cage().id);
  });

  it('with "Cả hai", cartons lying in the cage are not loose things: the cage is what is taken', () => {
    const r = hitchRig({ rapier, drops: [{ x: 0, z: 0, count: 2 }], hitch: { what: 'both' } });
    r.play(4);
    expect(r.cartons()).toHaveLength(2);
    takeCage(r);
    expect(r.out('hitch', 'thing')).toBe(r.cage().id);
  });

  it.each([
    ['"Vật lý thật" on', true],
    ['the switch off', false],
  ] as const)('"Nặng nhất gài được": a cage with its load above the limit is not taken, at the limit it is (%s)', (_n, real) => {
    const make = (maxMass: number): HitchRig => hitchRig({ ...(real ? { rapier } : {}), drops: [{ x: -0.2, z: 0, count: 1 }, { x: 0.2, z: 0, count: 1 }], hitch: { maxMass } });
    // The cage weighs 20 kg, each carton 1 kg.
    const weak = make(21.5);
    weak.play(4);
    weak.send(0, 0);
    weak.drive(20);
    weak.latch(true);
    weak.play(1);
    expect(weak.holding()).toBe(false);
    expect(weak.cage().position.x).toBe(0);

    const strong = make(22);
    strong.play(4);
    takeCage(strong);
  });

  it('a hidden tug lets go by itself: "Khi nhả" comes on and the cage stays', () => {
    const r = hitchRig({ rapier });
    takeCage(r);
    const tug = r.tug().id as EntityId;
    r.world.hide(tug);
    r.tick();
    expect(r.out('hitch', 'released')).toBe(true);
    expect(r.holding()).toBe(false);
    r.tick();
    expect(r.out('hitch', 'released')).toBe(false);
  });
});

describe('"Vị trí vật so với xe"', () => {
  it('a cage held 1.2 m ahead of the tug swings round with the nose and still never turns itself', () => {
    const r = hitchRig({ rapier, tug: { x: -3, z: 0 }, hitch: { reach: 2, offset: { x: 1.2, y: 0.1, z: 0 } } });
    r.send(-1.2, 0);
    r.drive(20);
    r.latch(true);
    r.play(2);
    const ahead = (): Vec3 => {
      const t = r.tug();
      return { x: t.position.x + Math.cos(t.robot!.heading) * 1.2, y: 0, z: t.position.z + Math.sin(t.robot!.heading) * 1.2 };
    };
    expect(flat(r.cage().position, ahead())).toBeLessThan(1e-9);
    // Lifted 0.1 m from where it stood.
    expect(r.cage().position.y).toBeCloseTo(0.475, 9);
    const sizes = r.cageBlocks().map((id) => ({ ...r.world.getEntity(id)!.size }));
    let worst = 0;
    r.send(-1.2, 4);
    r.drive(30, () => {
      worst = Math.max(worst, flat(r.cage().position, ahead()));
    });
    expect(worst).toBeLessThan(1 * MM);
    expect(turnedDeg(r.tug().robot!.heading, Math.PI / 2)).toBeLessThan(10);
    expect(r.cageBlocks().map((id) => r.world.getEntity(id)!.size)).toEqual(sizes);
  });
});

describe('a hitch in the side view', () => {
  it('takes the cut-through cage and carries it along x', () => {
    const r = hitchRig({ mode: '2d-side' });
    r.send(0, 0);
    r.drive(20);
    r.latch(true);
    r.play(1);
    expect(r.holding()).toBe(true);
    r.send(4, 0);
    let worst = 0;
    r.drive(30, () => {
      worst = Math.max(worst, Math.abs(r.cage().position.x - r.tug().position.x));
    });
    expect(worst).toBeLessThan(1 * MM);
    expect(r.cage().position.x).toBeGreaterThan(3.8);
    expect(r.cageBlocks()).toHaveLength(3);
  });
});
