import type { EntityId, Vec3, ViewMode } from '../engine/types';
import { DEG, type Frame } from './arm-kinematics';
import { tipForceN } from './crate-tipping';
import { accelFromForce, frictionForce, weight } from './mechanics';
import { flattenObb, obbOf, obbSeparation, type Obb } from './oriented-box';

/**
 * Pure maths of the linear actuator (piston): where the rod points, what its head pushes along one step and how much force
 * that takes. No world access and no randomness, so the same inputs always give the same plan.
 *
 * The head is a solid cube. Whatever it meets is pushed ahead of it, and so is whatever those bodies meet in turn; bodies
 * standing on a pushed body ride along (their weight loads the friction under it). Pushing needs a force:
 *   F = Σ μ · (m + load above) · g        (every pushed body slides on its own surface)
 *       + Σ (m + load above) · g          (extra, when the rod pushes straight up: it lifts them)
 * If F is above the actuator's maximum the rod stalls where it is; if the next step would put the head or anything it
 * pushes inside a solid (a wall, the floor) the rod stops just short of it. Nothing is ever pulled back.
 */

export type PushOrient = 'ground' | 'up' | 'down';

export interface Box {
  /** Centre. */
  pos: Vec3;
  /** Full size. */
  size: Vec3;
  /**
   * A head only: the real, possibly turned, outline of the piece this box is the bounds of. A head that has one meets rigid crates by that
   * outline (separating-axis test, the same shape the crate engine is given) instead of by its upright bounds, which at a tilt are fatter.
   */
  exact?: Obb;
  /**
   * A head only: an upright cover whose contact with rigid crates is decided by the exact heads that go with it, so it leaves them alone
   * (it still meets every other body and every solid).
   */
  fat?: boolean;
}

export interface PushBody {
  id: EntityId;
  box: Box;
  massKg: number;
  /** Surface friction coefficient against what it slides on. */
  mu: number;
  /**
   * How deep (m) it may sit inside a solid across the direction of travel before that counts as "in the way". Absent = the
   * usual hair (`SOLID_TOL`). A crate the rigid-body engine tilts sinks a few centimetres at an edge, which its box does not show.
   */
  crossTol?: number;
  /**
   * Rigid crate (real physics on): its real, possibly turned, outline. Present = the crate may tip, so pushing it needs only
   * the smaller of the sliding force and the tipping force (`tipForceN`). Absent = it can only slide.
   */
  real?: Obb;
  /** How close (m) along the direction of travel a pusher counts as touching this body. Absent = only when the boxes overlap. */
  skin?: number;
}

export interface PushInput {
  /** The head's box where it is now. */
  head: Box;
  /** Unit vector the head moves along this step (already signed: retracting is the opposite of extending). */
  dir: Vec3;
  /** Distance (m) the head is asked to move, above 0. */
  step: number;
  bodies: readonly PushBody[];
  /** Static solids (floor, walls). */
  solids: readonly Box[];
  /** The axis the view does not show; its extents are ignored (the side view has no z, the top view no y). */
  flat?: 'y' | 'z' | null;
  /** True when the rod points straight up: pushed bodies are lifted, not slid. */
  lifting?: boolean;
  /** Also find how far the head can travel before it first touches a body (`PushPlan.contactAt`). */
  probeContact?: boolean;
  /** For an exact head: its outline at the end of the step (the head turns while it travels); without it the outline is only carried along. */
  headEnd?: Obb;
}

export interface PushMove {
  id: EntityId;
  /** Where the body goes, as a displacement from now. */
  delta: Vec3;
  /** 'pushed' = touched by the head or by something it pushes; 'rider' = standing on a pushed body. */
  role: 'pushed' | 'rider';
}

