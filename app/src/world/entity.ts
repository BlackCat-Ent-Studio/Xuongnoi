import type {
  CharacterIntent,
  CharacterRole,
  EntityKind,
  EntityView,
  HoldStyle,
  ItemShape,
  Vec3,
} from '../engine/types';
import type { VehicleBody } from './vehicles';

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
  role?: CharacterRole;
  shape?: ItemShape;
  solid: boolean;
  visible: boolean;
  onGround: boolean;
  intent: CharacterIntent | null;
  /** Characters: unit horizontal direction of the last non-zero movement. */
  facing: Vec3;
  /** Characters: id of the item carried above the head. */
  holding: string | null;
  /** Characters: id of the tool in hand. */
  handHolding: string | null;
  /** Characters: seconds since the current swing began, or -1 when not swinging. */
  swingTime: number;
  /** Items: id of the carrying character. */
  heldBy: string | null;
  /** Items: true when `heldBy` carries it in hand rather than above the head. */
  inHand: boolean;
  /** Items: false = never picked up. */
  carryable: boolean;
  /** Items: which slot picks it up. */
  holdStyle: HoldStyle;
  /** Vehicles: dynamics state. */
  vehicle?: VehicleBody;
  /** Characters: id of the vehicle this one sits in, else null. */
  seatedIn: string | null;
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
    ...(e.role !== undefined ? { role: e.role } : {}),
    ...(e.shape !== undefined ? { shape: e.shape } : {}),
    ...(e.kind === 'item' && e.holdStyle === 'hand' ? { holdStyle: 'hand' as const } : {}),
    ...(e.kind === 'item' && e.inHand && e.heldBy !== null ? { inHand: true } : {}),
    ...(e.vehicle
      ? {
          vehicle: { model: e.vehicle.spec.model, speed: e.vehicle.speed, wheelSpin: e.vehicle.wheelSpin, heading: e.vehicle.heading, driver: e.vehicle.driver },
        }
      : {}),
    ...(e.seatedIn !== null ? { seatedIn: e.seatedIn } : {}),
    visible: e.visible,
  };
}
