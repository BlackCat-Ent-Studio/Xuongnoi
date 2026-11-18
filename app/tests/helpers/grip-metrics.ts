import type { EntityView, Vec3, World } from '../../src/engine/types';
import { armRegistry } from '../../src/nodes/arm-parts';
import { dirOf, lateralOf, normalOf } from '../../src/world/arm-kinematics';
import { extentOn, obbOf, obbSeparation, quatFromAxes } from '../../src/world/oriented-box';

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
  const parts = world.entities().filter((e) => e.ownerNodeId === gripperOwner);
  const palm = parts.find((e) => Math.abs(e.size.x - 0.15) < 1e-9);
  const fingers = parts.filter((e) => Math.abs(e.size.x - 0.3) < 1e-9);
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