export interface PushPlan {
  /** Distance (m) the head can really move: the step, or less when a solid is in the way. */
  advance: number;
  /** True when a solid stops the head (or something it pushes) before the full step. */
  blocked: boolean;
  /** Force (N) pushing the full step would take. */
  requiredN: number;
  /** Displacements at `advance`; bodies listed front first (largest distance along `dir` first). */
  moves: PushMove[];
  /** Bodies the full step would move (pushed and riding), and their total mass (kg): the load the force has to accelerate. */
  loadIds: EntityId[];
  loadKg: number;
  /** Force (N) each directly pushed body needs (a row or stack counts under the body the head touches); `requiredN` is their sum. */
  needs: ReadonlyMap<EntityId, number>;
  /** With `probeContact`: distance (m) the head can travel before it first touches a body; null when it touches none within the full step. */
  contactAt: number | null;
}

const AXES = ['x', 'y', 'z'] as const;
/** Boxes overlapping less than this count as touching. */
const TOUCH = 1e-6;
/** Across the direction of travel a solid has to be entered deeper than this to count as in the way (a body resting on the floor rubs by a hair). */
const SOLID_TOL = 0.01;
/** A body whose underside is this close to another's top stands on it. */
const RIDE_GAP = 0.06;
const BISECT = 12;
const CONTACT_BISECT = 14;
/** `PushBody.crossTol` of a rigid crate: it may sink this deep (m) into a solid beside its path (a tilt at a belt edge) without being "stuck". */
export const RIGID_CROSS_TOL = 0.05;
/** `PushBody.skin` of a rigid crate (m): the engine's contact margin is about 2 mm, so a pusher 5 mm away is checked as touching. */
export const RIGID_CONTACT_SKIN = 0.005;

function overlapAlong(a: Box, b: Box, axis: 'x' | 'y' | 'z'): number {
  return (a.size[axis] + b.size[axis]) / 2 - Math.abs(a.pos[axis] - b.pos[axis]);
}

function axesOf(flat: PushInput['flat']): readonly ('x' | 'y' | 'z')[] {
  return AXES.filter((a) => a !== flat);
}

function shifted(b: Box, d: Vec3): Box {
  return { pos: { x: b.pos.x + d.x, y: b.pos.y + d.y, z: b.pos.z + d.z }, size: b.size };
}

/** Where an exact head's outline is after it has travelled `d` of the step. */
function exactAt(input: PushInput, d: number): Obb | null {
  const a = input.head.exact;
  if (!a) return null;
  const move = { x: input.dir.x * d, y: input.dir.y * d, z: input.dir.z * d };
  const b = input.headEnd;
  if (!b || !(input.step > 0)) return { centre: { x: a.centre.x + move.x, y: a.centre.y + move.y, z: a.centre.z + move.z }, half: a.half, axes: a.axes };
  const t = Math.min(1, Math.max(0, d / input.step));
  const mix = (u: Vec3, v: Vec3): Vec3 => {
    const w = { x: u.x + (v.x - u.x) * t, y: u.y + (v.y - u.y) * t, z: u.z + (v.z - u.z) * t };
    const n = Math.hypot(w.x, w.y, w.z) || 1;
    return { x: w.x / n, y: w.y / n, z: w.z / n };
  };
  return {
    centre: { x: a.centre.x + move.x, y: a.centre.y + move.y, z: a.centre.z + move.z },
    half: a.half,
    axes: [mix(a.axes[0], b.axes[0]), mix(a.axes[1], b.axes[1]), mix(a.axes[2], b.axes[2])],
  };
}

/** The outline a body is tested by: its real outline when it has one, else its box. */
const outlineOf = (b: PushBody): Obb => b.real ?? obbOf(b.box.pos, b.box.size);

/** The outline as the view sees it: a flat view has no depth along its hidden axis. */
const seen = (o: Obb, flat: PushInput['flat']): Obb => (flat === 'y' || flat === 'z' ? flattenObb(o, flat) : o);

