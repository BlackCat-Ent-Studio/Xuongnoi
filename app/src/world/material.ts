import type { EntityKind, EntitySpec, Vec3 } from '../engine/types';
import { boxOverlap, colliderBox, isTurnedBody, orientedBox } from './collider';
import { footprintsOverlap, obbCorners } from './oriented-box';
import type { Pt } from './footprint-2d';
import { leverShares, shapeOf, supportPoint, type Shape } from './weighing';
import type { Entity } from './entity';

/**
 * Material of a body, in SI units. None of it changes how the game physics moves anything: it is what machines
 * (scales, grippers, joints, "Khiêng đồ" strength) read to answer real questions. Entities only carry a field when
 * it differs from the default, so old boards produce exactly the same entity views as before.
 */

/** Mass in kg when a node leaves "Khối lượng" at its default. */
export const DEFAULT_MASS_KG: Record<EntityKind, number> = { block: 10, item: 1, character: 60, vehicle: 1000, robot: 2 };
/** Friction coefficient of the surface by default. */
export const DEFAULT_MU = 0.5;
export const MAX_MASS_KG = 100000;
export const MAX_MU = 1.5;
export const MAX_CRUSH_LIMIT_N = 1e7;

/** What the world reports for a body: explicit values, else the defaults. */
export interface MaterialView {
  massKg: number;
  /** Surface friction coefficient. */
  mu: number;
  /** Largest squeeze (N) it survives; 0 = never breaks. */
  crushLimitN: number;
  damaged: boolean;
}

type MaterialFields = Partial<Pick<Entity, 'mass' | 'mu' | 'crushLimit'>>;

function clampNum(n: unknown, lo: number, hi: number): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : undefined;
}

/** The material fields of a new entity; empty for the defaults so nothing extra is carried. */
export function materialTuning(spec: EntitySpec): MaterialFields {
  const out: MaterialFields = {};
  const mass = clampNum(spec.mass, 0, MAX_MASS_KG);
  if (mass !== undefined && mass !== DEFAULT_MASS_KG[spec.kind]) out.mass = mass;
  const mu = clampNum(spec.mu, 0, MAX_MU);
  if (mu !== undefined && mu !== DEFAULT_MU) out.mu = mu;
  const crush = clampNum(spec.crushLimit, 0, MAX_CRUSH_LIMIT_N);
  if (crush !== undefined && crush > 0) out.crushLimit = crush;
  return out;
}

export function materialOf(e: Entity): MaterialView {
  return { massKg: e.mass ?? DEFAULT_MASS_KG[e.kind], mu: e.mu ?? DEFAULT_MU, crushLimitN: e.crushLimit ?? 0, damaged: e.damaged === true };
}

/** Squeeze force on a body: damaged once it exceeds the limit (never when the limit is 0). Returns true when it is damaged now. */
export function squeeze(e: Entity, forceN: number, direction?: Vec3): boolean {
  if (!e.damaged && typeof forceN === 'number' && Number.isFinite(forceN) && e.crushLimit !== undefined && forceN > e.crushLimit) {
    e.damaged = true;
    const axis = squeezeAxisOf(direction);
    if (axis) e.squeezeAxis = axis;
  }
  return e.damaged === true;
}

/** The horizontal axis a squeeze direction points along; null for no direction, a mostly vertical one or bad numbers (the body is then flattened in height). */
function squeezeAxisOf(d: Vec3 | undefined): 'x' | 'z' | null {
  if (!d || !Number.isFinite(d.x) || !Number.isFinite(d.y) || !Number.isFinite(d.z)) return null;
  const ax = Math.abs(d.x);
  const az = Math.abs(d.z);
  if (Math.abs(d.y) >= Math.max(ax, az)) return null;
  return ax >= az ? 'x' : 'z';
}

/** How far (m of game units) a bottom face may be from a top face and still count as resting on it. */
const REST_GAP = 0.05;

