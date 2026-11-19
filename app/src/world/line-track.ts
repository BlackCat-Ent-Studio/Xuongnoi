import type { LineTrackSpec } from '../engine/types';

/**
 * Geometry of a painted line on the floor. Pure maths on a flat plane (u, v): the world turns its views into that plane
 * (x and z in the top-down and 3D views, x and height in the side view). No world, no rendering.
 */

export interface PlanePoint {
  u: number;
  v: number;
}

/** `look` values that mark block entities as a painted line and as the dot under a line sensor's spot. */
export const LINE_TRACK_LOOK = 'line-track';
export const LINE_DOT_LOOK = 'line-dot';

export type TrackShape = 'custom' | 'straight' | 'oval' | 's-curve' | 'eight';

/** Points a preset shape is sampled with; enough that the ribbon looks round. */
const PRESET_STEPS = 48;
/** Samples taken across the sensing spot; the line's coverage is the share of them lying on the line. */
const SPOT_SAMPLES = 128;
/** Golden angle: spreads the samples evenly over a disc. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

export interface PresetPath {
  path: PlanePoint[];
  closed: boolean;
}

/** The centre line of a preset, centred on (cu, cv): `length` along u, `breadth` along v. Straight and S-curve are open, the rest closed. */
export function presetPath(shape: Exclude<TrackShape, 'custom'>, cu: number, cv: number, length: number, breadth: number): PresetPath {
  const a = Math.max(0, length) / 2;
  const b = Math.max(0, breadth) / 2;
  const at = (u: number, v: number): PlanePoint => ({ u: cu + u, v: cv + v });
  const path: PlanePoint[] = [];
  if (shape === 'straight') return { path: [at(-a, 0), at(a, 0)], closed: false };
  if (shape === 's-curve') {
    for (let i = 0; i <= PRESET_STEPS; i++) {
      const t = i / PRESET_STEPS;
      path.push(at(-a + 2 * a * t, b * Math.sin(2 * Math.PI * t)));
    }
    return { path, closed: false };
  }
  for (let i = 0; i < PRESET_STEPS; i++) {
    const t = (2 * Math.PI * i) / PRESET_STEPS;
    path.push(shape === 'oval' ? at(a * Math.cos(t), b * Math.sin(t)) : at(a * Math.sin(t), b * Math.sin(2 * t)));
  }
  return { path, closed: true };
}

const same = (p: PlanePoint, q: PlanePoint): boolean => Math.hypot(p.u - q.u, p.v - q.v) < 1e-9;

/** Drops repeated points (a zero-length piece has no direction). A closed path also drops a last point equal to the first. */
export function dedupePath(path: readonly PlanePoint[], closed: boolean): PlanePoint[] {
  const out: PlanePoint[] = [];
  for (const p of path) if (out.length === 0 || !same(out[out.length - 1]!, p)) out.push(p);
  if (closed && out.length > 1 && same(out[0]!, out[out.length - 1]!)) out.pop();
  return out;
}

/**
 * Rounds every corner with a curve that starts `radius` metres before the corner and ends `radius` after it (less when the
 * neighbouring pieces are shorter than twice that). A radius of 0 keeps the sharp corners. The ends of an open path stay put.
 */
export function smoothPath(path: readonly PlanePoint[], closed: boolean, radius: number, steps = 8): PlanePoint[] {
  const pts = dedupePath(path, closed);
  if (!(radius > 0) || pts.length < 3) return pts;
  const out: PlanePoint[] = [];
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const p = pts[i]!;
    if (!closed && (i === 0 || i === n - 1)) {
      out.push(p);
      continue;
    }
    const prev = pts[(i + n - 1) % n]!;
    const next = pts[(i + 1) % n]!;
    const dp = Math.hypot(prev.u - p.u, prev.v - p.v);
    const dn = Math.hypot(next.u - p.u, next.v - p.v);
    const d = Math.min(radius, dp / 2, dn / 2);
    const s = { u: p.u + ((prev.u - p.u) / dp) * d, v: p.v + ((prev.v - p.v) / dp) * d };
    const e = { u: p.u + ((next.u - p.u) / dn) * d, v: p.v + ((next.v - p.v) / dn) * d };
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const w0 = (1 - t) * (1 - t);
      const w1 = 2 * t * (1 - t);
      const w2 = t * t;
      out.push({ u: w0 * s.u + w1 * p.u + w2 * e.u, v: w0 * s.v + w1 * p.v + w2 * e.v });
    }
  }
  return out;
}

function segmentDistance(p: PlanePoint, a: PlanePoint, b: PlanePoint): number {
  const du = b.u - a.u;
  const dv = b.v - a.v;
  const len2 = du * du + dv * dv;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((p.u - a.u) * du + (p.v - a.v) * dv) / len2)) : 0;
  return Math.hypot(p.u - (a.u + t * du), p.v - (a.v + t * dv));
}

/** Distance (metres) from a point to the centre line of a path; Infinity for a path with no points. */
export function distanceToPath(path: readonly PlanePoint[], closed: boolean, p: PlanePoint): number {
  const n = path.length;
  if (n === 0) return Infinity;
  if (n === 1) return Math.hypot(p.u - path[0]!.u, p.v - path[0]!.v);
  let best = Infinity;
  const last = closed ? n : n - 1;
  for (let i = 0; i < last; i++) {
    const d = segmentDistance(p, path[i]!, path[(i + 1) % n]!);
    if (d < best) best = d;
  }
  return best;
}

/** Distance from a point to the centre line of a track. */
export function distanceToTrack(track: LineTrackSpec, p: PlanePoint): number {
  return distanceToPath(track.path, track.closed, p);
}

interface Bounds {
  minU: number;
  maxU: number;
  minV: number;
  maxV: number;
}

