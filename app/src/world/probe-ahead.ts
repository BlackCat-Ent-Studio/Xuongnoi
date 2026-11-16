import type { EntityId, ProbeAim, ViewMode } from '../engine/types';
import { colliderBox, type Box } from './collider';
import type { Entity } from './entity';
import { groundHeading, turnDirection } from './heading';
import { sameTrain } from './vehicle-train';

/** Ignore things this far above or below the prober's body (the floor it drives on, roofs high overhead). */
const VERTICAL_MARGIN = 0.1;
/** Share of the prober's width that counts as "in its lane". */
const LANE_SHARE = 0.9;
/** A box edge closer to the lane edge than this only brushes it and does not count. */
const LANE_EPS = 1e-9;

type Hit = { id: EntityId; distance: number };

/** The collision box of something the probe can run into, or null when it is not an obstacle for `self`. */
function obstacleBox(self: Entity, e: Entity): Box | null {
  if (e === self || !e.visible) return null;
  if (sameTrain(self, e)) return null;
  if (e.kind === 'block') {
    if (!e.solid || e.zone) return null;
  } else if (e.kind === 'vehicle' || e.kind === 'robot') {
    // a vehicle's own driver is not an obstacle and neither is cargo on its bed
  } else if (e.kind === 'character') {
    if (e.seatedIn !== null || e.combat?.dead) return null;
  } else {
    return null;
  }
  return colliderBox(e);
}

/**
 * Nearest visible solid block, vehicle, robot or character in front of `self` within `reach`.
 * A robot chassis, or a sensor mounted off the middle of the body or turned away from the nose (`aim`), is probed by
 * `probeBeam`, which is exact at any heading. Everything else keeps the original facing test (`probeAlongFacing`).
 */
export function probeAhead(entities: readonly Entity[], self: Entity, reach: number, aim?: ProbeAim, mode: ViewMode = '3d'): Hit | null {
  const mounted = aim !== undefined && ((aim.side ?? 0) !== 0 || (aim.forward ?? 0) !== 0 || (aim.angle ?? 0) !== 0 || (aim.beam ?? 0) > 0);
  if (self.kind !== 'robot' && !mounted) return probeAlongFacing(entities, self, reach);
  return probeBeam(entities, self, reach, aim ?? {}, mode);
}

/**
 * Works on projections of the boxes onto the facing direction and its sideways, so it is exact for the four straight
 * headings and a little generous on diagonals (boxes are axis-aligned). Something beside or behind never counts.
 */
function probeAlongFacing(entities: readonly Entity[], self: Entity, reach: number): Hit | null {
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

  let best: Hit | null = null;
  for (const e of entities) {
    const eb = obstacleBox(self, e);
    if (!eb) continue;
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

interface Pt {
  /** Distance along the look direction from the sensor. */
  a: number;
  /** Distance to the right of the look direction. */
  l: number;
}

/** Keeps the part of a convex polygon where `side(p) >= 0` (one Sutherland-Hodgman step). */
function clipPolygon(poly: readonly Pt[], side: (p: Pt) => number): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const cur = poly[i]!;
    const nxt = poly[(i + 1) % poly.length]!;
    const dc = side(cur);
    const dn = side(nxt);
    if (dc >= 0) out.push(cur);
    if (dc >= 0 !== dn >= 0) {
      const t = dc / (dc - dn);
      out.push({ a: cur.a + (nxt.a - cur.a) * t, l: cur.l + (nxt.l - cur.l) * t });
    }
  }
  return out;
}

/** How far a ray from `o` along `u` runs inside the box before it leaves it (0 when `o` is outside). */
function exitDistance(box: Box, o: { x: number; z: number }, u: { x: number; z: number }): number {
  let t = Infinity;
  if (u.x > 1e-9) t = Math.min(t, (box.pos.x + box.size.x / 2 - o.x) / u.x);
  else if (u.x < -1e-9) t = Math.min(t, (box.pos.x - box.size.x / 2 - o.x) / u.x);
  if (u.z > 1e-9) t = Math.min(t, (box.pos.z + box.size.z / 2 - o.z) / u.z);
  else if (u.z < -1e-9) t = Math.min(t, (box.pos.z - box.size.z / 2 - o.z) / u.z);
  return Number.isFinite(t) ? Math.max(0, t) : 0;
}

