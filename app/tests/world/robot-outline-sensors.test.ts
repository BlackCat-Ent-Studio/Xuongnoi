import { beforeAll, describe, expect, it } from 'vitest';
import type { EntityView } from '../../src/engine/types';
import { planPush, type PushBody } from '../../src/world/linear-actuator';
import { chassisOutlineOfView, obbBounds } from '../../src/world/oriented-box';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { overlapDepth } from '../helpers/chassis-metrics';
import { FLOOR } from '../helpers/nav-rig';
import { bot, deckRig, join, seconds } from './deck-rig';

/**
 * With "Vật lý thật" on, what senses or pushes a chassis reads its real outline (length by width, turned to its heading), not
 * the upright square as wide as the chassis is long. Expected numbers are worked out here from the sizes on the cards.
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const RAD = Math.PI / 180;
const NARROW = { length: 1.2, width: 0.4, height: 0.24 };

/** The corners of a chassis on the ground, from its view. */
function corners(v: EntityView): { x: number; z: number }[] {
  const r = v.robot!;
  const f = { x: Math.cos(r.heading), z: Math.sin(r.heading) };
  const out: { x: number; z: number }[] = [];
  for (const a of [-1, 1]) for (const b of [-1, 1]) out.push({ x: v.position.x + (a * f.x * r.length) / 2 - (b * f.z * r.width) / 2, z: v.position.z + (a * f.z * r.length) / 2 + (b * f.x * r.width) / 2 });
  return out;
}

function play(nodes: NodeSpec[], wires: WireSpec[], real = true) {
  return real ? deckRig(nodes, wires, rapier) : rig([FLOOR, ...nodes], wires, '3d');
}

describe('"Dò phía trước" reads the turned outline', () => {
  it('measures to the corner of a chassis that stands at 45 degrees ahead, not to the square round it', () => {
    const a = bot({ id: 'a', x: 0, z: 0, floor: 0 });
    const b = bot({ id: 'b', x: 3, z: 0, floor: 0, heading: 45 });
    const parts = join(a, b);
    const r = play([...parts.nodes, ['eye', 'ahead-sensor', { reach: 5, beam: 0.3 }]], [...parts.wires, ['a', 'self', 'eye', 'who']]);
    r.tick(30);
    // Nearest corner of "b" (within the 0.3 m beam), less the nose of "a" (half its length ahead of its middle).
    const near = Math.min(...corners(r.entity('b')!).filter((c) => Math.abs(c.z) < 0.15).map((c) => c.x));
    expect(near).toBeCloseTo(3 - (0.45 + 0.35) * Math.SQRT1_2, 3);
    expect(r.out('eye', 'distance') as number).toBeCloseTo(near - 0.45, 3);
    expect(r.out('eye', 'thing')).toBe(r.entity('b')!.id);
    r.world.dispose?.();
  });

  it('measures from its own nose when it stands at 45 degrees, not from the corner of its square', () => {
    const a = bot({ id: 'a', x: 0, z: 0, floor: 0, heading: 45 });
    const wall: NodeSpec = ['wall', 'block', { position: { x: 3.5, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 40 } }];
    const r = play([wall, ...a.nodes, ['eye', 'ahead-sensor', { reach: 10, beam: 0.02 }]], [...a.wires, ['a', 'self', 'eye', 'who']]);
    r.tick(30);
    // Along the beam the wall face (x = 3) is 3 / cos 45 away from the middle; the nose is half the length (0.45 m) out.
    expect(r.out('eye', 'distance') as number).toBeCloseTo(3 / Math.SQRT1_2 - 0.45, 1);
    expect(Math.abs((r.out('eye', 'distance') as number) - (3 / Math.SQRT1_2 - 0.45))).toBeLessThan(0.02);
    r.world.dispose?.();
  });

  it('with the switch off both still read the square', () => {
    const a = bot({ id: 'a', x: 0, z: 0, floor: 0 });
    const b = bot({ id: 'b', x: 3, z: 0, floor: 0, heading: 45 });
    const parts = join(a, b);
    const r = play([...parts.nodes, ['eye', 'ahead-sensor', { reach: 5, beam: 0.3 }]], [...parts.wires, ['a', 'self', 'eye', 'who']], false);
    r.tick(30);
    expect(r.out('eye', 'distance') as number).toBeCloseTo(3 - 0.45 - 0.45, 6);
  });
});

