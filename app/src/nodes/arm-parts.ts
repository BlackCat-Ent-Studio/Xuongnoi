import type { EntityId, EvalCtx, Vec3, ViewMode, WorldApi } from '../engine/types';
import { setArmHint } from '../engine/render-hints';
import { localToWorld, type Frame } from '../world/arm-kinematics';
import type { Box } from '../world/linear-actuator';

/**
 * What the arm pieces of one running game know about each other. Wires carry only "an object" between pieces, so the
 * pose of every link and the weight hanging beyond every joint travel through this table (one per world). Pieces
 * evaluate base-first, so a piece always sees the frame of whatever it is mounted on from the same tick; the loads
 * flow the other way and are the ones the pieces beyond wrote on the previous tick.
 */

/** A mass hanging somewhere on the arm. */
export interface ArmMass {
  kg: number;
  point: Vec3;
}

/** Where a part stands and which solid cubes it has, given the frame of what it is mounted on (see `solidsBeyond`). */
export type ArmShape = (base: Frame, mode: ViewMode) => { out: Frame | null; solids: Box[] };

export interface ArmPart {
  /** Last tick this part wrote its record. */
  tick: number;
  /** The object it is mounted on (a joint tip, a link tip or a plain entity). */
  baseId: EntityId | null;
  /** Its own entity: the handle of its `tip` output (grippers have none). */
  tipId: EntityId | null;
  masses: ArmMass[];
  /** The crate this part holds in its fingers (grippers): the arm's own pushes leave it alone, it is part of the hand. */
  holds?: EntityId | null;
  /** Geometry of the part for any frame it might be mounted on; lets a joint ask what its turn would carry into. */
  shape?: ArmShape;
}

export interface ArmRegistry {
  /** Output frame of every joint and link, by the entity id its `tip` output carries. */
  frames: Map<EntityId, Frame>;
  parts: Map<string, ArmPart>;
}

const registries = new WeakMap<object, ArmRegistry>();

export function armRegistry(world: WorldApi): ArmRegistry {
  let r = registries.get(world);
  if (!r) {
    r = { frames: new Map(), parts: new Map() };
    registries.set(world, r);
  }
  return r;
}

/** A record older than this many ticks belongs to a piece that stopped running. */
const STALE_TICKS = 3;

/** Every mass mounted beyond `tipId` (links, grippers, what they hold, further joints), at the places they were last drawn. */
export function massesBeyond(reg: ArmRegistry, tipId: EntityId, tick: number): ArmMass[] {
  const out: ArmMass[] = [];
  const seen = new Set<EntityId>([tipId]);
  const queue: EntityId[] = [tipId];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const part of reg.parts.values()) {
      if (part.baseId !== at || tick - part.tick > STALE_TICKS) continue;
      out.push(...part.masses);
      if (part.tipId !== null && !seen.has(part.tipId)) {
        seen.add(part.tipId);
        queue.push(part.tipId);
      }
    }
  }
  return out;
}

/** The crates held by every gripper mounted beyond `tipId`: they move with the hand and are not pushed by it. */
export function heldBeyond(reg: ArmRegistry, tipId: EntityId, tick: number): Set<EntityId> {
  const out = new Set<EntityId>();
  const seen = new Set<EntityId>([tipId]);
  const queue: EntityId[] = [tipId];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const part of reg.parts.values()) {
      if (part.baseId !== at || tick - part.tick > STALE_TICKS) continue;
      if (part.holds) out.add(part.holds);
      if (part.tipId !== null && !seen.has(part.tipId)) {
        seen.add(part.tipId);
        queue.push(part.tipId);
      }
    }
  }
  return out;
}

/**
 * The solid cubes of every part mounted beyond `tipId`, placed as if that tip stood at `tip` (a joint asks this for the
 * angle it would turn to). Parts further out keep the angles they have now.
 */
export function solidsBeyond(reg: ArmRegistry, tipId: EntityId, tip: Frame, tick: number, mode: ViewMode): Box[] {
  const out: Box[] = [];
  const seen = new Set<EntityId>([tipId]);
  const queue: { id: EntityId; frame: Frame }[] = [{ id: tipId, frame: tip }];
  while (queue.length > 0) {
    const at = queue.shift()!;
    for (const part of reg.parts.values()) {
      if (part.baseId !== at.id || tick - part.tick > STALE_TICKS || !part.shape) continue;
      const shape = part.shape(at.frame, mode);
      out.push(...shape.solids);
      if (part.tipId !== null && shape.out && !seen.has(part.tipId)) {
        seen.add(part.tipId);
        queue.push({ id: part.tipId, frame: shape.out });
      }
    }
  }
  return out;
}

/**
 * Keeps one invisible solid block per cube: spawned on the first call, right where the cube is (a far jump would drag a
 * solid across the world), then moved there every tick. `ids` is the piece's own list.
 */
export function placeSolidCubes(world: WorldApi, ownerNodeId: string, ids: EntityId[], cubes: readonly Box[], resize = false): void {
  cubes.forEach((cube, k) => {
    let id = ids[k];
    if (id === undefined) {
      id = world.spawn({ kind: 'block', ownerNodeId, position: cube.pos, size: cube.size, color: '#9ca3af', solid: true });
      setArmHint(ownerNodeId, id, { part: 'body' });
      ids.push(id);
    }
    // A cube that covers a turning box changes size with the turn; a link's cubes never do.
    if (resize) world.resizeBlock(id, cube.size);
    world.moveBlock(id, cube.pos);
  });
}

/** Frame of what a piece is mounted on, shifted by `mount` (local x along, y up, z sideways). Null when the object is unknown or hidden. */
export function baseFrame(ctx: EvalCtx, baseId: EntityId | null, mount: Vec3): Frame | null {
  if (baseId === null) return null;
  const known = armRegistry(ctx.world).frames.get(baseId);
  let frame: Frame;
  if (known) {
    frame = known;
  } else {
    const view = ctx.world.getEntity(baseId);
    if (!view || !view.visible) return null;
    // A robot chassis turns clockwise seen from above (heading 0 = +x); the arm frame turns the other way round, and the side view has no turning.
    frame = { pos: view.position, yaw: view.robot && ctx.mode !== '2d-side' ? -view.robot.heading : 0, pitch: 0 };
  }
  return { pos: localToWorld(frame, mount), yaw: frame.yaw, pitch: frame.pitch };
}

/** Puts a drawn (non-solid) box at `centre` with the arm's heading. The flat views read one turn: the side view pitch, the top view yaw. */
export function placeBox(world: WorldApi, mode: EvalCtx['mode'], id: EntityId, centre: Vec3, frame: Frame): void {
  world.moveBlock(id, centre);
  if (mode === '2d-side') {
    world.setBlockAngle(id, frame.pitch);
  } else {
    world.setBlockAngle(id, frame.yaw);
    if (mode === '3d') world.setBlockTilt(id, frame.pitch);
  }
}
