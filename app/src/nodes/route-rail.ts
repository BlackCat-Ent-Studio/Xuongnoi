/**
 * A smooth track through route points: straight pieces joined by short arcs at the corners.
 * Pure geometry on the ground plane (x, z); the route node walks along it by arc length.
 */

export interface Rail {
  /** Sampled path points and the arc length at each. */
  x: number[];
  z: number[];
  s: number[];
  /** Nose direction arriving at / leaving each sample (they differ only at a sharp corner). */
  hIn: number[];
  hOut: number[];
  /** Total length; for a loop it includes the closing piece back to the start. */
  total: number;
  loop: boolean;
  /** Arc length at each original route point (the middle of its corner arc). */
  vertexS: number[];
}

interface P2 {
  x: number;
  z: number;
}

/** Samples along one corner arc. */
const ARC_STEPS = 12;
const EPS = 1e-6;

function unit(a: P2, b: P2): { x: number; z: number; len: number } {
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz);
  return { x: dx / len, z: dz / len, len };
}

/**
 * Builds the track. `fillet` is how far before and after a corner the arc starts (0 = sharp corners); it is
 * shortened on short pieces. Points closer than a hair to their predecessor are skipped but keep a vertex slot.
 */
export function buildRail(points: readonly P2[], loop: boolean, fillet: number): Rail {
  const pts: P2[] = [];
  const slot: number[] = []; // original index -> index in pts
  points.forEach((p, k) => {
    const last = pts[pts.length - 1];
    if (!last || Math.hypot(p.x - last.x, p.z - last.z) > EPS) pts.push({ x: p.x, z: p.z });
    slot[k] = pts.length - 1;
  });
  if (loop && pts.length > 1 && Math.hypot(pts[0]!.x - pts[pts.length - 1]!.x, pts[0]!.z - pts[pts.length - 1]!.z) <= EPS) pts.pop();
  const m = pts.length;
  const rail: Rail = { x: [], z: [], s: [], hIn: [], hOut: [], total: 0, loop: loop && m >= 3, vertexS: [] };
  if (m < 2) {
    for (let k = 0; k < points.length; k++) rail.vertexS.push(0);
    return rail;
  }
  const isLoop = rail.loop;
  const mid: number[] = new Array<number>(m).fill(0); // sample index of each point's middle

  const push = (p: P2, hIn: number, hOut: number): number => {
    rail.x.push(p.x);
    rail.z.push(p.z);
    rail.hIn.push(hIn);
    rail.hOut.push(hOut);
    return rail.x.length - 1;
  };

  for (let k = 0; k < m; k++) {
    const p = pts[k]!;
    const open = !isLoop && (k === 0 || k === m - 1);
    const prev = pts[(k - 1 + m) % m]!;
    const next = pts[(k + 1) % m]!;
    if (open) {
      const d = k === 0 ? unit(p, next) : unit(prev, p);
      const h = Math.atan2(d.z, d.x);
      mid[k] = push(p, h, h);
      continue;
    }
    const din = unit(prev, p);
    const dout = unit(p, next);
    const hIn = Math.atan2(din.z, din.x);
    const hOut = Math.atan2(dout.z, dout.x);
    const cross = din.x * dout.z - din.z * dout.x;
    const dot = din.x * dout.x + din.z * dout.z;
    const t = Math.min(Math.max(0, fillet), din.len / 2, dout.len / 2);
    if (t < EPS || (Math.abs(cross) < 1e-4 && dot > 0) || dot < -0.9999) {
      mid[k] = push(p, hIn, hOut);
      continue;
    }
    const a: P2 = { x: p.x - din.x * t, z: p.z - din.z * t };
    const b: P2 = { x: p.x + dout.x * t, z: p.z + dout.z * t };
    for (let i = 0; i <= ARC_STEPS; i++) {
      const u = i / ARC_STEPS;
      const w0 = (1 - u) * (1 - u);
      const w1 = 2 * u * (1 - u);
      const w2 = u * u;
      const q: P2 = { x: w0 * a.x + w1 * p.x + w2 * b.x, z: w0 * a.z + w1 * p.z + w2 * b.z };
      // Derivative of the quadratic curve gives the nose direction along the arc.
      const tx = 2 * (1 - u) * (p.x - a.x) + 2 * u * (b.x - p.x);
      const tz = 2 * (1 - u) * (p.z - a.z) + 2 * u * (b.z - p.z);
      const h = Math.atan2(tz, tx);
      const idx = push(q, h, h);
      if (i === ARC_STEPS / 2) mid[k] = idx;
    }
  }
  if (isLoop) {
    // Close the loop: the first sample again, arriving along the last piece.
    const h0 = rail.hIn[0]!;
    push({ x: rail.x[0]!, z: rail.z[0]! }, h0, rail.hOut[0]!);
  }
  let acc = 0;
  rail.s.push(0);
  for (let i = 1; i < rail.x.length; i++) {
    acc += Math.hypot(rail.x[i]! - rail.x[i - 1]!, rail.z[i]! - rail.z[i - 1]!);
    rail.s.push(acc);
  }
  rail.total = acc;
  for (let k = 0; k < points.length; k++) rail.vertexS.push(rail.s[mid[slot[k]!]!]!);
  return rail;
}

function lerpAngle(a: number, b: number, f: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  else if (d < -Math.PI) d += Math.PI * 2;
  return a + d * f;
}

/** Position and nose direction at arc length `s` (wrapped on a loop, clamped on an open track). */
export function railAt(rail: Rail, s: number): { x: number; z: number; heading: number } {
  const n = rail.x.length;
  if (n === 0) return { x: 0, z: 0, heading: 0 };
  if (n === 1 || rail.total <= 0) return { x: rail.x[0]!, z: rail.z[0]!, heading: rail.hOut[0]! };
  const at = rail.loop ? ((s % rail.total) + rail.total) % rail.total : Math.min(rail.total, Math.max(0, s));
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (rail.s[mid]! <= at) lo = mid;
    else hi = mid;
  }
  const len = rail.s[hi]! - rail.s[lo]!;
  const f = len > 0 ? (at - rail.s[lo]!) / len : 0;
  return {
    x: rail.x[lo]! + (rail.x[hi]! - rail.x[lo]!) * f,
    z: rail.z[lo]! + (rail.z[hi]! - rail.z[lo]!) * f,
    heading: lerpAngle(rail.hOut[lo]!, rail.hIn[hi]!, f),
  };
}

/** Arc length of the track point closest to (x, z). */
export function nearestS(rail: Rail, x: number, z: number): number {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i + 1 < rail.x.length; i++) {
    const ax = rail.x[i]!;
    const az = rail.z[i]!;
    const dx = rail.x[i + 1]! - ax;
    const dz = rail.z[i + 1]! - az;
    const len2 = dx * dx + dz * dz;
    const f = len2 > 0 ? Math.min(1, Math.max(0, ((x - ax) * dx + (z - az) * dz) / len2)) : 0;
    const d = Math.hypot(x - (ax + dx * f), z - (az + dz * f));
    if (d < bestD) {
      bestD = d;
      best = rail.s[i]! + Math.sqrt(len2) * f;
    }
  }
  return best;
}

/** Index of the route point the walker is heading for at arc length `s` moving in `dir`. */
export function upcomingPoint(rail: Rail, s: number, dir: 1 | -1): number {
  const v = rail.vertexS;
  const n = v.length;
  if (dir === 1) {
    for (let k = 0; k < n; k++) if (v[k]! > s) return k;
    return rail.loop ? 0 : n - 1;
  }
  for (let k = n - 1; k >= 0; k--) if (v[k]! < s) return k;
  return 0;
}