/**
 * How far (m) the body's outline must travel along `dir` to be clear of an exact head's outline (0 when it cannot be parted that way).
 * `reach` bounds the search (the sizes of the unflattened boxes).
 */
function exactClearance(head: Obb, body: Obb, dir: Vec3, reach: number): number {
  const clear = (t: number): boolean => obbSeparation(head, { centre: { x: body.centre.x + dir.x * t, y: body.centre.y + dir.y * t, z: body.centre.z + dir.z * t }, half: body.half, axes: body.axes }) >= 0;
  if (clear(0)) return 0;
  if (!clear(reach)) return 0;
  let lo = 0;
  let hi = reach;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (clear(mid)) hi = mid;
    else lo = mid;
  }
  return hi;
}

/** Distance along `dir` that the box `body` must move to be clear of `pusher` (0 when it cannot be separated that way). */
function clearance(pusher: Box, body: Box, dir: Vec3, axes: readonly ('x' | 'y' | 'z')[]): number {
  let best = Infinity;
  for (const ax of axes) {
    const d = dir[ax];
    if (Math.abs(d) < 1e-9) continue;
    // Only an axis on which the body lies ahead of the pusher can push it clear.
    if (Math.sign(body.pos[ax] - pusher.pos[ax]) !== Math.sign(d)) continue;
    best = Math.min(best, overlapAlong(pusher, body, ax) / Math.abs(d));
  }
  return Number.isFinite(best) ? Math.max(0, best) : 0;
}

/** True when `under` lies below `above` and its top is where `above` rests (within `RIDE_GAP`): it only supports it. */
function holdsUp(under: Box, above: Box): boolean {
  return under.pos.y < above.pos.y && under.pos.y + under.size.y / 2 <= above.pos.y - above.size.y / 2 + RIDE_GAP;
}

/** Who moves when the head advances `d`: bodies the head meets, bodies those meet in turn, and what stands on them. */
function contactSet(input: PushInput, d: number): ContactSet {
  const axes = axesOf(input.flat);
  const move = { x: input.dir.x * d, y: input.dir.y * d, z: input.dir.z * d };
  const pushers: Box[] = [shifted(input.head, move)];
  const realHead = exactAt(input, d);
  const exactHead = realHead ? seen(realHead, input.flat) : null;
  /** Parallel to `pushers`: true for a rigid crate that is being pushed (the head itself is false). */
  const rigidPusher: boolean[] = [false];
  const sideways = input.flat !== 'y' && Math.abs(input.dir.y) <= 0.5;
  const pushed = new Map<EntityId, Vec3>();
  const pushedBy = new Map<EntityId, Box>();
  const boxes = new Map<EntityId, Box>();
  for (let again = true; again; ) {
    again = false;
    for (const b of input.bodies) {
      if (pushed.has(b.id)) continue;
      // A rigid crate counts as touched a few millimetres before the faces meet: the engine already pushes it from that close.
      const skin = b.skin ?? 0;
      const hit = pushers.find(
        (p, k) =>
          (k === 0 && exactHead ? -obbSeparation(exactHead, seen(outlineOf(b), input.flat)) > TOUCH - skin : axes.every((ax) => overlapAlong(p, b.box, ax) > (Math.abs(input.dir[ax]) > 1e-9 ? TOUCH - skin : TOUCH))) &&
          // Pushed sideways, a rigid crate does not push what only holds it up: the engine rests it a hair inside that body.
          !(sideways && rigidPusher[k] && holdsUp(b.box, p)),
      );
      if (!hit) continue;
      const t = hit === pushers[0] && exactHead && realHead ? exactClearance(exactHead, seen(outlineOf(b), input.flat), input.dir, 2 * (Math.hypot(realHead.half.x, realHead.half.y, realHead.half.z) + Math.hypot(outlineOf(b).half.x, outlineOf(b).half.y, outlineOf(b).half.z))) : clearance(hit, b.box, input.dir, axes);
      const delta = { x: input.dir.x * t, y: input.dir.y * t, z: input.dir.z * t };
      pushed.set(b.id, delta);
      pushedBy.set(b.id, hit);
      const moved = shifted(b.box, delta);
      boxes.set(b.id, moved);
      pushers.push(moved);
      rigidPusher.push(b.crossTol !== undefined);
      again = true;
    }
  }
  // Riders: bodies not pushed that stand on a pushed body (or on another rider) follow it.
  const riderOf = new Map<EntityId, EntityId>();
  const carriers = new Map<EntityId, Vec3>(pushed);
  const carrierBox = new Map<EntityId, Box>(input.bodies.filter((b) => pushed.has(b.id)).map((b) => [b.id, b.box]));
  for (let again = input.flat !== 'y'; again; ) {
    again = false;
    for (const b of input.bodies) {
      if (carriers.has(b.id)) continue;
      for (const [cid, cbox] of carrierBox) {
        const standsOn =
          Math.abs(b.box.pos.y - b.box.size.y / 2 - (cbox.pos.y + cbox.size.y / 2)) <= RIDE_GAP &&
          axes.filter((a) => a !== 'y').every((a) => overlapAlong(b.box, cbox, a) > TOUCH);
        if (!standsOn) continue;
        riderOf.set(b.id, cid);
        carriers.set(b.id, carriers.get(cid)!);
        carrierBox.set(b.id, b.box);
        again = true;
        break;
      }
    }
  }
  return { pushed: new Map([...pushed, ...[...riderOf.keys()].map((id) => [id, carriers.get(id)!] as const)]), riderOf, pushedBy };
}

