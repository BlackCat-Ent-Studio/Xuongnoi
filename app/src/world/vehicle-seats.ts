import type { Vec3, ViewMode } from '../engine/types';
import type { Entity } from './entity';
import { overlapsSolid } from './physics';

/** Spare room left between a character who steps out and the vehicle. */
const EXIT_GAP = 0.05;
/** A character standing next to a vehicle may differ this much in height from it and still reach the door. */
const REACH_HEIGHT_SLACK = 0.5;

/** Free-standing gap between the boxes of `a` and `b` on the ground plane (0 when they touch or overlap). */
function planarGap(a: Entity, b: Entity, mode: ViewMode): number {
  const gx = Math.max(0, Math.abs(a.pos.x - b.pos.x) - (a.size.x + b.size.x) / 2);
  const gz = mode === '2d-side' ? 0 : Math.max(0, Math.abs(a.pos.z - b.pos.z) - (a.size.z + b.size.z) / 2);
  return Math.hypot(gx, gz);
}

/** The closest empty vehicle whose box is within `reach` of the character's box. */
export function nearestEnterable(list: readonly Entity[], c: Entity, reach: number, mode: ViewMode): Entity | null {
  let best: Entity | null = null;
  let bestGap = Infinity;
  for (const v of list) {
    if (v.kind !== 'vehicle' || !v.visible || !v.vehicle || v.vehicle.driver !== null) continue;
    if (Math.abs(v.pos.y - c.pos.y) > (v.size.y + c.size.y) / 2 + REACH_HEIGHT_SLACK) continue;
    const gap = planarGap(c, v, mode);
    if (gap <= reach && gap < bestGap) {
      best = v;
      bestGap = gap;
    }
  }
  return best;
}

/**
 * A standing spot beside the vehicle that is clear of solid blocks (and of solid vehicles): to the right, left,
 * behind, in front, and as a last resort on its roof. The side view only has behind and in front.
 */
export function exitSpot(list: readonly Entity[], vehicle: Entity, c: Entity, mode: ViewMode): Vec3 {
  const heading = vehicle.vehicle?.heading ?? 0;
  const fwd = { x: Math.cos(heading), z: Math.sin(heading) };
  const right = { x: -fwd.z, z: fwd.x };
  const dirs =
    mode === '2d-side'
      ? [{ x: -Math.sign(fwd.x || 1), z: 0 }, { x: Math.sign(fwd.x || 1), z: 0 }]
      : [right, { x: -right.x, z: -right.z }, { x: -fwd.x, z: -fwd.z }, fwd];
  const solids = list.filter((e) => e.visible && e.solid && (e.kind === 'block' || e.kind === 'vehicle'));
  const feetY = vehicle.pos.y - vehicle.size.y / 2 + c.size.y / 2;
  for (const d of dirs) {
    // Push out to the edge of the vehicle's box along the dominant axis so the new box clears it at any angle.
    const reach = (vehicle.size.x + c.size.x) / 2 + EXIT_GAP;
    const t = reach / Math.max(Math.abs(d.x), Math.abs(d.z), 1e-6);
    const spot: Vec3 = { x: vehicle.pos.x + d.x * t, y: feetY, z: mode === '2d-side' ? 0 : vehicle.pos.z + d.z * t };
    if (!overlapsSolid({ ...c, pos: spot }, solids)) return spot;
  }
  return seatOnTop(vehicle, c, mode);
}

function seatOnTop(vehicle: Entity, c: Entity, mode: ViewMode): Vec3 {
  return { x: vehicle.pos.x, y: vehicle.pos.y + vehicle.size.y / 2 + c.size.y / 2 + EXIT_GAP, z: mode === '2d-side' ? 0 : vehicle.pos.z };
}
