import type { Vec3 } from '../engine/types';
import { flattenObb, isTurned, obbBounds, obbOf, obbSeparation, rotateBy, sensedTurn, yawQuat, type Obb, type Quat } from './oriented-box';
import type { TurnState } from './platforms';

/** Custom collision box of an entity, relative to its position. A size axis of 0 means the same as the visual size. */
export interface ColliderSpec {
  size: Vec3;
  offset: Vec3;
}

export interface Box {
  pos: Vec3;
  size: Vec3;
}

export interface Collidable extends Box {
  collider?: ColliderSpec;
  turn?: TurnState;
  /** A rigid crate's turn (unit quaternion about its position); unset or upright = not turned. */
  rot?: Quat;
  /** Item shape: a ball rolls, but its box does not turn with it. */
  shape?: string;
  kind?: string;
  /** Unit direction on the ground the body points along (a robot chassis: its heading as this view shows it). */
  facing?: { x: number; z: number };
  /** Robot chassis: whether it drives on wheel traction ("Vật lý thật" on), and its real length and width. */
  robot?: { traction: boolean; spec: { length: number; width: number } };
}

/** True when the entity's real outline is turned (a crate that tipped over; not a rolling ball). */
export function isTurnedBody(e: Collidable): boolean {
  return isTurned(sensedTurn(e.rot, e.shape));
}

type Axis = 'x' | 'y' | 'z';

const AXES: readonly Axis[] = ['x', 'y', 'z'];

function finiteOr(n: number | undefined, fallback: number): number {
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback;
}

/** Cleans up user input; returns undefined for the default box, so default entities carry nothing extra. */
export function normalizeCollider(size: Vec3 | undefined, offset: Vec3 | undefined): ColliderSpec | undefined {
  const s = { x: Math.abs(finiteOr(size?.x, 0)), y: Math.abs(finiteOr(size?.y, 0)), z: Math.abs(finiteOr(size?.z, 0)) };
  const o = { x: finiteOr(offset?.x, 0), y: finiteOr(offset?.y, 0), z: finiteOr(offset?.z, 0) };
  const plain = AXES.every((k) => s[k] === 0 && o[k] === 0);
  return plain ? undefined : { size: s, offset: o };
}

/** Quarter-turned blocks swap the collider axes in their turning plane, like their visual size does. */
function turned(v: Vec3, t: TurnState | undefined): Vec3 {
  if (!t || t.quarter % 2 === 0) return v;
  return t.plane === 'xy' ? { x: v.y, y: v.x, z: v.z } : { x: v.z, y: v.y, z: v.x };
}

/**
 * The box used for everything about collision (blocking, contacts, probing, path planning).
 * Without a custom collider this is the entity itself (no allocation); rendering always uses the visual size.
 */
export function colliderBox(e: Collidable): Box {
  const c = e.collider;
  if (!c) return e;
  const size = turned(c.size, e.turn);
  const off = turned(c.offset, e.turn);
  return {
    pos: { x: e.pos.x + off.x, y: e.pos.y + off.y, z: e.pos.z + off.z },
    size: { x: size.x > 0 ? size.x : e.size.x, y: size.y > 0 ? size.y : e.size.y, z: size.z > 0 ? size.z : e.size.z },
  };
}

/**
 * The real shape of an entity: its collision box turned by its own turn (a crate that tipped over), as an oriented box.
 * The turn is about the entity position, so a collision box that sits off the middle swings round with it.
 */
export function orientedBox(e: Collidable): Obb {
  const b = colliderBox(e);
  const turn = sensedTurn(e.rot, e.shape);
  if (!isTurned(turn)) return obbOf(b.pos, b.size);
  const swing = rotateBy(turn, { x: b.pos.x - e.pos.x, y: b.pos.y - e.pos.y, z: b.pos.z - e.pos.z });
  return obbOf({ x: e.pos.x + swing.x, y: e.pos.y + swing.y, z: e.pos.z + swing.z }, b.size, turn);
}

/**
 * True for a robot chassis that drives on wheel traction ("Vật lý thật" on) and has no collision box of its own: other bodies
 * meet it by its real outline (`chassisOutline`).
 */
export function hasChassisOutline(e: Collidable): boolean {
  return e.robot !== undefined && e.robot.traction === true && e.collider === undefined;
}

/**
 * The real outline of a robot chassis on wheel traction: its length by its width, turned to where it points. Null for every
 * other body, for a chassis on the plain drive of older boards, and for a chassis that was given a collision box of its own
 * (that box stays what it is, upright).
 *
 * Everything meets it by this outline: crates, items, people, other chassis, what rests on it, and blocks (the floor, walls,
 * moving blocks, machine pieces) that stop it or that it touches (`meetingPair`). Only the scale still weighs a block that
 * rests on a chassis, or a chassis on a block, by the upright square of `colliderBox` (`outlinePair`).
 */
export function chassisOutline(e: Collidable): Obb | null {
  if (!hasChassisOutline(e)) return null;
  const spec = e.robot!.spec;
  return obbOf(e.pos, { x: spec.length, y: e.size.y, z: spec.width }, e.facing ? yawQuat(e.facing) : undefined);
}