interface ContactSet {
  pushed: Map<EntityId, Vec3>;
  riderOf: Map<EntityId, EntityId>;
  /** For each directly pushed body, the box (head or another pushed body, where it ends up) that pushes it. */
  pushedBy: Map<EntityId, Box>;
}

/** Height (world y) at which `pusher` pushes `body`: the pusher's own mid-height, kept inside the stretch where the two really touch. */
function contactHeight(pusher: Box, body: Box): number {
  const lo = Math.max(pusher.pos.y - pusher.size.y / 2, body.pos.y - body.size.y / 2);
  const hi = Math.min(pusher.pos.y + pusher.size.y / 2, body.pos.y + body.size.y / 2);
  return hi < lo ? (lo + hi) / 2 : Math.min(hi, Math.max(lo, pusher.pos.y));
}

/**
 * Force (N) to push the given set. Every directly pushed body needs its own share, and the shares add up (a row of crates
 * is pushed by the sum): the smaller of
 *   sliding   μ · (m + load above) · g        and, for a rigid crate pushed sideways,
 *   tipping   (m + load above) · g · a / h    (`tipForceN`, at the height where it is really touched).
 * Lifting (the rod points up) adds the weight on top of the friction and never tips anything.
 */
function forceFor(input: PushInput, set: ContactSet): { total: number; needs: Map<EntityId, number> } {
  const { pushed, riderOf, pushedBy } = set;
  const byId = new Map(input.bodies.map((b) => [b.id, b]));
  // The whole load carried by each directly pushed body: itself plus every rider above it (stacks count).
  const rootOf = (id: EntityId): EntityId => {
    let at = id;
    for (let n = 0; riderOf.has(at) && n < 64; n++) at = riderOf.get(at)!;
    return at;
  };
  const load = new Map<EntityId, number>();
  for (const id of pushed.keys()) {
    const root = rootOf(id);
    load.set(root, (load.get(root) ?? 0) + (byId.get(id)?.massKg ?? 0));
  }
  let total = 0;
  const needs = new Map<EntityId, number>();
  for (const [root, kg] of load) {
    const body = byId.get(root);
    if (!body) continue;
    let need = frictionForce(body.mu, weight(kg));
    const by = pushedBy.get(root);
    if (body.real && by && Math.abs(input.dir.y) <= 0.5 && input.flat !== 'y') need = Math.min(need, tipForceN(body.real, input.dir, contactHeight(by, body.box), kg));
    total += need;
    if (input.lifting) total += weight(kg);
    needs.set(root, input.lifting ? need + weight(kg) : need);
  }
  return { total, needs };
}

