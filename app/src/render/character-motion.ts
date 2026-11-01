import type { ViewMode } from '../engine/types';
import { clamp } from './cameras';

/** Horizontal speed (units/s) below which the figure counts as standing still. */
export const WALK_SPEED_MIN = 0.3;
/** Smoothed |vertical speed| (units/s) above which the figure counts as airborne. */
export const AIRBORNE_SPEED_MIN = 0.8;
/** Horizontal speed (units/s) at which the walk swing reaches full amplitude. */
const WALK_SPEED_FULL = 3;
/** Frame position jumps larger than this are teleports (restart, respawn), not movement. */
export const TELEPORT_DISTANCE = 4;

/** What a character style needs to know to pick its pose; computed once per frame. */
export interface Motion {
  /** Horizontal speed in units/s. */
  speed: number;
  /** Walk swing intensity, 0 (still) .. 1 (full run). */
  amp: number;
  walking: boolean;
  airborne: boolean;
  /** Walk cycle angle in radians; advances faster with speed. */
  phase: number;
  /** Seconds since the figure appeared; drives idle animation. */
  time: number;
  /** Smoothed vertical speed in units/s (positive = rising); lets a look tell a jump from a fall. */
  vy: number;
  /** Holding something out front (the stage's carry pose); only some looks react, and only when the scene asks for it. */
  carrying?: boolean;
}

export function walkPhaseRate(speed: number): number {
  return 6 + Math.max(0, speed) * 1.2;
}

export function motionOf(speed: number, airborne: boolean, phase: number, time: number, vy = 0): Motion {
  return {
    speed,
    amp: clamp(speed / WALK_SPEED_FULL, 0, 1),
    walking: speed >= WALK_SPEED_MIN,
    airborne,
    phase,
    time,
    vy,
  };
}

/** Yaw (rotation about Y) that makes a figure built facing +X look along (dx, dz). */
export function yawToward(dx: number, dz: number): number {
  return Math.atan2(-dz, dx);
}

/** Facing used before the figure has ever moved: +X in side view, toward the camera otherwise. */
export function defaultYaw(mode: ViewMode): number {
  return mode === '2d-side' ? 0 : yawToward(0, 1);
}

/** Wrap an angle difference into (-PI, PI]. */
export function shortestAngle(delta: number): number {
  const twoPi = Math.PI * 2;
  let d = delta % twoPi;
  if (d > Math.PI) d -= twoPi;
  else if (d <= -Math.PI) d += twoPi;
  return d;
}

export function smoothAngle(current: number, target: number, dt: number, rate = 12): number {
  return current + shortestAngle(target - current) * (1 - Math.exp(-rate * dt));
}

/** Yaw to turn toward given horizontal velocity; keeps `current` while (nearly) still. */
export function facingTarget(mode: ViewMode, vx: number, vz: number, current: number): number {
  if (mode === '2d-side') {
    if (Math.abs(vx) < WALK_SPEED_MIN) return current;
    return vx > 0 ? 0 : Math.PI;
  }
  if (Math.hypot(vx, vz) < WALK_SPEED_MIN) return current;
  return yawToward(vx, vz);
}

/** Portion of a swing spent winding up, then striking; the rest is the return to rest. */
const SWING_WINDUP_END = 0.35;
const SWING_STRIKE_END = 0.65;
const SWING_BACK = 2.3;
const SWING_FOLLOW_THROUGH = -0.2;

/**
 * Arm angle (radians about the lateral axis, positive = toward the facing side) for a swing at `progress`
 * 0..1: raise back, strike down and forward, settle at rest. 0 outside the swing.
 */
export function swingAngle(progress: number): number {
  const p = clamp(progress, 0, 1);
  if (p <= SWING_WINDUP_END) {
    const t = p / SWING_WINDUP_END;
    return SWING_BACK * (1 - (1 - t) * (1 - t));
  }
  if (p <= SWING_STRIKE_END) {
    const t = (p - SWING_WINDUP_END) / (SWING_STRIKE_END - SWING_WINDUP_END);
    return SWING_BACK + (SWING_FOLLOW_THROUGH - SWING_BACK) * t * t;
  }
  const t = (p - SWING_STRIKE_END) / (1 - SWING_STRIKE_END);
  return SWING_FOLLOW_THROUGH * (1 - t);
}

/** Small forward step (figure units) that leans the whole body into a swing. */
export function swingLunge(progress: number): number {
  const p = clamp(progress, 0, 1);
  return Math.sin(Math.PI * p) * 0.12;
}
