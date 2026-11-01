import type { EntityId, ViewMode } from '../engine/types';
import { colliderBox } from './collider';
import type { Entity } from './entity';

type Axis = 'x' | 'y' | 'z';

/** Shrinks each box a hair so a sight line that only grazes an edge or runs along a floor is not blocked. */
const GRAZE = 0.02;

/** Axes the view really has: the one it hides is ignored, so a thin wall still blocks sight on the flat boards. */
function axesOf(mode: ViewMode): Axis[] {
  if (mode === '2d-side') return ['x', 'y'];
  if (mode === '2d-top') return ['x', 'z'];
  return ['x', 'y', 'z'];
}

/** Slab test: does the segment a -> b pass through the box (centre c, full size s) on the given axes? */
function segmentHitsBox(a: Record<Axis, number>, b: Record<Axis, number>, c: Record<Axis, number>, s: Record<Axis, number>, axes: Axis[]): boolean {
  let t0 = 0;
  let t1 = 1;
  for (const k of axes) {
    const half = Math.max(0, s[k] / 2 - GRAZE);
    const lo = c[k] - half;
    const hi = c[k] + half;
    const d = b[k] - a[k];
    if (Math.abs(d) < 1e-9) {
      if (a[k] < lo || a[k] > hi) return false;
      continue;
    }
    let near = (lo - a[k]) / d;
    let far = (hi - a[k]) / d;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 > t1) return false;
  }
  return true;
}

/**
 * True when no visible solid block crosses the straight line between the centres of `from` and `to`.
 * The two bodies themselves never block. An unknown or hidden end sees nothing (false).
 */
export function lineOfSight(entities: readonly Entity[], mode: ViewMode, from: Entity | undefined, to: Entity | undefined): boolean {
  if (!from || !to || !from.visible || !to.visible) return false;
  const axes = axesOf(mode);
  const a = { x: from.pos.x, y: from.pos.y, z: from.pos.z };
  const b = { x: to.pos.x, y: to.pos.y, z: to.pos.z };
  const skip: EntityId[] = [from.id, to.id];
  for (const e of entities) {
    if (!e.visible || !e.solid || e.kind !== 'block' || e.zone || skip.includes(e.id)) continue;
    const box = colliderBox(e);
    if (segmentHitsBox(a, b, box.pos, box.size, axes)) return false;
  }
  return true;
}