const boundsCache = new WeakMap<LineTrackSpec, Bounds>();

function boundsOf(track: LineTrackSpec): Bounds {
  let b = boundsCache.get(track);
  if (!b) {
    b = { minU: Infinity, maxU: -Infinity, minV: Infinity, maxV: -Infinity };
    for (const p of track.path) {
      b.minU = Math.min(b.minU, p.u);
      b.maxU = Math.max(b.maxU, p.u);
      b.minV = Math.min(b.minV, p.v);
      b.maxV = Math.max(b.maxV, p.v);
    }
    const half = Math.max(0, track.width) / 2;
    b.minU -= half;
    b.maxU += half;
    b.minV -= half;
    b.maxV += half;
    boundsCache.set(track, b);
  }
  return b;
}

/** Side view: how far `u` is from the nearest stretch of the path along the floor (0 inside it). The height of the points does not matter. */
function distanceAlongFloor(track: LineTrackSpec, u: number): number {
  const path = track.path;
  const n = path.length;
  if (n === 1) return Math.abs(u - path[0]!.u);
  let best = Infinity;
  for (let i = 0; i < (track.closed ? n : n - 1); i++) {
    const a = path[i]!.u;
    const b = path[(i + 1) % n]!.u;
    best = Math.min(best, Math.max(Math.min(a, b) - u, u - Math.max(a, b), 0));
  }
  return best;
}

/**
 * Per piece of a track's centre line, the upright box around it grown by half the band width (and a hair more): a point outside
 * the box is further from that piece than half the width. Four numbers per piece: min u, max u, min v, max v.
 */
const pieceBoxes = new WeakMap<LineTrackSpec, Float64Array>();

function pieceBoxesOf(track: LineTrackSpec): Float64Array {
  let boxes = pieceBoxes.get(track);
  if (!boxes) {
    const path = track.path;
    const n = path.length;
    const pieces = track.closed ? n : n - 1;
    boxes = new Float64Array(pieces * 4);
    for (let i = 0; i < pieces; i++) {
      const a = path[i]!;
      const b = path[(i + 1) % n]!;
      // The nearest point of the piece is worked out as a + t * (b - a): rounding can put it a few last bits outside the piece.
      const grow = track.width / 2 + 1e-9 * (1 + Math.abs(a.u) + Math.abs(a.v) + Math.abs(b.u) + Math.abs(b.v));
      boxes[i * 4] = Math.min(a.u, b.u) - grow;
      boxes[i * 4 + 1] = Math.max(a.u, b.u) + grow;
      boxes[i * 4 + 2] = Math.min(a.v, b.v) - grow;
      boxes[i * 4 + 3] = Math.max(a.v, b.v) + grow;
    }
    pieceBoxes.set(track, boxes);
  }
  return boxes;
}

/** True when the point lies on the band of a track (within half the width of the centre line). */
export function onTrack(track: LineTrackSpec, p: PlanePoint): boolean {
  const b = boundsOf(track);
  if (p.u < b.minU || p.u > b.maxU || p.v < b.minV || p.v > b.maxV) return false;
  const half = track.width / 2;
  const path = track.path;
  const n = path.length;
  // The plain rule, for the tracks the shortcut below is not made for.
  if (n < 2 || !(half >= 0 && half < Infinity)) return distanceToTrack(track, p) <= half;
  // On the band = within half the width of the nearest piece = within half the width of some piece. A piece whose box the
  // point is outside of is too far (a NaN is outside of nothing and is measured); the first piece near enough settles it.
  const boxes = pieceBoxesOf(track);
  for (let i = 0, k = 0; k < boxes.length; i++, k += 4) {
    if (p.u < boxes[k]! || p.u > boxes[k + 1]! || p.v < boxes[k + 2]! || p.v > boxes[k + 3]!) continue;
    if (segmentDistance(p, path[i]!, path[(i + 1) % n]!) <= half) return true;
  }
  return false;
}

/**
 * The share (0..1) of a round sensing spot that lies on the painted line, like the grey level an infrared sensor reads:
 * 0 off the line, 1 with the whole spot inside the band, in between while the spot crosses an edge.
 * `diameter` 0 reads a single point (0 or 1). With `flat` the spot is a segment along u instead of a disc (side view, where
 * the floor is a line: only the distance along it matters and the height of the points is ignored). Several tracks count as one painted area.
 * It is measured with a fixed pattern of samples, so moving a spot across one straight edge never makes the level go back
 * and forth (a spot wider than the band can wobble by a few samples, about 2 percent, near its peak).
 */
export function trackCoverage(tracks: readonly LineTrackSpec[], centre: PlanePoint, diameter: number, flat = false): number {
  const r = Math.max(0, diameter) / 2;
  const live = tracks.filter((t) => {
    const b = boundsOf(t);
    return centre.u + r >= b.minU && centre.u - r <= b.maxU && (flat || (centre.v + r >= b.minV && centre.v - r <= b.maxV));
  });
  if (live.length === 0) return 0;
  let hits = 0;
  for (let i = 0; i < SPOT_SAMPLES; i++) {
    const k = Math.sqrt((i + 0.5) / SPOT_SAMPLES);
    const p: PlanePoint = flat
      ? { u: centre.u + r * (2 * ((i + 0.5) / SPOT_SAMPLES) - 1), v: centre.v }
      : { u: centre.u + r * k * Math.cos(i * GOLDEN_ANGLE), v: centre.v + r * k * Math.sin(i * GOLDEN_ANGLE) };
    if (live.some((t) => (flat ? distanceAlongFloor(t, p.u) <= t.width / 2 : onTrack(t, p)))) hits++;
  }
  return hits / SPOT_SAMPLES;
}