/**
 * A turned crate (lying on its side, tipped against something) counts as standing on `base` when the base's top surface holds it up:
 * its lowest corners (all within REST_GAP of its lowest point) are within REST_GAP of the highest point of the base, and the patch
 * those corners make overlaps the base's top patch by a positive area, seen from above. Where the centre sits does not matter:
 * as before, any overlap loads the base with the crate's whole mass; a crate that slid off, or hangs above, loads nothing.
 */
function restsTurned(top: Entity, base: Entity): boolean {
  const lowT = obbCorners(orientedBox(top));
  const highB = obbCorners(orientedBox(base));
  const bottom = Math.min(...lowT.map((c) => c.y));
  const ceiling = Math.max(...highB.map((c) => c.y));
  if (Math.abs(bottom - ceiling) > REST_GAP) return false;
  const feet = lowT.filter((c) => c.y <= bottom + REST_GAP);
  const patch = highB.filter((c) => c.y >= ceiling - REST_GAP);
  return footprintsOverlap(feet, patch);
}

/** True when `top` stands on `base`: its bottom meets base's top and the footprints overlap. */
function rests(top: Entity, base: Entity): boolean {
  if (isTurnedBody(top) || isTurnedBody(base)) return restsTurned(top, base);
  const t = colliderBox(top);
  const b = colliderBox(base);
  if (Math.abs(t.pos.y - t.size.y / 2 - (b.pos.y + b.size.y / 2)) > REST_GAP) return false;
  return boxOverlap(top, base, 'x') > 0 && boxOverlap(top, base, 'z') > 0;
}

const massKgOf = (e: Entity): number => e.mass ?? DEFAULT_MASS_KG[e.kind];

/** A loose crate under the rigid-body engine (real physics on) that nothing carries: the only kind that is weighed by its share. */
const isFreeCrate = (e: Entity): boolean => e.rigid === true && e.kind === 'item' && e.heldBy === null && !e.inHand && !e.bullet;

const NO_PARTS: ReadonlySet<Entity> = new Set();

/**
 * Total mass (kg) standing on `target`, counting everything stacked on those bodies in turn. Hidden bodies and tools in hand do not count.
 * With real physics on, a loose crate loads each thing it rests on only with its share (see `massOnShared`); without it, every body that
 * overlaps counts whole.
 *
 * `parts` are the pieces of a machine bolted to the target (a joint hub, a link and its solid cover, a piston, a hand): they are part of
 * the target, so they never weigh on it, wherever they sit. What rests on one of them rests on the target, and so does a crate that a
 * hand among them holds.
 */
export function massOn(list: readonly Entity[], target: Entity, parts: ReadonlySet<Entity> = NO_PARTS): number {
  return list.some(isFreeCrate) ? massOnShared(list, target, parts) : massOnWhole(list, target, parts);
}

/**
 * Real physics on. Every loose crate pushes down on the supports under it (blocks, other crates, robots) and the pushes add up to its
 * weight plus what stands on it: the supports' pushes balance about the crate's centre of mass (lever rule, see `leverShares`). A crate
 * half over the scale and half over a block of the same height gives each half; a crate lying across the scale edge gives the scale
 * the part its centre of mass is nearer to; crates stacked on a crate pass their weight on through it. Other bodies (people, robots,
 * blocks) are shared equally between the things they stand on.
 */
