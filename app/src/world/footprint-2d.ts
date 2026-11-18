/**
 * Small flat geometry on the ground plane (x, z): convex outlines of a body seen from above, how they overlap, and how far a
 * point is from one. Pure functions; used by the scale (what a crate rests on) and the distance cards (how far a crate's outline is).
 */

export interface Pt {
  x: number;
  z: number;
}

const EPS = 1e-9;
/** An overlap thinner than this (m) or smaller than this (m²) is only two outlines touching, not a contact. */
export const MIN_LENGTH = 1e-6;
export const MIN_AREA = 1e-8;

const cross = (o: Pt, a: Pt, b: Pt): number => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x);
const dist = (a: Pt, b: Pt): number => Math.hypot(a.x - b.x, a.z - b.z);

/** Convex hull, counter-clockwise (x to the right, z up on the page). Points on one line give the 2 end points; one spot gives 1. */
export function hull(points: readonly Pt[]): Pt[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.z - b.z);
  const unique: Pt[] = [];
  for (const p of pts) {
    const last = unique[unique.length - 1];
    if (!last || Math.abs(last.x - p.x) > EPS || Math.abs(last.z - p.z) > EPS) unique.push(p);
  }
  if (unique.length <= 2) return unique;
  const build = (seq: readonly Pt[]): Pt[] => {
    const out: Pt[] = [];
    for (const p of seq) {
      while (out.length >= 2 && cross(out[out.length - 2]!, out[out.length - 1]!, p) <= EPS) out.pop();
      out.push(p);
    }
    out.pop();
    return out;
  };
  const lower = build(unique);
  const upper = build([...unique].reverse());
  const h = [...lower, ...upper];
  return h.length >= 3 ? h : [unique[0]!, unique[unique.length - 1]!];
}

/** Area of a convex outline (0 for fewer than 3 points). */
export function area(h: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < h.length; i++) {
    const p = h[i]!;
    const q = h[(i + 1) % h.length]!;
    a += p.x * q.z - q.x * p.z;
  }
  return Math.abs(a) / 2;
}

/** Middle of an outline: the centre of area for a polygon, the midpoint of a segment, the point itself. */
export function centroid(h: readonly Pt[]): Pt {
  if (h.length === 1) return { ...h[0]! };
  if (h.length === 2) return { x: (h[0]!.x + h[1]!.x) / 2, z: (h[0]!.z + h[1]!.z) / 2 };
  let a = 0;
  let cx = 0;
  let cz = 0;
  for (let i = 0; i < h.length; i++) {
    const p = h[i]!;
    const q = h[(i + 1) % h.length]!;
    const w = p.x * q.z - q.x * p.z;
    a += w;
    cx += (p.x + q.x) * w;
    cz += (p.z + q.z) * w;
  }
  if (Math.abs(a) < EPS) return { x: h.reduce((s, p) => s + p.x, 0) / h.length, z: h.reduce((s, p) => s + p.z, 0) / h.length };
  return { x: cx / (3 * a), z: cz / (3 * a) };
}

/** True when `p` is inside (or on the edge of) a counter-clockwise polygon of 3 or more points. */
function insidePolygon(poly: readonly Pt[], p: Pt): boolean {
  for (let i = 0; i < poly.length; i++) if (cross(poly[i]!, poly[(i + 1) % poly.length]!, p) < -EPS) return false;
  return true;
}

/** Sutherland-Hodgman: the part of convex `subject` inside convex `clip` (both counter-clockwise, 3 or more points). */
function clipPolygon(subject: readonly Pt[], clip: readonly Pt[]): Pt[] {
  let out: Pt[] = [...subject];
  for (let i = 0; i < clip.length && out.length > 0; i++) {
    const a = clip[i]!;
    const b = clip[(i + 1) % clip.length]!;
    const input = out;
    out = [];
    for (let j = 0; j < input.length; j++) {
      const cur = input[j]!;
      const prev = input[(j + input.length - 1) % input.length]!;
      const curIn = cross(a, b, cur) >= -EPS;
      const prevIn = cross(a, b, prev) >= -EPS;
      if (curIn !== prevIn) {
        const dc = cross(a, b, cur);
        const dp = cross(a, b, prev);
        const t = dp / (dp - dc);
        out.push({ x: prev.x + (cur.x - prev.x) * t, z: prev.z + (cur.z - prev.z) * t });
      }
      if (curIn) out.push(cur);
    }
  }
  return out;
}

