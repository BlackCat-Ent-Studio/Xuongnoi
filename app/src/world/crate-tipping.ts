import type { Vec3 } from '../engine/types';
import { weight } from './mechanics';
import { obbCorners, type Obb } from './oriented-box';

/**
 * When does a push tip a crate instead of sliding it? Pure maths (no world access), kg and N.
 *
 * A horizontal force F pushes the crate at height `contactY`. The crate turns about its lowest far edge (the pivot):
 * the push turns it forward with torque F · h, the weight holds it back with m · g · a, where
 *   h = height of the push above the pivot,   a = how far, along the push, the pivot is ahead of the centre of mass.
 * So it starts to tip when   F_tip = m · g · a / h.   An upright crate of base half-width b gives a = b, so F_tip = m · g · b / h.
 * Example: 10 kg, base 0.4 m wide (b = 0.2 m), pushed at h = 1.1 m: F_tip = 10 · 9.81 · 0.2 / 1.1 = 17.8 N, while sliding it
 * takes μ · m · g = 49.05 N at μ 0.5. The crate does whichever needs less force.
 */

/** Corners within this height (m) of the lowest one count as standing on the ground (a crate that is tilted by a hair still rests on its whole base). */
const SUPPORT_TOL = 0.01;
/** A push this close to (or under) the pivot's height has no tipping lever. */
const MIN_LEVER = 1e-3;

/**
 * Force (N) that tips `real` over about its far bottom edge when pushed horizontally along `dir` at height `contactY` (world y).
 * `massKg` is the whole load that turns with it (the crate and what stands on it). Infinity when the push has no lever
 * (it is level with or below the pivot, or does not push sideways); 0 when the centre of mass is already past the pivot
 * (the crate falls over by itself).
 */
export function tipForceN(real: Obb, dir: Vec3, contactY: number, massKg: number): number {
  const len = Math.hypot(dir.x, dir.z);
  if (!(len > 1e-9)) return Infinity;
  const d = { x: dir.x / len, z: dir.z / len };
  const corners = obbCorners(real);
  const lowest = Math.min(...corners.map((c) => c.y));
  let ahead = -Infinity;
  let pivotY = lowest;
  for (const c of corners) {
    if (c.y > lowest + SUPPORT_TOL) continue;
    const along = (c.x - real.centre.x) * d.x + (c.z - real.centre.z) * d.z;
    if (along > ahead) {
      ahead = along;
      pivotY = c.y;
    }
  }
  if (ahead <= 0) return 0;
  const lever = contactY - pivotY;
  if (lever <= MIN_LEVER) return Infinity;
  return (weight(massKg) * ahead) / lever;
}