function massOnShared(list: readonly Entity[], target: Entity, parts: ReadonlySet<Entity>): number {
  const shapes = new Map<Entity, Shape>();
  const shapeFor = (e: Entity): Shape => {
    let s = shapes.get(e);
    if (!s) {
      s = shapeOf(orientedBox(e));
      shapes.set(e, s);
    }
    return s;
  };
  /** A body something can stand on, and a body that weighs on what it stands on (the pieces bolted to the target bear, but never weigh). */
  const bears = (e: Entity): boolean => e.visible && !e.inHand && !e.zone;
  const counts = (e: Entity): boolean => bears(e) && !parts.has(e);
  /** Node ids of the bolted pieces: a crate one of them grips hangs on the target with its whole weight. */
  const hands = new Set<string>();
  for (const p of parts) hands.add(p.ownerNodeId);
  const gripped = (e: Entity): boolean => e.grippedBy !== undefined && hands.has(e.grippedBy);
  /** Where `base` pushes up on `top`: for a free crate the patch middle, else any overlap that old rule says is standing on it. */
  const holds = (top: Entity, base: Entity): Pt | null => {
    if (isFreeCrate(top)) return supportPoint(shapeFor(top), shapeFor(base));
    return rests(top, base) ? { x: top.pos.x, z: top.pos.z } : null;
  };

  // Everything that loads the target, directly or through other bodies.
  const above: Entity[] = [];
  const seen = new Set<Entity>([target, ...parts]);
  const queue: Entity[] = [target, ...parts];
  if (hands.size > 0) {
    for (const e of list) {
      if (!counts(e) || !gripped(e)) continue;
      seen.add(e);
      above.push(e);
      queue.push(e);
    }
  }
  while (queue.length > 0) {
    const base = queue.pop()!;
    for (const e of list) {
      if (seen.has(e) || !counts(e) || !holds(e, base)) continue;
      seen.add(e);
      above.push(e);
      queue.push(e);
    }
  }
  // Highest first: a body is passed everything above it before it passes its own load down.
  const height = (e: Entity): number => shapeFor(e).obb.centre.y;
  above.sort((a, b) => height(b) - height(a) || (a.id < b.id ? -1 : 1));

  const carried = new Map<Entity, { kg: number; x: number; z: number }>();
  let total = 0;
  for (const e of above) {
    const got = carried.get(e);
    const own = shapeFor(e).obb.centre;
    const kg = massKgOf(e) + (got?.kg ?? 0);
    // Centre of mass of the crate together with what stands on it.
    const centre = { x: (massKgOf(e) * own.x + (got?.x ?? 0)) / kg, z: (massKgOf(e) * own.z + (got?.z ?? 0)) / kg };
    if (gripped(e)) {
      total += kg;
      continue;
    }
    const bases: Entity[] = [];
    const spots: Pt[] = [];
    for (const b of list) {
      if (b === e || !bears(b)) continue;
      const at = holds(e, b);
      if (!at) continue;
      bases.push(b);
      spots.push(at);
    }
    const shares = isFreeCrate(e) ? leverShares(spots, centre, kg) : bases.map(() => kg / Math.max(1, bases.length));
    bases.forEach((b, k) => {
      const f = shares[k]!;
      if (b === target || parts.has(b)) total += f;
      const c = carried.get(b) ?? { kg: 0, x: 0, z: 0 };
      c.kg += f;
      c.x += f * spots[k]!.x;
      c.z += f * spots[k]!.z;
      carried.set(b, c);
    });
  }
  return total;
}

/** The old rule, for worlds without rigid crates: any overlap counts the whole mass. */
function massOnWhole(list: readonly Entity[], target: Entity, parts: ReadonlySet<Entity>): number {
  const seen = new Set<string>([target.id]);
  const queue: Entity[] = [target];
  for (const p of parts) {
    seen.add(p.id);
    queue.push(p);
  }
  let total = 0;
  while (queue.length > 0) {
    const base = queue.pop()!;
    for (const e of list) {
      if (seen.has(e.id) || !e.visible || e.inHand || e.zone) continue;
      if (!rests(e, base)) continue;
      seen.add(e.id);
      total += e.mass ?? DEFAULT_MASS_KG[e.kind];
      queue.push(e);
    }
  }
  return total;
}

/** Mass (kg) of what a character holds above the head and in the hand. */
export function massHeld(byId: ReadonlyMap<string, Entity>, holder: Entity): number {
  let total = 0;
  for (const id of [holder.holding, holder.handHolding]) {
    const it = id !== null ? byId.get(id) : undefined;
    if (it) total += it.mass ?? DEFAULT_MASS_KG[it.kind];
  }
  return total;
}
