/**
 * Wheel traction of a robot chassis ("Vật lý thật"). Pure maths, no world access.
 *
 * Every wheel pushes the chassis along its own forward direction with a force F. Newton's laws then give
 *   linear:  m * dv/dt = sum(F_i)
 *   turning: I * dw/dt = -sum(F_i * s_i)      (s_i = metres right of the centre line; a force on the right wheel turns the robot left)
 *   I = m * (length^2 + width^2) / 12         (a flat box turning about its centre)
 * and the speed of the ground under wheel i is  g_i = v - w * s_i.
 *
 * The wheel asks for the speed `command_i` (m/s at the rim). The forces that close every gap `command_i - g_i` within one tick
 * (the smallest set of forces that does, see `wantedForces`) are limited, wheel by wheel, by two things:
 *   - the motor: `driveN` when speeding up, `brakeN` when slowing down (0 = no motor limit, friction alone decides);
 *   - the grip:  mu * N_i, where N_i = m * g / n is the weight the wheel carries (equal share over the n wheels).
 * Grip does not depend on mass for slowing down (mu * m * g / m = mu * g), motor limits do (driveN / m).
 * When the motor would give more than the grip allows the wheel slips: its rim runs at `command_i`, not at the ground speed.
 *
 * Not modelled: weight shifting between wheels when speeding up or braking (the sum of the grips stays mu * m * g, so
 * the numbers do not change), sideways skidding, a payload that is not centred.
 */

/** Gravity used for weight and grip, m/s^2. */
export const GRAVITY_N = 9.81;
/** Lowest friction accepted: with none the chassis could never speed up or stop. */
export const MIN_FRICTION = 0.02;

export interface TractionWheel {
  /** Metres to the right of the centre line (negative = left). */
  side: number;
  /** Speed the wheel rim is asked for, m/s (positive = forward). */
  command: number;
  /** Most force the motor gives when speeding up, N. */
  driveN: number;
  /** Most force the motor gives when slowing down, N; 0 = no motor limit (only grip limits it). */
  brakeN: number;
}

export interface TractionBody {
  /** Kilograms, payload included. */
  mass: number;
  /** Ground grip coefficient mu. */
  friction: number;
  length: number;
  width: number;
}

export interface WheelTraction {
  /** Force this wheel gives the chassis along its forward direction, N. */
  force: number;
  /** Largest force the ground lets this wheel give, N (mu * weight on the wheel). */
  gripN: number;
  /** Speed of the ground under the wheel, m/s. */
  ground: number;
  /** True when the motor wanted more force than the grip allows. */
  slipping: boolean;
  /** Wheel rim speed minus ground speed while slipping, m/s; 0 while gripping. */
  slip: number;
  /** What the wheel rim really does, m/s: the commanded speed while slipping, the ground speed while rolling. */
  rim: number;
}

export interface TractionResult {
  speed: number;
  turn: number;
  wheels: WheelTraction[];
}

/** Moment of inertia of a flat box (kg m^2) turning about its centre. */
export function yawInertia(mass: number, length: number, width: number): number {
  return (mass * (length * length + width * width)) / 12;
}

/** Newtons of grip of one wheel when `n` wheels share the weight of a `mass` kg robot on ground of friction `mu`. */
export function wheelGrip(mass: number, mu: number, n: number): number {
  return (Math.max(MIN_FRICTION, mu) * mass * GRAVITY_N) / Math.max(1, n);
}

const clamp = (x: number, limit: number): number => Math.max(-limit, Math.min(limit, x));

/** Wheels closer than this (metres, side to side) cannot tell pushing from turning. */
const MIN_SIDE_SPREAD = 0.05;

/**
 * The forces (N) that bring every wheel's ground speed to its command in one tick, with no limits. One force F_i changes
 * the ground speed under wheel j by F_i * dt * (1/m + s_i s_j / I), so the wheels are fitted as  F_i = a + b * s_i  (a pushes,
 * b turns): the total force is m * (mean speed gap) / dt and the torque is I * (turn gap) / dt. Wheels all on one line cannot
 * turn the chassis, so they share the push equally.
 */
function wantedForces(gaps: readonly number[], sides: readonly number[], mass: number, inertia: number, dt: number): number[] {
  const n = gaps.length;
  const r = gaps.map((g) => g / dt);
  const s1 = sides.reduce((a, s) => a + s, 0);
  const s2 = sides.reduce((a, s) => a + s * s, 0);
  const sumR = r.reduce((a, x) => a + x, 0);
  if (Math.max(...sides) - Math.min(...sides) < MIN_SIDE_SPREAD) {
    const mean = s1 / n;
    const each = sumR / n / (n * (1 / mass + (mean * mean) / inertia));
    return r.map(() => each);
  }
  const sumSR = r.reduce((a, x, i) => a + x * sides[i]!, 0);
  const det = n * s2 - s1 * s1;
  const p1 = (s2 * sumR - s1 * sumSR) / det;
  const p2 = (n * sumSR - s1 * sumR) / det;
  const a = (s2 * mass * p1 - s1 * inertia * p2) / det;
  const b = (n * inertia * p2 - s1 * mass * p1) / det;
  return sides.map((s) => a + b * s);
}

/** One tick: the new chassis speed and turn rate, and what each wheel did. Needs at least one wheel. */
export function tractionStep(speed: number, turn: number, wheels: readonly TractionWheel[], body: TractionBody, dt: number): TractionResult {
  const n = wheels.length;
  const mass = Math.max(0.01, body.mass);
  const inertia = yawInertia(mass, Math.max(0.1, body.length), Math.max(0.1, body.width));
  const out: WheelTraction[] = [];
  let sumF = 0;
  let sumTorque = 0;
  const grounds = wheels.map((w) => speed - turn * w.side);
  const demands = wantedForces(
    wheels.map((w, i) => w.command - grounds[i]!),
    wheels.map((w) => w.side),
    mass,
    inertia,
    dt,
  );
  for (const [i, w] of wheels.entries()) {
    const ground = grounds[i]!;
    const demand = demands[i]!;
    const slowing = Math.abs(w.command) < Math.abs(ground) || w.command * ground < 0;
    const motorMax = slowing ? (w.brakeN > 0 ? w.brakeN : Infinity) : Math.max(0, w.driveN);
    const gripN = wheelGrip(mass, body.friction, n);
    const wanted = clamp(demand, motorMax);
    const force = clamp(wanted, gripN);
    const slipping = Math.abs(wanted) > gripN * (1 + 1e-9);
    out.push({ force, gripN, ground, slipping, slip: slipping ? w.command - ground : 0, rim: slipping ? w.command : ground });
    sumF += force;
    sumTorque -= force * w.side;
  }
  return { speed: speed + (sumF / mass) * dt, turn: turn + (sumTorque / inertia) * dt, wheels: out };
}
