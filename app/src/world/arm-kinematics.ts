import type { Vec3, ViewMode } from '../engine/types';

/**
 * Forward kinematics and joint dynamics of a robot arm (pure functions, no world access).
 *
 * A frame is a point with a heading: `yaw` turns about the vertical axis (0 = along +x; the same turn the 3D view draws),
 * `pitch` raises the pointing direction above the horizontal (0 = level, +90 deg = straight up). Pieces chain frames:
 * base -> joint -> link -> joint -> link -> gripper. Local offsets use x = along the arm, y = up from the arm, z = sideways.
 */

export interface Frame {
  pos: Vec3;
  /** Radians about the vertical axis. */
  yaw: number;
  /** Radians above the horizontal. */
  pitch: number;
}

export type JointAxis = 'pitch' | 'yaw';

export const DEG = Math.PI / 180;

/** Unit vector the frame points along. */
export function dirOf(f: Frame): Vec3 {
  const c = Math.cos(f.pitch);
  return { x: c * Math.cos(f.yaw), y: Math.sin(f.pitch), z: -c * Math.sin(f.yaw) };
}

/** Unit vector "up from the arm" (the normal in the arm's vertical plane). */
export function normalOf(f: Frame): Vec3 {
  return { x: -Math.sin(f.pitch) * Math.cos(f.yaw), y: Math.cos(f.pitch), z: Math.sin(f.pitch) * Math.sin(f.yaw) };
}

/** Unit vector sideways, always horizontal. */
export function lateralOf(f: Frame): Vec3 {
  return { x: Math.sin(f.yaw), y: 0, z: Math.cos(f.yaw) };
}

function add(a: Vec3, b: Vec3, k = 1): Vec3 {
  return { x: a.x + b.x * k, y: a.y + b.y * k, z: a.z + b.z * k };
}

/** The point at `local` (x along, y up from the arm, z sideways) in the frame. */
export function localToWorld(f: Frame, local: Vec3): Vec3 {
  let p = f.pos;
  p = add(p, dirOf(f), local.x);
  p = add(p, normalOf(f), local.y);
  p = add(p, lateralOf(f), local.z);
  return p;
}

/** The same frame moved `length` metres along its direction. */
export function advance(f: Frame, length: number): Frame {
  return { pos: add(f.pos, dirOf(f), length), yaw: f.yaw, pitch: f.pitch };
}

/**
 * The frame after a joint turned by `rad`. The flat views show one rotation only: the side view has no yaw
 * (a yaw joint leaves the arm where it is) and the top view has no pitch.
 */
export function rotateFrame(f: Frame, axis: JointAxis, rad: number, mode: ViewMode): Frame {
  if (axis === 'yaw') return mode === '2d-side' ? { ...f } : { pos: f.pos, yaw: f.yaw + rad, pitch: f.pitch };
  return mode === '2d-top' ? { ...f } : { pos: f.pos, yaw: f.yaw, pitch: f.pitch + rad };
}

/** Horizontal distance (m) of `point` from the pivot, measured along the pivot's heading: the lever arm of its weight about a pitch joint. */
export function horizontalArm(pivot: Frame, point: Vec3): number {
  const h = { x: Math.cos(pivot.yaw), z: -Math.sin(pivot.yaw) };
  return Math.abs((point.x - pivot.pos.x) * h.x + (point.z - pivot.pos.z) * h.z);
}

/** Length (m) of an axis-aligned box of `size` measured along the unit `axis` (how wide the box is between two fingers). */
export function extentAlong(axis: Vec3, size: Vec3): number {
  return Math.abs(axis.x) * size.x + Math.abs(axis.y) * size.y + Math.abs(axis.z) * size.z;
}

/** Wraps degrees into (-180, 180]. */
export function wrapDeg(d: number): number {
  let r = ((d + 180) % 360 + 360) % 360 - 180;
  if (r === -180) r = 180;
  return r;
}

/** Which way gravity turns a pitch joint: -1 = angle decreases, +1 = increases, given the absolute pitch of the beam beyond it. */
export function sagDirection(absolutePitchDeg: number): -1 | 1 {
  const a = wrapDeg(absolutePitchDeg);
  return a > -90 && a <= 90 ? -1 : 1;
}

export interface JointStepInput {
  /** Current joint angle (deg) and where it was told to go (already inside the limits). */
  angle: number;
  target: number;
  min: number;
  max: number;
  maxSpeedDegPerS: number;
  maxTorqueNm: number;
  /** Holding torque the load needs right now (N m). */
  requiredNm: number;
  /** false = no signal on "Bật": the servo holds nothing. */
  powered: boolean;
  /** Direction gravity turns the joint (see sagDirection). */
  sag: -1 | 1;
  dt: number;
}

export interface JointStepResult {
  angle: number;
  overloaded: boolean;
}

const TORQUE_EPS = 1e-9;
/** Share of the max torque a joint may use while still lifting. */
const HOLD_BAND = 0.995;

/**
 * One tick of a servo. Within its torque it moves toward the target at up to its max speed. Beyond it (or unpowered)
 * it cannot hold: the load turns it down at a speed proportional to the excess, from 0 up to its max speed.
 */
export function stepJoint(i: JointStepInput): JointStepResult {
  const capacity = i.powered ? Math.max(0, i.maxTorqueNm) : 0;
  const excess = i.requiredNm - capacity;
  const speed = Math.max(0, i.maxSpeedDegPerS);
  let angle = i.angle;
  const overloaded = excess > TORQUE_EPS;
  if (overloaded) {
    const ratio = Math.min(1, excess / Math.max(i.maxTorqueNm, TORQUE_EPS));
    angle += i.sag * speed * ratio * i.dt;
  } else if (i.powered) {
    const step = speed * i.dt;
    const d = i.target - angle;
    // Lifting against the load is allowed only with a hair of torque to spare, so a joint at its limit holds nearly still instead of twitching.
    const lifting = Math.sign(d) === -i.sag;
    if (!lifting || i.requiredNm <= capacity * HOLD_BAND) angle = Math.abs(d) <= step ? i.target : angle + Math.sign(d) * step;
  }
  return { angle: Math.min(i.max, Math.max(i.min, angle)), overloaded };
}
