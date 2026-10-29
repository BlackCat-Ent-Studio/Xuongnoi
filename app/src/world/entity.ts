import { combatView, type CombatState } from './combat';
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
import { turnAngle, type TurnState } from './platforms';
import type { BulletState } from './projectiles';

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
  /** Blocks: zone marker, drawn translucent. */
  zone?: boolean;
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
  /** Items: id of the carrying character (or, for loaded cargo, of the vehicle). */
  heldBy: string | null;
  /** Items: load order while riding as vehicle cargo (`heldBy` is then the vehicle); unset otherwise. */
  cargoSeq?: number;
  /** Items: true when `heldBy` carries it in hand rather than above the head. */
  inHand: boolean;
  /** Items: false = never picked up. */
  carryable: boolean;
  /** Items: which slot picks it up. */
  holdStyle: HoldStyle;
  /** Characters: health and hit reaction, once a health node registered it. */
  combat?: CombatState;
  /** Items: damage as a tool / when thrown (unset or 0 = by shape). */
  damage?: number;
  /** Items: id of the character whose throw is still in flight, else unset / null. */
  thrownBy?: string | null;
  /** Vehicles: dynamics state. */
  vehicle?: VehicleBody;
  /** Characters: id of the vehicle this one sits in, else null. */
  seatedIn: string | null;
  /** Blocks: set once a node moved or turned it; it then no longer counts as static terrain for path planning. */
  mover?: boolean;
  /** Blocks: turning state, once a node turned the block. */
  turn?: TurnState;
  /** Items that are shots in flight (moved by the projectile step, not by item physics). */
  bullet?: BulletState;
  /** Dropped from the world for good once hidden. */
  disposable?: boolean;
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
    ...combatView(e),
    ...(e.vehicle
      ? {
          vehicle: { model: e.vehicle.spec.model, speed: e.vehicle.speed, wheelSpin: e.vehicle.wheelSpin, heading: e.vehicle.heading, driver: e.vehicle.driver },
        }
      : {}),
    ...(e.seatedIn !== null ? { seatedIn: e.seatedIn } : {}),
    ...(e.zone ? { zone: true } : {}),
    ...turnAngle(e),
    visible: e.visible,
  };
}