/**
 * A beam from a point on the body (`aim.side` / `aim.forward` off its middle) along the nose turned by `aim.angle`, as wide
 * as the body or `aim.beam`. Exact for any heading: each obstacle box is cut to the beam and the nearest cut point counts.
 * The gap is measured from where the beam leaves the sensor's own collision box, so it is 0 when the body touches the obstacle.
 */
function probeBeam(entities: readonly Entity[], self: Entity, reach: number, aim: ProbeAim, mode: ViewMode): Hit | null {
  if (!(reach >= 0)) return null;
  const flat = mode === '2d-side';
  const h = groundHeading(self);
  const nose = flat ? { x: h.x < 0 ? -1 : 1, z: 0 } : h;
  const right = { x: -nose.z, z: nose.x };
  const sb = colliderBox(self);
  const side = flat ? 0 : (aim.side ?? 0);
  const forward = aim.forward ?? 0;
  const origin = { x: sb.pos.x + nose.x * forward + right.x * side, z: sb.pos.z + nose.z * forward + right.z * side };
  const u = flat ? nose : turnDirection(nose, ((aim.angle ?? 0) * Math.PI) / 180);
  const pz = { x: -u.z, z: u.x };

  const bodyWidth = self.robot ? self.robot.spec.width : Math.abs(pz.x) * sb.size.x + Math.abs(pz.z) * sb.size.z;
  const half = (aim.beam ?? 0) > 0 ? (aim.beam as number) / 2 : (bodyWidth / 2) * LANE_SHARE;
  const start = exitDistance(sb, origin, u);
  const selfBottom = sb.pos.y - sb.size.y / 2 + VERTICAL_MARGIN;
  const selfTop = sb.pos.y + sb.size.y / 2 - VERTICAL_MARGIN;

  let best: Hit | null = null;
  for (const e of entities) {
    const eb = obstacleBox(self, e);
    if (!eb) continue;
    if (eb.pos.y + eb.size.y / 2 <= selfBottom || eb.pos.y - eb.size.y / 2 >= selfTop) continue;
    const hx = eb.size.x / 2;
    const hz = flat ? 0 : eb.size.z / 2;
    const corners: Pt[] = [
      [-hx, -hz],
      [hx, -hz],
      [hx, hz],
      [-hx, hz],
    ].map(([cx, cz]) => {
      const dx = eb.pos.x + cx! - origin.x;
      const dz = eb.pos.z + cz! - origin.z;
      return { a: dx * u.x + dz * u.z, l: dx * pz.x + dz * pz.z };
    });
    if (flat) {
      // The side view has no depth: the lane is the whole line, so only the span along the look direction matters.
      const a = corners.map((c) => c.a);
      if (Math.max(...a) <= 0) continue;
      const gap = Math.max(0, Math.min(...a) - start);
      if (gap <= reach && (!best || gap < best.distance)) best = { id: e.id, distance: gap };
      continue;
    }
    const lats = corners.map((c) => c.l);
    if (Math.min(...lats) >= half - LANE_EPS || Math.max(...lats) <= -half + LANE_EPS) continue;
    const cut = clipPolygon(clipPolygon(corners, (p) => half - p.l), (p) => p.l + half);
    if (cut.length === 0) continue;
    const as = cut.map((p) => p.a);
    if (Math.max(...as) <= 0) continue;
    const gap = Math.max(0, Math.min(...as) - start);
    if (gap > reach) continue;
    if (!best || gap < best.distance) best = { id: e.id, distance: gap };
  }
  return best;
}
