import type { Vec3 } from '../engine/types';

/**
 * Boxes that are turned in space (a crate that tipped over or tumbles). One place for the maths every sensor and contact test
 * shares, so they all read the same real shape instead of the upright box the crate was spawned with.
 *
 * An oriented box is a centre, half sizes along its own three axes, and those axes as unit vectors. Pure functions, no world access.
 */

export interface Quat {
  x: number;
  y: number;
  z: number;
  w: number;
}

export interface Obb {
  centre: Vec3;
  /** Half size along each of the box's own axes. */
  half: Vec3;
  /** The box's own x, y and z axes in world coordinates (unit vectors). */
  axes: readonly [Vec3, Vec3, Vec3];
}

/** A half size this large makes an axis "not exist" (flat views ignore the axis they do not show). */
const UNBOUNDED = 1e6;
/** Below this the turn is rounding noise and the box counts as upright. */
const TURN_EPS = 1e-9;
const AXIS_EPS = 1e-9;

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const cross = (a: Vec3, b: Vec3): Vec3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

/** True when the quaternion really turns something (an upright body, or one with no turn recorded, is not turned). */
export function isTurned(q: Quat | undefined): q is Quat {
  return q !== undefined && Math.abs(q.x) + Math.abs(q.y) + Math.abs(q.z) > TURN_EPS;
}

/** The turn that counts for sensing: a ball rolls, but the box that stands for it does not turn with it. */
export function sensedTurn(q: Quat | undefined, shape: string | undefined): Quat | undefined {
  return shape === 'ball' ? undefined : q;
}

/** The three columns of the rotation matrix of `q` (where the x, y and z axes point after the turn). */
export function axesOf(q: Quat | undefined): readonly [Vec3, Vec3, Vec3] {
  if (!q) return [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }];
  const n = Math.hypot(q.x, q.y, q.z, q.w);
  if (!(n > 0) || !Number.isFinite(n)) return axesOf(undefined);
  const x = q.x / n;
  const y = q.y / n;
  const z = q.z / n;
  const w = q.w / n;
  return [
    { x: 1 - 2 * (y * y + z * z), y: 2 * (x * y + w * z), z: 2 * (x * z - w * y) },
    { x: 2 * (x * y - w * z), y: 1 - 2 * (x * x + z * z), z: 2 * (y * z + w * x) },
    { x: 2 * (x * z + w * y), y: 2 * (y * z - w * x), z: 1 - 2 * (x * x + y * y) },
  ];
}

/** `v` turned by `q`. */
export function rotateBy(q: Quat | undefined, v: Vec3): Vec3 {
  const [ax, ay, az] = axesOf(q);
  return { x: ax.x * v.x + ay.x * v.y + az.x * v.z, y: ax.y * v.x + ay.y * v.y + az.y * v.z, z: ax.z * v.x + ay.z * v.y + az.z * v.z };
}

/** Box of full size `size` centred at `centre`, turned by `rot` (no turn = upright). */
export function obbOf(centre: Vec3, size: Vec3, rot?: Quat): Obb {
  return {
    centre: { ...centre },
    half: { x: Math.abs(size.x) / 2, y: Math.abs(size.y) / 2, z: Math.abs(size.z) / 2 },
    axes: axesOf(isTurned(rot) ? rot : undefined),
  };
}

/** The same box with every half size grown by `by` (negative shrinks, never below 0). */
export function growObb(o: Obb, by: number): Obb {
  const g = (v: number): number => Math.max(0, v + by);
  return { centre: o.centre, half: { x: g(o.half.x), y: g(o.half.y), z: g(o.half.z) }, axes: o.axes };
}

/** Half length of the box's shadow on the unit direction `d`. */
export function halfAlong(o: Obb, d: Vec3): number {
  return Math.abs(dot(d, o.axes[0])) * o.half.x + Math.abs(dot(d, o.axes[1])) * o.half.y + Math.abs(dot(d, o.axes[2])) * o.half.z;
}

/** Full length of the box's shadow on the unit direction `d` (how wide it is between two fingers that close along `d`). */
export function extentOn(o: Obb, d: Vec3): number {
  return 2 * halfAlong(o, d);
}

/** The smallest upright (world axis-aligned) box that holds the box: centre and full size. */
export function obbBounds(o: Obb): { pos: Vec3; size: Vec3 } {
  const e = (k: 'x' | 'y' | 'z'): number => 2 * (Math.abs(o.axes[0][k]) * o.half.x + Math.abs(o.axes[1][k]) * o.half.y + Math.abs(o.axes[2][k]) * o.half.z);
  return { pos: { ...o.centre }, size: { x: e('x'), y: e('y'), z: e('z') } };
}

