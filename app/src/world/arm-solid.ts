import type { Vec3 } from '../engine/types';
import { dirOf, lateralOf, localToWorld, normalOf, type Frame } from './arm-kinematics';
import { loadLimitedAdvance, planPush, shiftPushBody, type Box, type PushBody } from './linear-actuator';
import { torque } from './mechanics';
import { obbOf, obbBounds, quatFromAxes, type Obb } from './oriented-box';

/**
 * Solid arm pieces (pure maths, no world access). A link is a chain of cubes laid along its length and a joint is one
 * cube at its hub; both are axis-aligned boxes like every other solid in the world, so characters, robots, vehicles and
 * loose items collide with them through the usual rules.
 *
 * A joint turning is a push: every cube beyond it moves along a short arc, which is taken as the straight step from its
 * old place to its new one (the step is a fraction of a degree per tick). Each cube pushes what it meets with the push
 * model of the piston (`planPush`: friction of every pushed body, lifting adds weight, a solid stops it). The force a
 * cube pushes with acts at its distance from the joint axis, so the joint needs   τ = Σ F · r   on top of the torque
 * that holds the arm up. If that is more than the servo has, or a solid is in the way, the joint does not make the step.
 */

/** Angle steps tried when a solid cuts a step short (each retry scales the step down to what the last try allowed). */
const RETRIES = 6;
/** Moves shorter than this are not worth planning (m). */
const TINY = 1e-9;
/** Rounding slack for "the whole step fits". */
const FULL = 1 - 1e-9;

/** Axis-aligned cubes covering a link of `length` and `thickness` that starts at `start` and points along it. */
export function linkCubes(start: Frame, length: number, thickness: number): Box[] {
  const t = Math.max(0.01, thickness);
  const size = { x: t, y: t, z: t };
  if (length <= t) return [{ pos: localToWorld(start, { x: length / 2, y: 0, z: 0 }), size }];
  const span = length - t;
  const n = Math.ceil(span / t - 1e-9) + 1;
  const step = n > 1 ? span / (n - 1) : 0;
  const out: Box[] = [];
  for (let k = 0; k < n; k++) out.push({ pos: localToWorld(start, { x: t / 2 + k * step, y: 0, z: 0 }), size });
  return out;
}

/** The exact box of a link (real physics on): `length` along the link, `thickness` across, turned with the link. */
export function linkOutline(start: Frame, length: number, thickness: number): Obb {
  const t = Math.max(0.01, thickness);
  return obbOf(localToWorld(start, { x: length / 2, y: 0, z: 0 }), { x: length, y: t, z: t }, quatFromAxes(dirOf(start), normalOf(start), lateralOf(start)));
}

/**
 * The slices of an exact box that a sweep tests against rigid crates: the box cut across its longest side into pieces about as long
 * as the box is thick, each as its own exact outline (a slice `Box` carries the bounds of its outline and the outline). The pieces
 * lie end to end, so together they are exactly the box.
 */
export function outlineSlices(o: Obb, along: 'x' | 'y' | 'z', count: number): Box[] {
  const n = Math.max(1, Math.round(count));
  const full = o.half[along] * 2;
  const cut = full / n;
  const out: Box[] = [];
  const axis = o.axes[along === 'x' ? 0 : along === 'y' ? 1 : 2];
  for (let k = 0; k < n; k++) {
    const shift = -full / 2 + cut * (k + 0.5);
    const half = { ...o.half, [along]: cut / 2 };
    const slice: Obb = { centre: { x: o.centre.x + axis.x * shift, y: o.centre.y + axis.y * shift, z: o.centre.z + axis.z * shift }, half, axes: o.axes };
    const bounds = obbBounds(slice);
    out.push({ pos: bounds.pos, size: bounds.size, exact: slice });
  }
  return out;
}

/** Number of slices a link of this length is cut into for sweeping (one per thickness). */
export function linkSliceCount(length: number, thickness: number): number {
  return Math.max(1, Math.ceil(length / Math.max(0.01, thickness) - 1e-9));
}

/** The cube of a joint's housing at its pivot. */
export function hubCube(pivot: Vec3, side: number): Box {
  return { pos: { ...pivot }, size: { x: side, y: side, z: side } };
}

export interface SweepInput {
  /** The cubes beyond the joint at the old angle and at the angle asked for (same order). */
  before: readonly Box[];
  after: readonly Box[];
  /** Distance (m) of each cube from the joint axis. */
  levers: readonly number[];
  bodies: readonly PushBody[];
  solids: readonly Box[];
  flat: 'y' | 'z' | null;
  /** Torque (N·m) the joint has left for pushing, after holding the arm up. */
  availableNm: number;
  /**
   * The block the whole arm is bolted to (its pillar or cap). A piece that already overlaps it where it stands (the first link cubes and the
   * hub sit on the pillar top) does not count it as in the way: an arm never blocks itself on its own mount. Anything that is not touching it
   * at the start of the step still stops at it.
   */
  mount?: Box | null;
  /** Also report where the first rigid crate is touched (`SweepResult.touch`); costs a little more per cube that meets one. */
  probeContact?: boolean;
}

