import type { Vec3, ViewMode } from '../engine/types';
import { cargoPositions } from './cargo';
import { boxOverlap, colliderBox, colliderOffset, isTurnedBody, orientedBox } from './collider';
import { mulQuat, obbSeparation, yawQuat } from './oriented-box';
import { lockMotion } from './combat';
import { carryOnBelts, carryVehicleRiders, vehicleRides } from './conveyor';
import type { CrateEngine } from './crate-engine';
import type { Entity } from './entity';
import { isSpinner, spinnerTouches } from './platforms';
import { massOn } from './material';
import { LIFT_SPEED, approach, solidCarryPosition, isSolidBody, overlapsBox, updateCarryFloors, type BodyRules } from './solid-bodies';
import { driveRobot, settleRobot } from './robot-drive';
import { beginShove, finishShove, restsOnChassis } from './robot-push';
import { sameTrain } from './vehicle-train';
import { CRASH_SPEED, SHOVE_SHARE, driveVehicle, seatPosition, settleVehicle, vehicleFacing } from './vehicles';

export const GRAVITY = -30;
export const TERMINAL_SPEED = 40;
/** Penetration below this is treated as resting contact (prevents snagging on tiled floors). */
export const SKIN = 1e-6;
/** Gap at or below this counts as a contact. */
export const CONTACT_EPS = 0.01;
/** Max displacement per substep, below half of a 1-unit block. */
const MAX_SUBSTEP_DISTANCE = 0.4;

type Axis = 'x' | 'y' | 'z';

function sanitize(n: number): number {
  return Number.isFinite(n) ? n : 0;
}

function clamp1(n: number): number {
  return Math.max(-1, Math.min(1, sanitize(n)));
}

function overlapOn(a: Entity, b: Entity, axis: Axis): number {
  return boxOverlap(a, b, axis);
}

/** Gravity of one body: the world pull `g` (negative, units/s²) times its own scale (1 = normal, 0 = floats). */
function gravityOf(e: Entity, g: number): number {
  return g * (e.gravityScale ?? 1);
}

/** Puts `c` flush against `b` on one side along `axis` (collision boxes touch; offsets are respected). */
function pushOut(c: Entity, b: Entity, axis: Axis, delta: number): void {
  const cb = colliderBox(c);
  const bb = colliderBox(b);
  const half = (cb.size[axis] + bb.size[axis]) / 2;
  c.pos[axis] = (delta > 0 ? bb.pos[axis] - half : bb.pos[axis] + half) - colliderOffset(c, axis);
}

function overlapsAll(a: Entity, b: Entity): boolean {
  return overlapOn(a, b, 'x') > SKIN && overlapOn(a, b, 'y') > SKIN && overlapOn(a, b, 'z') > SKIN;
}

/** Overlapping or within CONTACT_EPS on every axis. */
export function touching(a: Entity, b: Entity): boolean {
  // A spinning block touches through its rotated outline, not its bounding box.
  if (isSpinner(a)) return spinnerTouches(a, b);
  if (isSpinner(b)) return spinnerTouches(b, a);
  // A turned crate touches through its real outline, not through the upright box around it.
  if (isTurnedBody(a) || isTurnedBody(b)) return obbSeparation(orientedBox(a), orientedBox(b)) <= CONTACT_EPS;
  const ba = colliderBox(a);
  const bb = colliderBox(b);
  return (
    Math.abs(ba.pos.x - bb.pos.x) <= (ba.size.x + bb.size.x) / 2 + CONTACT_EPS &&
    Math.abs(ba.pos.y - bb.pos.y) <= (ba.size.y + bb.size.y) / 2 + CONTACT_EPS &&
    Math.abs(ba.pos.z - bb.pos.z) <= (ba.size.z + bb.size.z) / 2 + CONTACT_EPS
  );
}

/** Solid bodies only: other bodies that stop the mover, and the item it carries (which is stopped, and stops it, too). */
interface Extras {
  soft: readonly Entity[];
  carried?: { item: Entity; at: (holder: Entity) => Vec3 };
}

