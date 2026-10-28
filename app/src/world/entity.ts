import type { EntityKind, EntityView, ItemShape, Vec3, CharacterIntent } from '../engine/types';

/** Internal mutable entity record; EntityView is the public snapshot. */
export interface Entity {
  id: string;
  kind: EntityKind;
  ownerNodeId: string;
  pos: Vec3;
  size: Vec3;
  vel: Vec3;
  color: string;
  look?: string;
  shape?: ItemShape;
  solid: boolean;
  visible: boolean;
  onGround: boolean;
  intent: CharacterIntent | null;
  /** Characters: unit horizontal direction of the last non-zero movement. */
  facing: Vec3;
  /** Characters: id of the carried item. */
  holding: string | null;
  /** Items: id of the carrying character. */
  heldBy: string | null;
  /** Items: false = never picked up. */
  carryable: boolean;
}

export function toView(e: Entity): EntityView {
  return {
    id: e.id,
    kind: e.kind,
    ownerNodeId: e.ownerNodeId,
    position: { ...e.pos },
    size: { ...e.size },
    color: e.color,
    ...(e.look !== undefined ? { look: e.look } : {}),
    ...(e.shape !== undefined ? { shape: e.shape } : {}),
    visible: e.visible,
  };
}