describe('zones, "Va chạm" and contacts read the turned outline', () => {
  /** A narrow chassis at the origin, and a strip beside it (z 0.3 .. 0.6): inside its 1.2 m square, clear of its 0.4 m width. */
  function beside(heading: number, real = true) {
    const a = bot({ id: 'a', x: 0, z: 0, floor: 0, heading, chassis: NARROW });
    const nodes: NodeSpec[] = [
      ...a.nodes,
      ['zone', 'zone', { center: { x: 0, y: 0.2, z: 0.45 }, size: { x: 0.3, y: 1, z: 0.3 }, filter: 'robot' }],
      ['around', 'zone', { center: { x: 0, y: 0.2, z: 0 }, size: { x: 1.3, y: 1, z: 0.5 }, filter: 'robot', rule: 'inside' }],
      ['pad', 'block', { position: { x: 0, y: 0.1, z: 0.45 }, size: { x: 0.3, y: 0.2, z: 0.3 }, type: 'pickup' }],
      ['touch', 'touch', {}],
      ['near', 'touch', { grow: 0.05 }],
    ];
    const wires: WireSpec[] = [...a.wires, ['a', 'self', 'touch', 'a'], ['pad', 'self', 'touch', 'b'], ['a', 'self', 'near', 'a'], ['pad', 'self', 'near', 'b']];
    const r = play(nodes, wires, real);
    r.tick(30);
    const out = { zone: r.out('zone', 'count'), around: r.out('around', 'inside'), touch: r.out('touch', 'touching'), near: r.out('near', 'touching') };
    r.world.dispose?.();
    return out;
  }

  it('a strip beside a narrow chassis that points along x: nothing reads the chassis there', () => {
    expect(beside(0)).toEqual({ zone: 0, around: true, touch: false, near: false });
  });

  it('the same strip once the chassis points along z: its nose is in it', () => {
    expect(beside(90)).toEqual({ zone: 1, around: false, touch: true, near: true });
  });

  it('at 30 degrees the nose corner reaches the strip (0.6 sin 30 + 0.2 cos 30 = 0.47 m to the side)', () => {
    expect(beside(30)).toEqual({ zone: 1, around: false, touch: true, near: true });
  });

  it('with the switch off they read the square, at any heading', () => {
    expect(beside(0, false)).toEqual({ zone: 1, around: false, touch: true, near: true });
  });
});