/** The part of segment a-b inside a convex counter-clockwise polygon (Cyrus-Beck), or null. */
function clipSegment(a: Pt, b: Pt, poly: readonly Pt[]): [Pt, Pt] | null {
  let t0 = 0;
  let t1 = 1;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i]!;
    const q = poly[(i + 1) % poly.length]!;
    const da = cross(p, q, a);
    const db = cross(p, q, b);
    if (da < -EPS && db < -EPS) return null;
    if (da >= -EPS && db >= -EPS) continue;
    const t = da / (da - db);
    if (da < 0) t0 = Math.max(t0, t);
    else t1 = Math.min(t1, t);
    if (t0 > t1) return null;
  }
  return [
    { x: a.x + (b.x - a.x) * t0, z: a.z + (b.z - a.z) * t0 },
    { x: a.x + (b.x - a.x) * t1, z: a.z + (b.z - a.z) * t1 },
  ];
}

/** Where two segments cross, or null. */
function crossing(a: Pt, b: Pt, c: Pt, d: Pt): Pt | null {
  const r = { x: b.x - a.x, z: b.z - a.z };
  const s = { x: d.x - c.x, z: d.z - c.z };
  const den = r.x * s.z - r.z * s.x;
  if (Math.abs(den) < EPS) return null;
  const t = ((c.x - a.x) * s.z - (c.z - a.z) * s.x) / den;
  const u = ((c.x - a.x) * r.z - (c.z - a.z) * r.x) / den;
  if (t < -EPS || t > 1 + EPS || u < -EPS || u > 1 + EPS) return null;
  return { x: a.x + r.x * t, z: a.z + r.z * t };
}

/**
 * Where two outlines (hulls from `hull`) meet: the middle of the shared area when both are polygons and share a positive area;
 * the middle of the shared stretch when one of them is only a segment (an edge seen from above); the spot itself for a corner.
 * Two polygons that only touch along an edge share nothing. Returns null when they do not meet.
 */
export function overlapMiddle(p: readonly Pt[], q: readonly Pt[]): Pt | null {
  if (p.length === 0 || q.length === 0) return null;
  if (p.length >= 3 && q.length >= 3) {
    const shared = clipPolygon(p, q);
    if (shared.length < 3) return null;
    const h = hull(shared);
    return h.length >= 3 && area(h) > MIN_AREA ? centroid(h) : null;
  }
  const [poly, small] = p.length >= 3 ? [p, q] : q.length >= 3 ? [q, p] : [null, null];
  if (poly && small) {
    if (small.length === 1) return insidePolygon(poly, small[0]!) ? { ...small[0]! } : null;
    const piece = clipSegment(small[0]!, small[1]!, poly);
    return piece && dist(piece[0], piece[1]) > MIN_LENGTH ? centroid(piece) : null;
  }
  // Both are segments or spots.
  if (p.length === 1 && q.length === 1) return dist(p[0]!, q[0]!) <= MIN_LENGTH ? { ...p[0]! } : null;
  if (p.length === 1 || q.length === 1) {
    const [pt, seg] = p.length === 1 ? [p[0]!, q] : [q[0]!, p];
    const len = dist(seg[0]!, seg[1]!);
    const along = ((pt.x - seg[0]!.x) * (seg[1]!.x - seg[0]!.x) + (pt.z - seg[0]!.z) * (seg[1]!.z - seg[0]!.z)) / (len * len);
    const foot = { x: seg[0]!.x + (seg[1]!.x - seg[0]!.x) * along, z: seg[0]!.z + (seg[1]!.z - seg[0]!.z) * along };
    return along >= 0 && along <= 1 && dist(foot, pt) <= MIN_LENGTH ? { ...pt } : null;
  }
  return crossing(p[0]!, p[1]!, q[0]!, q[1]!);
}

/** Distance from a point to an outline from `hull` (0 when inside a polygon). */
export function distanceToHull(h: readonly Pt[], p: Pt): number {
  if (h.length === 0) return Infinity;
  if (h.length === 1) return dist(h[0]!, p);
  if (h.length >= 3 && insidePolygon(h, p)) return 0;
  let best = Infinity;
  const edges = h.length === 2 ? 1 : h.length;
  for (let i = 0; i < edges; i++) {
    const a = h[i]!;
    const b = h[(i + 1) % h.length]!;
    const len2 = (b.x - a.x) ** 2 + (b.z - a.z) ** 2;
    const t = len2 < EPS ? 0 : Math.min(1, Math.max(0, ((p.x - a.x) * (b.x - a.x) + (p.z - a.z) * (b.z - a.z)) / len2));
    best = Math.min(best, dist({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }, p));
  }
  return best;
}
