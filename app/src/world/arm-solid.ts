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

/** A plate (a link wider or narrower than it is thick) is covered by cells about this long and wide (m), or its smaller side when that is bigger. */
const PLATE_CELL = 0.2;

/** How wide a link is sideways (m): its own width, or its thickness when none is set (the square bar every older board has). */
export function linkWidth(thickness: number, width: number | undefined): number {
  return width !== undefined && Number.isFinite(width) && width > 0 ? Math.max(0.01, width) : Math.max(0.01, thickness);
}

/** True when the link is a plate: its width differs from its thickness. */
export function isPlate(thickness: number, width: number | undefined): boolean {
  return Math.abs(linkWidth(thickness, width) - Math.max(0.01, thickness)) > 1e-9;
}

/**
 * The upright boxes covering a plate: it is cut into a grid of cells along its length and across its width, and each cell is covered
 * by the bounds of its real, turned outline. Standing square to the axes the cover is the plate itself; turned, it is fatter by a
 * part of one cell (a 0.2 m cell at 45 degrees: 4 cm on each side, its corners 10 cm off the plate). The number of cells depends
 * only on the sizes, so the boxes keep their identity while the plate turns (their sizes follow the turn).
 */
function plateCover(start: Frame, length: number, thickness: number, width: number): Box[] {
  const cell = Math.max(PLATE_CELL, Math.min(thickness, width));
  const n = Math.max(1, Math.ceil(length / cell - 1e-9));
  const m = Math.max(1, Math.ceil(width / cell - 1e-9));
  const turn = quatFromAxes(dirOf(start), normalOf(start), lateralOf(start));
  const size = { x: length / n, y: thickness, z: width / m };
  const out: Box[] = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < m; j++) {
      const centre = localToWorld(start, { x: size.x * (i + 0.5), y: 0, z: -width / 2 + size.z * (j + 0.5) });
      const b = obbBounds(obbOf(centre, size, turn));
      out.push({ pos: b.pos, size: b.size });
    }
  }
  return out;
}

/**
 * Axis-aligned boxes covering a link of `length` and `thickness` that starts at `start` and points along it: a chain of cubes for a
 * square bar, a grid of cells for a plate (`width` given and different from the thickness).
 */
export function linkCubes(start: Frame, length: number, thickness: number, width?: number): Box[] {
  const t = Math.max(0.01, thickness);
  if (isPlate(thickness, width)) return plateCover(start, length, t, linkWidth(thickness, width));
  const size = { x: t, y: t, z: t };
  if (length <= t) return [{ pos: localToWorld(start, { x: length / 2, y: 0, z: 0 }), size }];
  const span = length - t;
  const n = Math.ceil(span / t - 1e-9) + 1;
  const step = n > 1 ? span / (n - 1) : 0;
  const out: Box[] = [];
  for (let k = 0; k < n; k++) out.push({ pos: localToWorld(start, { x: t / 2 + k * step, y: 0, z: 0 }), size });
  return out;
}

/**
 * The exact box of a link (real physics on): `length` along the link, `thickness` up from it and `width` sideways (the thickness
 * again when no width is set), turned with the link.
 */