/** The first rigid crate a sweep meets: how long the touching piece's path is, how far along it the touch comes, its lever and the load. */
export interface SweepTouch {
  /** Length (m) of the path of the piece that touches first, for the full step. */
  len: number;
  /** Distance (m) it can travel before it touches. */
  contactAt: number;
  lever: number;
  /** Mass (kg) of every rigid crate the full step would move. */
  loadKg: number;
}

export interface SweepResult {
  /** Share (0..1) of the step the cubes can make before a solid (or a pushed body meeting one) stops them. */
  fraction: number;
  /** Torque (N·m) the full step needs to push what it meets. */
  requiredNm: number;
  /** The part of `requiredNm` that goes into rigid crates (real physics on): the only part shown in the joint's load read-out. */
  rigidNm: number;
  /** True when that is more than `availableNm`: the joint cannot push, so it stays. */
  stalled: boolean;
  /** Where the bodies it pushes go, as a displacement from now, by id. */
  moves: Map<string, Vec3>;
  /** With `probeContact`: the first rigid crate touched, null when the step touches none. */
  touch: SweepTouch | null;
}

const sameBox = (a: Box, b: Box): boolean =>
  Math.abs(a.pos.x - b.pos.x) + Math.abs(a.pos.y - b.pos.y) + Math.abs(a.pos.z - b.pos.z) + Math.abs(a.size.x - b.size.x) + Math.abs(a.size.y - b.size.y) + Math.abs(a.size.z - b.size.z) < 1e-6;

/** True when the two boxes overlap by more than a hair on every axis the view shows. */
function boxesOverlap(a: Box, b: Box, flat: 'y' | 'z' | null): boolean {
  return (['x', 'y', 'z'] as const).every((k) => k === flat || (a.size[k] + b.size[k]) / 2 - Math.abs(a.pos[k] - b.pos[k]) > 1e-6);
}

/** One straight step of every cube: who is pushed, how much torque it takes, how much of it a solid allows. */
export function sweepCubes(input: SweepInput): SweepResult {
  const order = input.before.map((_, i) => i).sort((a, b) => (input.levers[b] ?? 0) - (input.levers[a] ?? 0));
  let bodies = input.bodies.map((b) => ({ ...b }));
  const moves = new Map<string, Vec3>();
  let requiredNm = 0;
  let rigidNm = 0;
  let fraction = 1;
  let touch: SweepTouch | null = null;
  const loadSeen = new Set<string>();
  let loadKg = 0;
  /** Rigid crates already charged to an earlier cube of this sweep: a hand of many cubes pushes a crate once, not once per cube. */
  const charged = new Set<string>();
  const isRigid = (b: PushBody): boolean => b.crossTol !== undefined;
  for (const i of order) {
    const from = input.before[i]!;
    const to = input.after[i]!;
    const d = { x: to.pos.x - from.pos.x, y: to.pos.y - from.pos.y, z: to.pos.z - from.pos.z };
    const len = Math.hypot(d.x, d.y, d.z);
    if (len < TINY) continue;
    const dir = { x: d.x / len, y: d.y / len, z: d.z / len };
    // An exact piece meets only rigid crates (by its real outline); the upright cover that goes with it meets everything else.
    const solids = input.mount && boxesOverlap(from, input.mount, input.flat) ? input.solids.filter((s) => !sameBox(s, input.mount!)) : input.solids;
    const seen = from.exact ? bodies.filter(isRigid) : from.fat ? bodies.filter((b) => !isRigid(b)) : bodies;
    if (from.exact && seen.length === 0) continue;
    const plan = planPush({ head: from, ...(to.exact ? { headEnd: to.exact } : {}), dir, step: len, bodies: seen, solids, flat: input.flat, lifting: dir.y > 0.5, ...(input.probeContact ? { probeContact: true } : {}) });
    // What an earlier (farther out) cube already pays for a rigid crate is not charged again; other bodies are charged per cube as ever.
    let fresh = plan.requiredN;
    for (const [id, need] of plan.needs) {
      if (bodies.find((b) => b.id === id)?.crossTol === undefined) continue;
      if (charged.has(id)) fresh -= need;
      else charged.add(id);
    }
    const nm = torque(Math.max(0, fresh), input.levers[i] ?? 0);
    requiredNm += nm;
    const rigidLoad = plan.loadIds.filter((id) => bodies.find((b) => b.id === id)?.crossTol !== undefined);
    if (rigidLoad.length > 0) rigidNm += nm;
    if (rigidLoad.length > 0 && plan.contactAt !== null) {
      if (touch === null || plan.contactAt / len < touch.contactAt / touch.len) touch = { len, contactAt: plan.contactAt, lever: input.levers[i] ?? 0, loadKg: 0 };
      for (const id of rigidLoad) {
        if (loadSeen.has(id)) continue;
        loadSeen.add(id);
        loadKg += bodies.find((b) => b.id === id)?.massKg ?? 0;
      }
    }
    fraction = Math.min(fraction, plan.advance / len);
    if (plan.moves.length === 0) continue;
    const delta = new Map(plan.moves.map((m) => [m.id, m.delta]));
    bodies = bodies.map((b) => {
      const m = delta.get(b.id);
      return m ? shiftPushBody(b, m) : b;
    });
    for (const m of plan.moves) {
      const was = moves.get(m.id) ?? { x: 0, y: 0, z: 0 };
      moves.set(m.id, { x: was.x + m.delta.x, y: was.y + m.delta.y, z: was.z + m.delta.z });
    }
  }
  return { fraction, requiredNm, rigidNm, stalled: requiredNm > Math.max(0, input.availableNm) + 1e-9, moves, touch: touch === null ? null : { ...touch, loadKg } };
}

