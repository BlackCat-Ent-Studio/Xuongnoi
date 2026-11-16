import type { RobotSpec, RobotWheelSpec } from '../engine/types';

/**
 * Robot drive train. Pure maths, no world access.
 *
 * Every motor is a wheel at a mount point on the chassis (`side`: metres to the right of the centre line, negative =
 * left; `forward`: metres ahead of the centre). A wheel pushes the chassis along its own forward direction at
 * `rpm * 2*pi * radius / 60` metres per second. The chassis forward speed and turn rate are fitted to ALL wheels at once
 * (see `solveDrive`), so one motor, two motors or six all work the same way. Nothing here knows about a "robot task":
 * only wheels, a mass and the ground.
 *
 * Sign conventions: forward speed is positive ahead. Heading and turn rate grow CLOCKWISE seen from above (heading 0 = +x,
 * 90 degrees = +z, the way the top-down view draws "down"), so a positive turn rate turns the robot to its right.
 */

/** Wheels whose side offsets are closer together than this cannot tell a turn from a straight run (metres). */
const MIN_SIDE_SPREAD = 0.05;
/** A wheel line closer to the centre than this (metres, on average) gives no turning lever at all. */
const MIN_LEVER = 0.05;
/** Push one motor can give the chassis at full grip, newtons. Chassis acceleration = force of all motors / mass. */
export const FORCE_PER_MOTOR = 6;
/** Gravity used for grip, m/s^2. */
const G = 9.81;
/** Lowest friction accepted: with none the chassis could never speed up or stop. */
const MIN_FRICTION = 0.02;
/** Shortest width used for the turning lever of the chassis, metres. */
const MIN_WIDTH = 0.1;

export interface DriveWheel {
  side: number;
  forward: number;
  radius: number;
  /** Signed wheel speed in revolutions per minute; positive pushes the chassis forward. */
  rpm: number;
}

export interface Motion {
  /** Forward speed, m/s (negative = reversing). */
  speed: number;
  /** Turn rate, rad/s (positive = turning right). */
  turn: number;
}

/** Linear speed of the wheel rim in m/s. */
export function wheelSpeed(w: Pick<DriveWheel, 'rpm' | 'radius'>): number {
  return (w.rpm * 2 * Math.PI * w.radius) / 60;
}

/**
 * The forward speed and turn rate the wheels ask for. A rigid chassis moving at `v` and turning at `w` carries the point
 * at side offset `s` along at `v - w*s`, so each wheel gives one equation `speed_i = v - w*s_i`. With wheels at two or
 * more different side offsets the least-squares answer is used (two wheels give exactly `w = (left - right) / track`).
 * When every wheel sits on the same line (one motor, or a row of them) the turn cannot be measured; the chassis then
 * pivots around the point that wheel line is pushing: `v` = average wheel speed, `w = -v * s / s^2` (a lone motor off
 * centre drives the robot round a circle of radius |s|). No wheels = no motion.
 */
export function solveDrive(wheels: readonly DriveWheel[]): Motion {
  const n = wheels.length;
  if (n === 0) return { speed: 0, turn: 0 };
  const speeds = wheels.map(wheelSpeed);
  const meanV = speeds.reduce((a, b) => a + b, 0) / n;
  const meanS = wheels.reduce((a, w) => a + w.side, 0) / n;
  const lo = Math.min(...wheels.map((w) => w.side));
  const hi = Math.max(...wheels.map((w) => w.side));
  if (hi - lo >= MIN_SIDE_SPREAD) {
    let cov = 0;
    let varS = 0;
    wheels.forEach((w, i) => {
      cov += (w.side - meanS) * (speeds[i]! - meanV);
      varS += (w.side - meanS) ** 2;
    });
    const turn = -cov / varS;
    return { speed: meanV + turn * meanS, turn };
  }
  const lever = wheels.reduce((a, w) => a + w.side * w.side, 0) / n;
  if (lever < MIN_LEVER * MIN_LEVER) return { speed: meanV, turn: 0 };
  const along = speeds.reduce((a, v, i) => a + v * wheels[i]!.side, 0);
  return { speed: meanV, turn: -along / (lever * n) };
}