/** Move along one axis by `delta`, pushing out of solid blocks. Returns true if blocked. */
function moveAxis(c: Entity, axis: Axis, delta: number, solids: readonly Entity[], rivals?: Rivals, extras?: Extras): boolean {
  if (delta === 0) return false;
  // Vehicles already overlapping (spawned or teleported onto each other) may drive apart instead of being snapped through.
  const free = rivals && rivals.list.length > 0 ? rivals.list.filter((r) => !overlapsAll(c, r)) : null;
  // Bodies that already overlap the mover (a spawn, a drop that found no room) may part instead of being snapped through.
  const soft = extras && extras.soft.length > 0 ? extras.soft.filter((b) => !overlapsAll(c, b)) : null;
  const carried = extras?.carried;
  let proxy: Entity | null = null;
  let carriedAgainst: Entity[] | null = null;
  if (carried && extras) {
    const p0: Entity = { ...carried.item, pos: carried.at(c) };
    proxy = p0;
    carriedAgainst = [...solids, ...extras.soft].filter((b) => b !== carried.item && b !== c && !overlapsAll(p0, b));
  }
  c.pos[axis] += delta;
  let blocked = false;
  for (const b of solids) {
    if (!overlapsAll(c, b)) continue;
    pushOut(c, b, axis, delta);
    blocked = true;
  }
  if (soft) {
    for (const b of soft) {
      if (!overlapsAll(c, b)) continue;
      pushOut(c, b, axis, delta);
      blocked = true;
    }
  }
  if (proxy && carriedAgainst && carried) {
    proxy.pos = carried.at(c);
    for (const b of carriedAgainst) {
      if (!overlapsAll(proxy, b)) continue;
      const before = proxy.pos[axis];
      pushOut(proxy, b, axis, delta);
      c.pos[axis] += proxy.pos[axis] - before;
      blocked = true;
    }
  }
  if (rivals && free) {
    for (const r of free) {
      if (!overlapsAll(c, r)) continue;
      pushOut(c, r, axis, delta);
      rivals.hit.add(r);
      blocked = true;
    }
  }
  return blocked;
}

/** Other vehicles a vehicle must not drive through, and the ones it ran into during this move. */
interface Rivals {
  list: readonly Entity[];
  hit: Set<Entity>;
}

function applyIntent(c: Entity, mode: ViewMode, yaw: number): void {
  if (lockMotion(c)) return;
  const it = c.intent;
  if (!it) {
    c.vel.x = 0;
    c.vel.z = 0;
    return;
  }
  const mx = clamp1(it.moveX);
  const my = clamp1(it.moveY);
  const speed = sanitize(it.speed);
  if (mode === '2d-side') {
    c.vel.x = mx * speed;
    c.vel.z = 0;
  } else if (mode === '2d-top') {
    c.vel.x = mx * speed;
    c.vel.z = -my * speed;
  } else {
    // yaw 0: forward = -Z, right = +X; rotate both around Y by yaw.
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    c.vel.x = (cos * mx - sin * my) * speed;
    c.vel.z = (-sin * mx - cos * my) * speed;
  }
  // Facing follows the last direction the player pushed, even if a wall then stops the body.
  const len = Math.hypot(c.vel.x, c.vel.z);
  if (len > 1e-6) {
    c.facing.x = c.vel.x / len;
    c.facing.z = c.vel.z / len;
  }
  if (mode !== '2d-top' && it.jump && c.onGround) {
    c.vel.y = sanitize(it.jumpPower);
    c.onGround = false;
  }
}

/** Moves a body by its velocity in substeps, stopping at solids. Returns true when it ended resting on something. */
function integrate(c: Entity, dt: number, mode: ViewMode, solids: readonly Entity[], rivals?: Rivals, extras?: Extras): boolean {
  const maxDist = Math.max(Math.abs(c.vel.x), Math.abs(c.vel.y), Math.abs(c.vel.z)) * dt;
  const n = Math.max(1, Math.ceil(maxDist / MAX_SUBSTEP_DISTANCE));
  const sub = dt / n;
  let grounded = false;
  for (let i = 0; i < n; i++) {
    if (moveAxis(c, 'x', c.vel.x * sub, solids, rivals, extras)) c.vel.x = 0;
    if (mode !== '2d-top') {
      const dy = c.vel.y * sub;
      if (moveAxis(c, 'y', dy, solids, undefined, extras)) {
        if (dy < 0) grounded = true;
        c.vel.y = 0;
      }
    }
    if (mode !== '2d-side' && moveAxis(c, 'z', c.vel.z * sub, solids, rivals, extras)) c.vel.z = 0;
  }
  return grounded;
}

