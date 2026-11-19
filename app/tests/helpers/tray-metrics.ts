import type { EntityView, Vec3, World } from '../../src/engine/types';
import { armRegistry } from '../../src/nodes/arm-parts';
import { dirOf, lateralOf, normalOf } from '../../src/world/arm-kinematics';
import { axesOf, obbOf, obbSeparation, quatFromAxes, type Obb } from '../../src/world/oriented-box';

/**
 * Where a crate sits on a link used as a tray, measured from the arm's own frame (the tip frame of the joint the link is
 * mounted on) and the link's sizes as the board gave them: nothing here asks the link code for its shape. Lengths in metres.
 */

const dot = (a: Vec3, b: Vec3): number => a.x * b.x + a.y * b.y + a.z * b.z;
const sub = (a: Vec3, b: Vec3): Vec3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });

export interface TraySize {
  length: number;
  thickness: number;
  width: number;
}

export interface TrayPose {
  pivot: Vec3;
  along: Vec3;
  normal: Vec3;
  lateral: Vec3;
  /** The plate itself: `length` along the link, `thickness` up from it, `width` sideways. */
  box: Obb;
}

/** `jointOwner` is the node id of the joint the tray link hangs on. Null before the joint has been placed. */
export function trayPose(world: World, jointOwner: string, size: TraySize): TrayPose | null {
  const joint = world.entities().find((e) => e.ownerNodeId === jointOwner);
  const frame = joint ? armRegistry(world).frames.get(joint.id) : undefined;
  if (!frame) return null;
  const along = dirOf(frame);
  const normal = normalOf(frame);
  const lateral = lateralOf(frame);
  const mid = { x: frame.pos.x + (along.x * size.length) / 2, y: frame.pos.y + (along.y * size.length) / 2, z: frame.pos.z + (along.z * size.length) / 2 };
  return { pivot: frame.pos, along, normal, lateral, box: obbOf(mid, { x: size.length, y: size.thickness, z: size.width }, quatFromAxes(along, normal, lateral)) };
}

export interface OnTray {
  /** Crate centre from the pivot along the tray, and sideways from its centre line. */
  along: number;
  lateral: number;
  /** Height of the crate centre above the tray's top face, measured along the tray normal. */
  rise: number;
  /** How deep the crate is inside the plate (positive = overlap, negative = the gap). */
  overlap: number;
  /** Degrees between the crate's up axis and the tray normal. */
  tilt: number;
}

export function crateOnTray(pose: TrayPose, size: TraySize, crate: EntityView): OnTray {
  const d = sub(crate.position, pose.pivot);
  const up = axesOf(crate.rotation)[1];
  return {
    along: dot(d, pose.along),
    lateral: dot(d, pose.lateral),
    rise: dot(d, pose.normal) - size.thickness / 2,
    overlap: -obbSeparation(pose.box, obbOf(crate.position, crate.size, crate.rotation)),
    tilt: (Math.acos(Math.max(-1, Math.min(1, dot(up, pose.normal)))) * 180) / Math.PI,
  };
}

/** True while the crate lies on the plate: over it, within 2 cm of its top face and within 10 degrees of flat on it. */
export function liesOnTray(m: OnTray, size: TraySize, crateSide: number): boolean {
  return m.along > 0 && m.along < size.length && Math.abs(m.lateral) < size.width / 2 && Math.abs(m.rise - crateSide / 2) < 0.02 && m.tilt < 10;
}
