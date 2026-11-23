import type { Vec3, ViewMode } from '../engine/types';
import { boundsBox, boxOverlap, chassisOutline, chassisReach, colliderBox, colliderOffset, hasChassisOutline, outlineBoxSeparation, overOutline, spanOverlap, type Box, type Collidable } from './collider';
import type { Entity } from './entity';
import { backOffAlong, obbOf } from './oriented-box';

/**
 * Moving and turning blocks.
 *
 * - A moving solid block carries what stands on it and pushes what is beside it. It never crushes: when a carried or
 *   pushed body would end up inside another solid, the block simply does not make that step.
 * - A solid block turns in quarter turns only: width and depth swap, so its box stays an exact AABB for every collision
 *   rule. The picture eases into the new orientation (`offset`); collision is already the final shape.
 * - A non-solid block may spin freely. It collides with nothing, but touch tests use its real rotated outline.
 */

type Axis = 'x' | 'y' | 'z';

/** Standing on top counts when the feet are this close to the surface. */
const RIDE_GAP = 0.06;
/** Longest stretch a platform moves in one go; below the thinnest body it can push. */
const MAX_STEP = 0.25;
/** A body turned away from a block is never thrown farther than this (summed over axes). */
const MAX_PUSH = 2.5;
const OVERLAP_MIN = 1e-6;
/** Speed (radians per second) at which the picture of a turned solid block catches up. */
const TURN_EASE = 9;
const QUARTER = Math.PI / 2;
/** Touch tolerance shared with the world's contact rule. */
const TOUCH_EPS = 0.01;

export interface TurnState {
  /** Size at quarter 0. */
  base: Vec3;
  /** 0..3 quarter turns (solid blocks). */
  quarter: number;
  /** Radians the picture still lags behind `quarter` (solid blocks). */
  offset: number;
  /** Free spin angle in radians (non-solid blocks). */
  spin: number;
  /** True = spin is live, so touches use the rotated outline. */
  spinning: boolean;
  /** Extra tilt in radians about the block's own width axis (non-solid blocks; the 3D view pitches the beam with it). */
  tilt?: number;
  /** Plane the turn happens in: x/y in the side view, x/z otherwise. */
  plane: 'xy' | 'xz';
}

function overlap(a: Entity, b: Entity, axis: Axis): number {
  return boxOverlap(a, b, axis);
}

function overlapsBox(a: Collidable, b: Collidable): boolean {
  for (const axis of ['x', 'y', 'z'] as const) {
    if (boxOverlap(a, b, axis) <= OVERLAP_MIN) return false;
  }
  return true;
}

/**
 * True when the body is inside the block. A robot chassis with a real outline (see `chassisOutline`) is inside where that
 * outline is, not where the upright square round it is: a block beside its long side has not touched it yet, and the corner of
 * a chassis that stands askew is met where it really is.
 */
function insideBlock(e: Entity, block: Entity): boolean {
  if (hasChassisOutline(e)) return outlineBoxSeparation(e, colliderBox(block)) < -OVERLAP_MIN;
  return overlapsBox(e, block);
}

