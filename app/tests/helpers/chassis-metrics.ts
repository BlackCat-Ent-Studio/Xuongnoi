import type { EntityView } from '../../src/engine/types';

/**
 * Geometry of robot chassis measured from the entity views alone (position, heading, length and width), with no call into
 * the physics code that is under test. Lengths in metres.
 *
 * A chassis is measured as it is drawn and as other bodies meet it with "Vật lý thật" on: a rectangle `length` by `width`
 * on the ground, turned to its heading, as high as its box. Anything else is its collision box, upright.
 */

interface Outline {
  x: number;
  y: number;
  z: number;
  /** Half sizes along its own forward and sideways directions, and half its height. */
  along: number;
  across: number;
  hy: number;
  /** Unit forward direction on the ground. */
  fx: number;
  fz: number;
}

function outlineOf(e: EntityView): Outline {
  if (e.robot) {
    return { x: e.position.x, y: e.position.y, z: e.position.z, along: e.robot.length / 2, across: e.robot.width / 2, hy: e.size.y / 2, fx: Math.cos(e.robot.heading), fz: Math.sin(e.robot.heading) };
  }
  const b = e.collider ?? { position: e.position, size: e.size };
  return { x: b.position.x, y: b.position.y, z: b.position.z, along: b.size.x / 2, across: b.size.z / 2, hy: b.size.y / 2, fx: 1, fz: 0 };
}

/** Half the length of the rectangle's shadow on the unit ground direction (nx, nz). */
function shadow(o: Outline, nx: number, nz: number): number {
  return o.along * Math.abs(o.fx * nx + o.fz * nz) + o.across * Math.abs(-o.fz * nx + o.fx * nz);
}

/**
 * How deep two bodies are inside each other. Two rectangles on the ground overlap when their shadows overlap along the
 * forward and the sideways direction of each (four directions); with the height that makes five. The result is the
 * smallest of those overlaps when all are positive (the distance one of them has to back off), else the largest gap as
 * a negative number.
 */
export function overlapDepth(a: EntityView, b: EntityView): number {
  const p = outlineOf(a);
  const q = outlineOf(b);
  let depth = p.hy + q.hy - Math.abs(p.y - q.y);
  for (const [nx, nz] of [[p.fx, p.fz], [-p.fz, p.fx], [q.fx, q.fz], [-q.fz, q.fx]] as const) {
    const apart = Math.abs((q.x - p.x) * nx + (q.z - p.z) * nz);
    depth = Math.min(depth, shadow(p, nx, nz) + shadow(q, nx, nz) - apart);
  }
  return depth;
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
