import type { EntityView, Vec3, World } from '../../src/engine/types';
import { armRegistry } from '../../src/nodes/arm-parts';
import { dirOf, lateralOf, normalOf } from '../../src/world/arm-kinematics';
import { extentOn, obbOf, obbSeparation, quatFromAxes, type Obb } from '../../src/world/oriented-box';

/**
 * Where a held crate sits in a gripper's hand, measured independently of the gripper code: from the arm's frame (the end of
 * the link the gripper is mounted on) and the drawn boxes of the hand and the link. Lengths in metres.
 */
export interface HoldMetrics {
  /** Crate centre minus grasp point, along the arm / across the closing direction / up from the arm. */
  along: number;
  across: number;
  rise: number;
  /** How far the crate sinks into each box (m, positive = overlap, negative = a gap). */
  overlap: { palm: number; finger1: number; finger2: number; link: number };
  /** Gap (m) between each finger's inner face and the crate face across the closing direction (0 = touching). */
  faceGap: [number, number];
}

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

/** `linkOwner` is the node id of the link the gripper hangs on, `gripperOwner` the gripper's node id. 3D: the fingers close sideways. */
export function holdMetrics(world: World, linkOwner: string, gripperOwner: string, crate: EntityView): HoldMetrics | null {
  const link = world.entities().find((e) => e.ownerNodeId === linkOwner);
  const hand = link ? armRegistry(world).frames.get(link.id) : undefined;
  if (!link || !hand) return null;
  const ap = dirOf(hand);
  const no = normalOf(hand);
  const la = lateralOf(hand);
  const grasp = { x: hand.pos.x + ap.x * 0.3, y: hand.pos.y + ap.y * 0.3, z: hand.pos.z + ap.z * 0.3 };
  const q = quatFromAxes(ap, no, la);
  // The drawn palm and two fingers are the first three entities the gripper made (the solid cover cubes of a hand come after them).
  const [palm, ...fingers] = world.entities().filter((e) => e.ownerNodeId === gripperOwner).slice(0, 3);
  if (!palm || fingers.length !== 2) return null;
  const c = obbOf(crate.position, crate.size, crate.rotation);
  const d = sub(crate.position, grasp);
  const w = extentOn(c, la);
  const face = (f: EntityView): number => Math.abs(dot(sub(f.position, crate.position), la)) - 0.06 - w / 2;
  return {
    along: dot(d, ap),
    across: dot(d, la),
    rise: dot(d, no),
    overlap: {
      palm: -obbSeparation(obbOf(palm.position, palm.size, q), c),
      finger1: -obbSeparation(obbOf(fingers[0]!.position, fingers[0]!.size, q), c),
      finger2: -obbSeparation(obbOf(fingers[1]!.position, fingers[1]!.size, q), c),
      link: -obbSeparation(obbOf(link.position, link.size, q), c),
    },
    faceGap: [face(fingers[0]!), face(fingers[1]!)],
  };
}

/** The drawn boxes of a gripper (palm, finger 1, finger 2) with the turn of its hand, for measuring against any crate. */
export function handBoxesOf(world: World, linkOwner: string, gripperOwner: string): { palm: Obb; fingers: [Obb, Obb]; link: Obb } | null {
  const link = world.entities().find((e) => e.ownerNodeId === linkOwner);
  const hand = link ? armRegistry(world).frames.get(link.id) : undefined;
  if (!link || !hand) return null;
  const q = quatFromAxes(dirOf(hand), normalOf(hand), lateralOf(hand));
  const [palm, f1, f2] = world.entities().filter((e) => e.ownerNodeId === gripperOwner).slice(0, 3);
  if (!palm || !f1 || !f2) return null;
  return {
    palm: obbOf(palm.position, palm.size, q),
    fingers: [obbOf(f1.position, f1.size, q), obbOf(f2.position, f2.size, q)],
    link: obbOf(link.position, link.size, q),
  };
}

/** How far a crate sinks into the hand's palm, either finger or the link (m, positive = overlap, negative = gap): the largest of the four. */
export function crateInHand(world: World, linkOwner: string, gripperOwner: string, crate: EntityView): number {
  const h = handBoxesOf(world, linkOwner, gripperOwner);
  if (!h) return -Infinity;
  const c = obbOf(crate.position, crate.size, crate.rotation);
  return Math.max(...[h.palm, h.fingers[0], h.fingers[1], h.link].map((o) => -obbSeparation(o, c)));
}

/** The drawn box of any link (its turn is the one of the frame at its end: a link does not turn). */
function linkObbOf(world: World, owner: string): Obb | null {
  const link = world.entities().find((e) => e.ownerNodeId === owner);
  const frame = link ? armRegistry(world).frames.get(link.id) : undefined;
  if (!link || !frame) return null;
  return obbOf(link.position, link.size, quatFromAxes(dirOf(frame), normalOf(frame), lateralOf(frame)));
}

/**
 * How far a crate sinks into any part of an arm (m, positive = overlap): its links, the hand's palm and both fingers. `links` are the
 * node ids of the links; the last of them is the one the gripper hangs on. Negative = the gap to the nearest part.
 */
export function crateInArm(world: World, links: readonly string[], gripperOwner: string, crate: EntityView): number {
  const c = obbOf(crate.position, crate.size, crate.rotation);
  const parts: Obb[] = [];
  for (const l of links) {
    const o = linkObbOf(world, l);
    if (o) parts.push(o);
  }
  const hand = links.length > 0 ? handBoxesOf(world, links[links.length - 1]!, gripperOwner) : null;
  if (hand) parts.push(hand.palm, hand.fingers[0], hand.fingers[1]);
  if (parts.length === 0) return -Infinity;
  return Math.max(...parts.map((o) => -obbSeparation(o, c)));
}
