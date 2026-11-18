import type { EntityView, Vec3, ViewMode } from '../engine/types';
import { distanceToHull, hull } from './footprint-2d';
import { closestOnObb, flattenObb, obbCorners, obbOfView, type Obb } from './oriented-box';

/**
 * How far apart two things are, for the cards that measure a distance. Plain bodies are measured from their middle, as always. A loose
 * crate under real physics (its view carries a `rotation`) is measured to its nearest surface point, turned as it lies, so a long crate
 * that tipped over is as far away as its near end, not as its middle.
 */

const AXIS_FOR: Partial<Record<ViewMode, 'y' | 'z'>> = { '2d-side': 'z', '2d-top': 'y' };

const isCrate = (v: EntityView): boolean => v.rotation !== undefined;

/** Distance between the middles of two bodies on the plane the view shows (the old rule). */
function middleGap(a: EntityView, b: EntityView, mode: ViewMode): number {
  const dx = a.position.x - b.position.x;
  const dy = mode === '2d-top' ? 0 : a.position.y - b.position.y;
  const dz = mode === '2d-side' ? 0 : a.position.z - b.position.z;
  return Math.hypot(dx, dy, dz);
}

/** Distance from `a` to `b`: surface of a crate, middle of anything else; two crates: the gap between their surfaces. */
export function viewDistance(a: EntityView, b: EntityView, mode: ViewMode): number {
  if (!isCrate(a) && !isCrate(b)) return middleGap(a, b, mode);
  const hidden = AXIS_FOR[mode];
  const solid = (v: EntityView): Obb => {
    const o = obbOfView(v);
    return hidden ? flattenObb(o, hidden) : o;
  };
  const middle = (v: EntityView): Vec3 => ({ x: v.position.x, y: hidden === 'y' ? 0 : v.position.y, z: hidden === 'z' ? 0 : v.position.z });
  const dist = (p: Vec3, q: Vec3): number => Math.hypot(p.x - q.x, p.y - q.y, p.z - q.z);
  if (isCrate(a) !== isCrate(b)) {
    const [crate, other] = isCrate(a) ? [a, b] : [b, a];
    return dist(closestOnObb(solid(crate), middle(other)), middle(other));
  }
  // Two crates: nearest pair of points, found by going back and forth between the two (each step can only bring them closer).
  const oa = solid(a);
  const ob = solid(b);
  let p = middle(a);
  let q = closestOnObb(ob, p);
  for (let i = 0; i < 24; i++) {
    p = closestOnObb(oa, q);
    q = closestOnObb(ob, p);
  }
  return dist(p, q);
}

/**
 * Distance on the floor (x and z; only x in the side view) from `who`'s middle to an item: to the item's middle, or for a crate to the
 * nearest point of its outline seen from above (0 when `who` stands over it).
 */
export function floorGap(who: EntityView, item: EntityView, sideView: boolean): number {
  if (!isCrate(item)) return Math.hypot(item.position.x - who.position.x, sideView ? 0 : item.position.z - who.position.z);
  const corners = obbCorners(obbOfView(item));
  if (sideView) {
    const xs = corners.map((c) => c.x);
    return Math.max(0, Math.min(...xs) - who.position.x, who.position.x - Math.max(...xs));
  }
  return distanceToHull(hull(corners.map((c) => ({ x: c.x, z: c.z }))), { x: who.position.x, z: who.position.z });
}
