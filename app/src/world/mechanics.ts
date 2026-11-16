/**
 * Engineering formulas in SI units (kg, m, s, N, N·m). Pure functions: no world access, deterministic, textbook physics.
 *
 * This is the "engineering-formula physics" layer. The game's own physics runs in game units and a gravity of 30;
 * machines (arms, grippers, scales) answer real questions with the numbers below instead. Non-finite or negative
 * inputs are treated as 0 so a bad parameter never produces NaN.
 */

/** Standard gravity, m/s². */
export const G = 9.81;

const finite = (n: number): number => (Number.isFinite(n) ? n : 0);
const nonNeg = (n: number): number => Math.max(0, finite(n));
/** "Enough" checks tolerate this much rounding (5 kg · 9.81 is 49.050000000000004 in floating point). */
const EPS = 1e-9;

/** Weight: W = m · g · scale. `massKg` kg → Newton. `gravityScale` multiplies g (1 = Earth). */
export function weight(massKg: number, g: number = G, gravityScale = 1): number {
  return nonNeg(massKg) * nonNeg(g) * nonNeg(gravityScale);
}

/** Torque: τ = F · r (N · m). */
export function torque(forceN: number, armM: number): number {
  return finite(forceN) * finite(armM);
}

/** Newton's second law: a = F / m (m/s²). A body with no mass does not accelerate (returns 0). */
export function accelFromForce(forceN: number, massKg: number): number {
  const m = nonNeg(massKg);
  return m > 0 ? finite(forceN) / m : 0;
}

/** Friction force: F = μ · N, where N is the force pressing the surfaces together. */
export function frictionForce(mu: number, normalN: number): number {
  return nonNeg(mu) * nonNeg(normalN);
}

export interface GripInput {
  /** Squeeze force of EACH finger pad against the object, in N. */
  gripForceN: number;
  /** Friction coefficient between pad and object. */
  mu: number;
  /** Number of pads pressing (default 2: one on each side). */
  fingers?: number;
  /** Weight of the object, in N. */
  weightN: number;
  /** Upward acceleration of the gripper in m/s² (default 0); lifting hard adds m·a to the load, downward (negative) relieves it. */
  accel?: number;
}

export interface GripResult {
  holds: boolean;
  /** gripForceN − requiredForceN; negative = slipping. */
  marginN: number;
  /** Smallest grip force per finger that holds; Infinity when μ or the finger count is 0. */
  requiredForceN: number;
}

/**
 * Friction grip: the pads together can resist  fingers · μ · F.  The object holds when
 *   fingers · μ · F ≥ m · (g + a)   =   W · (1 + a / g)
 * so the required grip force per finger is  F_req = W · (1 + a/g) / (fingers · μ).
 * Example: 5 kg (W = 49.05 N), μ 0.5, 2 fingers → F_req = 49.05 N.
 */
export function gripHolds(input: GripInput): GripResult {
  const fingers = Math.max(0, Math.floor(finite(input.fingers ?? 2)));
  const mu = nonNeg(input.mu);
  const load = nonNeg(input.weightN) * Math.max(0, 1 + finite(input.accel ?? 0) / G);
  const capacity = fingers * mu;
  const requiredForceN = load === 0 ? 0 : capacity > 0 ? load / capacity : Infinity;
  const gripForceN = nonNeg(input.gripForceN);
  return { holds: gripForceN + EPS >= requiredForceN, marginN: gripForceN - requiredForceN, requiredForceN };
}

/** Crush check: the object breaks when the squeeze exceeds its limit. A limit of 0 (or less) means it never breaks. */
export function crushed(forceN: number, crushLimitN: number): boolean {
  return finite(crushLimitN) > 0 && finite(forceN) > crushLimitN;
}

/** A mass hanging at a distance from the joint axis (the arm's own links count too, at their centre of mass). */
export interface JointLoad {
  massKg: number;
  /** Horizontal-reach distance from the joint axis to the mass, in metres. */
  armM: number;
}

export interface JointLiftInput {
  /** Torque the joint can hold, in N·m. */
  torqueMaxNm: number;
  loads: readonly JointLoad[];
  /** Angle of the arm above the horizontal, radians (default 0 = horizontal = worst case). */
  angle?: number;
}

export interface JointLiftResult {
  ok: boolean;
  requiredNm: number;
  /** torqueMaxNm − requiredNm; negative = the joint is overloaded. */
  marginNm: number;
}

/**
 * Joint torque needed to hold loads still:  τ_req = Σ m_i · g · L_i · cos(angle).
 * (the lever arm of a weight is its horizontal distance; a vertical arm needs no torque.)
 * Example: 6 kg at 0.5 m, horizontal → 6 · 9.81 · 0.5 = 29.43 N·m.
 */
export function jointCanLift(input: JointLiftInput): JointLiftResult {
  const c = Math.abs(Math.cos(finite(input.angle ?? 0)));
  let requiredNm = 0;
  for (const load of input.loads) requiredNm += nonNeg(load.massKg) * G * nonNeg(load.armM) * c;
  const max = nonNeg(input.torqueMaxNm);
  return { ok: max + EPS >= requiredNm, requiredNm, marginNm: max - requiredNm };
}

/**
 * Heaviest payload (kg) a joint can hold at distance `armM`, after the torque its own loads already use:
 *   m_max = (τ_max − Σ own) / (g · L · cos(angle)).   Example: 30 N·m, 0.5 m → 6.116 kg.
 * Returns 0 when the own loads already use all the torque, Infinity when the payload has no lever arm.
 */
export function maxPayloadKg(torqueMaxNm: number, armM: number, ownLoads: readonly JointLoad[] = [], angle = 0): number {
  const own = jointCanLift({ torqueMaxNm, loads: ownLoads, angle }).requiredNm;
  const free = nonNeg(torqueMaxNm) - own;
  if (free <= 0) return 0;
  const lever = G * nonNeg(armM) * Math.abs(Math.cos(finite(angle)));
  return lever > 1e-12 ? free / lever : Infinity;
}

/** Largest slope angle (radians) on which static friction holds a body:  tan θ_max = μ, so θ_max = atan(μ). */
export function maxStaticAngle(mu: number): number {
  return Math.atan(nonNeg(mu));
}

/**
 * Body on an incline of `angleRad`: the pull down the slope is m·g·sin θ, the friction available is μ·m·g·cos θ.
 * It stays put when μ·cos θ ≥ sin θ (same as μ ≥ tan θ). `marginN` = available − pull (negative = it slides).
 */
export function slopeHold(mu: number, massKg: number, angleRad: number): { holds: boolean; marginN: number; pullN: number } {
  const w = weight(massKg);
  const a = finite(angleRad);
  const pullN = w * Math.sin(a);
  const marginN = frictionForce(mu, w * Math.cos(a)) - pullN;
  return { holds: marginN >= -EPS, marginN, pullN };
}
