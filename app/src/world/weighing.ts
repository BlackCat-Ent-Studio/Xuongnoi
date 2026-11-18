import { hull, overlapMiddle, type Pt } from './footprint-2d';
import { obbCorners, rayObb, type Obb } from './oriented-box';

/**
 * How a crate's weight is shared between what holds it up (scale, floor block, another crate).
 *
 * Contact: the part of the crate that is within `REST_TOL` of a support's top surface, seen from above, overlaps the support's top
 * face. The middle of that shared patch is where the support pushes up. A crate sunk more than `SINK` into the support (it stands
 * beside it, pressed against its side) is not resting on it.
 *
 * Share (lever rule): the supports push up with forces that add up to the weight and whose moment about the crate's middle is zero,
 * so the weight is split by the distances from the supports' patch middles to the crate's centre of mass. With three or more
 * supports the evenest split that still balances is taken (least sum of squares). No engine force is read: the split follows from the
 * positions only, so it is the same every tick and a pupil can check it with a ruler.
 */

/** Crate bottom may hover this far (m) above a support's top and still count as resting on it. */
export const REST_TOL = 0.02;
/** ... or sit this deep (m) inside it (the engine lets a tilted crate sink a little at an edge). */
const SINK = 0.05;

/** The 12 edges of a box whose corners come from `obbCorners` (index bits: x, y, z). */
const EDGES: readonly (readonly [number, number])[] = (() => {
  const out: [number, number][] = [];
  for (let i = 0; i < 8; i++) for (const bit of [1, 2, 4]) if ((i & bit) === 0) out.push([i, i | bit]);
  return out;
})();

/** The part of the box lying at or below height `h`, as points seen from above (every corner below, and where the edges cross `h`). */
function belowHeight(corners: readonly { x: number; y: number; z: number }[], h: number): Pt[] {
  const pts: Pt[] = [];
  for (const c of corners) if (c.y <= h) pts.push({ x: c.x, z: c.z });
  for (const [i, j] of EDGES) {
    const a = corners[i]!;
    const b = corners[j]!;
    if ((a.y <= h) !== (b.y <= h)) {
      const t = (h - a.y) / (b.y - a.y);
      pts.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
    }
  }
  return pts;
}

/** A box with what the contact test needs worked out once. */
export interface Shape {
  obb: Obb;
  corners: readonly { x: number; y: number; z: number }[];
  lowest: number;
  highest: number;
}

export function shapeOf(obb: Obb): Shape {
  const corners = obbCorners(obb);
  return { obb, corners, lowest: Math.min(...corners.map((c) => c.y)), highest: Math.max(...corners.map((c) => c.y)) };
}

/**
 * Where `base` pushes up on `crate`, as the middle of their shared patch seen from above, or null when the crate does not rest on it.
 */
export function supportPoint(crate: Shape, base: Shape): Pt | null {
  const top = base.highest;
  if (crate.lowest > top + REST_TOL) return null;
  const underside = hull(belowHeight(crate.corners, top + REST_TOL));
  const face = hull(base.corners.filter((c) => c.y >= top - REST_TOL).map((c) => ({ x: c.x, z: c.z })));
  const middle = overlapMiddle(underside, face);
  if (!middle) return null;
  // Where the crate's own underside is, straight above the patch middle: far below the support's top means it is pressed against the
  // support's side or stands under it, not on it.
  const below = rayObb(crate.obb, { x: middle.x, y: crate.obb.centre.y - 1e4, z: middle.z }, { x: 0, y: 1, z: 0 });
  if (below !== null && crate.obb.centre.y - 1e4 + below < top - SINK) return null;
  return middle;
}

/**
 * Splits `weight` between supports that push up at `points`, so the pushes add up to the weight and balance about `centre`
 * (the crate's centre of mass, with whatever stands on it). A centre outside the supports puts the weight on the nearest ones.
 */
export function leverShares(points: readonly Pt[], centre: Pt, weight: number): number[] {
  const n = points.length;
  const shares = new Array<number>(n).fill(0);
  if (n === 0) return shares;
  let active = points.map((_, i) => i);
  const rel = points.map((p) => ({ x: p.x - centre.x, z: p.z - centre.z }));
  for (;;) {
    if (active.length === 1) {
      shares[active[0]!] = weight;
      return shares;
    }
    if (active.length === 2) {
      const a = rel[active[0]!]!;
      const b = rel[active[1]!]!;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const len2 = dx * dx + dz * dz;
      const t = len2 < 1e-12 ? 0.5 : Math.min(1, Math.max(0, (-a.x * dx - a.z * dz) / len2));
      shares[active[0]!] = weight * (1 - t);
      shares[active[1]!] = weight * t;
      return shares;
    }
    // Least sum of squares with  sum F = W  and  sum F * r = 0:  F_i = l0 + l1 x_i + l2 z_i.
    let m00 = 0, m01 = 0, m02 = 0, m11 = 0, m12 = 0, m22 = 0;
    for (const i of active) {
      const p = rel[i]!;
      m00 += 1;
      m01 += p.x;
      m02 += p.z;
      m11 += p.x * p.x;
      m12 += p.x * p.z;
      m22 += p.z * p.z;
    }
    const det = m00 * (m11 * m22 - m12 * m12) - m01 * (m01 * m22 - m12 * m02) + m02 * (m01 * m12 - m11 * m02);
    const scale = Math.max(1e-12, m11 + m22);
    if (Math.abs(det) < 1e-9 * scale * scale) {
      // All on one line: keep the two ends of it; the others carry nothing.
      let best: [number, number] = [active[0]!, active[1]!];
      let far = -1;
      for (const i of active) {
        for (const j of active) {
          const d = (rel[i]!.x - rel[j]!.x) ** 2 + (rel[i]!.z - rel[j]!.z) ** 2;
          if (d > far) {
            far = d;
            best = [i, j];
          }
        }
      }
      active = best[0] === best[1] ? [best[0]] : [...best];
      continue;
    }
    // Solve M l = (W, 0, 0): the first column of the inverse of M (symmetric), by cofactors.
    const l0 = (weight * (m11 * m22 - m12 * m12)) / det;
    const l1 = (weight * (m02 * m12 - m01 * m22)) / det;
    const l2 = (weight * (m01 * m12 - m02 * m11)) / det;
    let worst = -1;
    let worstValue = -1e-12;
    for (const i of active) {
      const f = l0 + l1 * rel[i]!.x + l2 * rel[i]!.z;
      shares[i] = f;
      if (f < worstValue) {
        worstValue = f;
        worst = i;
      }
    }
    if (worst < 0) return shares;
    active = active.filter((i) => i !== worst);
    for (let i = 0; i < n; i++) if (!active.includes(i)) shares[i] = 0;
  }
}