describe('pistons and arm pieces meet the turned outline', () => {
  it('a push plan built from the view of a chassis at 45 degrees touches its corner, not its square', () => {
    const b = bot({ id: 'b', x: 0, z: 0, floor: 0, heading: 45 });
    const r = play(b.nodes, b.wires);
    r.tick(30);
    const view = r.entity('b')!;
    const outline = chassisOutlineOfView(view);
    expect(outline).not.toBeNull();
    const body: PushBody = { id: view.id, box: obbBounds(outline!), outline: outline!, massKg: 5, mu: 0.8 };
    // A 0.2 m head coming along +x on the line of the corner that points back along x.
    const corner = corners(view).reduce((p, q) => (q.x < p.x ? q : p));
    const plan = planPush({ head: { pos: { x: -2, y: view.position.y, z: corner.z }, size: { x: 0.2, y: 0.2, z: 0.2 } }, dir: { x: 1, y: 0, z: 0 }, step: 2, bodies: [body], solids: [], probeContact: true });
    expect(plan.contactAt).not.toBeNull();
    expect(plan.contactAt!).toBeCloseTo(corner.x - 0.1 + 2, 3);
    expect(corner.x).toBeCloseTo(-(0.45 + 0.35) * Math.SQRT1_2, 3);
    r.world.dispose?.();
  });

  it('a view with the switch off, or of a chassis with a collision box of its own, gives no outline', () => {
    const b = bot({ id: 'b', x: 0, z: 0, floor: 0, heading: 45 });
    const off = play(b.nodes, b.wires, false);
    off.tick(5);
    expect(chassisOutlineOfView(off.entity('b')!)).toBeNull();
    const boxed = bot({ id: 'b', x: 0, z: 0, floor: 0, heading: 45, body: { colliderSize: { x: 0.5, y: 0.24, z: 0.5 } } });
    const on = play(boxed.nodes, boxed.wires);
    on.tick(5);
    expect(on.entity('b')!.collider).toBeDefined();
    expect(chassisOutlineOfView(on.entity('b')!)).toBeNull();
    on.world.dispose?.();
  });

  for (const heading of [30, 45, 60]) {
    it(`a chassis at ${heading} degrees driven into the head of a piston stops with its corner on the head`, { timeout: 60_000 }, () => {
      const a = bot({ id: 'a', x: 0, z: 0, floor: 0, heading, power: [0.5, 0.5] });
      const along = { x: Math.cos(heading * RAD), z: Math.sin(heading * RAD) };
      // The piston points back along x; its 0.4 m head stands 3 m ahead of the chassis, on its line.
      const piston: NodeSpec = ['machine', 'linear-actuator', { position: { x: along.x * 3 + 1.5, y: 0.2, z: along.z * 3 }, direction: 180, stroke: 1, headSize: 0.4 }];
      const r = play([...a.nodes, piston], a.wires);
      let deepest = -Infinity;
      let touched = false;
      for (let k = 0; k < seconds(8); k++) {
        r.tick();
        const e = r.entity('a')!;
        const head = r.world.entities().find((v) => v.ownerNodeId === 'machine' && v.size.x === 0.4 && v.size.y === 0.4)!;
        deepest = Math.max(deepest, overlapDepth(e, head));
        if (r.world.isTouching(e.id, head.id)) touched = true;
      }
      r.world.dispose?.();
      expect(touched).toBe(true);
      expect(deepest).toBeLessThan(0.001);
    });

    it(`a chassis at ${heading} degrees driven into a solid arm link stops with its corner on the link`, { timeout: 60_000 }, () => {
      const a = bot({ id: 'a', x: 0, z: 0, floor: 0, heading, power: [0.5, 0.5] });
      // A 5 m bar along x at z = 2, 0.2 m thick, on a joint at the foot of a pillar.
      const nodes: NodeSpec[] = [
        ...a.nodes,
        ['stand', 'block', { position: { x: -1.5, y: 0.5, z: 2 }, size: { x: 0.4, y: 1, z: 0.4 } }],
        ['hinge', 'joint', { axis: 'yaw', start: 0, min: -180, max: 180, mount: { x: 0.3, y: -0.35, z: 0 }, solid: 'no' }],
        ['bar', 'link', { length: 5, thickness: 0.2, solid: 'yes', mass: 1 }],
        ['on', 'on-start', {}],
      ];
      const wires: WireSpec[] = [...a.wires, ['stand', 'self', 'hinge', 'base'], ['on', 'started', 'hinge', 'power'], ['hinge', 'tip', 'bar', 'base']];
      const r = play(nodes, wires);
      let deepest = -Infinity;
      let touched = false;
      for (let k = 0; k < seconds(8); k++) {
        r.tick();
        const e = r.entity('a')!;
        for (const piece of r.world.entities().filter((v) => v.ownerNodeId === 'bar')) {
          deepest = Math.max(deepest, overlapDepth(e, piece));
          if (r.world.isTouching(e.id, piece.id)) touched = true;
        }
      }
      const e = r.entity('a')!;
      r.world.dispose?.();
      expect(touched).toBe(true);
      expect(deepest).toBeLessThan(0.001);
      // The bar's near face is at z = 1.9: the leading corner is on it.
      expect(1.9 - Math.max(...corners(e).map((c) => c.z))).toBeLessThan(0.01);
    });
  }
});
