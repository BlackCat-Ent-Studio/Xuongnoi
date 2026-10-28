import type { EntityId, EntityView, Vec3, ViewMode, WorldApi } from '../engine/types';
import { clamp } from './util';

/**
 * Steering shared by the brain nodes (patrol / go-to / chase). It turns "walk toward this point"
 * into the same -1..1 move values a stick gives, plus a jump request.
 *
 * Path-following hook: brain nodes never aim at their goal directly. They call `nextWaypoint`
 * to learn where to head this tick, then `steerToward` to walk there. A pathfinder replaces
 * the body of `nextWaypoint` (and may keep its path in `memo`); nothing else needs to change.
 */

export interface SteerOut {
  moveX: number;
  moveY: number;
  jump: boolean;
}

export const STILL: Readonly<SteerOut> = { moveX: 0, moveY: 0, jump: false };

/** Per-node scratch space owned by the brain node and handed to `nextWaypoint` (e.g. a cached path). */
export type SteerMemo = Record<string, unknown>;

export interface WaypointRequest {
  world: WorldApi;
  self: EntityView;
  /** Where the node ultimately wants to be. */
  goal: Vec3;
  dt: number;
  memo: SteerMemo;
}

/**
 * THE single place that picks the point to walk to next.
 * Straight-line steering: the goal itself. A path follower returns the next point on its path
 * (and falls back to `goal` when no path exists).
 */
export function nextWaypoint(req: WaypointRequest): Vec3 {
  return req.goal;
}

// ---------- geometry ----------

/** Horizontal offset from `a` to `b` on the plane the mode walks on (the side view has no depth). */
export function planarDelta(mode: ViewMode, a: Vec3, b: Vec3): { x: number; z: number } {
  return { x: b.x - a.x, z: mode === '2d-side' ? 0 : b.z - a.z };
}

/** Unit walking direction from `a` toward `b` and the walking-plane distance; null when they coincide. */
export function unitToward(mode: ViewMode, a: Vec3, b: Vec3): { ux: number; uz: number; dist: number } | null {
  const d = planarDelta(mode, a, b);
  const dist = Math.hypot(d.x, d.z);
  if (dist < 1e-6) return null;
  return mode === '2d-side' ? { ux: Math.sign(d.x), uz: 0, dist } : { ux: d.x / dist, uz: d.z / dist, dist };
}

/** Distance as a bot judges "how far": ignores height in the top-down view. */
export function distanceFor(mode: ViewMode, a: Vec3, b: Vec3): number {
  const d = planarDelta(mode, a, b);
  return mode === '2d-top' ? Math.hypot(d.x, d.z) : Math.hypot(d.x, d.z, b.y - a.y);
}

/** Largest height difference that still counts as "at" a spot. */
const ARRIVE_HEIGHT = 1.5;
/** Smallest stop distance: a bot at full speed moves less than this per tick. */
export const MIN_STOP_DISTANCE = 0.2;
/** Inside this distance the bot slows down so it settles on the spot instead of overshooting. */
const SLOW_RADIUS = 0.6;
const MIN_SPEED_FRACTION = 0.3;

/** True when `self` is within `stop` of `goal` on the walking plane (and at about the same height outside the top view). */
export function hasArrived(mode: ViewMode, self: Vec3, goal: Vec3, stop: number): boolean {
  const d = planarDelta(mode, self, goal);
  if (Math.hypot(d.x, d.z) > Math.max(MIN_STOP_DISTANCE, stop)) return false;
  return mode === '2d-top' || Math.abs(goal.y - self.y) <= ARRIVE_HEIGHT;
}

// ---------- probes ----------

/** Obstacles at most this high (above the feet) are hopped over. */
const HOP_HEIGHT = 1.5;
const KNEE_PROBE = 0.3;
const HEAD_PROBE = HOP_HEIGHT + 0.1;
const AHEAD_MARGIN = 0.25;
const EDGE_MARGIN = 0.1;
const GROUND_PROBE_DEPTH = 0.2;