/** The eight corners. */
export function obbCorners(o: Obb): Vec3[] {
  const out: Vec3[] = [];
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const a = o.half.x * sx;
        const b = o.half.y * sy;
        const c = o.half.z * sz;
        out.push({
          x: o.centre.x + o.axes[0].x * a + o.axes[1].x * b + o.axes[2].x * c,
          y: o.centre.y + o.axes[0].y * a + o.axes[1].y * b + o.axes[2].y * c,
          z: o.centre.z + o.axes[0].z * a + o.axes[1].z * b + o.axes[2].z * c,
        });
      }
    }
  }
  return out;
}

/**
 * How far apart two boxes are, as the largest gap found along the 15 separating-axis candidates: positive = a gap of at least
 * that much (exact when a face of one looks at the other), negative = they overlap, by the smallest push that would part them.
 */
export function obbSeparation(a: Obb, b: Obb): number {
  const t = sub(b.centre, a.centre);
  let best = -Infinity;
  const test = (n: Vec3): void => {
    const len = Math.hypot(n.x, n.y, n.z);
    if (len < AXIS_EPS) return;
    const u = { x: n.x / len, y: n.y / len, z: n.z / len };
    const gap = Math.abs(dot(t, u)) - halfAlong(a, u) - halfAlong(b, u);
    if (gap > best) best = gap;
  };
  for (const ax of a.axes) test(ax);
  for (const ax of b.axes) test(ax);
  for (const ax of a.axes) for (const bx of b.axes) test(cross(ax, bx));
  return best;
}

/** True when `p` is inside the box grown by `margin` on every side. */
export function pointInObb(o: Obb, p: Vec3, margin = 0): boolean {
  const d = sub(p, o.centre);
  return (
    Math.abs(dot(d, o.axes[0])) <= o.half.x + margin &&
    Math.abs(dot(d, o.axes[1])) <= o.half.y + margin &&
    Math.abs(dot(d, o.axes[2])) <= o.half.z + margin
  );
}

/** True when `inner` lies completely inside `outer`. */
export function obbInside(inner: Obb, outer: Obb): boolean {
  const d = sub(inner.centre, outer.centre);
  const half = [outer.half.x, outer.half.y, outer.half.z];
  return outer.axes.every((n, i) => Math.abs(dot(d, n)) + halfAlong(inner, n) <= half[i]! + 1e-9);
}

/** Distance along the ray from `origin` (direction `dir`, any length) to where it enters the box; 0 when it starts inside; null when it misses. */
export function rayObb(o: Obb, origin: Vec3, dir: Vec3): number | null {
  const len = Math.hypot(dir.x, dir.y, dir.z);
  if (!(len > 0)) return null;
  const d = sub(origin, o.centre);
  const half = [o.half.x, o.half.y, o.half.z];
  let t0 = 0;
  let t1 = Infinity;
  for (let i = 0; i < 3; i++) {
    const n = o.axes[i]!;
    const p = dot(d, n);
    const v = dot(dir, n) / len;
    const h = half[i]!;
    if (Math.abs(v) < 1e-12) {
      if (Math.abs(p) > h) return null;
      continue;
    }
    let near = (-h - p) / v;
    let far = (h - p) / v;
    if (near > far) [near, far] = [far, near];
    t0 = Math.max(t0, near);
    t1 = Math.min(t1, far);
    if (t0 > t1) return null;
  }
  return t0;
}

/**
 * The box as a flat view sees it: the world axis the view hides is dropped (the box turns about that axis only, so the box's
 * own axis that lines up with it is made endless and the centre is put at 0 on it). Two boxes flattened the same way are
 * compared by the 3-D tests above as if on the plane.
 */
export function flattenObb(o: Obb, hidden: 'y' | 'z'): Obb {
  let idx = 0;
  for (let i = 1; i < 3; i++) if (Math.abs(o.axes[i]![hidden]) > Math.abs(o.axes[idx]![hidden])) idx = i;
  const half = { ...o.half };
  if (idx === 0) half.x = UNBOUNDED;
  else if (idx === 1) half.y = UNBOUNDED;
  else half.z = UNBOUNDED;
  return { centre: { ...o.centre, [hidden]: 0 }, half, axes: o.axes };
}

type Pt = { x: number; z: number };

