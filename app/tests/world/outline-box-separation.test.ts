import { describe, expect, it } from 'vitest';
import { chassisOutline, outlineBoxSeparation, type Collidable } from '../../src/world/collider';
import { obbOf, obbSeparation } from '../../src/world/oriented-box';

/**
 * The quick test a chassis makes against every block near it (`outlineBoxSeparation`) is held against the long way: the
 * separating-axis test of its real outline and the block as two turned boxes.
 */

/** Small repeatable random numbers (mulberry32). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('outlineBoxSeparation', () => {
  it('gives the separation of the two turned boxes, in 20000 random cases around touching', () => {
    const next = rng(20261123);
    const span = (lo: number, hi: number): number => lo + (hi - lo) * next();
    let worst = 0;
    let overlapping = 0;
    let apart = 0;
    for (let k = 0; k < 20000; k++) {
      const heading = k % 7 === 0 ? (Math.PI / 2) * Math.floor(span(0, 4)) : span(-Math.PI, Math.PI);
      const chassis: Collidable = {
        pos: { x: span(-2, 2), y: span(0, 1), z: span(-2, 2) },
        size: { x: 1, y: span(0.1, 0.6), z: 1 },
        kind: 'robot',
        facing: { x: Math.cos(heading), z: Math.sin(heading) },
        robot: { traction: true, spec: { length: span(0.3, 2), width: span(0.3, 2) } },
      };
      const box = { pos: { x: span(-3, 3), y: span(-0.5, 1.5), z: span(-3, 3) }, size: { x: span(0.05, 4), y: span(0.05, 2), z: span(0.05, 4) } };
      const long = obbSeparation(chassisOutline(chassis)!, obbOf(box.pos, box.size));
      const quick = outlineBoxSeparation(chassis, box);
      worst = Math.max(worst, Math.abs(long - quick));
      if (long < 0) overlapping++;
      else apart++;
    }
    expect(worst).toBeLessThan(1e-12);
    // The cases are not all on one side.
    expect(overlapping).toBeGreaterThan(2000);
    expect(apart).toBeGreaterThan(2000);
  });

  it('reads the heading it is given instead of the chassis own, and a chassis without a facing as pointing along x', () => {
    const chassis: Collidable = { pos: { x: 0, y: 0.12, z: 0 }, size: { x: 1.2, y: 0.24, z: 1.2 }, kind: 'robot', facing: { x: 0, z: 1 }, robot: { traction: true, spec: { length: 1.2, width: 0.4 } } };
    const wall = { pos: { x: 1, y: 0.5, z: 0 }, size: { x: 1, y: 1, z: 4 } };
    // Pointing along z its side (0.2 m) faces the wall face at x = 0.5; pointing along x its nose (0.6 m) is 0.1 m inside.
    expect(outlineBoxSeparation(chassis, wall)).toBeCloseTo(0.3, 12);
    expect(outlineBoxSeparation(chassis, wall, { x: 1, z: 0 })).toBeCloseTo(-0.1, 12);
    expect(outlineBoxSeparation({ ...chassis, facing: undefined }, wall)).toBeCloseTo(-0.1, 12);
  });
});