export interface ResolvedStep {
  /** Angle (same unit as the inputs) the joint ends the tick at. */
  angle: number;
  /** True when it is short of the angle asked for because of a solid or a load it cannot push. */
  blocked: boolean;
  moves: Map<string, Vec3>;
  /** Torque (N·m) the push of rigid crates took (stalled: the torque it would have taken); 0 when no rigid crate is touched. */
  rigidNm: number;
  /** Speed (m/s) the rigid crate it pushes now has along the push (the touching piece's own speed once it is in contact); 0 when it pushes none. */
  loadSpeed: number;
}

/** What a turn needs to know to keep a joint from throwing a crate: the tick length and the speed the crate already has. */
export interface ContactRule {
  dt: number;
  loadSpeed: number;
}

/**
 * The angle a joint can really turn to this tick: from `from` toward `to`, cut back until the cubes beyond it neither
 * enter a solid nor need more torque than the servo has left. `cubesAt(angle)` gives the cubes for a joint angle.
 */
export function resolveTurn(
  from: number,
  to: number,
  cubesAt: (angle: number) => readonly Box[],
  rest: Omit<SweepInput, 'before' | 'after' | 'probeContact'>,
  /**
   * A joint passes this: a crate it pushes then gains at most a = (available force - needed force) / m (see `loadLimitedAdvance`), so a
   * link swung fast stops at the crate's face and follows the crate as it speeds up instead of hitting it at its own speed.
   */
  contact?: ContactRule,
): ResolvedStep {
  if (Math.abs(to - from) < TINY) return { angle: from, blocked: false, moves: new Map(), rigidNm: 0, loadSpeed: 0 };
  const before = cubesAt(from);
  let f = 1;
  let rigidNm = 0;
  let limited = false;
  /** Share of the step the contact-speed rule allows: a step cut back to it is a joint following a crate, not one that is blocked. */
  let allowedShare = 1;
  let touch: SweepTouch | null = null;
  /** Speed (m/s) of the pushed crate after a step that reached `share` of the full one. */
  const speedAfter = (share: number): number => (touch !== null && contact && share * touch.len > touch.contactAt + 1e-6 ? (share * touch.len) / contact.dt : 0);
  for (let k = 0; k < RETRIES; k++) {
    const angle = from + (to - from) * f;
    const r = sweepCubes({ ...rest, ...(contact ? { probeContact: true } : {}), before, after: cubesAt(angle) });
    rigidNm = r.rigidNm;
    if (r.stalled) return { angle: from, blocked: true, moves: new Map(), rigidNm, loadSpeed: 0 };
    if (contact && !limited && r.touch !== null && r.touch.lever > 0 && r.touch.loadKg > 0) {
      limited = true;
      touch = r.touch;
      const lever = r.touch.lever;
      const allowed = loadLimitedAdvance({
        step: r.touch.len,
        dt: contact.dt,
        contactAt: r.touch.contactAt,
        loadKg: r.touch.loadKg,
        requiredN: r.rigidNm / lever,
        maxN: Math.max(0, rest.availableNm) / lever,
        loadSpeed: contact.loadSpeed,
      });
      const share = Math.min(1, Math.max(0, allowed / r.touch.len));
      if (share < f - 1e-9) {
        f = share;
        allowedShare = share;
        if (f < 1e-6) return { angle: from, blocked: true, moves: new Map(), rigidNm, loadSpeed: 0 };
        continue;
      }
    }
    if (r.fraction >= FULL) return { angle, blocked: f < allowedShare * FULL - 1e-12, moves: r.moves, rigidNm, loadSpeed: speedAfter(f) };
    f *= r.fraction;
    if (f < 1e-6) break;
  }
  return { angle: from, blocked: true, moves: new Map(), rigidNm, loadSpeed: 0 };
}
