import type { EntityId, Vec3, VehicleModel, VehicleSpec, ViewMode } from '../engine/types';
import type { Entity } from './entity';

/**
 * Vehicle dynamics. Pure: a vehicle body holds its heading, signed speed and the stick values of this tick;
 * `driveVehicle` turns them into a velocity, `settleVehicle` reads back how far the move really got.
 *
 * Collision uses a square footprint so turning never makes the box snag on a wall, and the path planner
 * (which plans with the entity's size) automatically leaves room for the whole vehicle.
 */

export interface VehicleDims {
  /** Footprint side (x and z size) in units. */
  footprint: number;
  height: number;
  /** Radians per second at full steering. */
  turnRate: number;
  wheelRadius: number;
  /** Height of a seated driver's feet above the vehicle's bottom. */
  seatFeet: number;
}

export const VEHICLE_DIMS: Readonly<Record<VehicleModel, VehicleDims>> = {
  car: { footprint: 1.5, height: 0.8, turnRate: 2.8, wheelRadius: 0.2, seatFeet: 0.3 },
  bike: { footprint: 1.2, height: 0.8, turnRate: 3.6, wheelRadius: 0.24, seatFeet: 0.5 },
  truck: { footprint: 2, height: 1.2, turnRate: 2, wheelRadius: 0.3, seatFeet: 0.6 },
};

export function vehicleSize(model: VehicleModel): Vec3 {
  const d = VEHICLE_DIMS[model];
  return { x: d.footprint, y: d.height, z: d.footprint };
}

/** Mutable per-vehicle state kept on the world entity. */
export interface VehicleBody {
  spec: VehicleSpec;
  /** Direction of travel on the ground plane: forward = (cos, sin) over (x, z). 0 = +x. */
  heading: number;
  /** Signed forward speed in units/s (side view: along +x). */
  speed: number;
  /** Total wheel rotation in radians (for drawing). */
  wheelSpin: number;
  inputX: number;
  inputY: number;
  /** True = brake to a standstill whatever the stick says. */
  stop: boolean;
  driver: EntityId | null;
  /** Crashes with other vehicles so far, and the vehicle hit last. */
  hitSeq: number;
  hitWith: EntityId | null;
  /** Seconds during which a continuing contact does not count as a new crash. */
  hitCooldown: number;
  /** Items per layer on the bed, set by a cargo node (see `normalizeCells`). Omitted = the default layout. */
  cargoCells?: number;
}

export function createVehicleBody(spec: VehicleSpec): VehicleBody {
  return {
    spec: {
      model: spec.model,
      steerMode: spec.steerMode,
      maxSpeed: positive(spec.maxSpeed, 8),
      accel: positive(spec.accel, 8),
      collide: spec.collide !== false,
      brakeFactor: positive(spec.brakeFactor, BRAKE_FACTOR),
      reverseShare: positive(spec.reverseShare, REVERSE_SHARE),
      crashSpeed: positive(spec.crashSpeed, CRASH_SPEED),
      shoveShare: nonNegative(spec.shoveShare, SHOVE_SHARE),
    },
    heading: 0,
    speed: 0,
    wheelSpin: 0,
    inputX: 0,
    inputY: 0,
    stop: false,
    driver: null,
    hitSeq: 0,
    hitWith: null,
    hitCooldown: 0,
  };
}

/** Braking and coasting to a stop is stronger than speeding up. */
export const BRAKE_FACTOR = 2;
/** In "direction" steering the vehicle turns faster than in throttle steering: it is the easy mode. */
const DIRECTION_TURN_BOOST = 1.6;
/** Throttle steering needs this share of top speed before the wheels bite fully. */
const STEER_FULL_AT = 0.35;
/** Reverse is slower than forward. */
export const REVERSE_SHARE = 0.4;
/** Closing speed (units/s) above which a touch counts as a crash rather than a nudge. */
export const CRASH_SPEED = 1.5;
/** Share of the closing speed passed on to the vehicle that was hit (it is shoved a little, not launched). */
export const SHOVE_SHARE = 0.25;
/** Stick below this length counts as "no input" in direction steering. */
const STICK_DEAD_ZONE = 0.05;
/** Slowest a misaligned vehicle may crawl while it turns toward its target direction. */
const MIN_ALIGN_SHARE = 0.15;

function positive(n: number | undefined, fallback: number): number {
  return n !== undefined && Number.isFinite(n) && n > 0 ? n : fallback;
}

function nonNegative(n: number | undefined, fallback: number): number {
  return n !== undefined && Number.isFinite(n) && n >= 0 ? n : fallback;
}

function clamp1(n: number): number {
  return Number.isFinite(n) ? Math.max(-1, Math.min(1, n)) : 0;
}

function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let d = a % twoPi;
  if (d > Math.PI) d -= twoPi;
  else if (d <= -Math.PI) d += twoPi;
  return d;
}

