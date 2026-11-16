/**
 * Pure helpers for the scrolling signal chart: a fixed-size ring of samples per trace, the sampling period that
 * makes the ring cover the chosen time window, and the vertical scale. No DOM, no world.
 */

export const PLOT_TICKS_PER_SECOND = 60;
/** Most points one trace keeps; longer windows are sampled less often instead of storing more. */
export const PLOT_MAX_POINTS = 300;
export const PLOT_MIN_WINDOW = 1;
export const PLOT_MAX_WINDOW = 60;

export interface Ring {
  values: Float64Array;
  /** Index the next sample is written to. */
  head: number;
  count: number;
}

export function createRing(capacity: number): Ring {
  return { values: new Float64Array(Math.max(1, Math.floor(capacity))), head: 0, count: 0 };
}

export function ringPush(r: Ring, v: number): void {
  r.values[r.head] = Number.isFinite(v) ? v : 0;
  r.head = (r.head + 1) % r.values.length;
  if (r.count < r.values.length) r.count++;
}

/** Samples oldest first. */
export function ringToArray(r: Ring): number[] {
  const out: number[] = [];
  const n = r.values.length;
  const start = r.count < n ? 0 : r.head;
  for (let k = 0; k < r.count; k++) out.push(r.values[(start + k) % n] ?? 0);
  return out;
}

export function clampWindow(seconds: number): number {
  const s = Number.isFinite(seconds) ? seconds : 10;
  return Math.min(PLOT_MAX_WINDOW, Math.max(PLOT_MIN_WINDOW, s));
}

/** How many ticks pass between two stored samples, and how many samples cover `windowSeconds`. */
export function plotSampling(windowSeconds: number): { period: number; capacity: number } {
  const ticks = clampWindow(windowSeconds) * PLOT_TICKS_PER_SECOND;
  const period = Math.max(1, Math.floor(ticks / PLOT_MAX_POINTS));
  return { period, capacity: Math.max(2, Math.round(ticks / period)) };
}

export interface PlotRange {
  min: number;
  max: number;
}

/** Fixed range when `auto` is off (a reversed or empty pair is repaired); otherwise the data range with 8% margin. */
export function plotRange(series: readonly (readonly number[])[], auto: boolean, min: number, max: number): PlotRange {
  if (!auto) {
    const lo = Number.isFinite(min) ? min : 0;
    const hi = Number.isFinite(max) ? max : lo + 1;
    if (hi > lo) return { min: lo, max: hi };
    return hi < lo ? { min: hi, max: lo } : { min: lo - 1, max: lo + 1 };
  }
  let lo = Infinity;
  let hi = -Infinity;
  for (const s of series) {
    for (const v of s) {
      if (v < lo) lo = v;
      if (v > hi) hi = v;
    }
  }
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) return { min: -1, max: 1 };
  if (hi - lo < 1e-9) return { min: lo - 1, max: hi + 1 };
  const pad = (hi - lo) * 0.08;
  return { min: lo - pad, max: hi + pad };
}

/** 0 (bottom) .. 1 (top) position of a value in the range; out-of-range values stick to the edge. */
export function plotFraction(v: number, range: PlotRange): number {
  const span = range.max - range.min;
  if (span <= 0) return 0.5;
  return Math.min(1, Math.max(0, (v - range.min) / span));
}
