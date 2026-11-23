import type { Vec3, ViewMode } from '../engine/types';
import { boundsBox, spanOverlap, type Box } from './collider';
import type { Entity } from './entity';
import { DEFAULT_MASS_KG } from './material';
import { moveBlocksIn, moveSceneOf, type MoveScene } from './platforms';

/**
 * A carrier holding another body.
 *
 * - The held body (one loose item, or blocks that go as one body, the first of them leading) is put where the carrier is plus
 *   `offset`, after the carrier has made its move of the tick. It keeps its own heading: only its place follows the carrier.
 * - A held body never enters a solid block. Along each axis it goes as far as it can, and the carrier is put back by what the
 *   body could not go (never by more than the carrier moved itself in that tick): carrier and held body stop together, as one
 *   outline. What a held block meets on its way other than solid blocks it carries and pushes as any moving block does.
 * - A body is held by one hitch at a time.
 */

type Axis = 'x' | 'y' | 'z';

/** Overlap below this counts as touching (same value physics.ts uses). */
const SKIN = 1e-6;
/** Halvings made to find how far a body can go before it meets a solid (the last step is under a hundredth of the move). */
const SEEK = 8;

export interface Hitch {
  /** Node id of the hitch. */
  owner: string;
  carrier: Entity;
  /** What is held, the leading body first; the others keep their places against it. */
  bodies: Entity[];
  /**
   * Where the leading body sits against the middle of the carrier: `x` metres ahead of it and `z` metres to its right (along
   * the carrier's own heading), `y` metres above it.
   */
  offset: Vec3;
  /** Where the carrier stood on the ground plane before its move of this tick. */
  from: { x: number; z: number };
}

/** Where the leading body of a hitch belongs now. */
export function hitchPlace(h: Hitch, mode: ViewMode): Vec3 {
  const c = h.carrier;
  const lead = h.bodies[0]!;
  const o = h.offset;
  if (mode === '2d-side') return { x: c.pos.x + (c.facing.x < 0 ? -o.x : o.x), y: c.pos.y + o.y, z: lead.pos.z };
  const len = Math.hypot(c.facing.x, c.facing.z);
  const fx = len > 1e-9 ? c.facing.x / len : 1;
  const fz = len > 1e-9 ? c.facing.z / len : 0;
  // Heading grows clockwise seen from above, so "to the right" of (fx, fz) is (-fz, fx).
  return { x: c.pos.x + fx * o.x - fz * o.z, y: mode === '2d-top' ? lead.pos.y : c.pos.y + o.y, z: c.pos.z + fz * o.x + fx * o.z };
}

/** What every carrier holds, for the carriers that hold something. */
export function heldByCarrier(hitches: Iterable<Hitch>): Map<Entity, Entity[]> {
  const out = new Map<Entity, Entity[]>();
  for (const h of hitches) {
    const had = out.get(h.carrier);
    if (had) had.push(...h.bodies);
    else out.set(h.carrier, [...h.bodies]);
  }
  return out;
}

/** Mass (kg) of the bodies themselves; what lies in or on them is weighed by `massOn` with the bodies as parts of the carrier. */
export function ownMassOf(bodies: readonly Entity[]): number {
  let kg = 0;
  for (const b of bodies) kg += b.mass ?? DEFAULT_MASS_KG[b.kind];
  return kg;
}

/** Notes where every carrier stands before the bodies of the world make their moves of this tick. */
export function beginHitches(hitches: Iterable<Hitch>): void {
  for (const h of hitches) h.from = { x: h.carrier.pos.x, z: h.carrier.pos.z };
}

function overlaps(a: Box, b: Box): boolean {
  return spanOverlap(a, b, 'x') > SKIN && spanOverlap(a, b, 'y') > SKIN && spanOverlap(a, b, 'z') > SKIN;
}

/**
 * The share (0..1) of a move by `d` along `axis` the held bodies can make before one of them enters a solid block. A block a
 * body already stands in does not stop it (it may part from it).
 */
