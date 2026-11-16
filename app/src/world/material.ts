import type { EntityKind, EntitySpec } from '../engine/types';
import { boxOverlap, colliderBox } from './collider';
import type { Entity } from './entity';

/**
 * Material of a body, in SI units. None of it changes how the game physics moves anything: it is what machines
 * (scales, grippers, joints, "Khiêng đồ" strength) read to answer real questions. Entities only carry a field when
 * it differs from the default, so old boards produce exactly the same entity views as before.
 */

/** Mass in kg when a node leaves "Khối lượng" at its default. */
export const DEFAULT_MASS_KG: Record<EntityKind, number> = { block: 10, item: 1, character: 60, vehicle: 1000 };
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
export function squeeze(e: Entity, forceN: number): boolean {
  if (!e.damaged && typeof forceN === 'number' && Number.isFinite(forceN) && e.crushLimit !== undefined && forceN > e.crushLimit) e.damaged = true;
  return e.damaged === true;
}

/** How far (m of game units) a bottom face may be from a top face and still count as resting on it. */
const REST_GAP = 0.05;

/** True when `top` stands on `base`: its bottom meets base's top and the footprints overlap. */
function rests(top: Entity, base: Entity): boolean {
  const t = colliderBox(top);
  const b = colliderBox(base);
  if (Math.abs(t.pos.y - t.size.y / 2 - (b.pos.y + b.size.y / 2)) > REST_GAP) return false;
  return boxOverlap(top, base, 'x') > 0 && boxOverlap(top, base, 'z') > 0;
}

/** Total mass (kg) standing on `target`, counting everything stacked on those bodies in turn. Hidden bodies and tools in hand do not count. */
export function massOn(list: readonly Entity[], target: Entity): number {
  const seen = new Set<string>([target.id]);
  const queue: Entity[] = [target];
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