/** True when `a` is inside `s`: strictly along the travel axes, with a hair of slack across them (resting on the floor is not "in" it). */
function inSolid(a: Box, s: Box, axes: readonly ('x' | 'y' | 'z')[], dir: Vec3, crossTol = SOLID_TOL): boolean {
  return axes.every((ax) => overlapAlong(a, s, ax) > (Math.abs(dir[ax]) > 1e-9 ? TOUCH : crossTol));
}

function clearOfSolids(input: PushInput, d: number): boolean {
  const axes = axesOf(input.flat);
  const { pushed } = contactSet(input, d);
  const move = { x: input.dir.x * d, y: input.dir.y * d, z: input.dir.z * d };
  const head = shifted(input.head, move);
  const exactHead = input.head.exact !== undefined;
  const byId = new Map(input.bodies.map((b) => [b.id, b]));
  for (const s of input.solids) {
    // An exact head comes with the upright cover that meets the solids (see `Box.fat`): only what it pushes is checked here.
    if (!exactHead && inSolid(head, s, axes, input.dir)) return false;
    for (const [id, delta] of pushed) {
      const b = byId.get(id);
      if (b && inSolid(shifted(b.box, delta), s, axes, input.dir, b.crossTol)) return false;
    }
  }
  return true;
}

/** One step of the head: what moves, how far the head may go, and how much force the full step needs. */
export function planPush(input: PushInput): PushPlan {
  const step = Math.max(0, Number.isFinite(input.step) ? input.step : 0);
  const full = contactSet(input, step);
  const { total: requiredN, needs } = forceFor(input, full);
  const loadIds = [...full.pushed.keys()];
  const byId = new Map(input.bodies.map((b) => [b.id, b]));
  const loadKg = loadIds.reduce((sum, id) => sum + (byId.get(id)?.massKg ?? 0), 0);
  let contactAt: number | null = null;
  if (input.probeContact && step > 0 && loadIds.length > 0) {
    let lo = 0;
    let hi = step;
    for (let i = 0; i < CONTACT_BISECT; i++) {
      const mid = (lo + hi) / 2;
      if (contactSet(input, mid).pushed.size > 0) hi = mid;
      else lo = mid;
    }
    contactAt = lo;
  }
  let advance = step;
  let blocked = false;
  if (step > 0 && !clearOfSolids(input, step)) {
    blocked = true;
    let lo = 0;
    let hi = step;
    for (let i = 0; i < BISECT; i++) {
      const mid = (lo + hi) / 2;
      if (clearOfSolids(input, mid)) lo = mid;
      else hi = mid;
    }
    advance = lo;
  }
  const set = advance === step ? full : contactSet(input, advance);
  const ahead = (id: EntityId): number => {
    const b = input.bodies.find((x) => x.id === id)!;
    return b.box.pos.x * input.dir.x + b.box.pos.y * input.dir.y + b.box.pos.z * input.dir.z;
  };
  const moves: PushMove[] = [...set.pushed]
    .map(([id, delta]): PushMove => ({ id, delta, role: set.riderOf.has(id) ? 'rider' : 'pushed' }))
    .sort((a, b) => ahead(b.id) - ahead(a.id));
  return { advance, blocked, requiredN, moves, loadIds, loadKg, needs, contactAt };
}

/** The same body after it was moved by `delta`: its box and its real outline go together. */
export function shiftPushBody(b: PushBody, delta: Vec3): PushBody {
  const move = (p: Vec3): Vec3 => ({ x: p.x + delta.x, y: p.y + delta.y, z: p.z + delta.z });
  return { ...b, box: { pos: move(b.box.pos), size: b.box.size }, ...(b.real ? { real: { ...b.real, centre: move(b.real.centre) } } : {}) };
}