/** Sliding items lose horizontal speed at this rate per second (on the ground; gentler on the top-down floor). */
const ITEM_FRICTION = 10;
const ITEM_FRICTION_TOP = 3;
/** Below this horizontal speed a sliding item stops dead. */
const ITEM_STOP_SPEED = 0.05;
/** Friction an item gets when its node does not say otherwise. */
export const DEFAULT_ITEM_FRICTION = ITEM_FRICTION;
/** A fall slower than this does not bounce, so a bouncing item eventually settles. */
const BOUNCE_MIN_SPEED = 1.5;

function stepFreeItem(item: Entity, dt: number, mode: ViewMode, g: number, solids: readonly Entity[], extras?: Extras): void {
  if (mode === '2d-top') item.vel.y = 0;
  else item.vel.y = Math.max(-TERMINAL_SPEED, item.vel.y + gravityOf(item, g) * dt);
  if (mode === '2d-side') {
    item.pos.z = 0;
    item.vel.z = 0;
  }
  const fallSpeed = item.vel.y;
  item.onGround = integrate(item, dt, mode, solids, undefined, extras);
  if (item.onGround && item.bounce && fallSpeed < -BOUNCE_MIN_SPEED) {
    item.vel.y = -fallSpeed * item.bounce;
    item.onGround = false;
  }
  if (item.onGround || mode === '2d-top') {
    const friction = item.friction ?? ITEM_FRICTION;
    const k = Math.max(0, 1 - (mode === '2d-top' ? (friction * ITEM_FRICTION_TOP) / ITEM_FRICTION : friction) * dt);
    item.vel.x *= k;
    item.vel.z *= k;
    if (Math.hypot(item.vel.x, item.vel.z) < ITEM_STOP_SPEED) {
      item.vel.x = 0;
      item.vel.z = 0;
    }
  }
}

/** Where a carried item rides: above the head, or in front of the character in the top-down view. */
export function holdPosition(holder: Entity, item: Entity, mode: ViewMode): Vec3 {
  if (mode === '2d-top') {
    const reach = holder.size.x / 2 + item.size.x / 2 + 0.1;
    return {
      x: holder.pos.x + holder.facing.x * reach,
      y: holder.pos.y,
      z: holder.pos.z + holder.facing.z * reach,
    };
  }
  return {
    x: holder.pos.x,
    y: holder.pos.y + holder.size.y / 2 + item.size.y / 2 + 0.05,
    z: holder.pos.z,
  };
}

/** Where a tool in hand rides: just ahead of the holder at chest height (it only reports contacts). */
export function handPosition(holder: Entity, item: Entity, mode: ViewMode): Vec3 {
  const reach = Math.max(holder.size.x, holder.size.z) / 2 + item.size.x / 2 + 0.05;
  return {
    x: holder.pos.x + holder.facing.x * reach,
    y: mode === '2d-top' ? holder.pos.y : holder.pos.y - holder.size.y * 0.1,
    z: mode === '2d-side' ? 0 : holder.pos.z + holder.facing.z * reach,
  };
}

/** Where a carried item rides: the plain spot above the head, or the solid-body spot that matches the drawing. */
export function carryAt(holder: Entity, item: Entity, mode: ViewMode, rules: BodyRules | null): Vec3 {
  return rules && mode === '3d' ? solidCarryPosition(holder, item, rules) : holdPosition(holder, item, mode);
}

/** After a move or a turn, backs the carrier out of whatever its carried item has ended up inside. */
function settleCarried(c: Entity, item: Entity, obstacles: readonly Entity[], rules: BodyRules, mode: ViewMode): void {
  for (let pass = 0; pass < 4; pass++) {
    const proxy: Entity = { ...item, pos: carryAt(c, item, mode, rules) };
    let moved = false;
    for (const b of obstacles) {
      if (b === item || b === c || !overlapsBox(proxy, b)) continue;
      const bb = colliderBox(b);
      const ox = overlapOn(proxy, b, 'x');
      const oz = overlapOn(proxy, b, 'z');
      if (ox <= oz) c.pos.x += proxy.pos.x < bb.pos.x ? -ox : ox;
      else c.pos.z += proxy.pos.z < bb.pos.z ? -oz : oz;
      moved = true;
      break;
    }
    if (!moved) return;
  }
}

