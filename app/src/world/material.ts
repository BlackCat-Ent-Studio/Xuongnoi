import type { EntityKind, EntitySpec, Vec3 } from '../engine/types';
import { boxOverlap, chassisOutline, chassisReach, colliderBox, isTurnedBody, orientedBox, outlinePair, type Box } from './collider';
import { footprintsOverlap, obbCorners, type Obb } from './oriented-box';
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
function restsTurned(top: Obb, base: Obb): boolean {
  const lowT = obbCorners(top);
  const highB = obbCorners(base);
  const bottom = Math.min(...lowT.map((c) => c.y));
  const ceiling = Math.max(...highB.map((c) => c.y));
  if (Math.abs(bottom - ceiling) > REST_GAP) return false;
  const feet = lowT.filter((c) => c.y <= bottom + REST_GAP);
  const patch = highB.filter((c) => c.y >= ceiling - REST_GAP);
  return footprintsOverlap(feet, patch);
}

/** True when `top` stands on `base`: its bottom meets base's top and the footprints overlap. */
function rests(top: Entity, base: Entity): boolean {
  // A chassis with a real outline bears, and stands on, other bodies by that outline (blocks meet its upright square).
  const pair = outlinePair(top, base);
  if (pair) return restsTurned(pair[0], pair[1]);
  if (isTurnedBody(top) || isTurnedBody(base)) return restsTurned(orientedBox(top), orientedBox(base));
  const t = colliderBox(top);
  const b = colliderBox(base);
  if (Math.abs(t.pos.y - t.size.y / 2 - (b.pos.y + b.size.y / 2)) > REST_GAP) return false;
  return boxOverlap(top, base, 'x') > 0 && boxOverlap(top, base, 'z') > 0;
}

const massKgOf = (e: Entity): number => e.mass ?? DEFAULT_MASS_KG[e.kind];

/** A loose crate under the rigid-body engine (real physics on) that nothing carries: the only kind that is weighed by its share. */
const isFreeCrate = (e: Entity): boolean => e.rigid === true && e.kind === 'item' && e.heldBy === null && !e.inHand && !e.bullet;

const NO_PARTS: ReadonlySet<Entity> = new Set();

/** A support at least this wide and deep (m) has a plain rectangle as its top, with sides the outline maths handles exactly. */
const MIN_SIDE = 1e-3;
/** Further than this (m) beyond the rim of an upright support's top, a crate is not on it. The outline maths forgives a millionth of that. */
const RIM_SLACK = 1e-3;
/** Slack (m) for a turned support, whose top outline can be any small shape: its sides are longer than 1e-9 m, which forgives up to 1 m. */
const TURNED_SLACK = 1;

/**
 * What weighing reads of one body again and again, worked out once: whether it is a loose crate, whether it is turned (a
 * chassis with a real outline counts as turned: other bodies rest on that outline), its collision box, and how far its real
 * shape reaches from its position however it is turned.
 */
interface Fact {
  e: Entity;
  free: boolean;
  turned: boolean;
  box: Box;
  reach: number;
  /** A chassis with a real outline: that outline (what other bodies rest on); null for every other body. */
  outline: Obb | null;
  /**
   * A box on the ground plane such that two bodies can only rest on one another when their boxes meet, or `everywhere` is set
   * for one of them. It follows from the tests `holds` rules pairs out with:
   *  - a loose crate on an upright support at least MIN_SIDE wide and deep: the crate's position is within its reach plus
   *    RIM_SLACK of the support's rectangle; on a turned loose crate: within its reach plus three of the other's plus TURNED_SLACK.
   *    So a loose crate takes three reaches plus TURNED_SLACK round its position, an upright body its rectangle plus RIM_SLACK;
   *  - two upright bodies rest only when their rectangles overlap;
   *  - an upright body at least MIN_SIDE wide rests on a turned one only when its rectangle comes within a billionth of the
   *    other's highest corners along x and along z (its own corners make x and z two of the axes `footprintsOverlap` tries),
   *    and those corners lie within the turned body's reach of its position;
   *  - a chassis with a real outline (not a loose crate) takes √2 reaches plus RIM_SLACK round its position; its reach holds
   *    both its outline and its collision box. A loose crate rests on it only within its own reach plus RIM_SLACK of the
   *    outline's rectangle (`tooFarToHold`), so within the two reaches plus RIM_SLACK of its position. With a block it is an
   *    upright body whose rectangle lies within one reach. With any other body the two rest only when `footprintsOverlap`
   *    finds no gap between two sets of corners, each within its body's reach of its position; the axes it tries include,
   *    for a set with two different corners, the line through them and the line across it, and along both the sets come
   *    within a billionth of each other, so the positions are at most √2 times the two reaches apart.
   * Every other body (turned without being a loose crate or such a chassis, upright and thinner than MIN_SIDE, or with a
   * number that is not finite) is `everywhere`: no test rules it out, so it is always asked.
   */
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  everywhere: boolean;
}