function finiteOr(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

/** Bodies a moving block can carry or push. */
export function movable(e: Entity): boolean {
  // Rigid crates are moved by the crate engine (a moving block pushes and carries them through contact).
  if (!e.visible || e.kind === 'block' || e.bullet || e.rigid) return false;
  return e.heldBy === null && e.seatedIn === null;
}

function solidBlocksExcept(list: readonly Entity[], p: Entity): Entity[] {
  return list.filter((e) => e !== p && e.visible && e.solid && e.kind === 'block');
}

/**
 * What a moving solid block looks at, sorted out of the entity list once instead of once per moved block: the solid blocks that
 * stop what it pushes, the bodies it carries or pushes, the rigid crates it must not crush (with the upright box around each).
 * All three keep the order of the entity list. It stays right for as long as no entity appears, disappears, changes kind, is
 * taken up or let go, and no rigid crate moves, turns or changes size; moving blocks with `moveBlockIn` changes none of that
 * (a block only moves itself and the bodies, never a rigid crate), so one scene serves every block moved in between.
 */
export interface MoveScene {
  solids: readonly Entity[];
  bodies: readonly Entity[];
  crates: readonly Entity[];
  crateBoxes: Box[];
}

/** A rigid crate was put somewhere else or turned, and nothing else changed: the scene takes its new box. */
export function crateMovedIn(scene: MoveScene, crate: Entity): void {
  const k = scene.crates.indexOf(crate);
  if (k >= 0) scene.crateBoxes[k] = boundsBox(crate);
}

export function moveSceneOf(list: readonly Entity[]): MoveScene {
  const crates = list.filter((e) => e.rigid === true && e.visible && e.heldBy === null && !e.bullet);
  return { solids: list.filter((e) => e.visible && e.solid && e.kind === 'block'), bodies: list.filter(movable), crates, crateBoxes: crates.map((c) => boundsBox(c)) };
}

export function standsOn(e: Entity, p: Entity, mode: ViewMode): boolean {
  if (mode === '2d-top') return false;
  const eb = boundsBox(e);
  const pb = colliderBox(p);
  if (Math.abs(eb.pos.y - eb.size.y / 2 - (pb.pos.y + pb.size.y / 2)) > RIDE_GAP) return false;
  // What rides on a chassis with a real outline stands over that outline, not over the square round it.
  const outline = e.kind !== 'block' ? chassisOutline(p) : null;
  if (outline) return overOutline(eb, outline, OVERLAP_MIN);
  if (overlap(e, p, 'x') <= OVERLAP_MIN) return false;
  return mode === '2d-side' || overlap(e, p, 'z') > OVERLAP_MIN;
}

function moveAxisOf(mode: ViewMode): Axis[] {
  return mode === '2d-side' ? ['x', 'y'] : mode === '2d-top' ? ['x', 'z'] : ['x', 'y', 'z'];
}

/** How deep (m) a pushed crate must sit inside a solid before the platform counts as crushing it. */
const CRUSH_DEPTH = 0.02;

/**
 * True when pushing this rigid crate ahead of the platform would squeeze it into a solid. The crate itself is moved by the
 * crate engine (it tips and slides); this only keeps a platform from crushing a crate against a wall.
 */
function crushesCrate(p: Entity, crate: Entity, axis: Axis, d: number, solids: readonly Entity[], apart: readonly Entity[]): boolean {
  if (overlap(crate, p, 'x') <= OVERLAP_MIN || overlap(crate, p, 'y') <= OVERLAP_MIN || overlap(crate, p, 'z') <= OVERLAP_MIN) return false;
  const pb = colliderBox(p);
  const reach = (pb.size[axis] + boundsBox(crate).size[axis]) / 2;
  const pushed: Entity = { ...crate, pos: { ...crate.pos } };
  pushed.pos[axis] = (d > 0 ? pb.pos[axis] + reach : pb.pos[axis] - reach) - colliderOffset(crate, axis);
  // A crate resting on the floor sinks a fraction of a millimetre into it: only a real overlap is a squeeze.
  // (The crate's bounds are worked out once for all the solids: `spanOverlap` of two bounds is `overlap` of the two bodies.)
  const where = boundsBox(pushed);
  return solids.some((s) => {
    const sb = boundsBox(s);
    return spanOverlap(where, sb, 'x') > CRUSH_DEPTH && spanOverlap(where, sb, 'y') > CRUSH_DEPTH && spanOverlap(where, sb, 'z') > CRUSH_DEPTH && s !== p && !apart.includes(s);
  });
}

/**
 * One axis of a platform move. Returns false (and changes nothing) when it would squeeze a body into a solid. `bodies` are the
 * bodies the platform can meet on this move; the solids that stop what it moves are those of the scene other than the platform
 * itself and `apart`. `moved` hears of every body whose place was written.
 */
function stepAxis(p: Entity, axis: Axis, d: number, bodies: readonly Entity[], mode: ViewMode, scene: MoveScene, apart: readonly Entity[], moved?: (e: Entity) => void): boolean {
  const riders = bodies.filter((e) => standsOn(e, p, mode));
  const undo: { e: Entity; from: number }[] = [{ e: p, from: p.pos[axis] }];
  p.pos[axis] += d;
  for (const r of riders) {
    undo.push({ e: r, from: r.pos[axis] });
    r.pos[axis] += d;
  }
  for (const e of bodies) {
    if (riders.includes(e)) continue;
    if (hasChassisOutline(e)) {
      // A chassis with a real outline is pushed where the block meets that outline, and only as far as it takes to clear it.
      // Up and down the outline is the box (it only turns about the vertical), so there it is set flush by the boxes as ever.
      const pb = colliderBox(p);
      if (!(outlineBoxSeparation(e, pb) < -OVERLAP_MIN)) continue;
      undo.push({ e, from: e.pos[axis] });
      if (axis === 'y') {
        e.pos.y = pb.pos.y + (Math.sign(d) * (pb.size.y + colliderBox(e).size.y)) / 2;
      } else {
        const dir = { x: 0, y: 0, z: 0 };
        dir[axis] = d > 0 ? 1 : -1;
        e.pos[axis] += dir[axis] * backOffAlong(obbOf(pb.pos, pb.size), chassisOutline(e)!, dir);
      }
      continue;
    }
    if (overlap(e, p, 'x') <= OVERLAP_MIN || overlap(e, p, 'y') <= OVERLAP_MIN || overlap(e, p, 'z') <= OVERLAP_MIN) {
      continue;
    }
    undo.push({ e, from: e.pos[axis] });
    const pb = colliderBox(p);
    const reach = (pb.size[axis] + colliderBox(e).size[axis]) / 2;
    e.pos[axis] = (d > 0 ? pb.pos[axis] + reach : pb.pos[axis] - reach) - colliderOffset(e, axis);
  }
  if (moved) for (const u of undo) moved(u.e);
  const back = (): false => {
    for (const u of undo) u.e.pos[axis] = u.from;
    return false;
  };
  for (const u of undo) {
    if (u.e !== p && scene.solids.some((s) => s !== p && !apart.includes(s) && insideBlock(u.e, s))) return back();
  }
  // A crate standing on the platform rides with it; any other crate in the way is pushed, so it must have room to go.
  const here = boundsBox(p);
  for (let k = 0; k < scene.crates.length; k++) {
    // Only a crate whose box reaches into the platform can be crushed (the first thing `crushesCrate` asks, here without
    // working the crate's box out again): every other crate is passed over at once.
    const box = scene.crateBoxes[k]!;
    if (spanOverlap(box, here, 'x') <= OVERLAP_MIN || spanOverlap(box, here, 'y') <= OVERLAP_MIN || spanOverlap(box, here, 'z') <= OVERLAP_MIN) continue;
    const c = scene.crates[k]!;
    if (apart.includes(c)) continue;
    if (!standsOn(c, p, mode) && crushesCrate(p, c, axis, d, scene.solids, apart)) return back();
  }
  return true;
}

/** Beyond the block's own box, on every side, a body counts as on its way (more than `RIDE_GAP`, the furthest a rider stands off). */
const WAY_PAD = 0.1;

/**
 * The bodies a block can carry or push on its way to `to`, in their order: those whose bounds reach into the box round all the
 * places the block passes through (it moves axis by axis between where it is and where it is sent, so it never leaves the box
 * round the two), grown by WAY_PAD. A body is carried or pushed only when its bounds overlap the block's, or stand within
 * RIDE_GAP above it, and a body moves only by being carried or pushed, so a body outside that box at the start stays out of
 * the whole move. (The side view does not ask for overlap along z to ride.) A number that is not finite rules nothing out.
 */
function bodiesOnTheWay(bodies: readonly Entity[], p: Entity, to: Vec3, mode: ViewMode, apart: readonly Entity[]): readonly Entity[] {
  if (bodies.length === 0) return bodies;
  const moving = moveAxisOf(mode);
  const boxes = [boundsBox(p), colliderBox(p)];
  const lo = { x: Infinity, y: Infinity, z: Infinity };
  const hi = { x: -Infinity, y: -Infinity, z: -Infinity };
  for (const k of ['x', 'y', 'z'] as const) {
    const travel = moving.includes(k) ? finiteOr(to[k], p.pos[k]) - p.pos[k] : 0;
    for (const b of boxes) {
      const half = Math.abs(b.size[k]) / 2;
      // The block gets there in equal steps: rounding may leave it a few last bits off.
      const pad = WAY_PAD + 1e-9 * (Math.abs(b.pos[k]) + Math.abs(travel));
      lo[k] = Math.min(lo[k], b.pos[k] - half - pad, b.pos[k] + travel - half - pad);
      hi[k] = Math.max(hi[k], b.pos[k] + half + pad, b.pos[k] + travel + half + pad);
    }
  }
  const axes = mode === '2d-side' ? (['x', 'y'] as const) : (['x', 'y', 'z'] as const);
  return bodies.filter((e) => {
    if (apart.includes(e)) return false;
    const b = boundsBox(e);
    // A chassis that stands askew reaches past its square with the corners of its real outline.
    const round = chassisReach(e);
    for (const k of axes) {
      const half = Math.max(round, Math.abs(b.size[k]) / 2);
      if (b.pos[k] - half > hi[k] || b.pos[k] + half < lo[k]) return false;
    }
    return true;
  });
}

/** A block that is not solid goes straight to where it is sent: it carries, pushes and meets nothing. */
function placeBlock(p: Entity, to: Vec3, mode: ViewMode): true {
  for (const axis of moveAxisOf(mode)) p.pos[axis] = finiteOr(to[axis], p.pos[axis]);
  return true;
}

/** Moves a block to `to`, axis by axis. True when it got all the way there. */
export function moveBlockTo(list: readonly Entity[], p: Entity, to: Vec3, mode: ViewMode): boolean {
  return p.solid ? moveBlockIn(moveSceneOf(list), p, to, mode) : placeBlock(p, to, mode);
}

/**
 * `moveBlockTo` with the scene worked out beforehand. `apart` are entities the block neither pushes nor is stopped by, as if
 * they were not in the world (what a machine piece is bolted onto).
 */
export function moveBlockIn(scene: MoveScene, p: Entity, to: Vec3, mode: ViewMode, apart: readonly Entity[] = [], moved?: (e: Entity) => void): boolean {
  if (!p.solid) {
    moved?.(p);
    return placeBlock(p, to, mode);
  }
  const bodies = bodiesOnTheWay(scene.bodies, p, to, mode, apart);
  let reached = true;
  for (const axis of moveAxisOf(mode)) {
    const d = finiteOr(to[axis], p.pos[axis]) - p.pos[axis];
    if (Math.abs(d) < 1e-9) continue;
    // Small steps, so a long jump cannot slide over someone without pushing them.
    const n = Math.ceil(Math.abs(d) / MAX_STEP);
    for (let i = 0; i < n; i++) {
      if (!stepAxis(p, axis, d / n, bodies, mode, scene, apart, moved)) {
        reached = false;
        break;
      }
    }
  }
  return reached;
}

function ensureTurn(e: Entity, mode: ViewMode): TurnState {
  if (!e.turn) {
    e.turn = { base: { ...e.size }, quarter: 0, offset: 0, spin: 0, spinning: false, plane: mode === '2d-side' ? 'xy' : 'xz' };
  }
  return e.turn;
}

function turnedSize(t: TurnState, quarter: number): Vec3 {
  if (quarter % 2 === 0) return { ...t.base };
  return t.plane === 'xy' ? { x: t.base.y, y: t.base.x, z: t.base.z } : { x: t.base.z, y: t.base.y, z: t.base.x };
}

/** Closest spot, clear of every solid and of the turned block, to which `e` can be moved. Null when none within reach. */
function freeSpot(e: Entity, p: Entity, solids: readonly Entity[], mode: ViewMode): Vec3 | null {
  const candidates: Vec3[] = [];
  const add = (axis: Axis, sign: 1 | -1): void => {
    const c = { ...e.pos };
    const pb = colliderBox(p);
    c[axis] = pb.pos[axis] + (sign * (pb.size[axis] + colliderBox(e).size[axis])) / 2 - colliderOffset(e, axis);
    candidates.push(c);
  };
  add('x', 1);
  add('x', -1);
  if (mode !== '2d-top') {
    add('y', 1);
    add('y', -1);
  }
  if (mode !== '2d-side') {
    add('z', 1);
    add('z', -1);
  }
  const dist = (c: Vec3): number => Math.abs(c.x - e.pos.x) + Math.abs(c.y - e.pos.y) + Math.abs(c.z - e.pos.z);
  candidates.sort((a, b) => dist(a) - dist(b));
  for (const c of candidates) {
    if (dist(c) > MAX_PUSH) break; // sorted: the rest are farther
    const probe = { pos: c, size: e.size, ...(e.collider ? { collider: e.collider } : {}) };
    if (!overlapsBox(probe, p) && !solids.some((s) => overlapsBox(probe, s))) return c;
  }
  return null;
}

/** Turns a solid block to the given quarter turn. False while someone in the way cannot be moved clear. */
export function turnSolidTo(list: readonly Entity[], p: Entity, quarters: number, mode: ViewMode): boolean {
  const t = ensureTurn(p, mode);
  const want = ((Math.round(quarters) % 4) + 4) % 4;
  if (want === t.quarter) return true;
  const before = { ...p.size };
  p.size = turnedSize(t, want);
  const solids = solidBlocksExcept(list, p);
  const moves: { e: Entity; to: Vec3 }[] = [];
  for (const e of list) {
    if (!movable(e) || !overlapsBox(e, p)) continue;
    const to = freeSpot(e, p, solids, mode);
    if (!to) {
      p.size = before;
      return false;
    }
    moves.push({ e, to });
  }
  for (const m of moves) m.e.pos = m.to;
  let delta = want - t.quarter;
  if (delta > 2) delta -= 4;
  if (delta < -1) delta += 4;
  t.offset -= delta * QUARTER;
  t.quarter = want;
  return true;
}

/** Sets the free spin angle of a non-solid block. */
export function spinBlockTo(p: Entity, rad: number, mode: ViewMode): void {
  const t = ensureTurn(p, mode);
  t.spin = finiteOr(rad, 0);
  t.spinning = true;
}

/** Sets the tilt (pitch) of a non-solid block, drawn in the 3D view. */
export function tiltBlockTo(p: Entity, rad: number, mode: ViewMode): void {
  ensureTurn(p, mode).tilt = finiteOr(rad, 0);
}

/** Lets the picture of turned solid blocks catch up with their snapped orientation. */
export function settleTurns(list: readonly Entity[], dt: number): void {
  for (const e of list) {
    const t = e.turn;
    if (!t || t.offset === 0) continue;
    const step = TURN_EASE * dt;
    t.offset = Math.abs(t.offset) <= step ? 0 : t.offset - Math.sign(t.offset) * step;
  }
}

/** The renderer-facing angle of a block (empty when there is nothing to turn). */
export function turnAngle(e: Entity): { angle?: number; tilt?: number } {
  const t = e.turn;
  if (!t) return {};
  if (!e.solid) return { ...(t.spinning ? { angle: t.spin } : {}), ...(t.tilt ? { tilt: t.tilt } : {}) };
  return Math.abs(t.offset) > 1e-4 ? { angle: t.offset } : {};
}

/** True when the entity is a spinning, non-solid block whose touches follow its rotated outline. */
export function isSpinner(e: Entity): boolean {
  return !e.solid && e.turn !== undefined && e.turn.spinning;
}

/** Touch test between a spinning block (rotated rectangle in its plane) and an axis-aligned box. */
export function spinnerTouches(s: Entity, o: Entity): boolean {
  const t = s.turn;
  if (!t) return false;
  const xy = t.plane === 'xy';
  const cos = Math.cos(t.spin);
  const sin = Math.sin(t.spin);
  // Rectangle axes in plane coordinates (p = x, q = y or z); the rotation matches the renderer's.
  const ux = cos;
  const uq = xy ? sin : -sin;
  const vx = xy ? -sin : sin;
  const vq = cos;
  const sq = xy ? s.pos.y : s.pos.z;
  const oq = xy ? o.pos.y : o.pos.z;
  const hu = s.size.x / 2;
  const hv = (xy ? s.size.y : s.size.z) / 2;
  const bp = o.size.x / 2;
  const bq = (xy ? o.size.y : o.size.z) / 2;
  const third = xy ? 'z' : 'y';
  if (Math.abs(s.pos[third] - o.pos[third]) > (s.size[third] + o.size[third]) / 2 + TOUCH_EPS) return false;
  const dp = o.pos.x - s.pos.x;
  const dq = oq - sq;
  const e = TOUCH_EPS;
  if (Math.abs(dp) > bp + hu * Math.abs(ux) + hv * Math.abs(vx) + e) return false;
  if (Math.abs(dq) > bq + hu * Math.abs(uq) + hv * Math.abs(vq) + e) return false;
  if (Math.abs(dp * ux + dq * uq) > hu + bp * Math.abs(ux) + bq * Math.abs(uq) + e) return false;
  if (Math.abs(dp * vx + dq * vq) > hv + bp * Math.abs(vx) + bq * Math.abs(vq) + e) return false;
  return true;
}