/** One tick of a vehicle: stick -> speed and heading -> velocity, then the usual fall and collision against blocks. */
function stepVehicle(
  v: Entity,
  dt: number,
  mode: ViewMode,
  yaw: number,
  g: number,
  solids: readonly Entity[],
  colliders: readonly Entity[],
): void {
  const body = v.vehicle;
  if (!body) return;
  body.hitCooldown = Math.max(0, body.hitCooldown - dt);
  const rivals: Rivals | undefined =
    body.spec.collide !== false ? { list: colliders.filter((o) => o !== v && !sameTrain(v, o)), hit: new Set() } : undefined;
  const flat = driveVehicle(body, dt, mode, yaw);
  const wanted = { x: flat.x, z: flat.z };
  v.vel.x = flat.x;
  v.vel.z = flat.z;
  v.facing = vehicleFacing(body, mode);
  if (mode === '2d-top') v.vel.y = 0;
  else v.vel.y = Math.max(-TERMINAL_SPEED, v.vel.y + gravityOf(v, g) * dt);
  if (mode === '2d-side') v.pos.z = 0;
  v.onGround = integrate(v, dt, mode, solids, rivals);
  settleVehicle(body, v.vel, wanted, dt, mode);
  v.facing = vehicleFacing(body, mode);
  if (rivals) for (const other of rivals.hit) crashInto(v, other, wanted, dt, mode, solids, colliders);
}

/**
 * One tick of a robot chassis: wheels -> speed and turn -> velocity, then the usual fall and collision against blocks.
 * What rests on top loads the motors (nothing rests on a chassis in the top-down view).
 */
function stepRobot(r: Entity, dt: number, mode: ViewMode, g: number, solids: readonly Entity[], entities: readonly Entity[], meets: ChassisMeets | null): void {
  const body = r.robot;
  if (!body) return;
  const flat = driveRobot(body, dt, mode === '2d-side', mode === '2d-top' ? 0 : massOn(entities, r));
  r.vel.x = flat.x;
  r.vel.z = flat.z;
  r.facing = mode === '2d-side' ? { x: 1, y: 0, z: 0 } : { x: Math.cos(body.heading), y: 0, z: Math.sin(body.heading) };
  if (mode === '2d-top') r.vel.y = 0;
  else r.vel.y = Math.max(-TERMINAL_SPEED, r.vel.y + gravityOf(r, g) * dt);
  if (mode === '2d-side') r.pos.z = 0;
  const others = meets && r.solid ? meets.chassis.filter((o) => o !== r) : [];
  if (!meets || others.length === 0) {
    const shove = beginShove(r, entities, solids, dt, mode);
    r.onGround = integrate(r, dt, mode, solids);
    if (shove) finishShove(r, shove, new Map(entities.map((e) => [e.id, e])), solids, mode);
    settleRobot(body, r.vel, mode === '2d-side');
    return;
  }
  // Another chassis that already shoved this one along this tick has given it that much of its own move: it does not travel it twice.
  const given = meets.shoved.get(r);
  const cut = { x: 0, z: 0 };
  const far = given ? Math.hypot(given.x, given.z) : 0;
  if (given && far > 1e-12) {
    const own = ((r.vel.x * given.x + r.vel.z * given.z) / far) * dt;
    const take = Math.min(Math.max(own, 0), far) / (far * dt);
    cut.x = given.x * take;
    cut.z = given.z * take;
    r.vel.x -= cut.x;
    r.vel.z -= cut.z;
  }
  const from = { x: r.pos.x, z: r.pos.z };
  const shove = beginShove(r, entities, solids, dt, mode, others);
  // The chassis it shoves move once it has moved; every other one stops it like a wall.
  const rivals: Rivals = { list: shove && shove.shoved.size > 0 ? others.filter((o) => !shove.shoved.has(o.id)) : others, hit: new Set() };
  r.onGround = integrate(r, dt, mode, solids, rivals);
  if (shove) {
    for (const [o, d] of finishShove(r, shove, new Map(entities.map((e) => [e.id, e])), solids, mode, dt)) {
      if (meets.stepped.has(o)) continue;
      const was = meets.shoved.get(o);
      meets.shoved.set(o, was ? { x: was.x + d.x, z: was.z + d.z } : d);
    }
  }
  meets.stepped.add(r);
  // Stopped by a chassis that itself moves, it keeps the speed it really travelled at (a wall takes all of it, as ever).
  const done = rivals.hit.size > 0 ? { x: (r.pos.x - from.x) / dt, z: (r.pos.z - from.z) / dt } : r.vel;
  settleRobot(body, { x: done.x + cut.x, z: done.z + cut.z }, mode === '2d-side');
}

