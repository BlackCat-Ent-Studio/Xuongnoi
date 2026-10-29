import type { Vec3, ViewMode } from '../engine/types';
import { cargoPositions } from './cargo';
import { lockMotion } from './combat';
import type { Entity } from './entity';
import { isSpinner, spinnerTouches } from './platforms';
import { driveVehicle, seatPosition, settleVehicle, vehicleFacing } from './vehicles';

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
  return (
    Math.min(a.pos[axis] + a.size[axis] / 2, b.pos[axis] + b.size[axis] / 2) -
    Math.max(a.pos[axis] - a.size[axis] / 2, b.pos[axis] - b.size[axis] / 2)
  );
}

function overlapsAll(a: Entity, b: Entity): boolean {
  return overlapOn(a, b, 'x') > SKIN && overlapOn(a, b, 'y') > SKIN && overlapOn(a, b, 'z') > SKIN;
}

/** Overlapping or within CONTACT_EPS on every axis. */
export function touching(a: Entity, b: Entity): boolean {
  // A spinning block touches through its rotated outline, not its bounding box.
  if (isSpinner(a)) return spinnerTouches(a, b);
  if (isSpinner(b)) return spinnerTouches(b, a);
  return (
    Math.abs(a.pos.x - b.pos.x) <= (a.size.x + b.size.x) / 2 + CONTACT_EPS &&
    Math.abs(a.pos.y - b.pos.y) <= (a.size.y + b.size.y) / 2 + CONTACT_EPS &&
    Math.abs(a.pos.z - b.pos.z) <= (a.size.z + b.size.z) / 2 + CONTACT_EPS
  );
}

/** Move along one axis by `delta`, pushing out of solid blocks. Returns true if blocked. */
function moveAxis(c: Entity, axis: Axis, delta: number, solids: readonly Entity[]): boolean {
  if (delta === 0) return false;
  c.pos[axis] += delta;
  let blocked = false;
  for (const b of solids) {
    if (!overlapsAll(c, b)) continue;
    const half = (c.size[axis] + b.size[axis]) / 2;
    c.pos[axis] = delta > 0 ? b.pos[axis] - half : b.pos[axis] + half;
    blocked = true;
  }
  return blocked;
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
function integrate(c: Entity, dt: number, mode: ViewMode, solids: readonly Entity[]): boolean {
  const maxDist = Math.max(Math.abs(c.vel.x), Math.abs(c.vel.y), Math.abs(c.vel.z)) * dt;
  const n = Math.max(1, Math.ceil(maxDist / MAX_SUBSTEP_DISTANCE));
  const sub = dt / n;
  let grounded = false;
  for (let i = 0; i < n; i++) {
    if (moveAxis(c, 'x', c.vel.x * sub, solids)) c.vel.x = 0;
    if (mode !== '2d-top') {
      const dy = c.vel.y * sub;
      if (moveAxis(c, 'y', dy, solids)) {
        if (dy < 0) grounded = true;
        c.vel.y = 0;
      }
    }
    if (mode !== '2d-side' && moveAxis(c, 'z', c.vel.z * sub, solids)) c.vel.z = 0;
  }
  return grounded;
}

/** Sliding items lose horizontal speed at this rate per second (on the ground; gentler on the top-down floor). */
const ITEM_FRICTION = 10;
const ITEM_FRICTION_TOP = 3;
/** Below this horizontal speed a sliding item stops dead. */
const ITEM_STOP_SPEED = 0.05;

function stepFreeItem(item: Entity, dt: number, mode: ViewMode, solids: readonly Entity[]): void {
  if (mode === '2d-top') item.vel.y = 0;
  else item.vel.y = Math.max(-TERMINAL_SPEED, item.vel.y + GRAVITY * dt);
  if (mode === '2d-side') {
    item.pos.z = 0;
    item.vel.z = 0;
  }
  item.onGround = integrate(item, dt, mode, solids);
  if (item.onGround || mode === '2d-top') {
    const k = Math.max(0, 1 - (mode === '2d-top' ? ITEM_FRICTION_TOP : ITEM_FRICTION) * dt);
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

/** One tick of a vehicle: stick -> speed and heading -> velocity, then the usual fall and collision against blocks. */
function stepVehicle(v: Entity, dt: number, mode: ViewMode, yaw: number, solids: readonly Entity[]): void {
  const body = v.vehicle;
  if (!body) return;
  const flat = driveVehicle(body, dt, mode, yaw);
  const wanted = { x: flat.x, z: flat.z };
  v.vel.x = flat.x;
  v.vel.z = flat.z;
  v.facing = vehicleFacing(body, mode);
  if (mode === '2d-top') v.vel.y = 0;
  else v.vel.y = Math.max(-TERMINAL_SPEED, v.vel.y + GRAVITY * dt);
  if (mode === '2d-side') v.pos.z = 0;
  v.onGround = integrate(v, dt, mode, solids);
  settleVehicle(body, v.vel, wanted, dt, mode);
  v.facing = vehicleFacing(body, mode);
}

/** Advance all visible characters and loose items by dt against solid visible blocks; carried items follow. */
export function stepPhysics(entities: readonly Entity[], dt: number, mode: ViewMode, yaw: number): void {
  const solids = entities.filter((e) => e.visible && e.solid && e.kind === 'block');

  // Solid vehicles stop people on foot (but not the vehicles themselves, which only hit blocks).
  const vehicleSolids = entities.filter((e) => e.kind === 'vehicle' && e.visible && e.solid);
  const walkSolids = vehicleSolids.length > 0 ? [...solids, ...vehicleSolids] : solids;

  for (const c of entities) {
    if (c.kind === 'vehicle' && c.visible) stepVehicle(c, dt, mode, yaw, solids);
  }
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
      c.vel.y = Math.max(-TERMINAL_SPEED, c.vel.y + GRAVITY * dt);
    }
    if (mode === '2d-side') c.pos.z = 0;

    c.onGround = integrate(c, dt, mode, walkSolids);
  }

  const byId = new Map(entities.map((e) => [e.id, e]));
  const cargo = cargoPositions(entities, mode);
  for (const item of entities) {
    if (item.kind !== 'item' || !item.visible || item.bullet) continue;
    const holder = item.heldBy !== null ? byId.get(item.heldBy) : undefined;
    if (holder) {
      const slot = cargo.get(item.id);
      if (slot) Object.assign(item.pos, slot);
      else Object.assign(item.pos, item.inHand ? handPosition(holder, item, mode) : holdPosition(holder, item, mode));
      item.vel.x = 0;
      item.vel.y = 0;
      item.vel.z = 0;
      item.onGround = false;
    } else {
      stepFreeItem(item, dt, mode, solids);
    }
  }
}

/** True when the box overlaps a solid block (used to keep dropped items out of walls). */
export function overlapsSolid(box: Entity, solids: readonly Entity[]): boolean {
  return solids.some((s) => overlapsAll(box, s));
}