function readFact(f: Fact): void {
  const e = f.e;
  const b = colliderBox(e);
  f.free = isFreeCrate(e);
  f.outline = chassisOutline(e);
  const chassis = f.outline !== null;
  f.turned = chassis || isTurnedBody(e);
  f.box = b;
  f.reach = Math.max(chassisReach(e), Math.hypot(b.pos.x - e.pos.x, b.pos.y - e.pos.y, b.pos.z - e.pos.z) + Math.hypot(b.size.x, b.size.y, b.size.z) / 2);
  const halfX = Math.abs(b.size.x) / 2;
  const halfZ = Math.abs(b.size.z) / 2;
  if (f.free || chassis) {
    const round = f.free ? 3 * f.reach + TURNED_SLACK : Math.SQRT2 * f.reach + RIM_SLACK;
    f.minX = e.pos.x - round;
    f.maxX = e.pos.x + round;
    f.minZ = e.pos.z - round;
    f.maxZ = e.pos.z + round;
  } else {
    f.minX = b.pos.x - halfX - RIM_SLACK;
    f.maxX = b.pos.x + halfX + RIM_SLACK;
    f.minZ = b.pos.z - halfZ - RIM_SLACK;
    f.maxZ = b.pos.z + halfZ + RIM_SLACK;
  }
  // A turned body is only ruled out as a loose crate or a chassis; an upright one only when it is wide and deep enough.
  const plain = f.turned ? f.free || chassis : halfX * 2 >= MIN_SIDE && halfZ * 2 >= MIN_SIDE;
  f.everywhere = !plain || !(Math.abs(f.minX) + Math.abs(f.maxX) + Math.abs(f.minZ) + Math.abs(f.maxZ) + Math.abs(e.pos.y) + Math.abs(b.pos.y) + Math.abs(b.size.y) + f.reach < Infinity);
}

function factOf(e: Entity): Fact {
  const f: Fact = { e, free: false, turned: false, box: e, reach: 0, outline: null, minX: 0, maxX: 0, minZ: 0, maxZ: 0, everywhere: true };
  readFact(f);
  return f;
}

/** A body something can stand on (and, unless it is bolted to the target, one that weighs on what it stands on). */
const bears = (e: Entity): boolean => e.visible && !e.inHand && !e.zone;

/** A body that may be somewhere else at the next weighing of the same tick: a chassis drives and shoves chassis and plain items. */
const moves = (e: Entity): boolean => e.kind === 'robot' || (e.kind === 'item' && e.rigid !== true);

/**
 * The bodies of a world sorted out for weighing, so that several weighings in a row (every chassis is weighed on every tick)
 * do not each read every body again. It may be passed to `massOn` for as long as nothing but chassis and plain (not rigid)
 * items moves and no body appears, disappears, is taken up or let go: those few are read again at every weighing, the rest
 * is kept. Without one, `massOn` reads everything itself.
 */
export interface WeighScene {
  /** Every body that bears, in the order of the entity list. */
  facts: Fact[];
  byEntity: Map<Entity, Fact>;
  /** The facts of the bodies that may move in between. */
  moving: Fact[];
  shapes: Map<Entity, Shape>;
  anyFreeCrate: boolean;
}

