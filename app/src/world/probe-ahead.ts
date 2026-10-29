import type { EntityId } from '../engine/types';
import { colliderBox } from './collider';
import type { Entity } from './entity';

/** Ignore things this far above or below the prober's body (the floor it drives on, roofs high overhead). */
const VERTICAL_MARGIN = 0.1;
/** Share of the prober's width that counts as "in its lane". */
const LANE_SHARE = 0.9;

/**
 * Nearest visible solid block, vehicle or character in front of `self` within `reach`.
 * Works on projections of the boxes onto the facing direction and its sideways, so it is exact for the four straight
 * headings and a little generous on diagonals (boxes are axis-aligned). Something beside or behind never counts.
 */
export function probeAhead(entities: readonly Entity[], self: Entity, reach: number): { id: EntityId; distance: number } | null {
  const fx = self.facing.x;
  const fz = self.facing.z;
  const len = Math.hypot(fx, fz);
  if (len < 1e-6 || !(reach >= 0)) return null;
  const ux = fx / len;
  const uz = fz / len;
  // Sideways unit (perpendicular on the ground plane).
  const px = -uz;
  const pz = ux;
  const sb = colliderBox(self);
  const selfAlong = (Math.abs(ux) * sb.size.x + Math.abs(uz) * sb.size.z) / 2;
  const selfLat = (Math.abs(px) * sb.size.x + Math.abs(pz) * sb.size.z) / 2;
  const selfBottom = sb.pos.y - sb.size.y / 2 + VERTICAL_MARGIN;
  const selfTop = sb.pos.y + sb.size.y / 2 - VERTICAL_MARGIN;

  let best: { id: EntityId; distance: number } | null = null;
  for (const e of entities) {
    if (e === self || !e.visible) continue;
    if (e.kind === 'block') {
      if (!e.solid || e.zone) continue;
    } else if (e.kind === 'vehicle') {
      // a vehicle's own driver is not an obstacle and neither is cargo on its bed
    } else if (e.kind === 'character') {
      if (e.seatedIn !== null || e.combat?.dead) continue;
    } else {
      continue;
    }
    const eb = colliderBox(e);
    if (eb.pos.y + eb.size.y / 2 <= selfBottom || eb.pos.y - eb.size.y / 2 >= selfTop) continue;

    const dx = eb.pos.x - sb.pos.x;
    const dz = eb.pos.z - sb.pos.z;
    const along = dx * ux + dz * uz;
    if (along <= 0) continue;
    const lat = dx * px + dz * pz;
    const eAlong = (Math.abs(ux) * eb.size.x + Math.abs(uz) * eb.size.z) / 2;
    const eLat = (Math.abs(px) * eb.size.x + Math.abs(pz) * eb.size.z) / 2;
    if (Math.abs(lat) >= eLat + selfLat * LANE_SHARE) continue;
    const gap = Math.max(0, along - eAlong - selfAlong);
    if (gap > reach) continue;
    if (!best || gap < best.distance) best = { id: e.id, distance: gap };
  }
  return best;
}
