import { colliderBox, type ColliderSpec } from './collider';
import { combatView, type CombatState } from './combat';
import type {
  CharacterIntent,
  CharacterRole,
  EntityKind,
  EntityView,
  HitReaction,
  HoldStyle,
  ItemShape,
  LineTrackSpec,
  Vec3,
} from '../engine/types';
import type { RobotBody } from './robot-drive';
import type { VehicleBody } from './vehicles';
import { turnAngle, type TurnState } from './platforms';
import type { BulletState } from './projectiles';
import { beltAxis, type BeltState } from './conveyor';

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
  /** Characters (solid-body worlds): lowest height the carried item may ride at, so it clears what lies below the hands. */
  carryFloor?: number;
  /** Characters: id of the tool in hand. */
  handHolding: string | null;
  /** Characters: seconds since the current swing began, or -1 when not swinging. */
  swingTime: number;
  /** Items: id of the carrying character (or, for loaded cargo, of the vehicle). */
  heldBy: string | null;
  /** Items: load order while riding as vehicle cargo (`heldBy` is then the vehicle); unset otherwise. */
  cargoSeq?: number;
  /** Items: goods type; unset = untagged. */
  tag?: string;
  /** Items: true when `heldBy` carries it in hand rather than above the head. */
  inHand: boolean;
  /** Items: false = never picked up. */
  carryable: boolean;
  /** Items: which slot picks it up. */
  holdStyle: HoldStyle;
  /** Characters: health and hit reaction, once a health node registered it. */
  combat?: CombatState;
  /** Characters: hit-reaction tuning from the character node; unset fields use the combat defaults. */
  hit?: HitReaction;
  /** Items: damage as a tool / when thrown (unset or 0 = by shape). */
  damage?: number;
  /** Items: id of the character whose throw is still in flight, else unset / null. */
  thrownBy?: string | null;
  /** Vehicles: dynamics state. */
  vehicle?: VehicleBody;
  /** Robot chassis: drive state and mounted wheels. */
  robot?: RobotBody;
  /** Characters: id of the vehicle this one sits in, else null. */
  seatedIn: string | null;
  /** Blocks: set once a node moved or turned it; it then no longer counts as static terrain for path planning. */
  mover?: boolean;
  /** Blocks: conveyor surface (speed, scroll, side walls), set at creation when the block is a belt. */
  belt?: BeltState;
  /** Blocks: turning state, once a node turned the block. */
  turn?: TurnState;
  /** Items that are shots in flight (moved by the projectile step, not by item physics). */
  bullet?: BulletState;
  /** Blocks: drawing style id and sign text (see EntitySpec). */
  blockStyle?: string;
  label?: string;
  /** Dropped from the world for good once hidden. */
  disposable?: boolean;
  /** Blocks: a painted line (see LineTrackSpec). */
  track?: LineTrackSpec;
  /** Solid-body worlds: where this character or item started; a fall off the tray brings it back here. */
  home?: Vec3;

  // ---- collision and body tuning; unset = plain visual box and normal physics ----
  collider?: ColliderSpec;
  /** Gravity multiplier; unset = 1. */
  gravityScale?: number;
  /** Items: ground friction; unset = default. */
  friction?: number;
  /** Items: 0..1 landing bounce; unset = none. */
  bounce?: number;

  // ---- material (SI); unset = the default of the kind, see material.ts ----
  /** Mass in kg. */
  mass?: number;
  /** Surface friction coefficient. */
  mu?: number;
  /** Largest squeeze in N it survives; unset = never breaks. */
  crushLimit?: number;
  /** Broken by a squeeze; stays so until the game restarts. */
  damaged?: boolean;
}

function colliderView(e: Entity): { position: Vec3; size: Vec3 } {
  const b = colliderBox(e);
  return { position: { ...b.pos }, size: { ...b.size } };
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
    ...(e.kind === 'block' && e.blockStyle !== undefined ? { blockStyle: e.blockStyle } : {}),
    ...(e.kind === 'block' && e.label ? { label: e.label } : {}),
    ...(e.kind === 'item' && e.holdStyle === 'hand' ? { holdStyle: 'hand' as const } : {}),
    ...(e.kind === 'item' && e.inHand && e.heldBy !== null ? { inHand: true } : {}),
    ...combatView(e),
    ...(e.vehicle
      ? {
          vehicle: { model: e.vehicle.spec.model, speed: e.vehicle.speed, wheelSpin: e.vehicle.wheelSpin, heading: e.vehicle.heading, driver: e.vehicle.driver, hitSeq: e.vehicle.hitSeq, hitWith: e.vehicle.hitWith, steerMode: e.vehicle.spec.steerMode },
        }
      : {}),
    ...(e.robot
      ? {
          robot: {
            length: e.robot.spec.length,
            width: e.robot.spec.width,
            speed: e.robot.speed,
            heading: e.robot.heading,
            turnRate: e.robot.turnRate,
            wheels: [...e.robot.wheels.values()].map((w) => ({ side: w.side, forward: w.forward, radius: w.radius, spin: w.spin })),
          },
        }
      : {}),
    ...(e.seatedIn !== null ? { seatedIn: e.seatedIn } : {}),
    ...(e.zone ? { zone: true } : {}),
    ...(e.track ? { track: e.track } : {}),
    ...(e.belt ? { belt: { axis: beltAxis(e), speed: e.belt.speed, phase: e.belt.phase } } : {}),
    ...turnAngle(e),
    ...(e.collider ? { collider: colliderView(e) } : {}),
    ...(e.mass !== undefined ? { mass: e.mass } : {}),
    ...(e.mu !== undefined ? { mu: e.mu } : {}),
    ...(e.crushLimit !== undefined ? { crushLimit: e.crushLimit } : {}),
    ...(e.damaged ? { damaged: true } : {}),
    visible: e.visible,
  };
}
