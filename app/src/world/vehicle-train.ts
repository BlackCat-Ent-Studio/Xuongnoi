import type { EntityId, ViewMode } from '../engine/types';
import type { Entity } from './entity';

/**
 * Trains: a vehicle coupled behind a leader follows the path the leader travelled (its trail), a fixed distance
 * back, with its nose along that path. Also turns the pose a node asked for (`setVehicleTrack`) into the velocity
 * that puts the vehicle there. Runs once per tick before the physics move.
 */

/** A new breadcrumb is dropped after this much travel. */
const TRAIL_SPACING = 0.1;
/** Oldest trail is forgotten beyond this length (must exceed the longest coupling distance in a chain). */
const TRAIL_KEEP = 120;
/** Half-width of the stretch used to read the nose direction off the trail. */
const TANGENT_SPAN = 0.3;
/** Gap between two coupled vehicles' ends when the distance is automatic. */
const AUTO_GAP = 0.2;
/** A vehicle farther than this from its target pose is moved straight onto it (first placement) instead of driven. */
const SNAP_DISTANCE = 3;

/** Path walked by a vehicle: points with the arc length at each. */
export interface Trail {
  x: number[];
  z: number[];
  s: number[];
  /** Nose direction when the trail was started; used to extend the path backward before it has length. */
  startHeading: number;
}

export function newTrail(x: number, z: number, heading: number): Trail {
  return { x: [x], z: [z], s: [0], startHeading: heading };
}

/** Adds the present spot. The last point is always the live one: it is moved along until it is a full spacing away, then a new one starts. */
export function recordTrail(t: Trail, x: number, z: number): void {
  const n = t.s.length;
  if (n === 1 && Math.hypot(x - t.x[0]!, z - t.z[0]!) < 1e-6) return;
  const anchor = n >= 2 ? n - 2 : -1;
  if (anchor >= 0 && Math.hypot(x - t.x[anchor]!, z - t.z[anchor]!) < TRAIL_SPACING) {
    t.x[n - 1] = x;
    t.z[n - 1] = z;
    t.s[n - 1] = t.s[anchor]! + Math.hypot(x - t.x[anchor]!, z - t.z[anchor]!);
    return;
  }
  const d = Math.hypot(x - t.x[n - 1]!, z - t.z[n - 1]!);
  t.x.push(x);
  t.z.push(z);
  t.s.push(t.s[n - 1]! + d);
  while (t.s.length > 2 && t.s[t.s.length - 1]! - t.s[1]! > TRAIL_KEEP) {
    t.x.shift();
    t.z.shift();
    t.s.shift();
  }
}

/** Direction of the first stretch of the trail (the way the path was heading when it began). */
function startDirection(t: Trail): { x: number; z: number } {
  const n = t.s.length;
  for (let k = 1; k < n; k++) {
    if (t.s[k]! - t.s[0]! >= 0.5 || k === n - 1) {
      const dx = t.x[k]! - t.x[0]!;
      const dz = t.z[k]! - t.z[0]!;
      const len = Math.hypot(dx, dz);
      if (len > 1e-6) return { x: dx / len, z: dz / len };
    }
  }
  return { x: Math.cos(t.startHeading), z: Math.sin(t.startHeading) };
}

/** Point at arc length `at`; before the start the path continues straight backward. */
function pointAt(t: Trail, at: number, back: { x: number; z: number }): { x: number; z: number } {
  const n = t.s.length;
  if (at <= t.s[0]!) return { x: t.x[0]! + back.x * (at - t.s[0]!), z: t.z[0]! + back.z * (at - t.s[0]!) };
  if (at >= t.s[n - 1]!) return { x: t.x[n - 1]!, z: t.z[n - 1]! };
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (t.s[mid]! <= at) lo = mid;
    else hi = mid;
  }
  const k = (at - t.s[lo]!) / (t.s[hi]! - t.s[lo]!);
  return { x: t.x[lo]! + (t.x[hi]! - t.x[lo]!) * k, z: t.z[lo]! + (t.z[hi]! - t.z[lo]!) * k };
}

/** Position and nose direction `back` units behind the end of the trail. */
export function sampleTrail(t: Trail, back: number, fallbackHeading: number): { x: number; z: number; heading: number } {
  const end = t.s[t.s.length - 1]!;
  const dir = startDirection(t);
  const at = end - back;
  const p = pointAt(t, at, dir);
  const a = pointAt(t, at - TANGENT_SPAN, dir);
  const b = pointAt(t, Math.min(end, at + TANGENT_SPAN), dir);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const heading = Math.hypot(dx, dz) > 1e-6 ? Math.atan2(dz, dx) : fallbackHeading;
  return { x: p.x, z: p.z, heading };
}

