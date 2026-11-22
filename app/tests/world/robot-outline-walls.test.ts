import { beforeAll, describe, expect, it } from 'vitest';
import type { EntityView } from '../../src/engine/types';
import { loadRapier, type RapierModule } from '../../src/world/rapier-loader';
import { rig, type NodeSpec, type WireSpec } from '../helpers/arm-rig';
import { overlapDepth } from '../helpers/chassis-metrics';
import { FLOOR } from '../helpers/nav-rig';
import { bot, deckRig, seconds } from './deck-rig';

/**
 * With "Vật lý thật" on, walls and other blocks meet a chassis by its real outline, length by width turned to its heading, as
 * crates and other chassis already did. Everything is measured from the entity views with `overlapDepth` (rectangles on the
 * ground, worked out in the test helpers, not by the physics code).
 */

let rapier: RapierModule;
beforeAll(async () => {
  rapier = await loadRapier();
});

const RAD = Math.PI / 180;

/** The same board with the switch off. */
function rigOff(nodes: NodeSpec[], wires: WireSpec[]) {
  return rig([FLOOR, ...nodes], wires, '3d');
}

const wall = (id: string, x0: number, x1: number, z0: number, z1: number): NodeSpec => [id, 'block', { position: { x: (x0 + x1) / 2, y: 0.5, z: (z0 + z1) / 2 }, size: { x: x1 - x0, y: 1, z: z1 - z0 } }];

/** Half the length of the chassis's shadow on the world x axis and on the world z axis, from its view. */
function reach(v: EntityView): { x: number; z: number } {
  const r = v.robot!;
  const c = Math.abs(Math.cos(r.heading));
  const s = Math.abs(Math.sin(r.heading));
  return { x: (r.length * c + r.width * s) / 2, z: (r.length * s + r.width * c) / 2 };
}

const headingDeg = (v: EntityView): number => v.robot!.heading / RAD;

