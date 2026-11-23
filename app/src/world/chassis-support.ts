import type { ViewMode } from '../engine/types';
import { boundsBox, hasChassisOutline } from './collider';
import type { Entity } from './entity';
import { centroid, distanceToHull, hull, type Pt } from './footprint-2d';
import type { MountedWheel } from './robot-drive';

/**
 * What holds a robot chassis up ("Vật lý thật" only). Pure geometry on the ground plane, no world access.
 *
 * A chassis stands on its wheels: every mounted wheel, plus two free casters that are not drawn, on its centre line near the
 * nose and near the tail (a chassis on two drive wheels would otherwise balance on a line; a chassis with wheels at its four
 * corners gains nothing from them). Each of those points is held when a solid block has its top under it, at the height of the
 * chassis's underside. From that, one of four things is true:
 *
 *  - on its wheels: its middle (where its weight is taken to act; what it carries is not counted) lies over the points that
 *    are held. Only the wheels that are held grip; one that hangs over a hole or past an edge spins free.
 *  - on its belly: its middle is not over the held points, but it is over the part of its underside that lies on blocks
 *    (astride a hole narrower than itself; one drive wheel over an edge). It has dropped onto its underside, which rubs on
 *    the floor and brakes it; a wheel that still has ground under it goes on gripping. Astride a hole, with no such wheel, it
 *    is stuck.
 *  - tipping: its middle hangs beyond everything that is under it (driven or pushed over the edge of a deck). Nothing
 *    grips; it slides off, away from what still holds it, and falls once nothing is under it. The slide ends there: it drops
 *    with the speed its wheels had given it.
 *  - in the air: no block is under it at all.
 *
 * The chassis has no pitch or roll in this model: tipping is shown as sliding off level and then dropping, not as turning over.
 *
 * Being set down: a chassis card puts its chassis a little above the floor and it drops onto it in the first ticks. Until it
 * has landed for the first time, a floor up to `SET_DOWN_REACH` under it counts as under its wheels, so a board starts as it
 * did before this rule (the wheels already turn while it settles). A chassis that appears higher than that, or with a wheel
 * over nothing, is not being set down: the rule holds for it from the first tick.
 * A chassis with a collision box of its own, the top-down view and the plain drive of older boards are left as they were:
 * held up by any block under the box, every wheel gripping.
 */

/** How far (m) above or below the underside the top of a block may be and still be what the chassis stands on. */
const HEIGHT_SLACK = 0.05;
/** Before its first landing, a block top up to this far (m) under the underside is what the chassis is being set down on. */
const SET_DOWN_REACH = 0.5;
/** Half the size (m) of the patch a wheel touches the ground with: a gap narrower than this under a wheel is rolled over. */
const WHEEL_PATCH = 0.03;
/** The middle may be this far (m) outside what holds it and still count as over it (a chassis on two wheels and one caster balances on a line). */
const BALANCE_SLACK = 0.001;
/** A caster sits this far (m) in from the nose or the tail, or a quarter of the length when the chassis is shorter than that. */
const CASTER_INSET = 0.1;
/** The side view has no depth: there every block is this deep (m) to either side, and the chassis half as wide. */
const DEEP = 2;

export type SupportState = 'wheels' | 'belly' | 'tipping' | 'air';

export interface ChassisSupport {
  state: SupportState;
  /** The wheels that have ground under them and grip (none while it tips or is in the air). */
  grip: ReadonlySet<MountedWheel>;
  /** Tipping: the unit direction on the ground it slides off along, and how far (0..1 of its reach that way) its middle hangs out. */
  away: { x: number; z: number; share: number } | null;
}

interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

const inRect = (p: Pt, r: Rect, pad: number): boolean => p.x >= r.x0 - pad && p.x <= r.x1 + pad && p.z >= r.z0 - pad && p.z <= r.z1 + pad;

/** The part of a convex polygon inside an upright rectangle (one cut per side). */
function clipToRect(poly: readonly Pt[], r: Rect): Pt[] {
  const cuts: [(p: Pt) => number, 'x' | 'z', number][] = [
    [(p) => p.x - r.x0, 'x', r.x0],
    [(p) => r.x1 - p.x, 'x', r.x1],
    [(p) => p.z - r.z0, 'z', r.z0],
    [(p) => r.z1 - p.z, 'z', r.z1],
  ];
  let out: Pt[] = [...poly];
  for (const [side, axis, at] of cuts) {
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i]!;
      const nxt = input[(i + 1) % input.length]!;
      const dc = side(cur);
      const dn = side(nxt);
      if (dc >= 0) out.push(cur);
      if (dc >= 0 !== dn >= 0) {
        const t = dc / (dc - dn);
        const p = { x: cur.x + (nxt.x - cur.x) * t, z: cur.z + (nxt.z - cur.z) * t };
        // The cut point lies on the side exactly, whatever the rounding of `t`.
        p[axis] = at;
        out.push(p);
      }
    }
    if (out.length === 0) break;
  }
  return out;
}