/** How far (m) the real outline of such a chassis reaches from its position at most, whatever its heading; 0 for every other body. */
export function chassisReach(e: Collidable): number {
  if (!hasChassisOutline(e)) return 0;
  const spec = e.robot!.spec;
  return Math.hypot(spec.length, e.size.y, spec.width) / 2;
}

/**
 * The outlines two bodies meet by when one of them is a chassis with a real outline (the other may be a block: a wall, the
 * floor, a machine piece); null when their upright boxes decide, as between any other two bodies.
 */
export function meetingPair(a: Collidable, b: Collidable): [Obb, Obb] | null {
  if (a.robot === undefined && b.robot === undefined) return null;
  const oa = chassisOutline(a);
  const ob = chassisOutline(b);
  if (!oa && !ob) return null;
  return [oa ?? orientedBox(a), ob ?? orientedBox(b)];
}

/** `meetingPair` for the scale, which leaves blocks to the upright boxes: null when one of the two is a block. */
export function outlinePair(a: Collidable, b: Collidable): [Obb, Obb] | null {
  if (a.kind === 'block' || b.kind === 'block') return null;
  return meetingPair(a, b);
}

/**
 * `obbSeparation` of the real outline of `chassis` (which must have one) and the upright box `box`, without building either
 * as a turned box: the outline only turns about the vertical, so five directions can part the two (up, the two world axes on
 * the ground, the chassis's own length and width). Positive = a gap of at least that much, negative = they overlap by the
 * smallest push that would part them. `facing` stands in for the chassis's own (the heading it had before a turn, say).
 * This is the test a chassis makes against every block near it every tick, so it is kept free of any allocation.
 */
export function outlineBoxSeparation(chassis: Collidable, box: Box, facing: { x: number; z: number } | undefined = chassis.facing): number {
  const spec = chassis.robot!.spec;
  let fx = 1;
  let fz = 0;
  if (facing) {
    const len = Math.hypot(facing.x, facing.z);
    if (len > 1e-9) {
      fx = facing.x / len;
      fz = facing.z / len;
    }
  }
  const hl = spec.length / 2;
  const hw = spec.width / 2;
  const bx = Math.abs(box.size.x) / 2;
  const bz = Math.abs(box.size.z) / 2;
  const dx = box.pos.x - chassis.pos.x;
  const dz = box.pos.z - chassis.pos.z;
  const ax = Math.abs(fx);
  const az = Math.abs(fz);
  let gap = Math.abs(box.pos.y - chassis.pos.y) - (Math.abs(box.size.y) + Math.abs(chassis.size.y)) / 2;
  gap = Math.max(gap, Math.abs(dx) - (ax * hl + az * hw) - bx);
  gap = Math.max(gap, Math.abs(dz) - (az * hl + ax * hw) - bz);
  gap = Math.max(gap, Math.abs(dx * fx + dz * fz) - hl - (ax * bx + az * bz));
  return Math.max(gap, Math.abs(dz * fx - dx * fz) - hw - (az * bx + ax * bz));
}

/** True when the upright box `lying` is over the outline seen from above: their shadows on the ground share more than `min` (m) of depth. */
export function overOutline(lying: Box, outline: Obb, min: number): boolean {
  return obbSeparation(flattenObb(obbOf(lying.pos, lying.size), 'y'), flattenObb(outline, 'y')) < -min;
}

/**
 * The smallest upright box that holds the entity's real shape: its collision box when it is not turned, else the bounds of the
 * turned box. For everything that only needs a box (heights, stacking, pushing) and not the exact outline.
 */
export function boundsBox(e: Collidable): Box {
  return isTurnedBody(e) ? obbBounds(orientedBox(e)) : colliderBox(e);
}

/** Size of the entity's box for setting it down: a turned crate takes the room its real outline takes, else its plain size. */
export function layoutSize(e: Collidable & { size: Vec3 }): Vec3 {
  return isTurnedBody(e) ? boundsBox(e).size : e.size;
}

/** Distance from the entity position to its collision box center along one axis. */
export function colliderOffset(e: Collidable, axis: Axis): number {
  if (!e.collider) return 0;
  const off = turned(e.collider.offset, e.turn);
  return isTurnedBody(e) ? rotateBy(e.rot!, off)[axis] : off[axis];
}

/** Overlap length of two upright boxes along one axis (negative = gap). */
export function spanOverlap(ba: Box, bb: Box, axis: Axis): number {
  return (
    Math.min(ba.pos[axis] + ba.size[axis] / 2, bb.pos[axis] + bb.size[axis] / 2) -
    Math.max(ba.pos[axis] - ba.size[axis] / 2, bb.pos[axis] - bb.size[axis] / 2)
  );
}

/**
 * Overlap length of two boxes (turned ones by their bounds) along one axis (negative = gap). Code that asks this of one body
 * against many works out `boundsBox` once and asks `spanOverlap`: the same sum, so the same number to the last bit.
 */
export function boxOverlap(a: Collidable, b: Collidable, axis: Axis): number {
  return spanOverlap(boundsBox(a), boundsBox(b), axis);
}

/** Gravity multiplier from user input: 1 = normal, 0 = floats, 2 = heavy. */
export function sanitizeGravityScale(n: number | undefined): number {
  return Math.min(10, Math.max(0, finiteOr(n, 1)));
}