/**
 * Real physics: the solid robot chassis of this tick, which stop and shove each other. `shoved` is how far a chassis that has
 * not made its own move yet (`stepped`) was already pushed along by others.
 */
interface ChassisMeets {
  chassis: readonly Entity[];
  shoved: Map<Entity, { x: number; z: number }>;
  stepped: Set<Entity>;
}

/** Seconds a contact must stay broken before the same pair can crash again. */
const CRASH_COOLDOWN = 0.5;

/** `v` ran into `other`: shove it a little, and report a crash (to both) when the closing speed was high enough. */
function crashInto(
  v: Entity,
  other: Entity,
  wanted: { x: number; z: number },
  dt: number,
  mode: ViewMode,
  solids: readonly Entity[],
  colliders: readonly Entity[],
): void {
  const a = v.vehicle;
  const b = other.vehicle;
  if (!a || !b) return;
  let dx = other.pos.x - v.pos.x;
  let dz = mode === '2d-side' ? 0 : other.pos.z - v.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 1e-9) return;
  dx /= dist;
  dz /= dist;
  const closing = wanted.x * dx + wanted.z * dz - (other.vel.x * dx + other.vel.z * dz);
  if (closing <= 0) return;
  if (closing > (a.spec.crashSpeed ?? CRASH_SPEED) && a.hitCooldown <= 0 && b.hitCooldown <= 0) {
    a.hitSeq++;
    a.hitWith = other.id;
    b.hitSeq++;
    b.hitWith = v.id;
  }
  a.hitCooldown = b.hitCooldown = CRASH_COOLDOWN;
  const push = closing * (a.spec.shoveShare ?? SHOVE_SHARE) * dt;
  const around = { list: colliders.filter((o) => o !== other && o !== v), hit: new Set<Entity>() };
  moveAxis(other, 'x', dx * push, solids, around);
  if (mode !== '2d-side') moveAxis(other, 'z', dz * push, solids, around);
}

/** The solid robot chassis that an item lying on (or landing on) its top rests on. Items pass through everything else of a chassis. */
function supportsOf(item: Entity, robots: readonly Entity[]): Entity[] {
  return robots.filter((r) => restsOnChassis(item, r));
}

/**
 * Advance all visible characters and loose items by dt against solid visible blocks; carried items follow.
 * `g` is the pull in units/s² (negative; -30 unless the world has its own gravity). With a crate engine, rigid items are
 * moved by it at the end of the tick instead of by the plain item rules.
 */