export function weighSceneOf(list: readonly Entity[]): WeighScene {
  const scene: WeighScene = { facts: [], byEntity: new Map(), moving: [], shapes: new Map(), anyFreeCrate: list.some(isFreeCrate) };
  // Without a loose crate the old rule weighs, and it reads the list itself.
  if (!scene.anyFreeCrate) return scene;
  for (const e of list) {
    if (!bears(e)) continue;
    const f = factOf(e);
    scene.facts.push(f);
    scene.byEntity.set(e, f);
    if (moves(e)) scene.moving.push(f);
  }
  return scene;
}

/**
 * True only when the loose crate `crate` is so far to the side of `base` that it cannot rest on it; then `supportPoint` need not be
 * asked (it would work out both outlines to say no). Never true for a pair that could rest: a wrong "far" would change a weight.
 *
 * A crate rests on a support where its underside, seen from above, shares a patch with the support's top. The underside lies
 * within the crate's reach of its position. An upright support (not turned, at least MIN_SIDE wide and deep) has its
 * collision box's rectangle as top, so a crate whose position is further than its reach plus RIM_SLACK outside that rectangle,
 * along x or along z, shares nothing with it. A turned support's top lies within its own reach of its position; the outline
 * maths may take a point for inside up to (1e-9 / side length) beyond a side and up to two diameters beyond a corner, hence
 * three reaches and TURNED_SLACK. With a number that is not finite anywhere in the pair, the outline maths decides alone.
 *
 * A chassis with a real outline is the first kind of support turned about the vertical: its top is the outline's rectangle,
 * and what the outline maths forgives depends on the length of a side, not on which way it points. So the same test holds
 * along the chassis's own length and width.
 */
function tooFarToHold(crate: Fact, base: Fact): boolean {
  const c = crate.e.pos;
  const o = base.outline;
  if (o) {
    if (!(o.half.x * 2 >= MIN_SIDE) || !(o.half.z * 2 >= MIN_SIDE)) return false;
    const dx = c.x - o.centre.x;
    const dz = c.z - o.centre.z;
    const along = Math.abs(dx * o.axes[0].x + dz * o.axes[0].z);
    const across = Math.abs(dx * o.axes[2].x + dz * o.axes[2].z);
    if (!(along + across + crate.reach + o.half.x + o.half.z + Math.abs(c.y) + Math.abs(o.centre.y) + o.half.y < Infinity)) return false;
    return along > crate.reach + o.half.x + RIM_SLACK || across > crate.reach + o.half.z + RIM_SLACK;
  }
  if (base.turned) {
    const p = base.e.pos;
    const far = Math.hypot(c.x - p.x, c.z - p.z);
    const limit = crate.reach + 3 * base.reach + TURNED_SLACK;
    return far + limit + Math.abs(c.y) + Math.abs(p.y) < Infinity && far > limit;
  }
  const b = base.box;
  const halfX = Math.abs(b.size.x) / 2;
  const halfZ = Math.abs(b.size.z) / 2;
  if (!(halfX * 2 >= MIN_SIDE) || !(halfZ * 2 >= MIN_SIDE)) return false;
  const dx = Math.abs(c.x - b.pos.x);
  const dz = Math.abs(c.z - b.pos.z);
  if (!(dx + dz + crate.reach + halfX + halfZ + Math.abs(c.y) + Math.abs(b.pos.y) + Math.abs(b.size.y) < Infinity)) return false;
  return dx > crate.reach + halfX + RIM_SLACK || dz > crate.reach + halfZ + RIM_SLACK;
}