export function linkOutline(start: Frame, length: number, thickness: number, width?: number): Obb {
  const t = Math.max(0.01, thickness);
  return obbOf(localToWorld(start, { x: length / 2, y: 0, z: 0 }), { x: length, y: t, z: linkWidth(thickness, width) }, quatFromAxes(dirOf(start), normalOf(start), lateralOf(start)));
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

const ROOT3 = Math.sqrt(3);
const SHOWN = ['x', 'y', 'z'] as const;

/**
 * The same sweep with less to look at, when no cube can touch any body on its way: then nothing is pushed and nothing rides,
 * so the bodies do not matter at all, and of the solids only those the cubes can reach. Null when a body may be touched (the
 * whole sweep is then needed: a pushed body can push others anywhere) or when the shortcut is not sure.
 *
 * A region is put round everything the cubes pass through, and round each body a box that holds all a cube could touch of it:
 *  - a plain cube touches a body when their boxes overlap, or come within the body's `skin`, on every axis the view shows; the
 *    cube's box travels in a straight line from `before` to `after`;
 *  - an exact piece (3D only) touches when the largest gap along the separating axes is less than `skin`, the body's own three
 *    axes among them. The piece lies within R = the sum of its half sizes of its centre along any axis, so the centres are then
 *    less than |half sizes of the body| + √3·(R + skin) apart: the piece adds √3·R round its centre's path, the body the rest.
 * A body whose box is clear of the region along one shown axis cannot be touched. A solid stops a cube that pushes nothing only
 * by overlapping the cube's own box, so a solid clear of the region stops none. Anything that is not a finite number makes the
 * shortcut unsure.
 */
function quietSweep(input: SweepInput): SweepInput | null {
  if (input.bodies.length === 0 && input.solids.length === 0) return null;
  if (input.after.length < input.before.length) return null;
  const shown = SHOWN.filter((k) => k !== input.flat);
  const lo = { x: Infinity, y: Infinity, z: Infinity };
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  let sum = 0;
  for (let i = 0; i < input.before.length; i++) {
    const from = input.before[i]!;
    const to = input.after[i]!;
    // The flat views flatten an exact outline along the hidden axis: its reach is then not what is worked out here.
    if (from.exact && input.flat !== null) return null;
    const round = from.exact ? ROOT3 * (from.exact.half.x + from.exact.half.y + from.exact.half.z) : 0;
    for (const k of shown) {
      const start = from.exact ? from.exact.centre[k] : from.pos[k];
      const end = start + (to.pos[k] - from.pos[k]);
      // The step is walked as start + direction * distance: rounding may end it a few last bits beside `end`.
      const ext = (from.exact ? round : Math.abs(from.size[k]) / 2) + 1e-6 * (1 + Math.abs(start) + Math.abs(end));
      lo[k] = Math.min(lo[k], start - ext, end - ext);
      hi[k] = Math.max(hi[k], start + ext, end + ext);
      sum += Math.abs(start) + Math.abs(end) + ext;
    }
  }
  if (!(sum < Infinity)) return null;
  for (const b of input.bodies) {
    const skin = Math.abs(b.skin ?? 0);
    const centre = b.real ? b.real.centre : b.box.pos;
    const half = b.real ? b.real.half : null;
    const round = (half ? Math.hypot(half.x, half.y, half.z) : Math.hypot(b.box.size.x, b.box.size.y, b.box.size.z) / 2) + ROOT3 * skin;
    let clear = false;
    for (const k of shown) {
      const reach = Math.abs(b.box.size[k]) / 2 + skin;
      const min = Math.min(b.box.pos[k] - reach, centre[k] - round);
      const max = Math.max(b.box.pos[k] + reach, centre[k] + round);
      // Not finite: never clear.
      if (min > hi[k] || max < lo[k]) clear = true;
      if (!(Math.abs(min) + Math.abs(max) < Infinity)) return null;
    }
    if (!clear) return null;
  }
  const solids = input.solids.filter((s) => {
    for (const k of shown) {
      const half = Math.abs(s.size[k]) / 2;
      if (s.pos[k] - half > hi[k] || s.pos[k] + half < lo[k]) return false;
    }
    return true;
  });
  return { ...input, bodies: [], solids };
}

/** One straight step of every cube: who is pushed, how much torque it takes, how much of it a solid allows. */
export function sweepCubes(input: SweepInput): SweepResult {
  return sweepWhole(quietSweep(input) ?? input);
}

/** `sweepCubes` with every body and every solid looked at, whatever the cubes can reach (the tests hold the shortcut against it). */
export function sweepWhole(input: SweepInput): SweepResult {
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
