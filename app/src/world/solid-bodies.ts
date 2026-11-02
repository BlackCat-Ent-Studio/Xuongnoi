import type { Vec3 } from '../engine/types';
import { boxOverlap, colliderBox } from './collider';
import type { Entity } from './entity';
import type { WorldOptions } from './world-options';

/**
 * Rules for worlds where characters and items are solid bodies (see WorldOptions.solidBodies).
 * Nothing in here runs for the editor, the samples or the lessons.
 */

export interface BodyRules {
  frontLooks: ReadonlySet<string>;
  frontCarry: { reach: number; height: number };
}

/** A body falling lower than this went off the tray; it goes back to where it started. */
export const RESPAWN_BELOW = -6;
/** Gap left between a carried or dropped item and whatever it is set down beside. */
const DROP_MARGIN = 0.05;
/** How far apart successive rings of drop spots are. */
const RING_STEP = 0.5;
const RINGS = 5;
const FALLBACK_FRONT = { reach: 0.65, height: 0.3 };

export function bodyRules(options: WorldOptions | undefined): BodyRules | null {
  if (!options?.solidBodies) return null;
  return { frontLooks: new Set(options.frontCarryLooks ?? []), frontCarry: options.frontCarry ?? FALLBACK_FRONT };
}

/** True when this entity blocks (and is blocked by) other bodies: a standing character or an item lying free. */
export function isSolidBody(e: Entity): boolean {
  if (!e.visible || e.bullet) return false;
  if (e.kind === 'character') return e.seatedIn === null;
  return e.kind === 'item' && !e.inHand && e.cargoSeq === undefined;
}

export function overlapsBox(a: Entity, b: Entity): boolean {
  return boxOverlap(a, b, 'x') > 1e-6 && boxOverlap(a, b, 'y') > 1e-6 && boxOverlap(a, b, 'z') > 1e-6;
}

/**
 * Where an item rides on its carrier: in front and low for the looks that hold it out front, otherwise just above
 * the top of the carrier's collision box (which is as tall as the figure that is drawn).
 */
export function solidCarryPosition(holder: Entity, item: Entity, rules: BodyRules): Vec3 {
  if (holder.look !== undefined && rules.frontLooks.has(holder.look)) {
    const feet = holder.pos.y - holder.size.y / 2;
    return {
      x: holder.pos.x + holder.facing.x * rules.frontCarry.reach,
      y: feet + rules.frontCarry.height + item.size.y / 2,
      z: holder.pos.z + holder.facing.z * rules.frontCarry.reach,
    };
  }
  const box = colliderBox(holder);
  return { x: holder.pos.x, y: box.pos.y + box.size.y / 2 + DROP_MARGIN + item.size.y / 2, z: holder.pos.z };
}

/**
 * A resting spot for an item set down by `c`: beside it first (so the way ahead stays open), then in front, behind and
 * further out, always clear of walls and of every other body. Null when nothing nearby is free.
 */
export function solidDropSpot(c: Entity, item: Entity, distance: number | undefined, blockers: readonly Entity[]): Vec3 | null {
  const box = colliderBox(c);
  const auto = Math.max(box.size.x, box.size.z) / 2 + Math.max(item.size.x, item.size.z) / 2 + DROP_MARGIN;
  const base = distance !== undefined && Number.isFinite(distance) && distance > 0 ? distance : auto;
  const y = c.pos.y - c.size.y / 2 + item.size.y / 2;
  const fx = c.facing.x;
  const fz = c.facing.z;
  const dirs: [number, number][] = [
    [-fz, fx],
    [fz, -fx],
    [fx, fz],
    [-fx, -fz],
    [fx - fz, fz + fx],
    [fx + fz, fz - fx],
    [-fx - fz, -fz + fx],
    [-fx + fz, -fz - fx],
  ];
  for (let ring = 0; ring < RINGS; ring++) {
    const d = base + ring * RING_STEP;
    for (const [dx, dz] of dirs) {
      const len = Math.hypot(dx, dz);
      if (len < 1e-6) continue;
      const spot = { x: c.pos.x + (dx / len) * d, y, z: c.pos.z + (dz / len) * d };
      const probe: Entity = { ...item, pos: spot };
      if (!blockers.some((b) => b !== item && overlapsBox(probe, b))) return spot;
    }
  }
  return null;
}