describe('a chassis meets walls by its turned outline', () => {
  for (const heading of [0, 30, 45, 60]) {
    it(`driving at ${heading} degrees into a wall: its leading corner stops on the wall face, never inside it`, { timeout: 60_000 }, () => {
      const b = bot({ id: 'r', x: 0, z: 0, floor: 0, heading, power: [0.5, 0.5] });
      const r = deckRig([wall('wall', 3, 3.5, -30, 30), ...b.nodes], b.wires, rapier);
      let deepest = -Infinity;
      for (let k = 0; k < seconds(8); k++) {
        r.tick();
        deepest = Math.max(deepest, overlapDepth(r.entity('r')!, r.entity('wall')!));
      }
      const e = r.entity('r')!;
      r.world.dispose?.();
      expect(deepest).toBeLessThan(0.001);
      // It is against the wall: the corner that leads is within a centimetre of the face at x = 3.
      expect(3 - (e.position.x + reach(e).x)).toBeLessThan(0.01);
      expect(3 - (e.position.x + reach(e).x)).toBeGreaterThan(-0.001);
      // Held by the wall, its nose still points the way it drove (a wall does not turn it).
      expect(Math.abs(headingDeg(e) - heading)).toBeLessThan(0.5);
    });
  }

  it('a 1.2 x 0.4 m chassis drives through a 0.6 m gap between two walls (its 1.2 m square would not fit)', { timeout: 60_000 }, () => {
    const b = bot({ id: 'r', x: 0, z: 0, floor: 0, power: [0.5, 0.5], chassis: { length: 1.2, width: 0.4, height: 0.24 } });
    const r = deckRig([wall('left', 2, 4, -3, -0.3), wall('right', 2, 4, 0.3, 3), ...b.nodes], b.wires, rapier);
    let deepest = -Infinity;
    let drift = 0;
    for (let k = 0; k < seconds(8); k++) {
      r.tick();
      const e = r.entity('r')!;
      deepest = Math.max(deepest, overlapDepth(e, r.entity('left')!), overlapDepth(e, r.entity('right')!));
      drift = Math.max(drift, Math.abs(e.position.z));
    }
    const x = r.entity('r')!.position.x;
    r.world.dispose?.();
    expect(x).toBeGreaterThan(5);
    expect(drift).toBeLessThan(1e-6);
    expect(deepest).toBeLessThan(0.001);
  });

  it('pivots a full turn in a lane wider than its diagonal without moving or touching the walls', { timeout: 60_000 }, () => {
    // 0.9 x 0.7 m: diagonal 1.14 m; lane 1.2 m.
    const b = bot({ id: 'r', x: 0, z: 0, floor: 0, power: [0.3, -0.3] });
    const r = deckRig([wall('left', -5, 5, -1.6, -0.6), wall('right', -5, 5, 0.6, 1.6), ...b.nodes], b.wires, rapier);
    let deepest = -Infinity;
    let moved = 0;
    let turned = 0;
    let last = 0;
    for (let k = 0; k < seconds(12); k++) {
      r.tick();
      const e = r.entity('r')!;
      deepest = Math.max(deepest, overlapDepth(e, r.entity('left')!), overlapDepth(e, r.entity('right')!));
      moved = Math.max(moved, Math.hypot(e.position.x, e.position.z));
      let d = headingDeg(e) - last;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      turned += d;
      last = headingDeg(e);
    }
    r.world.dispose?.();
    expect(Math.abs(turned)).toBeGreaterThan(360);
    expect(moved).toBeLessThan(0.001);
    expect(deepest).toBeLessThan(0);
  });

  it('pivoting flush beside one wall: the corner pushes it off the wall, smoothly, and it turns on', { timeout: 60_000 }, () => {
    // Side face 1 cm from the wall face at z = -0.36.
    const b = bot({ id: 'r', x: 0, z: 0, floor: 0, power: [0.3, -0.3] });
    const r = deckRig([wall('wall', -5, 5, -1.36, -0.36), ...b.nodes], b.wires, rapier);
    let deepest = -Infinity;
    let jump = 0;
    let turned = 0;
    let last = 0;
    let before = r.entity('r')!.position;
    let farthest = 0;
    for (let k = 0; k < seconds(12); k++) {
      r.tick();
      const e = r.entity('r')!;
      deepest = Math.max(deepest, overlapDepth(e, r.entity('wall')!));
      jump = Math.max(jump, Math.hypot(e.position.x - before.x, e.position.z - before.z));
      // Never pulled back towards the wall: it only ever goes away from it.
      expect(e.position.z).toBeGreaterThanOrEqual(before.z - 1e-9);
      before = e.position;
      farthest = Math.max(farthest, e.position.z);
      let d = headingDeg(e) - last;
      if (d > 180) d -= 360;
      if (d < -180) d += 360;
      turned += d;
      last = headingDeg(e);
    }
    r.world.dispose?.();
    expect(deepest).toBeLessThan(0.001);
    expect(Math.abs(turned)).toBeGreaterThan(360);
    // The half diagonal (0.570 m) needs the middle that far from the face: 0.21 m further than where it started.
    expect(farthest).toBeGreaterThan(0.2);
    expect(farthest).toBeLessThan(0.22);
    // A step of a tick is a few millimetres, not a jump.
    expect(jump).toBeLessThan(0.02);
  });

  it('pivoting in a lane narrower than its diagonal: the turn stops against the walls and stays stopped', { timeout: 60_000 }, () => {
    // Lane 0.8 m: wider than the chassis (0.7 m), narrower than its diagonal (1.14 m).
    const b = bot({ id: 'r', x: 0, z: 0, floor: 0, power: [0.3, -0.3] });
    const r = deckRig([wall('left', -5, 5, -1.4, -0.4), wall('right', -5, 5, 0.4, 1.4), ...b.nodes], b.wires, rapier);
    let deepest = -Infinity;
    for (let k = 0; k < seconds(6); k++) {
      r.tick();
      const e = r.entity('r')!;
      deepest = Math.max(deepest, overlapDepth(e, r.entity('left')!), overlapDepth(e, r.entity('right')!));
    }
    const held = r.entity('r')!;
    // It did turn until its corners met the walls: 0.9 sin(a) + 0.7 cos(a) = 0.8 at a = 6.8 degrees.
    expect(Math.abs(headingDeg(held))).toBeGreaterThan(5);
    expect(Math.abs(headingDeg(held))).toBeLessThan(7);
    for (let k = 0; k < seconds(2); k++) {
      r.tick();
      const e = r.entity('r')!;
      deepest = Math.max(deepest, overlapDepth(e, r.entity('left')!), overlapDepth(e, r.entity('right')!));
      expect(e.robot!.heading).toBe(held.robot!.heading);
      expect(e.position.x).toBe(held.position.x);
      expect(e.position.z).toBe(held.position.z);
      expect(e.robot!.turnRate).toBe(0);
    }
    r.world.dispose?.();
    expect(deepest).toBeLessThan(0.001);
  });

  it('with the switch off a chassis still meets the wall by its upright square', () => {
    const b = bot({ id: 'r', x: 0, z: 0, floor: 0, heading: 45, power: [0.5, 0.5] });
    const r = rigOff([wall('wall', 3, 3.5, -30, 30), ...b.nodes], b.wires);
    for (let k = 0; k < seconds(8); k++) r.tick();
    const e = r.entity('r')!;
    // The square is 0.9 m: the middle stops 0.45 m from the face.
    expect(e.position.x).toBeCloseTo(3 - 0.45, 6);
  });
});
