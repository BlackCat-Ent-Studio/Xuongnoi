import type { Vec3 } from '../engine/types';
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

/** Distance from the entity position to its collision box center along one axis. */
export function colliderOffset(e: Collidable, axis: Axis): number {
  return e.collider ? turned(e.collider.offset, e.turn)[axis] : 0;
}

/** Overlap length of two collision boxes along one axis (negative = gap). */
export function boxOverlap(a: Collidable, b: Collidable, axis: Axis): number {
  const ba = colliderBox(a);
  const bb = colliderBox(b);
  return (
    Math.min(ba.pos[axis] + ba.size[axis] / 2, bb.pos[axis] + bb.size[axis] / 2) -
    Math.max(ba.pos[axis] - ba.size[axis] / 2, bb.pos[axis] - bb.size[axis] / 2)
  );
}

/** Gravity multiplier from user input: 1 = normal, 0 = floats, 2 = heavy. */
export function sanitizeGravityScale(n: number | undefined): number {
  return Math.min(10, Math.max(0, finiteOr(n, 1)));
}