/** True when two small point sets (convex outlines seen from above: 1 to 8 points each) overlap by a positive area or length. */
export function footprintsOverlap(p: readonly Vec3[], q: readonly Vec3[], eps = 1e-9): boolean {
  const pts = (s: readonly Vec3[]): Pt[] => s.map((v) => ({ x: v.x, z: v.z }));
  const a = pts(p);
  const b = pts(q);
  const axes: Pt[] = [];
  for (const set of [a, b]) {
    for (let i = 0; i < set.length; i++) {
      for (let j = i + 1; j < set.length; j++) {
        const dx = set[j]!.x - set[i]!.x;
        const dz = set[j]!.z - set[i]!.z;
        const len = Math.hypot(dx, dz);
        if (len < AXIS_EPS) continue;
        axes.push({ x: dx / len, z: dz / len }, { x: -dz / len, z: dx / len });
      }
    }
  }
  if (axes.length === 0) {
    // Both sets are single points: they overlap only when they coincide.
    return a.length > 0 && b.length > 0 && Math.hypot(a[0]!.x - b[0]!.x, a[0]!.z - b[0]!.z) <= eps;
  }
  const span = (s: Pt[], n: Pt): [number, number] => {
    let lo = Infinity;
    let hi = -Infinity;
    for (const v of s) {
      const d = v.x * n.x + v.z * n.z;
      lo = Math.min(lo, d);
      hi = Math.max(hi, d);
    }
    return [lo, hi];
  };
  for (const n of axes) {
    const [alo, ahi] = span(a, n);
    const [blo, bhi] = span(b, n);
    const overlap = Math.min(ahi, bhi) - Math.max(alo, blo);
    // A set that is a single spot along this axis (a corner or an edge seen end-on) overlaps when it lies inside; others need real length.
    const thin = Math.min(ahi - alo, bhi - blo) <= eps;
    if (thin ? overlap < -eps : overlap <= eps) return false;
  }
  return true;
}

/** What a view of an entity tells about its shape (`EntityView` fits). */
export interface ViewShape {
  shape?: string;
  position: Vec3;
  size: Vec3;
  collider?: { position: Vec3; size: Vec3 };
  rotation?: Quat;
}

/**
 * The real shape behind an entity view: its collision box when `useCollider` and it has one, else its drawn size, turned by the
 * view's rotation about the view's position (so a collision box off the middle swings round with it).
 */
export function obbOfView(v: ViewShape, useCollider = true): Obb {
  const box = useCollider && v.collider ? v.collider : v;
  const turn = sensedTurn(v.rotation, v.shape);
  if (!isTurned(turn)) return obbOf(box.position, box.size);
  const swing = rotateBy(turn, { x: box.position.x - v.position.x, y: box.position.y - v.position.y, z: box.position.z - v.position.z });
  return obbOf({ x: v.position.x + swing.x, y: v.position.y + swing.y, z: v.position.z + swing.z }, box.size, turn);
}

/** True when the view shows a body whose real outline is turned (a crate that tipped over; not a rolling ball). */
export function isTurnedView(v: ViewShape): boolean {
  return isTurned(sensedTurn(v.rotation, v.shape));
}

/** The turn that carries the x, y and z axes onto the three given orthonormal, right-handed axes. */
export function quatFromAxes(ax: Vec3, ay: Vec3, az: Vec3): Quat {
  const m00 = ax.x;
  const m10 = ax.y;
  const m20 = ax.z;
  const m01 = ay.x;
  const m11 = ay.y;
  const m21 = ay.z;
  const m02 = az.x;
  const m12 = az.y;
  const m22 = az.z;
  const trace = m00 + m11 + m22;
  if (trace > 0) {
    const s = 0.5 / Math.sqrt(trace + 1);
    return { w: 0.25 / s, x: (m21 - m12) * s, y: (m02 - m20) * s, z: (m10 - m01) * s };
  }
  if (m00 > m11 && m00 > m22) {
    const s = 2 * Math.sqrt(1 + m00 - m11 - m22);
    return { w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s };
  }
  if (m11 > m22) {
    const s = 2 * Math.sqrt(1 + m11 - m00 - m22);
    return { w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s };
  }
  const s = 2 * Math.sqrt(1 + m22 - m00 - m11);
  return { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s };
}

/** `a` applied after `b`: rotating by the result equals rotating by `b` first, then by `a`. */
export function mulQuat(a: Quat, b: Quat): Quat {
  return {
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
  };
}

/** The turn that undoes `q`. */
export function conjQuat(q: Quat): Quat {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}
