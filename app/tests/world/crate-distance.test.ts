import { describe, expect, it } from 'vitest';
import type { EntityId, EntityView, World } from '../../src/engine/types';
import { distanceNode } from '../../src/nodes/distance';
import { nearestItemNode } from '../../src/nodes/nearest-item';
import { floorGap, viewDistance } from '../../src/world/view-gap';
import { runNode } from '../nodes/fake-world';
import { block, crate, crateWorld, floor, run, view } from './crate-helpers';

/** Quarter turn about z: a 0.4 x 1.2 x 0.4 crate (long side up) lies along x. */
const S = Math.SQRT1_2;
const Z90 = { x: 0, y: 0, z: S, w: S };
const LONG = { x: 0.4, y: 1.2, z: 0.4 };

/** A long crate lying along x with its middle at (cx, 0.2, cz). */
async function lyingCrate(w: World, cx: number, cz: number): Promise<EntityId> {
  const c = crate(w, 0, 0.6, 0, LONG, { mass: 10, mu: 0.5 });
  run(w, 0.2);
  w.teleport(c, { x: cx, y: 0.2, z: cz }, false);
  w.setItemRotation(c, Z90);
  run(w, 1);
  const v = view(w, c);
  expect(v.position.x).toBeCloseTo(cx, 2);
  expect(v.position.y).toBeCloseTo(0.2, 1);
  return c;
}

const marker = (w: World, x: number, y: number, z: number): EntityId => block(w, x, y, z, 0.2, 0.2, 0.2, { solid: false });

describe('distance card reads the crate surface', () => {
  it('to a long crate lying along x: the gap to its near face, not to its middle', async () => {
    const w = await crateWorld();
    floor(w);
    const c = await lyingCrate(w, 5, 0);
    // Middle at x = 5, near face at 5 - 0.6 = 4.4. A marker at x = 2 (middle) is 2.4 from the face; from the middle it is 3.0.
    const from = marker(w, 2, 0.2, 0);
    const read = runNode(distanceNode, [{ inputs: { a: from, b: c } }], { threshold: 2.5 }, w)[0]!;
    expect(read.distance as number).toBeCloseTo(2.4, 2);
    expect(read.within).toBe(true);
    // Either way round gives the same.
    expect(runNode(distanceNode, [{ inputs: { a: c, b: from } }], { threshold: 2.5 }, w)[0]!.distance as number).toBeCloseTo(2.4, 2);
    // From above the middle: the top face is at 0.4, the marker's middle at 3.2: 2.8 (the middle would give 3.0).
    const over = marker(w, 5, 3.2, 0);
    expect(runNode(distanceNode, [{ inputs: { a: over, b: c } }], { threshold: 2.5 }, w)[0]!.distance as number).toBeCloseTo(2.8, 2);
  });

  it('a plain block is still measured between middles', async () => {
    const w = await crateWorld();
    floor(w);
    const a = marker(w, 0, 1, 0);
    const b = marker(w, 3, 1, 4);
    expect(runNode(distanceNode, [{ inputs: { a, b } }], { threshold: 3 }, w)[0]!.distance as number).toBeCloseTo(5, 9);
  });

  it('two crates: the gap between their nearest surfaces', async () => {
    const w = await crateWorld();
    floor(w);
    const a = await lyingCrate(w, 0, 0);
    const b = await lyingCrate(w, 3, 0);
    // Faces at 0.6 and 3 - 0.6 = 2.4: gap 1.8 (middles 3.0).
    expect(runNode(distanceNode, [{ inputs: { a, b } }], { threshold: 3 }, w)[0]!.distance as number).toBeCloseTo(1.8, 2);
  });
});

describe('nearest-item card ranks crates by their surface', () => {
  it('picks the lying crate whose near end is closer although its middle is farther', async () => {
    const w = await crateWorld();
    floor(w);
    const who = marker(w, 0, 0.2, 0);
    // Long crate: middle x = 5, near end x = 4.4 (gap 4.4). Small crate: middle z = 4.8, near face 4.6 (gap 4.6), middle nearer (4.8 < 5).
    const long = await lyingCrate(w, 5, 0);
    const small = crate(w, 0, 0.2, 4.8, { x: 0.4, y: 0.4, z: 0.4 });
    run(w, 0.5);
    const out = runNode(nearestItemNode, [{ inputs: { who } }], {}, w)[0]!;
    expect(out.item).toBe(long);
    expect(out.distance as number).toBeCloseTo(4.4, 2);
    expect(out.found).toBe(true);
    // Take the long one away: the small one is next, at its face (4.6).
    w.hide(long);
    run(w, 0.1);
    const next = runNode(nearestItemNode, [{ inputs: { who } }], {}, w)[0]!;
    expect(next.item).toBe(small);
    expect(next.distance as number).toBeCloseTo(4.6, 2);
  });
});

describe('gap helpers on views', () => {
  const view3 = (over: Partial<EntityView>): EntityView =>
    ({ id: 'v', kind: 'item', ownerNodeId: 'n', position: { x: 0, y: 0.2, z: 0 }, size: { x: 0.4, y: 0.4, z: 0.4 }, color: '#fff', visible: true, ...over }) as EntityView;

  it('an upright crate is measured to its face too (centre 3 away, half size 0.2: 2.8)', () => {
    const c = view3({ rotation: { x: 0, y: 0, z: 0, w: 1 }, position: { x: 3, y: 0.2, z: 0 } });
    const p = view3({ kind: 'block', position: { x: 0, y: 0.2, z: 0 } });
    expect(viewDistance(p, c, '3d')).toBeCloseTo(2.8, 9);
    // Without the turn on the view (switch off) it stays the distance between middles.
    expect(viewDistance(p, { ...c, rotation: undefined }, '3d')).toBe(3);
  });

  it('floor distance: inside the outline is 0, side view looks along x only', () => {
    const c = view3({ rotation: { x: 0, y: 0, z: S, w: S }, size: LONG, position: { x: 5, y: 0.2, z: 0 } });
    const who = view3({ kind: 'character', position: { x: 5, y: 1, z: 0.1 } });
    expect(floorGap(who, c, false)).toBe(0);
    const away = view3({ kind: 'character', position: { x: 0, y: 1, z: 9 } });
    expect(floorGap(away, c, true)).toBeCloseTo(4.4, 9);
    // 3D: nearest point of the footprint x 4.4..5.6, z -0.2..0.2 to (0, 9): corner (4.4, 0.2): hypot(4.4, 8.8).
    expect(floorGap(away, c, false)).toBeCloseTo(Math.hypot(4.4, 8.8), 9);
  });
});