/**
 * What holds `r` up among the solid blocks `solids` (those bolted to it left out), or null when every wheel and caster has
 * ground under it, which is every chassis on a floor: nothing then differs from a chassis that is simply held by the floor.
 * Null as well for a chassis this rule does not apply to (see the file comment). `landed` is false until it has stood on
 * something for the first time.
 */
export function chassisSupport(r: Entity, solids: readonly Entity[], mode: ViewMode, landed = true): ChassisSupport | null {
  const body = r.robot;
  if (!body || mode === '2d-top' || !hasChassisOutline(r)) return null;
  const side = mode === '2d-side';
  const flen = Math.hypot(r.facing.x, r.facing.z);
  const f = side || !(flen > 1e-9) ? { x: 1, z: 0 } : { x: r.facing.x / flen, z: r.facing.z / flen };
  const right = { x: -f.z, z: f.x };
  const at = (forward: number, across: number): Pt => ({ x: r.pos.x + f.x * forward + right.x * across, z: side ? 0 : r.pos.z + f.z * forward + right.z * across });
  const { length, width } = body.spec;
  const wheels = [...body.wheels.values()];
  const wheelAt = wheels.map((w) => at(w.forward, w.side));
  const caster = length / 2 - Math.min(CASTER_INSET, length / 4);
  const points = [...wheelAt, at(caster, 0), at(-caster, 0)];

  // The blocks whose top is at the underside and that come near the chassis at all.
  const bottom = r.pos.y - r.size.y / 2;
  let round = Math.hypot(length, width) / 2;
  for (const w of wheels) round = Math.max(round, Math.hypot(w.forward, w.side));
  round += WHEEL_PATCH;
  const under: Rect[] = [];
  const below = landed ? HEIGHT_SLACK : SET_DOWN_REACH;
  for (const s of solids) {
    const b = boundsBox(s);
    const gap = bottom - (b.pos.y + b.size.y / 2);
    if (gap > below || gap < -HEIGHT_SLACK) continue;
    const hx = Math.abs(b.size.x) / 2;
    const hz = side ? DEEP : Math.abs(b.size.z) / 2;
    const bz = side ? 0 : b.pos.z;
    if (Math.abs(b.pos.x - r.pos.x) > hx + round || Math.abs(bz - (side ? 0 : r.pos.z)) > hz + round) continue;
    under.push({ x0: b.pos.x - hx, x1: b.pos.x + hx, z0: bz - hz, z1: bz + hz });
  }
  const held = points.map((p) => under.some((u) => inRect(p, u, WHEEL_PATCH)));
  if (held.every(Boolean)) return null;

  const middle: Pt = { x: r.pos.x, z: side ? 0 : r.pos.z };
  const feet = hull(points.filter((_, i) => held[i]));
  const grip: ReadonlySet<MountedWheel> = new Set(wheels.filter((_, i) => held[i]));
  if (feet.length > 0 && distanceToHull(feet, middle) <= BALANCE_SLACK) return { state: 'wheels', grip, away: null };
  const none: ReadonlySet<MountedWheel> = new Set();
  // The underside that lies on blocks: the outline cut to each block's top.
  const hw = side ? DEEP / 2 : width / 2;
  const outline: Pt[] = [
    { x: middle.x - f.x * (length / 2) - right.x * hw, z: middle.z - f.z * (length / 2) - right.z * hw },
    { x: middle.x + f.x * (length / 2) - right.x * hw, z: middle.z + f.z * (length / 2) - right.z * hw },
    { x: middle.x + f.x * (length / 2) + right.x * hw, z: middle.z + f.z * (length / 2) + right.z * hw },
    { x: middle.x - f.x * (length / 2) + right.x * hw, z: middle.z - f.z * (length / 2) + right.z * hw },
  ];
  const lying: Pt[] = [];
  for (const u of under) lying.push(...clipToRect(outline, u));
  if (lying.length === 0) return { state: 'air', grip: none, away: null };
  const belly = hull(lying);
  if (distanceToHull(belly, middle) <= BALANCE_SLACK) return { state: 'belly', grip, away: null };
  const c = centroid(belly);
  const dx = middle.x - c.x;
  const dz = middle.z - c.z;
  const far = Math.hypot(dx, dz);
  if (!(far > 1e-9)) return { state: 'belly', grip, away: null };
  const dir = { x: dx / far, z: dz / far };
  // How far its middle hangs beyond what holds it, as a share of how far the outline reaches that way from the middle.
  const reach = (Math.abs(dir.x * f.x + dir.z * f.z) * length + Math.abs(dir.x * right.x + dir.z * right.z) * (side ? 0 : width)) / 2;
  const out = distanceToHull(belly, middle);
  return { state: 'tipping', grip: none, away: { x: dir.x, z: dir.z, share: reach > 1e-9 ? Math.min(1, out / reach) : 1 } };
}
