import type { Vec3, ViewMode } from '../engine/types';
import { boxOverlap, colliderBox, colliderOffset, type Collidable } from './collider';
import type { Entity } from './entity';

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

function finiteOr(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

/** Bodies a moving block can carry or push. */
export function movable(e: Entity): boolean {
  if (!e.visible || e.kind === 'block' || e.bullet) return false;
  return e.heldBy === null && e.seatedIn === null;
}

function solidBlocksExcept(list: readonly Entity[], p: Entity): Entity[] {
  return list.filter((e) => e !== p && e.visible && e.solid && e.kind === 'block');
}

export function standsOn(e: Entity, p: Entity, mode: ViewMode): boolean {
  if (mode === '2d-top') return false;
  const eb = colliderBox(e);
  const pb = colliderBox(p);
  if (Math.abs(eb.pos.y - eb.size.y / 2 - (pb.pos.y + pb.size.y / 2)) > RIDE_GAP) return false;
  if (overlap(e, p, 'x') <= OVERLAP_MIN) return false;
  return mode === '2d-side' || overlap(e, p, 'z') > OVERLAP_MIN;
}

function moveAxisOf(mode: ViewMode): Axis[] {
  return mode === '2d-side' ? ['x', 'y'] : mode === '2d-top' ? ['x', 'z'] : ['x', 'y', 'z'];
}

/** One axis of a platform move. Returns false (and changes nothing) when it would squeeze a body into a solid. */
function stepAxis(p: Entity, axis: Axis, d: number, bodies: readonly Entity[], solids: readonly Entity[], mode: ViewMode): boolean {
  const riders = bodies.filter((e) => standsOn(e, p, mode));
  const undo: { e: Entity; from: number }[] = [{ e: p, from: p.pos[axis] }];
  p.pos[axis] += d;
  for (const r of riders) {
    undo.push({ e: r, from: r.pos[axis] });
    r.pos[axis] += d;
  }
  for (const e of bodies) {
    if (riders.includes(e) || overlap(e, p, 'x') <= OVERLAP_MIN || overlap(e, p, 'y') <= OVERLAP_MIN || overlap(e, p, 'z') <= OVERLAP_MIN) {
      continue;
    }
    undo.push({ e, from: e.pos[axis] });
    const pb = colliderBox(p);
    const reach = (pb.size[axis] + colliderBox(e).size[axis]) / 2;
    e.pos[axis] = (d > 0 ? pb.pos[axis] + reach : pb.pos[axis] - reach) - colliderOffset(e, axis);
  }
  for (const u of undo) {
    if (u.e !== p && solids.some((s) => overlapsBox(u.e, s))) {
      for (const back of undo) back.e.pos[axis] = back.from;
      return false;
    }
  }
  return true;
}

/** Moves a block to `to`, axis by axis. True when it got all the way there. */
export function moveBlockTo(list: readonly Entity[], p: Entity, to: Vec3, mode: ViewMode): boolean {
  if (!p.solid) {
    for (const axis of moveAxisOf(mode)) p.pos[axis] = finiteOr(to[axis], p.pos[axis]);
    return true;
  }
  const solids = solidBlocksExcept(list, p);
  const bodies = list.filter(movable);
  let reached = true;
  for (const axis of moveAxisOf(mode)) {
    const d = finiteOr(to[axis], p.pos[axis]) - p.pos[axis];
    if (Math.abs(d) < 1e-9) continue;
    // Small steps, so a long jump cannot slide over someone without pushing them.
    const n = Math.ceil(Math.abs(d) / MAX_STEP);
    for (let i = 0; i < n; i++) {
      if (!stepAxis(p, axis, d / n, bodies, solids, mode)) {
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
export function turnAngle(e: Entity): { angle?: number } {
  const t = e.turn;
  if (!t) return {};
  if (!e.solid) return t.spinning ? { angle: t.spin } : {};
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