/**
 * Total mass (kg) standing on `target`, counting everything stacked on those bodies in turn. Hidden bodies and tools in hand do not count.
 * With real physics on, a loose crate loads each thing it rests on only with its share (see `massOnShared`); without it, every body that
 * overlaps counts whole.
 *
 * `parts` are the pieces of a machine bolted to the target (a joint hub, a link and its solid cover, a piston, a hand): they are part of
 * the target, so they never weigh on it, wherever they sit. What rests on one of them rests on the target, and so does a crate that a
 * hand among them holds.
 *
 * `scene` saves reading every body again when many bodies are weighed in a row (see `WeighScene` for when it may be passed).
 *
 * `machineOf` tells, for a piece bolted to a machine, the body that machine stands on (nothing for any other body). A bolted
 * piece is held up by its machine: it can weigh on that body and on the other pieces of the same machine, never on a body it
 * only hangs over (the fingers of an arm lowered round a crate do not weigh on the crate, or on the robot under it).
 */
export type MachineOf = (e: Entity) => Entity | undefined;

/** False when `top` is a piece of a machine that `base` is no part of: it then cannot rest on `base`, however near it hangs. */
function mayRestOn(top: Entity, base: Entity, machineOf: MachineOf | undefined): boolean {
  const machine = machineOf?.(top);
  return machine === undefined || base === machine || machineOf!(base) === machine;
}

export function massOn(list: readonly Entity[], target: Entity, parts: ReadonlySet<Entity> = NO_PARTS, scene?: WeighScene, machineOf?: MachineOf): number {
  if (!(scene ? scene.anyFreeCrate : list.some(isFreeCrate))) return massOnWhole(list, target, parts, machineOf);
  if (!scene) return massOnShared(weighSceneOf(list), target, parts, machineOf);
  for (const f of scene.moving) {
    readFact(f);
    scene.shapes.delete(f.e);
  }
  // A target or a piece that does not bear has no fact in the scene; nothing is kept of it either.
  scene.shapes.delete(target);
  for (const p of parts) scene.shapes.delete(p);
  return massOnShared(scene, target, parts, machineOf);
}

/**
 * Real physics on. Every loose crate pushes down on the supports under it (blocks, other crates, robots) and the pushes add up to its
 * weight plus what stands on it: the supports' pushes balance about the crate's centre of mass (lever rule, see `leverShares`). A crate
 * half over the scale and half over a block of the same height gives each half; a crate lying across the scale edge gives the scale
 * the part its centre of mass is nearer to; crates stacked on a crate pass their weight on through it. Other bodies (people, robots,
 * blocks) are shared equally between the things they stand on.
 *
 * Every body is held against every support of the pile, so a pair is first ruled out by a few numbers where that is certain
 * (`tooFarToHold`, and the height tests in `holds`, each the very test the full rule would start with); only the pairs left are
 * asked in full. The bodies are gone through in the order of the entity list, which the shares depend on. And only the bodies
 * round the pile are gone through at all: those whose ground box (see `Fact`) meets the box round the whole pile so far.
 */