/** Moves `current` toward `target` by at most `rate * dt`. */
function approach(current: number, target: number, rate: number, dt: number): number {
  const step = rate * dt;
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

/** The ground-plane direction a stick points in; same mapping as a character's (3D sticks turn with the camera). */
export function stickDirection(mode: ViewMode, yaw: number, mx: number, my: number): { x: number; z: number } {
  if (mode === '2d-side') return { x: mx, z: 0 };
  if (mode === '2d-top') return { x: mx, z: -my };
  const sin = Math.sin(yaw);
  const cos = Math.cos(yaw);
  return { x: cos * mx - sin * my, z: -sin * mx - cos * my };
}

function speedRate(body: VehicleBody, target: number): number {
  const braking = Math.abs(target) < Math.abs(body.speed) || Math.sign(target) * Math.sign(body.speed) < 0;
  return body.spec.accel * (braking ? (body.spec.brakeFactor ?? BRAKE_FACTOR) : 1);
}

/** Updates heading and speed from the stick and returns the velocity on the ground plane. */
export function driveVehicle(body: VehicleBody, dt: number, mode: ViewMode, yaw: number): { x: number; z: number } {
  const { spec } = body;
  const dims = VEHICLE_DIMS[spec.model];
  const ix = body.stop ? 0 : clamp1(body.inputX);
  const iy = body.stop ? 0 : clamp1(body.inputY);

  if (mode === '2d-side') {
    // Left/right only: the stick sets the speed, the nose points where it goes.
    const target = ix * spec.maxSpeed;
    body.speed = approach(body.speed, target, speedRate(body, target), dt);
    if (body.speed > 0.05) body.heading = 0;
    else if (body.speed < -0.05) body.heading = Math.PI;
    return { x: body.speed, z: 0 };
  }

  if (spec.steerMode === 'direction') {
    const dir = stickDirection(mode, yaw, ix, iy);
    const mag = Math.min(1, Math.hypot(dir.x, dir.z));
    let target = 0;
    if (mag > STICK_DEAD_ZONE) {
      const diff = wrapAngle(Math.atan2(dir.z, dir.x) - body.heading);
      const maxTurn = dims.turnRate * DIRECTION_TURN_BOOST * dt;
      const turn = Math.max(-maxTurn, Math.min(maxTurn, diff));
      body.heading = wrapAngle(body.heading + turn);
      target = mag * spec.maxSpeed * Math.max(MIN_ALIGN_SHARE, Math.cos(diff - turn));
    }
    body.speed = approach(body.speed, target, speedRate(body, target), dt);
  } else {
    // Gas / steer: up is gas, down is brake then reverse, left/right turns while rolling.
    const target = iy >= 0 ? iy * spec.maxSpeed : iy * spec.maxSpeed * (spec.reverseShare ?? REVERSE_SHARE);
    body.speed = approach(body.speed, target, speedRate(body, target), dt);
    const grip = Math.min(1, Math.abs(body.speed) / (spec.maxSpeed * STEER_FULL_AT));
    body.heading = wrapAngle(body.heading + ix * dims.turnRate * grip * Math.sign(body.speed) * dt);
  }
  return { x: Math.cos(body.heading) * body.speed, z: Math.sin(body.heading) * body.speed };
}

/** After the physics move: the speed that is left once walls took their share, and the wheel rotation. */
export function settleVehicle(
  body: VehicleBody,
  vel: { x: number; z: number },
  wanted: { x: number; z: number },
  dt: number,
  mode: ViewMode,
): void {
  const moved = Math.hypot(vel.x, vel.z);
  const intended = Math.hypot(wanted.x, wanted.z);
  if (mode === '2d-side') {
    body.speed = vel.x; // signed along x; the nose flips with the direction
  } else if (intended > 1e-9 && moved < intended - 1e-9) {
    // A wall took part of the move: scrape along it (nose turns parallel) instead of losing all speed against it.
    if (moved > 1e-6) {
      const reversing = body.speed < 0;
      body.heading = wrapAngle(Math.atan2(vel.z, vel.x) + (reversing ? Math.PI : 0));
      body.speed = reversing ? -moved : moved;
    } else {
      body.speed = 0;
    }
  }
  const along = vel.x * Math.cos(body.heading) + vel.z * Math.sin(body.heading);
  body.wheelSpin += (along * dt) / VEHICLE_DIMS[body.spec.model].wheelRadius;
}

/** Unit direction the nose points in. */
export function vehicleFacing(body: VehicleBody, mode: ViewMode): Vec3 {
  if (mode === '2d-side') return { x: Math.cos(body.heading) >= 0 ? 1 : -1, y: 0, z: 0 };
  return { x: Math.cos(body.heading), y: 0, z: Math.sin(body.heading) };
}

/** Where a seated driver's body center rides: over the vehicle's middle, feet on the seat. */
export function seatPosition(vehicle: Entity, driver: Entity): Vec3 {
  const dims = VEHICLE_DIMS[vehicle.vehicle?.spec.model ?? 'car'];
  return {
    x: vehicle.pos.x,
    y: vehicle.pos.y - vehicle.size.y / 2 + dims.seatFeet + driver.size.y / 2,
    z: vehicle.pos.z,
  };
}