export interface LoadLimitInput {
  /** The head's step (m) this tick, as the rod speed asks for it. */
  step: number;
  dt: number;
  /** `PushPlan.contactAt` of that step. */
  contactAt: number | null;
  /** What the step has to accelerate (`PushPlan.loadKg`) and the force the push needs just to move it (`PushPlan.requiredN`). */
  loadKg: number;
  requiredN: number;
  /** The force limit of the pusher. */
  maxN: number;
  /** Speed (m/s) the load already has along the push. */
  loadSpeed: number;
}

/**
 * How far the head may go this tick so that it never gives its load more speed than its force can: the push that is left
 * after moving the load (maxN - requiredN) accelerates it at a = F / m, so in one tick the load gains at most a * dt.
 * Before the head touches anything it runs free, but it stops at the face instead of hitting it at full speed; once it
 * touches, it moves no faster than the load can follow. The extra energy a head driven faster would give the crate does
 * not exist: the crate's kinetic energy never exceeds (maxN - requiredN) times the distance pushed.
 */
export function loadLimitedAdvance(i: LoadLimitInput): number {
  if (i.contactAt === null || !(i.loadKg > 0) || !(i.dt > 0)) return i.step;
  const a = accelFromForce(Math.max(0, i.maxN - i.requiredN), i.loadKg);
  const follow = (Math.max(0, i.loadSpeed) + a * i.dt) * i.dt;
  if (i.step <= follow) return i.step;
  return Math.min(i.step, Math.max(i.contactAt, follow));
}

/** True when `requiredN` is more than `maxN` can supply (a hair of tolerance for floating point). */
export function exceeds(requiredN: number, maxN: number): boolean {
  return requiredN > Math.max(0, maxN) + 1e-9;
}

/** Rod length after one tick toward `target`, ignoring what it meets: speed-limited, never beyond 0..stroke. */
export function approach(length: number, target: number, stroke: number, speed: number, dt: number): number {
  const t = Math.min(stroke, Math.max(0, target));
  const step = Math.max(0, speed) * dt;
  const d = t - length;
  return Math.abs(d) <= step ? t : length + Math.sign(d) * step;
}

/** The rod length the inputs ask for (m): "Vị trí đặt" (0..1 of the stroke) wins over "Đẩy ra". Unwired = retracted. */
export function targetLength(stroke: number, extend: boolean, position: number | null): number {
  const s = Math.max(0, stroke);
  if (position !== null && Number.isFinite(position)) return Math.min(1, Math.max(0, position)) * s;
  return extend ? s : 0;
}

/**
 * Frame of the rod: `base` is where it is mounted (position and the heading of what it is mounted on), `directionDeg` the push
 * direction on the ground plane (0 = +x, grows clockwise seen from above, like a robot heading). The side view only knows
 * forward / backward along x and up / down, the top view only the ground plane.
 */
export function actuatorFrame(base: Frame, directionDeg: number, orient: PushOrient, mode: ViewMode): Frame {
  const deg = Number.isFinite(directionDeg) ? directionDeg : 0;
  const pitchOpt = orient === 'up' ? Math.PI / 2 : orient === 'down' ? -Math.PI / 2 : 0;
  if (mode === '2d-side') {
    const backward = Math.cos(deg * DEG) < -1e-9;
    return { pos: base.pos, yaw: 0, pitch: orient === 'ground' ? (backward ? Math.PI : 0) : pitchOpt };
  }
  if (mode === '2d-top') return { pos: base.pos, yaw: base.yaw - deg * DEG, pitch: 0 };
  return { pos: base.pos, yaw: base.yaw - deg * DEG, pitch: base.pitch + pitchOpt };
}