function massOnShared(scene: WeighScene, target: Entity, parts: ReadonlySet<Entity>, machineOf?: MachineOf): number {
  const { facts, shapes } = scene;
  const shapeFor = (e: Entity): Shape => {
    let s = shapes.get(e);
    if (!s) {
      s = shapeOf(scene.byEntity.get(e)?.outline ?? chassisOutline(e) ?? orientedBox(e));
      shapes.set(e, s);
    }
    return s;
  };
  /** The target and its pieces need not bear (a hidden piece), so they may have no fact yet. */
  const factFor = (e: Entity): Fact => scene.byEntity.get(e) ?? factOf(e);
  /** Node ids of the bolted pieces: a crate one of them grips hangs on the target with its whole weight. */
  const hands = new Set<string>();
  for (const p of parts) hands.add(p.ownerNodeId);
  const gripped = (e: Entity): boolean => e.grippedBy !== undefined && hands.has(e.grippedBy);
  /** Where `base` pushes up on `top`: for a free crate the patch middle, else any overlap that old rule says is standing on it. */
  const holds = (top: Fact, base: Fact): Pt | null => {
    if (top.free) return tooFarToHold(top, base) ? null : supportPoint(shapeFor(top.e), shapeFor(base.e));
    if (!top.turned) {
      const t = top.box;
      if (!base.turned) {
        // Two upright bodies: the height test `rests` starts with, on the same numbers.
        const b = base.box;
        if (Math.abs(t.pos.y - t.size.y / 2 - (b.pos.y + b.size.y / 2)) > REST_GAP) return null;
      } else if (Math.hypot(t.size.x, t.size.y, t.size.z) < Infinity) {
        // An upright body on a turned support: `restsTurned` starts by holding the lowest corner of the body against the
        // highest point of the support. An upright box's lowest corner is its collision box's middle less half its height, to
        // the last bit (the corner sum only adds zeros to it; with a size that is not finite it is not a number, and that is
        // left to `restsTurned`). The millionth of slack leaves anything near the limit to `restsTurned` as well.
        if (Math.abs(t.pos.y - Math.abs(t.size.y) / 2 - shapeFor(base.e).highest) > REST_GAP + 1e-6) return null;
      }
    }
    return rests(top.e, base.e) ? { x: top.e.pos.x, z: top.e.pos.z } : null;
  };

  // The box round the pile (the target, its pieces and all that loads them so far) and the bodies whose own box meets it, in
  // the order of the list. Whatever can rest on a body of the pile, or bear one, is among them.
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  let everywhere = false;
  let near: readonly Fact[] = [];
  let grown = false;
  const join = (f: Fact): void => {
    if (f.everywhere) {
      grown ||= !everywhere;
      everywhere = true;
      return;
    }
    if (f.minX >= minX && f.maxX <= maxX && f.minZ >= minZ && f.maxZ <= maxZ) return;
    minX = Math.min(minX, f.minX);
    maxX = Math.max(maxX, f.maxX);
    minZ = Math.min(minZ, f.minZ);
    maxZ = Math.max(maxZ, f.maxZ);
    grown = true;
  };
  const lookRound = (): void => {
    if (!grown) return;
    grown = false;
    near = everywhere ? facts : facts.filter((f) => f.everywhere || !(f.minX > maxX || f.maxX < minX || f.minZ > maxZ || f.maxZ < minZ));
  };

  // Everything that loads the target, directly or through other bodies.
  const above: Fact[] = [];
  const seen = new Set<Entity>([target, ...parts]);
  const queue: Fact[] = [factFor(target), ...[...parts].map(factFor)];
  queue.forEach(join);
  if (hands.size > 0) {
    for (const f of facts) {
      if (parts.has(f.e) || !gripped(f.e)) continue;
      seen.add(f.e);
      above.push(f);
      queue.push(f);
      join(f);
    }
  }
  while (queue.length > 0) {
    const base = queue.pop()!;
    // `base` joined the pile before it was queued, so the bodies round the pile hold all that can rest on it.
    lookRound();
    for (const f of near) {
      if (seen.has(f.e) || parts.has(f.e) || !mayRestOn(f.e, base.e, machineOf) || !holds(f, base)) continue;
      seen.add(f.e);
      above.push(f);
      queue.push(f);
      join(f);
    }
  }
  lookRound();
  // Highest first: a body is passed everything above it before it passes its own load down.
  const height = (f: Fact): number => shapeFor(f.e).obb.centre.y;
  above.sort((a, b) => height(b) - height(a) || (a.e.id < b.e.id ? -1 : 1));

  const carried = new Map<Entity, { kg: number; x: number; z: number }>();
  let total = 0;
  for (const top of above) {
    const e = top.e;
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
    for (const f of near) {
      if (f === top || !mayRestOn(e, f.e, machineOf)) continue;
      const at = holds(top, f);
      if (!at) continue;
      bases.push(f.e);
      spots.push(at);
    }
    const shares = top.free ? leverShares(spots, centre, kg) : bases.map(() => kg / Math.max(1, bases.length));
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
function massOnWhole(list: readonly Entity[], target: Entity, parts: ReadonlySet<Entity>, machineOf?: MachineOf): number {
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
      if (!mayRestOn(e, base, machineOf) || !rests(e, base)) continue;
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