/** Limits and feel of the chassis: how quickly it can follow what the wheels ask for. */
export interface Chassis {
  /** Kilograms. */
  mass: number;
  /** Ground grip coefficient (about 0.8 for rubber on a table, 0.1 on ice). */
  friction: number;
  /** Chassis width in metres; the lever arm for turning. */
  width: number;
}

/**
 * Linear acceleration the chassis can reach, m/s^2. Speeding up is limited by the motors' push (their number times
 * `FORCE_PER_MOTOR`, shared by the mass) and by grip (friction * g). Slowing down only needs grip, so a robot always
 * stops faster than it starts, and a slippery floor makes it coast.
 */
export function chassisAccel(c: Chassis, motors: number, braking: boolean): number {
  const grip = Math.max(MIN_FRICTION, c.friction) * G;
  if (braking) return grip;
  const push = (FORCE_PER_MOTOR * Math.max(1, motors)) / Math.max(0.01, c.mass);
  return Math.min(grip, push);
}

function approach(current: number, target: number, step: number): number {
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

/** Moves the chassis speed and turn rate one tick toward what the wheels ask for, within the acceleration limits. */
export function followWheels(current: Motion, ask: Motion, chassis: Chassis, motors: number, dt: number): Motion {
  const brakingLinear = Math.abs(ask.speed) < Math.abs(current.speed) || ask.speed * current.speed < 0;
  const a = chassisAccel(chassis, motors, brakingLinear);
  const brakingTurn = Math.abs(ask.turn) < Math.abs(current.turn) || ask.turn * current.turn < 0;
  // Turning pushes the wheels around the centre: the same force over half the width gives this angular acceleration.
  const arm = Math.max(MIN_WIDTH, chassis.width) / 2;
  const alpha = chassisAccel(chassis, motors, brakingTurn) / arm;
  return { speed: approach(current.speed, ask.speed, a * dt), turn: approach(current.turn, ask.turn, alpha * dt) };
}

/** Where one motor's rpm goes in a tick: it ramps toward `target` by at most `accel` rpm per second. */
export function motorRpmStep(rpm: number, target: number, accel: number, dt: number): number {
  return approach(rpm, target, Math.max(0, accel) * dt);
}

/** Target rpm of a motor for a power command in -1..1 (the reverse flag turns the wheel the other way). */
export function motorTargetRpm(power: number, maxRpm: number, reverse: boolean): number {
  const p = Number.isFinite(power) ? Math.max(-1, Math.min(1, power)) : 0;
  return p * Math.max(0, maxRpm) * (reverse ? -1 : 1);
}

// ---------------------------------------------------------------- state on the world entity

/** One mounted wheel as the world stores it. */
export interface MountedWheel extends DriveWheel {
  /** Wheel turning in radians, for drawing. */
  spin: number;
  /** Set by the motor node each tick; a wheel not refreshed by the next step is removed (motor unplugged or gone). */
  fresh: boolean;
  /** Push force (N) this wheel gives now: set by the motor node, its maximum scaled by |power|. */
  pushN: number;
}

export interface RobotBody {
  spec: RobotSpec;
  /** Direction of travel on the ground plane: forward = (cos, sin) over (x, z). 0 = +x. */
  heading: number;
  /** Signed forward speed, m/s (side view: along +x). */
  speed: number;
  /** Turn rate in rad/s, positive = right. */
  turnRate: number;
  /** Kilograms resting on the chassis in the last step (it loads the motors on top of the chassis's own mass). */
  payload: number;
  /** True while the payload is above `spec.maxPayload`: the motors then cannot move the chassis. */
  overloaded: boolean;
  /** True while the chassis shoves, or is stalled against, a loose item (set by the physics step). */
  pushing: boolean;
  /** Newtons of that push: what the pushed chain needs, or what the motors give when they stall. */
  pushForce: number;
  wheels: Map<string, MountedWheel>;
}

function positive(n: number | undefined, fallback: number): number {
  return n !== undefined && Number.isFinite(n) && n > 0 ? n : fallback;
}

export const DEFAULT_ROBOT: RobotSpec = { length: 1, width: 0.7, mass: 2, friction: 0.8 };

export function createRobotBody(spec: RobotSpec | undefined, heading = 0): RobotBody {
  return {
    spec: sanitizeRobotSpec(spec ?? DEFAULT_ROBOT),
    heading: Number.isFinite(heading) ? heading : 0,
    speed: 0,
    turnRate: 0,
    payload: 0,
    overloaded: false,
    pushing: false,
    pushForce: 0,
    wheels: new Map(),
  };
}

export function sanitizeRobotSpec(spec: Partial<RobotSpec>): RobotSpec {
  return {
    length: positive(spec.length, DEFAULT_ROBOT.length),
    width: positive(spec.width, DEFAULT_ROBOT.width),
    mass: positive(spec.mass, DEFAULT_ROBOT.mass),
    friction: positive(spec.friction, DEFAULT_ROBOT.friction),
    maxPayload: positive(spec.maxPayload, 0),
    ...(spec.pushObjects === true ? { pushObjects: true } : {}),
  };
}

/** Adds, refreshes or (null) removes a wheel; unusable numbers are ignored. */
export function setWheel(body: RobotBody, id: string, wheel: RobotWheelSpec | null): void {
  if (wheel === null) {
    body.wheels.delete(id);
    return;
  }
  const { side, forward, radius, rpm, pushN } = wheel;
  if (![side, forward, radius, rpm].every(Number.isFinite) || radius <= 0) return;
  const old = body.wheels.get(id);
  body.wheels.set(id, { side, forward, radius, rpm, spin: old?.spin ?? 0, fresh: true, pushN: pushN !== undefined && Number.isFinite(pushN) && pushN > 0 ? pushN : 0 });
}

/** True when `payload` kg is more than the chassis may carry (a maximum of 0 means no limit). */
export function isOverloaded(spec: Pick<RobotSpec, 'maxPayload'>, payload: number): boolean {
  const max = spec.maxPayload ?? 0;
  return max > 0 && payload > max;
}

/**
 * One tick of drive: drops wheels that were not refreshed, fits the wheels, lets the chassis follow within its limits
 * and turns the heading (side view: no turning, the robot only rolls along x). `payload` is the weight (kg) resting on
 * the chassis: it adds to the mass the motors must push, and above the chassis's maximum the motors ask for no motion.
 * Returns the velocity on the ground plane.
 */
export function driveRobot(body: RobotBody, dt: number, sideView: boolean, payload = 0): { x: number; z: number } {
  for (const [id, w] of body.wheels) if (!w.fresh) body.wheels.delete(id);
  const wheels = [...body.wheels.values()];
  body.pushing = false;
  body.pushForce = 0;
  body.payload = Number.isFinite(payload) && payload > 0 ? payload : 0;
  body.overloaded = isOverloaded(body.spec, body.payload);
  const ask = body.overloaded ? { speed: 0, turn: 0 } : solveDrive(wheels);
  if (sideView) ask.turn = 0;
  const loaded = body.payload > 0 ? { ...body.spec, mass: body.spec.mass + body.payload } : body.spec;
  const next = followWheels({ speed: body.speed, turn: body.turnRate }, ask, loaded, wheels.length, dt);
  body.speed = next.speed;
  body.turnRate = next.turn;
  for (const w of wheels) {
    w.spin += ((w.rpm * 2 * Math.PI) / 60) * dt;
    w.fresh = false;
  }
  if (sideView) return { x: body.speed, z: 0 };
  body.heading = wrapAngle(body.heading + body.turnRate * dt);
  return { x: Math.cos(body.heading) * body.speed, z: Math.sin(body.heading) * body.speed };
}

/** After the move: the speed that is left once a wall took its share (the nose keeps pointing the same way). */
export function settleRobot(body: RobotBody, vel: { x: number; z: number }, sideView: boolean): void {
  body.speed = sideView ? vel.x : vel.x * Math.cos(body.heading) + vel.z * Math.sin(body.heading);
}

export function wrapAngle(a: number): number {
  const twoPi = Math.PI * 2;
  let d = a % twoPi;
  if (d > Math.PI) d -= twoPi;
  else if (d <= -Math.PI) d += twoPi;
  return d;
}
