/**
 * Steering of a two-sided (differential) robot toward a point on the floor. Pure maths, no world access: it reads where
 * the chassis is and which way it faces, and answers with a power for the wheels of the left side and of the right side
 * (-1..1, what the "Động cơ" piece takes). It never moves anything itself.
 *
 * Conventions (shared with robot-drive.ts): heading 0 = +x, growing CLOCKWISE seen from above, so the bearing of a point
 * is atan2(dz, dx) and a positive heading error means the point lies to the robot's right. Turning right = the left
 * wheels faster than the right ones.
 */

const DEG = 180 / Math.PI;

export interface GotoGains {
  /** Highest power either side is given, 0..1. */
  power: number;
  /** Turn power per degree of heading error. */
  turnGain: number;
  /** Turn power taken off per degree/second the chassis is already turning (keeps the nose from swinging past). */
  turnDamp: number;
  /** Heading error (degrees) from which the robot stops driving forward and turns on the spot. */
  pivotAngle: number;
  /** Distance (m) from which the forward power falls in proportion to what is left. */
  slowDistance: number;
  /** Within this distance (m) the robot has arrived. */
  tolerance: number;
  /** Lowest forward power while still on the way, so the last centimetres do not take forever. */
  minPower: number;
}

export interface GotoPose {
  x: number;
  z: number;
  /** Radians. */
  heading: number;
  /** Radians per second, positive = turning right. */
  turnRate: number;
}

export interface GotoCommand {
  left: number;
  right: number;
  /** Metres from the chassis middle to the goal. */
  distance: number;
  /** Degrees the nose must turn to point at the goal (or at the wanted final heading once there); positive = to the right. */
  headingError: number;
  /** True while within the tolerance (with a little slack to leave again, so the answer never flickers). */
  near: boolean;
  /** True while near and, when a final heading is asked for, facing it. */
  arrived: boolean;
}

/** What the controller remembers between ticks. */
export interface GotoMemory {
  near: boolean;
  faced: boolean;
  /** Distance to the goal on the tick before (null before the first tick), to notice the robot rolling past the middle. */
  last: number | null;
}

/** Leaving again takes this many times the tolerance (plus a centimetre), so a robot resting on the edge stays "arrived". */
const LEAVE_FACTOR = 1.5;
const LEAVE_EXTRA = 0.01;
/** The robot keeps rolling to this share of the tolerance, so it stops near the middle of the goal and not on its rim. */
const STOP_SHARE = 0.25;
/** Final heading: reached within this many degrees, lost again beyond twice that. */
export const FACE_TOLERANCE_DEG = 2;

/** `a` in degrees wrapped to (-180, 180]. */
export function wrapDeg(a: number): number {
  const d = ((a % 360) + 360) % 360;
  return d > 180 ? d - 360 : d;
}

const limit = (x: number, m: number): number => Math.max(-m, Math.min(m, x));

function turnPower(errorDeg: number, pose: GotoPose, g: GotoGains): number {
  return limit(g.turnGain * errorDeg - g.turnDamp * pose.turnRate * DEG, g.power);
}

/**
 * One tick of steering. `sideView`: the robot only rolls along x, so it drives forward or backward and never turns.
 * `faceDeg` (optional): the heading to turn to after arriving. `run` false = both sides get 0, the read-outs stay true.
 */
export function gotoStep(pose: GotoPose, goal: { x: number; z: number }, g: GotoGains, memory: GotoMemory, run: boolean, sideView: boolean, faceDeg: number | null = null): GotoCommand {
  const dx = goal.x - pose.x;
  const dz = sideView ? 0 : goal.z - pose.z;
  const distance = Math.hypot(dx, dz);
  const tolerance = Math.max(0, g.tolerance);
  const power = Math.max(0, Math.min(1, g.power));
  const gains = { ...g, power };
  const bearingError = sideView ? 0 : wrapDeg(Math.atan2(dz, dx) * DEG - pose.heading * DEG);
  const receding = memory.last !== null && distance > memory.last + 1e-9;
  memory.last = distance;
  if (memory.near) memory.near = distance <= tolerance * LEAVE_FACTOR + LEAVE_EXTRA;
  // Inside the tolerance the robot is there once it is at the middle, has rolled past it, or would have to turn round for the last centimetres.
  else memory.near = distance <= tolerance && (distance <= tolerance * STOP_SHARE || receding || Math.abs(bearingError) >= g.pivotAngle || !run);

  if (memory.near) {
    const error = faceDeg === null || sideView ? 0 : wrapDeg(faceDeg - pose.heading * DEG);
    memory.faced = Math.abs(error) <= (memory.faced ? FACE_TOLERANCE_DEG * 2 : FACE_TOLERANCE_DEG);
    if (memory.faced || !run) return { left: 0, right: 0, distance, headingError: error, near: true, arrived: memory.faced };
    // Turning on the spot needs a floor under the power, or the last degree would take forever. Already swinging in fast: coast.
    const raw = turnPower(error, pose, gains);
    const turn = raw * error <= 0 ? 0 : Math.sign(error) * Math.max(Math.abs(raw), Math.min(power, g.minPower));
    return { left: turn, right: -turn, distance, headingError: error, near: true, arrived: false };
  }
  memory.faced = false;

  if (sideView) {
    const ahead = Math.cos(pose.heading) >= 0 ? 1 : -1;
    const forward = Math.sign(dx) * ahead * forwardPower(distance, gains);
    return { left: run ? forward : 0, right: run ? forward : 0, distance, headingError: 0, near: false, arrived: false };
  }

  const error = bearingError;
  if (!run) return { left: 0, right: 0, distance, headingError: error, near: false, arrived: false };
  // Forward power fades as the nose points away from the goal; at the pivot angle the robot only turns.
  const facing = g.pivotAngle > 0 ? Math.max(0, 1 - Math.abs(error) / g.pivotAngle) : Math.abs(error) < 1 ? 1 : 0;
  const forward = forwardPower(distance, gains) * facing;
  const turn = turnPower(error, pose, gains);
  let left = forward + turn;
  let right = forward - turn;
  // Keep the ratio of the two sides when one would go past the limit, so the curve stays the one that was asked for.
  const top = Math.max(Math.abs(left), Math.abs(right));
  if (top > power && top > 0) {
    left *= power / top;
    right *= power / top;
  }
  return { left, right, distance, headingError: error, near: false, arrived: false };
}

function forwardPower(distance: number, g: GotoGains): number {
  const eased = g.slowDistance > 0 ? Math.min(1, distance / g.slowDistance) : 1;
  return Math.min(g.power, Math.max(g.power * eased, g.minPower));
}