function freeShare(parts: readonly Entity[], axis: Axis, d: number, walls: readonly Box[]): number {
  const boxes = parts.map((p) => boundsBox(p));
  const shifted = (b: Box, by: number): Box => {
    const pos = { ...b.pos };
    pos[axis] += by;
    return { pos, size: b.size };
  };
  // Per body, the walls it is clear of now and reaches somewhere on the way.
  const against = boxes.map((b) => {
    const swept: Box = shifted(b, d / 2);
    swept.size = { ...b.size };
    swept.size[axis] = Math.abs(b.size[axis]) + Math.abs(d);
    return walls.filter((w) => overlaps(swept, w) && !overlaps(b, w));
  });
  if (against.every((list) => list.length === 0)) return 1;
  const meets = (share: number): boolean => boxes.some((b, k) => against[k]!.length > 0 && against[k]!.some((w) => overlaps(shifted(b, d * share), w)));
  if (!meets(1)) return 1;
  let lo = 0;
  let hi = 1;
  for (let k = 0; k < SEEK; k++) {
    const mid = (lo + hi) / 2;
    if (meets(mid)) hi = mid;
    else lo = mid;
  }
  return lo;
}

function moveAxesOf(mode: ViewMode): Axis[] {
  return mode === '2d-side' ? ['x', 'y'] : mode === '2d-top' ? ['x', 'z'] : ['x', 'y', 'z'];
}

/**
 * After the carriers have moved: every held body goes to its place (see the top of this file). `dt` is the length of the tick,
 * for the speed a robot carrier is left with when it was put back.
 */
export function followHitches(hitches: Iterable<Hitch>, entities: readonly Entity[], mode: ViewMode, dt: number): void {
  let scene: MoveScene | null = null;
  let solids: Entity[] | null = null;
  for (const h of hitches) {
    const c = h.carrier;
    const lead = h.bodies[0];
    if (!lead || !c.visible || h.bodies.some((b) => !b.visible)) continue;
    const to = hitchPlace(h, mode);
    if (![to.x, to.y, to.z].every(Number.isFinite)) continue;
    const blocks = lead.kind === 'block';
    // What can meet a wall: a loose item, or the solid ones among the blocks.
    const parts = h.bodies.filter((b) => b.kind !== 'block' || b.solid);
    let walls: Box[] | null = null;
    for (const axis of moveAxesOf(mode)) {
      const d = to[axis] - lead.pos[axis];
      if (Math.abs(d) < 1e-12) continue;
      if (parts.length > 0 && !walls) {
        solids ??= entities.filter((e) => e.visible && e.solid && e.kind === 'block');
        walls = solids.filter((s) => s !== c && s.hitchedBy !== h.owner).map((s) => boundsBox(s));
      }
      const share = parts.length > 0 ? freeShare(parts, axis, d, walls!) : 1;
      if (share <= 0) continue;
      const step = share >= 1 ? d : d * share;
      if (blocks) {
        const next = { ...lead.pos };
        next[axis] = share >= 1 ? to[axis] : lead.pos[axis] + step;
        // The carrier is no load of the body and is not in its way: it is what the body is fixed to.
        moveBlocksIn((scene ??= moveSceneOf(entities)), h.bodies, next, mode, [c]);
      } else {
        for (const b of h.bodies) b.pos[axis] = b === lead && share >= 1 ? to[axis] : b.pos[axis] + step;
      }
    }
    giveBack(h, to, dt);
  }
}

/**
 * The carrier takes back, on the ground plane, what its held body could not go: at most its own move of this tick, so a body
 * that is still on its way to its place never drags the carrier along. A robot carrier keeps only the speed it really made.
 */
function giveBack(h: Hitch, to: Vec3, dt: number): void {
  const c = h.carrier;
  const lead = h.bodies[0]!;
  let back = false;
  for (const axis of ['x', 'z'] as const) {
    const miss = lead.pos[axis] - to[axis];
    const own = c.pos[axis] - h.from[axis];
    if (Math.abs(miss) < 1e-9 || Math.abs(own) < 1e-12) continue;
    const by = own > 0 ? Math.max(-own, Math.min(0, miss)) : Math.min(-own, Math.max(0, miss));
    if (by === 0) continue;
    c.pos[axis] += by;
    back = true;
  }
  const robot = c.robot;
  if (!back || !robot || !(dt > 0)) return;
  const along = ((c.pos.x - h.from.x) * Math.cos(robot.heading) + (c.pos.z - h.from.z) * Math.sin(robot.heading)) / dt;
  if (Math.abs(along) < Math.abs(robot.speed)) robot.speed = along;
}
