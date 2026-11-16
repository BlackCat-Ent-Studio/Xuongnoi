/**
 * Discrete PID controller, pure and deterministic (no world, no clock).
 *
 *   error      e = target - measured
 *   P          kp * e
 *   I          running sum of ki * e * dt (the gain is applied while summing, so changing Ki live does not make I jump)
 *   D          kd * filtered slope; slope = -(measured - lastMeasured) / dt   (derivative on measurement, no kick on a new target)
 *                                  or  (e - lastE) / dt                       (derivative on error)
 *              filtered += (1 - smoothing) * (slope - filtered)               (smoothing 0 = raw, near 1 = very smooth)
 *   out        clamp(P + I + D, outMin, outMax)
 *   saturated  true while the clamp cut the sum
 *
 * Anti-windup: while saturated and the error still pushes further into the limit, I stops growing; I is also kept
 * inside [outMin, outMax]. Without it I keeps growing during saturation and the output overshoots for a long time.
 */

export const PID_DT = 1 / 60;
/** Highest smoothing allowed; 1 would freeze the derivative forever. */
export const PID_MAX_SMOOTHING = 0.99;

export interface PidConfig {
  kp: number;
  ki: number;
  kd: number;
  outMin: number;
  outMax: number;
  antiWindup: boolean;
  /** 0..1 smoothing of the derivative. */
  dFilter: number;
  dOnMeasurement: boolean;
  dt: number;
}

export interface PidState {
  /** Running integral term, already multiplied by Ki. */
  integral: number;
  lastMeasured: number | null;
  lastError: number | null;
  dFiltered: number;
}

export interface PidResult {
  out: number;
  error: number;
  p: number;
  i: number;
  d: number;
  saturated: boolean;
}

export const DEFAULT_PID_CONFIG: PidConfig = {
  kp: 1,
  ki: 0,
  kd: 0,
  outMin: -1,
  outMax: 1,
  antiWindup: true,
  dFilter: 0.2,
  dOnMeasurement: true,
  dt: PID_DT,
};

export function createPidState(): PidState {
  return { integral: 0, lastMeasured: null, lastError: null, dFiltered: 0 };
}

/** Clears the integral and the derivative memory (the next step has no slope yet). */
export function resetPid(s: PidState): void {
  s.integral = 0;
  s.lastMeasured = null;
  s.lastError = null;
  s.dFiltered = 0;
}

const fin = (v: number): number => (Number.isFinite(v) ? v : 0);

function limits(cfg: PidConfig): [number, number] {
  const a = fin(cfg.outMin);
  const b = fin(cfg.outMax);
  return a <= b ? [a, b] : [b, a];
}

/** One tick of an enabled controller. */
export function pidStep(s: PidState, cfg: PidConfig, measured: number, target: number): PidResult {
  const m = fin(measured);
  const e = fin(target) - m;
  const dt = cfg.dt > 0 ? cfg.dt : PID_DT;
  const [lo, hi] = limits(cfg);

  const p = fin(cfg.kp) * e;

  let slope = 0;
  if (cfg.dOnMeasurement) {
    if (s.lastMeasured !== null) slope = -(m - s.lastMeasured) / dt;
  } else if (s.lastError !== null) {
    slope = (e - s.lastError) / dt;
  }
  const smoothing = Math.min(PID_MAX_SMOOTHING, Math.max(0, fin(cfg.dFilter)));
  s.dFiltered += (1 - smoothing) * (slope - s.dFiltered);
  const d = fin(cfg.kd) * s.dFiltered;
  s.lastMeasured = m;
  s.lastError = e;

  let integral = s.integral + fin(cfg.ki) * e * dt;
  let unclamped = p + integral + d;
  let out = Math.min(hi, Math.max(lo, unclamped));
  if (cfg.antiWindup) {
    const pushingFurther = unclamped !== out && Math.sign(unclamped - out) === Math.sign(e);
    if (pushingFurther) integral = s.integral;
    integral = Math.min(hi, Math.max(lo, integral));
    unclamped = p + integral + d;
    out = Math.min(hi, Math.max(lo, unclamped));
  }
  s.integral = integral;
  return { out, error: e, p, i: integral, d, saturated: unclamped !== out };
}

/** One tick of a switched-off controller: output 0, nothing accumulates, memory follows the signal so switching on does not jump. */
export function pidHold(s: PidState, measured: number, target: number): PidResult {
  const m = fin(measured);
  const e = fin(target) - m;
  s.lastMeasured = m;
  s.lastError = e;
  s.dFiltered = 0;
  return { out: 0, error: e, p: 0, i: s.integral, d: 0, saturated: false };
}