/** True when both vehicles belong to the same coupled train. */
export function sameTrain(a: Entity, b: Entity): boolean {
  const ta = a.vehicle?.train;
  return ta !== undefined && ta === b.vehicle?.train;
}

function towDistance(follower: Entity, leader: Entity, set: number): number {
  if (set > 0) return set;
  return (leader.size.x + follower.size.x) / 2 + AUTO_GAP;
}

/** Follows `tow` links to the first vehicle; null on a loop or when a link is broken. */
function chainOf(e: Entity, byId: ReadonlyMap<EntityId, Entity>): Entity[] | null {
  const chain: Entity[] = [e];
  let cur = e;
  while (cur.vehicle?.tow) {
    const next = byId.get(cur.vehicle.tow.leader);
    if (!next || !next.vehicle || chain.includes(next)) return null;
    chain.push(next);
    cur = next;
  }
  return chain;
}

function aim(e: Entity, to: { x: number; z: number; heading: number; speed: number }, dt: number, mode: ViewMode): void {
  const body = e.vehicle;
  if (!body) return;
  const dx = to.x - e.pos.x;
  const dz = mode === '2d-side' ? 0 : to.z - e.pos.z;
  if (Math.hypot(dx, dz) > SNAP_DISTANCE) {
    e.pos.x = to.x;
    if (mode !== '2d-side') e.pos.z = to.z;
    body.rail = { vx: 0, vz: 0, heading: to.heading, speed: to.speed };
    return;
  }
  body.rail = { vx: dx / dt, vz: dz / dt, heading: to.heading, speed: to.speed };
}

/** Per tick, before the physics move: lay trails, place coupled vehicles behind their leaders, apply requested poses. */
export function prepareTrains(list: readonly Entity[], byId: ReadonlyMap<EntityId, Entity>, dt: number, mode: ViewMode): void {
  if (dt <= 0) return;
  // Vehicles with a coupling or something coupled behind them, leaders first.
  const chains = new Map<Entity, Entity[] | null>();
  const leaders = new Set<EntityId>();
  for (const e of list) {
    const tow = e.vehicle?.tow;
    if (!e.vehicle) continue;
    if (e.vehicle.train !== undefined) e.vehicle.train = undefined;
    if (!tow) continue;
    chains.set(e, chainOf(e, byId));
    leaders.add(tow.leader);
  }
  const depth = (e: Entity): number => chains.get(e)?.length ?? 0;
  const towed = [...chains.keys()].sort((a, b) => depth(a) - depth(b));
  // Every leader in a chain, including the head: lay one breadcrumb at its present spot first.
  const heads = new Set<Entity>();
  for (const e of towed) {
    const c = chains.get(e);
    if (c) c.forEach((v) => heads.add(v));
  }
  for (const e of heads) {
    const body = e.vehicle;
    if (!body || !leaders.has(e.id)) continue;
    if (!body.tow) {
      const t = body.trackTarget;
      body.trail ??= newTrail(t?.x ?? e.pos.x, t?.z ?? e.pos.z, t?.heading ?? body.heading);
    }
  }
  // Heads (no tow) record where they are (or are about to be); followers place themselves, then record the spot they were placed on.
  for (const e of heads) {
    const body = e.vehicle;
    if (!body || body.tow || !body.trail) continue;
    // A node-placed head records the spot it is about to be put on, so the wagons do not lag a tick behind.
    recordTrail(body.trail, body.trackTarget?.x ?? e.pos.x, body.trackTarget?.z ?? e.pos.z);
  }
  for (const e of towed) {
    const body = e.vehicle;
    const tow = body?.tow;
    const chain = chains.get(e);
    if (!body || !tow) continue;
    const leader = byId.get(tow.leader);
    const root = chain ? chain[chain.length - 1]! : null;
    if (chain && root?.vehicle) {
      for (const v of chain) if (v.vehicle) v.vehicle.train = root.id;
    }
    if (!leader || !leader.visible || !leader.vehicle || !chain || !e.visible) continue; // stays coupled but stops
    const trail = leader.vehicle.trail;
    if (!trail) continue;
    const pose = sampleTrail(trail, towDistance(e, leader, tow.distance), body.heading);
    const before = e.pos;
    const speed = ((pose.x - before.x) * Math.cos(pose.heading) + (pose.z - before.z) * Math.sin(pose.heading)) / dt;
    aim(e, { ...pose, speed }, dt, mode);
    if (leaders.has(e.id)) {
      body.trail ??= newTrail(pose.x, pose.z, pose.heading);
      recordTrail(body.trail, pose.x, pose.z);
    }
  }
  // Poses asked for by nodes (rail-following brains).
  for (const e of list) {
    const body = e.vehicle;
    if (!body?.trackTarget) continue;
    const target = body.trackTarget;
    body.trackTarget = undefined;
    if (!e.visible || body.tow) continue;
    aim(e, target, dt, mode);
  }
}