export function stepPhysics(
  entities: readonly Entity[],
  dt: number,
  mode: ViewMode,
  yaw: number,
  rules: BodyRules | null = null,
  g: number = GRAVITY,
  crates: CrateEngine | null = null,
): void {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const solids = entities.filter((e) => e.visible && e.solid && e.kind === 'block');

  // Solid vehicles stop people on foot (but not the vehicles themselves, which only hit blocks).
  const vehicleSolids = entities.filter((e) => (e.kind === 'vehicle' || e.kind === 'robot') && e.visible && e.solid);
  const walkSolids = vehicleSolids.length > 0 ? [...solids, ...vehicleSolids] : solids;

  // Belts and moving vehicles carry what rests on them, before the riders move on their own.
  const solidsFor = (e: Entity): readonly Entity[] => (e.kind === 'character' ? walkSolids : solids);
  const carry = (e: Entity, axis: Axis, d: number, against: readonly Entity[]): void => void moveAxis(e, axis, d, against);
  carryOnBelts(entities, dt, mode, carry, solidsFor);
  const rides = vehicleRides(entities, mode);

  // Solid bodies (puzzle levels): characters and loose items stop each other, and what a character carries goes with it.
  const bodies = rules ? entities.filter(isSolidBody) : [];
  if (rules && mode === '3d') updateCarryFloors(entities, rules, (h, it) => carryAt(h, it, mode, rules));
  const extrasFor = (e: Entity): Extras | undefined => {
    if (!rules) return undefined;
    const soft = bodies.filter((b) => b !== e && b.heldBy !== e.id);
    const heldId = e.kind === 'character' ? e.holding : null;
    const held = heldId !== null ? byId.get(heldId) : undefined;
    if (!held || held.inHand || held.heldBy !== e.id) return { soft };
    return { soft, carried: { item: held, at: (h) => carryAt(h, held, mode, rules) } };
  };

  const colliders = entities.filter((e) => e.kind === 'vehicle' && e.visible && e.vehicle?.spec.collide !== false);
  for (const c of entities) {
    if (c.kind === 'vehicle' && c.visible) stepVehicle(c, dt, mode, yaw, g, solids, colliders);
  }
  // Real physics: solid chassis on wheel traction are solid for each other too (without it they pass through, as on every older board).
  const tractionChassis = entities.filter((e) => e.kind === 'robot' && e.visible && e.solid && e.robot?.traction === true);
  const meets: ChassisMeets | null = tractionChassis.length > 1 ? { chassis: tractionChassis, shoved: new Map(), stepped: new Set() } : null;
  for (const c of entities) {
    if (c.kind === 'robot' && c.visible) stepRobot(c, dt, mode, g, solids, entities, c.robot?.traction === true ? meets : null);
  }
  carryVehicleRiders(rides, mode, carry, solidsFor);
  for (const c of entities) {
    if (c.kind !== 'character' || !c.visible) continue;
    const seat = c.seatedIn !== null ? entities.find((e) => e.id === c.seatedIn) : undefined;
    if (seat) {
      // A driver rides along with the vehicle and ignores its own controls.
      Object.assign(c.pos, seatPosition(seat, c));
      c.vel.x = c.vel.y = c.vel.z = 0;
      c.onGround = false;
      c.facing = { ...seat.facing };
      continue;
    }
    applyIntent(c, mode, yaw);

    if (mode === '2d-top') {
      c.vel.y = 0;
    } else {
      c.vel.y = Math.max(-TERMINAL_SPEED, c.vel.y + gravityOf(c, g) * dt);
    }
    if (mode === '2d-side') c.pos.z = 0;

    const extras = extrasFor(c);
    c.onGround = integrate(c, dt, mode, walkSolids, undefined, extras);
    if (rules && extras?.carried) settleCarried(c, extras.carried.item, [...walkSolids, ...extras.soft], rules, mode);
  }

  const cargo = cargoPositions(entities, mode);
  // Loose items rest on the top of a solid robot chassis; they pass through it everywhere else.
  const chassis = mode === '2d-top' ? [] : entities.filter((e) => e.kind === 'robot' && e.visible && e.solid);
  for (const item of entities) {
    if (item.kind !== 'item' || !item.visible || item.bullet) continue;
    const holder = item.heldBy !== null ? byId.get(item.heldBy) : undefined;
    if (holder) {
      const slot = cargo.get(item.id);
      if (slot) Object.assign(item.pos, slot);
      else if (item.inHand) Object.assign(item.pos, handPosition(holder, item, mode));
      else if (rules) Object.assign(item.pos, approach(item.pos, carryAt(holder, item, mode, rules), LIFT_SPEED * dt));
      else Object.assign(item.pos, carryAt(holder, item, mode, rules));
      item.vel.x = 0;
      item.vel.y = 0;
      item.vel.z = 0;
      item.onGround = false;
      // A crate taken up turned rides with the same turn against its holder's heading, and is drawn and sensed that way.
      if (item.heldTurn) item.rot = mulQuat(yawQuat(holder.facing), item.heldTurn);
    } else if (!item.rigid) {
      const held = chassis.length > 0 ? supportsOf(item, chassis) : [];
      stepFreeItem(item, dt, mode, g, held.length > 0 ? [...solids, ...held] : solids, extrasFor(item));
    }
  }
  crates?.step(entities, dt);
}

/** True when the box overlaps a solid block (used to keep dropped items out of walls). */
export function overlapsSolid(box: Entity, solids: readonly Entity[]): boolean {
  return solids.some((s) => overlapsAll(box, s));
}
