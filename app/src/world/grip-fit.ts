import type { Vec3 } from '../engine/types';
import { axesOf, conjQuat, extentOn, mulQuat, obbOf, obbSeparation, pointInObb, rotateBy, type Quat } from './oriented-box';

/**
 * How a rigid crate sits in a closed gripper (pure maths, no world access). All lengths in metres, all positions and turns in
 * the hand's own frame: x along the arm, y up from the arm, z sideways, origin at the grasp point (the middle of the fingers).
 *
 * The two pads close along one axis (`close`: z in the 3D and top views, y in the side view). Closing on a crate:
 *  - the crate must lie between the open fingers (all of it inside the opening across the closing axis); in the views with
 *    flat pads (closing axis z) one pair of its faces must face the pads (within `ALIGN_TOL`) and closing turns it flat against
 *    them, as a parallel gripper does. In the side view the fingers are bars in the plane of the arm and the crate keeps the turn
 *    it has in the hand: they touch its outline, so the gap is the outline's width across the closing axis;
 *  - each finger closes until it touches its face, so the pads end on opposite faces whatever the crate's offset across the closing
 *    axis (the crate is not moved); `shift` is where the pads' middle is, relative to the grasp point;
 *  - the grasp point must lie inside the crate, so the pads are really on it;
 *  - the crate must not sink into the palm or into the link the hand hangs on (a crate the hand has not stood round, or one
 *    that would have to be pressed into the palm, is not taken).
 */

/** Largest angle (rad) between the closing axis and the nearest crate face normal that closing still turns flat (10 deg). */
export const ALIGN_TOL = (10 * Math.PI) / 180;
/** Overlap (m) with the palm or the link that still counts as touching. */
export const SKIN = 0.0005;

export interface HandBox {
  /** Centre and full size in the hand frame, relative to the grasp point; the box is aligned with the hand. */
  centre: Vec3;
  size: Vec3;
}

export interface FitInput {
  /** The hand's own turn (hand frame -> world). */
  hand: Quat;
  /** Crate centre minus grasp point, in world axes. */
  offset: Vec3;
  size: Vec3;
  /** The crate's real turn (world), or undefined when upright. */
  rotation: Quat | undefined;
  /** Opening between the open fingers (m). */
  width: number;
  close: 'y' | 'z';
  /** Boxes the held crate must stay clear of: the palm and the link the hand hangs on. */
  clear: readonly HandBox[];
}

export interface GripFit {
  /** Crate centre in the hand frame (it is not moved by the closing fingers). */
  offset: Vec3;
  /** Crate turn in the hand frame, with the faces turned flat against the pads. */
  turn: Quat;
  /** Width of the crate between the pads (m): half of it is each finger's distance from the grasp point. */
  across: number;
  /** Offset of the crate centre from the grasp point along the closing axis: the pads' middle sits there. */
  shift: number;
}

const unit = (q: Quat): Quat => {
  const n = Math.hypot(q.x, q.y, q.z, q.w) || 1;
  return { x: q.x / n, y: q.y / n, z: q.z / n, w: q.w / n };
};

/** The turn about the axis perpendicular to both `a` and `b` that carries unit `a` onto unit `b`. */
function arc(a: Vec3, b: Vec3, cos: number): Quat {
  const cx = a.y * b.z - a.z * b.y;
  const cy = a.z * b.x - a.x * b.z;
  const cz = a.x * b.y - a.y * b.x;
  const len = Math.hypot(cx, cy, cz);
  if (len < 1e-12) return { x: 0, y: 0, z: 0, w: 1 };
  const half = Math.acos(Math.min(1, Math.max(-1, cos))) / 2;
  const s = Math.sin(half) / len;
  return { x: cx * s, y: cy * s, z: cz * s, w: Math.cos(half) };
}

/** Where a rigid crate would sit in the closed hand, or null when closing cannot clamp it (see the header). */
export function fitInHand(input: FitInput): GripFit | null {
  const closeV: Vec3 = input.close === 'y' ? { x: 0, y: 1, z: 0 } : { x: 0, y: 0, z: 1 };
  const toHand = conjQuat(input.hand);
  const turnIn = mulQuat(toHand, input.rotation ?? { x: 0, y: 0, z: 0, w: 1 });
  // The crate face normal nearest the closing axis; the pads turn the crate until it lies exactly on it.
  let best: { axis: Vec3; cos: number } | null = null;
  for (const a of axesOf(turnIn)) {
    const c = a.x * closeV.x + a.y * closeV.y + a.z * closeV.z;
    if (!best || Math.abs(c) > Math.abs(best.cos)) best = { axis: c < 0 ? { x: -a.x, y: -a.y, z: -a.z } : a, cos: Math.abs(c) };
  }
  const flatPads = input.close === 'z';
  if (!best || (flatPads && Math.acos(Math.min(1, best.cos)) > ALIGN_TOL)) return null;
  const turn = flatPads ? unit(mulQuat(arc(best!.axis, closeV, best!.cos), turnIn)) : turnIn;
  const d = rotateBy(toHand, input.offset);
  const box = obbOf(d, input.size, turn);
  const across = extentOn(box, closeV);
  // Lying between the open fingers: the whole crate fits inside the opening, off-middle by no more than the opening leaves room for.
  if (Math.abs(input.close === 'y' ? d.y : d.z) + across / 2 > input.width / 2 + 1e-9) return null;
  if (!pointInObb(box, { x: 0, y: 0, z: 0 })) return null;
  for (const other of input.clear) {
    if (obbSeparation(obbOf(other.centre, other.size), box) < -SKIN) return null;
  }
  return { offset: d, turn, across, shift: input.close === 'y' ? d.y : d.z };
}
