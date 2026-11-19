import type { EntityView } from '../../src/engine/types';

/**
 * Geometry of robot chassis measured from the entity views alone (position and collision box), with no call into the
 * physics code that is under test. Lengths in metres.
 */

interface Square {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
}

function boxOf(e: EntityView): Square {
  const b = e.collider ?? { position: e.position, size: e.size };
  return { x: b.position.x, y: b.position.y, z: b.position.z, hx: b.size.x / 2, hy: b.size.y / 2, hz: b.size.z / 2 };
}

/**
 * How deep the collision boxes of two bodies are inside each other: the smallest of the three axis overlaps when all three
 * are positive (the distance one of them has to back off), else the largest axis gap as a negative number.
 */
export function overlapDepth(a: EntityView, b: EntityView): number {
  const p = boxOf(a);
  const q = boxOf(b);
  const ox = p.hx + q.hx - Math.abs(p.x - q.x);
  const oy = p.hy + q.hy - Math.abs(p.y - q.y);
  const oz = p.hz + q.hz - Math.abs(p.z - q.z);
  return Math.min(ox, oy, oz);
}

/** The deepest overlap among every pair of the given bodies. */
export function deepestOverlap(bodies: readonly EntityView[]): number {
  let worst = -Infinity;
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) worst = Math.max(worst, overlapDepth(bodies[i]!, bodies[j]!));
  }
  return worst;
}

/** Ground speed (m/s) of a body between two views taken one tick (`dt` seconds) apart. */
export function groundSpeed(before: EntityView, after: EntityView, dt: number): number {
  return Math.hypot(after.position.x - before.position.x, after.position.z - before.position.z) / dt;
}