function halfWidth(self: EntityView): number {
  return Math.max(self.size.x, self.size.z) / 2;
}

function feetY(self: EntityView): number {
  return self.position.y - self.size.y / 2;
}

function pointAhead(self: EntityView, ux: number, uz: number, reach: number, y: number): Vec3 {
  return { x: self.position.x + ux * reach, y, z: self.position.z + uz * reach };
}

/** True when there is no floor just past the bot's front edge in direction (ux, uz). Not meaningful in the top view. */
export function edgeAhead(world: WorldApi, self: EntityView, ux: number, uz: number): boolean {
  if (world.mode === '2d-top') return false;
  const probe = pointAhead(self, ux, uz, halfWidth(self) + EDGE_MARGIN, feetY(self) - GROUND_PROBE_DEPTH);
  return !world.solidAt(probe);
}

/** True when a hop-sized obstacle (not a tall wall) stands right in front of the bot. */
export function hoppableObstacleAhead(world: WorldApi, self: EntityView, ux: number, uz: number): boolean {
  if (world.mode === '2d-top') return false;
  const reach = halfWidth(self) + AHEAD_MARGIN;
  const feet = feetY(self);
  return (
    world.solidAt(pointAhead(self, ux, uz, reach, feet + KNEE_PROBE)) &&
    !world.solidAt(pointAhead(self, ux, uz, reach, feet + HEAD_PROBE))
  );
}

// ---------- steering ----------

/** Stick-style move values that make a character travel along the world direction (ux, uz) at `mag` (0..1). */
export function moveForDirection(mode: ViewMode, yaw: number, ux: number, uz: number, mag: number): { moveX: number; moveY: number } {
  if (mode === '2d-side') return { moveX: ux * mag || 0, moveY: 0 };
  if (mode === '2d-top') return { moveX: ux * mag || 0, moveY: -uz * mag || 0 };
  // 3D: the world turns stick input by the camera yaw, so undo that turn here.
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return { moveX: (c * ux - s * uz) * mag || 0, moveY: (-s * ux - c * uz) * mag || 0 };
}

export interface SteerOptions {
  /** Never walk or jump into a drop (fleeing, guarding a ledge): stand still at an edge instead. */
  avoidFall?: boolean;
}

/** One tick of walking from `self` toward `waypoint`. Hops small obstacles and gaps in the side and 3D views. */
export function steerToward(world: WorldApi, self: EntityView, waypoint: Vec3, opts: SteerOptions = {}): SteerOut {
  const mode = world.mode;
  const toward = unitToward(mode, self.position, waypoint);
  if (!toward) return { ...STILL };
  const { ux, uz, dist } = toward;
  const mag = clamp(dist / SLOW_RADIUS, MIN_SPEED_FRACTION, 1);

  let jump = false;
  if (mode !== '2d-top' && world.isOnGround(self.id)) {
    const edge = edgeAhead(world, self, ux, uz);
    if (edge && opts.avoidFall) return { ...STILL };
    const goalNotBelow = waypoint.y >= self.position.y - 1;
    jump = hoppableObstacleAhead(world, self, ux, uz) || (edge && goalNotBelow);
  }
  return { ...moveForDirection(mode, world.cameraYaw(), ux, uz, mag), jump };
}

// ---------- helpers for brain nodes ----------

/** The live character behind an `object` wire, or undefined (nothing wired, hidden, or not a character). */
export function liveCharacter(world: WorldApi, id: EntityId | null): EntityView | undefined {
  const e = id !== null ? world.getEntity(id) : undefined;
  return e && e.visible && e.kind === 'character' ? e : undefined;
}

/** Position of a wired object if it is still in the world, else null. */
export function visiblePosition(world: WorldApi, id: EntityId | null): Vec3 | null {
  const e = id !== null ? world.getEntity(id) : undefined;
  return e && e.visible ? e.position : null;
}
