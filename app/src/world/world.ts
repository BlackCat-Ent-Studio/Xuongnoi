import type {
  BodySnapshot,
  CargoLayout,
  CharacterIntent,
  EntityId,
  EntitySpec,
  EntityView,
  GameResult,
  HudItem,
  PlayCameraCommand,
  PortalLink,
  RobotWheelSpec,
  ShotSpec,
  SolidBox,
  Vec3,
  ViewMode,
  World,
} from '../engine/types';
import { PUNCH_DAMAGE, createCombat, itemDamage } from './combat';
import { toView, type Entity } from './entity';
import { moveBlockTo, settleTurns, spinBlockTo, turnSolidTo } from './platforms';
import { advanceBelts, syncBeltWalls } from './conveyor';
import { carryAt, handPosition, overlapsSolid, stepPhysics, touching } from './physics';
import { RESPAWN_BELOW, bodyRules, isCovered, isSolidBody, overlapsBox, solidDropSpot } from './solid-bodies';
import type { WorldOptions } from './world-options';
import { createPhysicsWatch } from '../dev/physics-watch';
import { bodyTuning } from './body-tuning';
import { colliderBox, normalizeCollider } from './collider';
import { MAX_BULLETS, aimDirection, clampShot, countBullets, muzzlePosition, stepBullets } from './projectiles';
import { exitSpot, nearestEnterable } from './vehicle-seats';
import { cargoOn, nearestLoadable, normalizeCells, unloadSpot } from './cargo';
import { createTeleporter } from './teleport';
import { lineOfSight } from './line-of-sight';
import { probeAhead } from './probe-ahead';
import { createRobotBody, sanitizeRobotSpec, setWheel } from './robot-drive';
import { createVehicleBody, seatPosition } from './vehicles';
import { prepareTrains } from './vehicle-train';

function pairKey(a: EntityId, b: EntityId): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Vertical share of a throw's speed. */
const THROW_LIFT = 0.5;
/** How much facing toward an item counts against distance when several are in reach. */
const FACING_BIAS = 0.3;
/** Seconds a swing lasts; a new swing cannot start before it ends. */
export const SWING_SECONDS = 0.3;
/** A target must overlap the swinger's height by at least this much (keeps the floor underfoot out of reach). */
const USE_MIN_VERTICAL_OVERLAP = 0.1;
/** Sideways slack (beyond the swinger's half width) for what counts as "in front". */
const USE_LATERAL_SLACK = 0.1;

function finiteOr(n: number, fallback: number): number {
  return Number.isFinite(n) ? n : fallback;
}

export function createWorld(mode: ViewMode, options?: WorldOptions): World {
  const rules = bodyRules(options);
  const watcher = import.meta.env.DEV && import.meta.env.MODE !== 'test' && rules ? createPhysicsWatch() : null;
  const list: Entity[] = [];
  const byId = new Map<EntityId, Entity>();
  const hud = new Map<string, HudItem>();
  let contacts = new Set<string>();
  let ended: { result: GameResult; message: string } | null = null;
  let yaw = 0;
  let nextId = 1;
  /** Differs every run; a node's own seed param overrides it for repeatable results. */
  const seed = Math.floor(Math.random() * 0xffffffff) + 1;
  let solidRev = 0;
  /** Interactions requested this tick; they become visible (one tick) after the next step. */
  let pendingInteract = new Set<EntityId>();
  let interacted = new Set<EntityId>();
  /** Same one-tick pulse for tool use. */
  let pendingUsed = new Set<EntityId>();
  let usedOn = new Set<EntityId>();
  /** Characters hit by shots in the latest step, per shooter. */
  let shotHitsNow = new Map<EntityId, EntityId[]>();

  /** Play-camera requests by camera node; `seq` orders them by when they became active. */
  const cameraCmds = new Map<string, { seq: number; cmd: PlayCameraCommand }>();
  let cameraSeq = 0;

  const teleporter = createTeleporter({
    list,
    byId,
    mode,
    isTouching: (a, b) => contacts.has(pairKey(a, b)),
    // Routes planned from the old spot are stale; solidRevision is the signal brain nodes replan on.
    invalidatePlans: () => void solidRev++,
  });

  const combat = createCombat({
    mode,
    touches: touching,
    hide: (id) => api.hide(id),
    letGo: (c) => letGoOfAll(c),
  });

  function computeContacts(): void {
    const next = new Set<string>();
    const live = list.filter((e) => e.visible);
    for (let i = 0; i < live.length; i++) {
      const a = live[i]!;
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j]!;
        // Block-block pairs never matter; characters and items report contacts.
        if (a.kind === 'block' && b.kind === 'block') continue;
        if (touching(a, b)) next.add(pairKey(a.id, b.id));
      }
    }
    contacts = next;
  }

  function liveCharacter(id: EntityId): Entity | undefined {
    const e = byId.get(id);
    return e && e.kind === 'character' && e.visible && !e.combat?.dead ? e : undefined;
  }

  /** Nearest matching item within reach; items on the character's facing side win close calls. */
  function nearestItem(c: Entity, reach: number, accept: (it: Entity) => boolean): Entity | null {
    const r = finiteOr(reach, 0);
    let best: Entity | null = null;
    let bestScore = Infinity;
    for (const it of list) {
      if (it.kind !== 'item' || !it.visible || !accept(it)) continue;
      const dx = it.pos.x - c.pos.x;
      const dy = it.pos.y - c.pos.y;
      const dz = it.pos.z - c.pos.z;
      const dist = Math.hypot(dx, dy, dz);
      if (dist > r) continue;
      const flat = Math.hypot(dx, dz);
      const ahead = flat > 1e-6 ? (dx * c.facing.x + dz * c.facing.z) / flat : 0;
      const score = dist - FACING_BIAS * ahead;
      if (score < bestScore) {
        bestScore = score;
        best = it;
      }
    }
    return best;
  }

  function release(item: Entity): Entity | undefined {
    const holder = item.heldBy !== null ? byId.get(item.heldBy) : undefined;
    if (holder) {
      if (item.inHand) {
        if (holder.handHolding === item.id) holder.handHolding = null;
      } else if (holder.holding === item.id) {
        holder.holding = null;
      }
    }
    item.heldBy = null;
    item.inHand = false;
    delete item.cargoSeq;
    return holder;
  }

  /** Gets a seated character out beside its vehicle (no-op when it is not seated). Returns the vehicle left. */
  function leaveSeat(c: Entity): Entity | undefined {
    const veh = c.seatedIn !== null ? byId.get(c.seatedIn) : undefined;
    c.seatedIn = null;
    if (!veh) return undefined;
    if (veh.vehicle && veh.vehicle.driver === c.id) veh.vehicle.driver = null;
    c.pos = exitSpot(list, veh, c, mode);
    c.vel = { x: 0, y: 0, z: 0 };
    return veh;
  }

  function viewOf(e: Entity): EntityView {
    const v = toView(e);
    if (e.kind === 'vehicle' && e.vehicle) return { ...v, drive: { speed: e.vehicle.spec.maxSpeed, jumpPower: 0 } };
    if (rules && e.kind === 'item' && e.heldBy !== null && !e.inHand && e.cargoSeq === undefined) return { ...v, carried: true };
    if (e.kind !== 'character') return v;
    const tool = e.handHolding !== null ? byId.get(e.handHolding) : undefined;
    const carried = e.holding !== null && mode !== '2d-top' ? byId.get(e.holding) : undefined;
    return {
      ...v,
      ...(carried ? { carriedHeight: carried.size.y + 0.05 } : {}),
      ...(tool && tool.shape !== undefined ? { tool: { shape: tool.shape, color: tool.color } } : {}),
      facing: { x: e.facing.x, z: e.facing.z },
      ...(e.swingTime >= 0 ? { swing: Math.min(1, e.swingTime / SWING_SECONDS) } : {}),
      ...(e.intent ? { drive: { speed: finiteOr(e.intent.speed, 0), jumpPower: finiteOr(e.intent.jumpPower, 0) } } : {}),
    };
  }

  /**
   * Nearest visible block / item / other character in a box ahead of the swinger: from its center out to
   * `reach`, as wide as the swinger, at the swinger's height. Closest box surface wins.
   */
  function useTarget(c: Entity, reach: number): Entity | null {
    const r = Math.max(0, finiteOr(reach, 0));
    const fx = c.facing.x;
    const fz = c.facing.z;
    const halfWidth = Math.min(c.size.x, c.size.z) / 2 + USE_LATERAL_SLACK;
    let best: Entity | null = null;
    let bestDist = Infinity;
    let bestFwd = Infinity;
    for (const e of list) {
      if (e === c || !e.visible || e.seatedIn !== null) continue;
      if (e.id === c.holding || e.id === c.handHolding) continue;
      const dx = e.pos.x - c.pos.x;
      const dz = e.pos.z - c.pos.z;
      const dy = e.pos.y - c.pos.y;
      const fwd = dx * fx + dz * fz;
      const lat = dx * fz - dz * fx;
      const fwdHalf = (Math.abs(fx) * e.size.x + Math.abs(fz) * e.size.z) / 2;
      const latHalf = (Math.abs(fz) * e.size.x + Math.abs(fx) * e.size.z) / 2;
      if (fwd + fwdHalf <= 0.05 || fwd - fwdHalf > r) continue;
      if (Math.abs(lat) > latHalf + halfWidth) continue;
      if (Math.abs(dy) > (e.size.y + c.size.y) / 2 - USE_MIN_VERTICAL_OVERLAP) continue;
      // Closest point of the target's box (on the ground plane) to the swinger: wide boxes get no head start.
      const px = Math.min(Math.max(c.pos.x, e.pos.x - e.size.x / 2), e.pos.x + e.size.x / 2) - c.pos.x;
      const pz = Math.min(Math.max(c.pos.z, e.pos.z - e.size.z / 2), e.pos.z + e.size.z / 2) - c.pos.z;
      const dist = Math.hypot(px, pz);
      if (dist > r || px * fx + pz * fz < -1e-9) continue; // out of reach, or only touching behind
      if (dist < bestDist - 1e-9 || (Math.abs(dist - bestDist) <= 1e-9 && fwd < bestFwd)) {
        best = e;
        bestDist = dist;
        bestFwd = fwd;
      }
    }
    return best;
  }

  /** Solid bodies: a grabbing character turns to face what it picks up, so the item comes to its hands from the front. */
  function turnToward(c: Entity, item: Entity): void {
    const dx = item.pos.x - c.pos.x;
    const dz = item.pos.z - c.pos.z;
    const flat = Math.hypot(dx, dz);
    if (flat < 1e-6 || (dx * c.facing.x + dz * c.facing.z) / flat >= 0.5) return;
    c.facing = { ...c.facing, x: dx / flat, z: dz / flat };
  }

  /** Solid bodies: true when the item can be let go where it is (not inside a wall, a crate or a character). */
  function roomToLetGo(c: Entity, item: Entity): boolean {
    const probe: Entity = { ...item, heldBy: null, inHand: false };
    if (list.some((e) => e.visible && e.solid && e.kind === 'block' && overlapsBox(probe, e))) return false;
    return !list.some((e) => e !== item && e !== c && isSolidBody(e) && overlapsBox(probe, e));
  }

  /** A resting spot in front of (else behind, else at, else above) the character that is clear of solids. */
  function dropSpot(c: Entity, item: Entity, distance?: number): Vec3 {
    const solids = list.filter((e) => e.visible && e.solid && e.kind === 'block');
    if (rules && mode === '3d') {
      // Solid bodies: beside the carrier, clear of walls and of every other crate and character.
      const spot = solidDropSpot(c, item, distance, [...solids, ...list.filter((e) => e !== item && isSolidBody(e))]);
      return spot ?? carryAt(c, item, mode, rules);
    }
    const y = mode === '2d-top' ? c.pos.y : c.pos.y - c.size.y / 2 + item.size.y / 2;
    const autoGap = Math.max(c.size.x, c.size.z) / 2 + Math.max(item.size.x, item.size.z) / 2 + 0.05;
    const gap = distance !== undefined && Number.isFinite(distance) && distance > 0 ? distance : autoGap;
    const spots: Vec3[] = [
      { x: c.pos.x + c.facing.x * gap, y, z: c.pos.z + c.facing.z * gap },
      { x: c.pos.x - c.facing.x * gap, y, z: c.pos.z - c.facing.z * gap },
      { x: c.pos.x, y, z: c.pos.z },
    ];
    for (const spot of spots) {
      if (mode === '2d-side') spot.z = 0;
      if (!overlapsSolid({ ...item, pos: spot }, solids)) return spot;
    }
    return carryAt(c, item, mode, null);
  }

  /** Solid bodies: anything that fell off the tray goes back to where it started (a carried crate follows its carrier). */
  function respawnFallen(): void {
    for (const e of list) {
      if (!e.home || !e.visible || e.pos.y >= RESPAWN_BELOW) continue;
      if (e.kind === 'item' && e.heldBy !== null) continue;
      letGoOfAll(e);
      e.pos = { ...e.home };
      e.vel = { x: 0, y: 0, z: 0 };
      e.onGround = false;
    }
  }

  /** Lets go of the carried and the hand-held item (and of the carrier, for an item) where they are. */
  function letGoOfAll(e: Entity): void {
    if (e.heldBy !== null) release(e);
    if (e.kind === 'vehicle') for (const cargo of cargoOn(list, e.id)) release(cargo);
    if (e.holding !== null) {
      const held = byId.get(e.holding);
      if (held) release(held);
      e.holding = null;
    }
    if (e.handHolding !== null) {
      const tool = byId.get(e.handHolding);
      if (tool) release(tool);
      e.handHolding = null;
    }
  }

  /** A block that moves or turns no longer belongs to the static solids that path planning caches. */
  function markMover(e: Entity): void {
    if (e.mover) return;
    e.mover = true;
    if (e.solid) solidRev++;
  }

  /** Keeps the side walls of a belt in place (and as visible / as coloured as the belt). */
  function syncWalls(belt: Entity): void {
    if (syncBeltWalls(belt, byId)) solidRev++;
  }

  /** Forgets hidden entities that asked to be dropped (shots and spawned copies), so long runs stay light. */
  function dropDisposed(): void {
    let keep = 0;
    for (const e of list) {
      if (!e.visible && e.disposable) byId.delete(e.id);
      else list[keep++] = e;
    }
    list.length = keep;
  }

  const api: World = {
    mode,
    get ended() {
      return ended;
    },
    spawn(spec: EntitySpec): EntityId {
      const id = `e${nextId++}`;
      const e: Entity = {
        id,
        kind: spec.kind,
        ownerNodeId: spec.ownerNodeId,
        pos: { ...spec.position },
        size: { ...spec.size },
        vel: { x: 0, y: 0, z: 0 },
        color: spec.color,
        look: spec.look,
        ...(spec.kind === 'character' && spec.role !== undefined ? { role: spec.role } : {}),
        ...(spec.kind === 'item' ? { shape: spec.shape ?? 'box' } : {}),
        solid: spec.kind === 'item' ? false : spec.solid,
        ...(spec.kind === 'block' && spec.zone ? { zone: true } : {}),
        ...(spec.kind === 'block' && spec.blockStyle && spec.blockStyle !== 'box' ? { blockStyle: spec.blockStyle } : {}),
        ...(spec.kind === 'block' && spec.label ? { label: spec.label } : {}),
        ...(spec.kind === 'block' && spec.track ? { track: spec.track } : {}),
        ...(spec.kind === 'item' && spec.tag ? { tag: spec.tag } : {}),
        visible: true,
        onGround: false,
        intent: null,
        facing: { x: 1, y: 0, z: 0 },
        holding: null,
        handHolding: null,
        swingTime: -1,
        heldBy: null,
        inHand: false,
        carryable: spec.kind === 'item' && spec.carryable !== false,
        holdStyle: spec.holdStyle === 'hand' ? 'hand' : 'head',
        ...(spec.kind === 'character' && spec.hitReaction ? { hit: { ...spec.hitReaction } } : {}),
        ...(spec.kind === 'item' && spec.damage !== undefined ? { damage: finiteOr(spec.damage, 0) } : {}),
        seatedIn: null,
        ...(spec.disposable ? { disposable: true } : {}),
        ...bodyTuning(spec),
        ...(spec.kind === 'robot' ? { robot: createRobotBody(spec.robot, spec.heading) } : {}),
        ...(spec.kind === 'vehicle' ? { vehicle: createVehicleBody(spec.vehicle ?? { model: 'car', steerMode: 'direction', maxSpeed: 8, accel: 8 }) } : {}),
      };
      if (mode === '2d-side') e.pos.z = 0;
      if (rules && (e.kind === 'character' || e.kind === 'item')) {
        e.home = { ...e.pos };
        // Solid bodies: the collision box covers the figure that is drawn, unless the node asked for its own.
        const box = options?.characterBox;
        if (e.kind === 'character' && box && !e.collider) {
          const collider = normalizeCollider(box.size, box.offset);
          if (collider) e.collider = collider;
        }
      }
      list.push(e);
      byId.set(id, e);
      if (e.kind === 'block' && e.solid) solidRev++;
      if (spec.kind === 'block' && spec.belt) {
        const axis = mode === '2d-side' ? 'x' : spec.belt.axis;
        e.belt = { axis, speed: 0, phase: 0, walls: [] };
        if (spec.belt.walls && mode === '3d' && e.solid) {
          for (let i = 0; i < 2; i++) {
            e.belt.walls.push(api.spawn({ kind: 'block', ownerNodeId: spec.ownerNodeId, position: e.pos, size: e.size, color: e.color, solid: true }));
          }
          syncWalls(e);
        }
      }
      return id;
    },
    setEntityStyle(id: EntityId, style: { color?: string; look?: string }): void {
      const e = byId.get(id);
      if (!e) return;
      if (style.color !== undefined) e.color = style.color;
      if (style.look !== undefined && e.kind === 'character') e.look = style.look;
      if (e.belt) syncWalls(e);
    },
    tagOf(id: EntityId): string {
      return byId.get(id)?.tag ?? '';
    },
    setCharacterIntent(id: EntityId, intent: CharacterIntent): void {
      const e = byId.get(id);
      if (e && e.kind === 'character') e.intent = { ...intent };
    },
    hide(id: EntityId): void {
      const e = byId.get(id);
      if (!e) return;
      // Hiding a carried item, or a character holding one, lets go of it where it is.
      letGoOfAll(e);
      if (e.visible && e.kind === 'block' && e.solid) solidRev++;
      // A hidden vehicle puts its driver out first; a hidden driver leaves the seat empty.
      const driver = e.vehicle?.driver != null ? byId.get(e.vehicle.driver) : undefined;
      if (driver) leaveSeat(driver);
      if (e.seatedIn !== null) leaveSeat(e);
      e.visible = false;
      e.onGround = false;
      if (e.belt) syncWalls(e);
      for (const k of [...contacts]) if (k.split('|').includes(id)) contacts.delete(k);
    },
    show(id: EntityId): void {
      const e = byId.get(id);
      if (!e || e.visible || e.disposable || e.combat?.dead) return;
      e.visible = true;
      e.vel = { x: 0, y: 0, z: 0 };
      if (e.kind === 'block' && e.solid) solidRev++;
      if (e.belt) syncWalls(e);
    },
    getEntity(id: EntityId): EntityView | undefined {
      const e = byId.get(id);
      return e ? viewOf(e) : undefined;
    },
    isOnGround(id: EntityId): boolean {
      const e = byId.get(id);
      return !!e && e.visible && e.onGround;
    },
    isTouching(a: EntityId, b: EntityId): boolean {
      return contacts.has(pairKey(a, b));
    },
    setHud(item: HudItem): void {
      hud.set(item.key, { ...item });
    },
    endGame(result: GameResult, message: string): void {
      if (!ended) ended = { result, message };
    },
    grab(character: EntityId, reach: number): EntityId | null {
      const c = liveCharacter(character);
      if (!c || c.holding !== null) return null;
      const item = nearestItem(c, reach, (it) => it.carryable && it.heldBy === null && it.holdStyle === 'head' && !(rules && isCovered(it, list)));
      if (!item) return null;
      item.heldBy = c.id;
      c.holding = item.id;
      if (rules) turnToward(c, item);
      else Object.assign(item.pos, carryAt(c, item, mode, rules));
      item.vel = { x: 0, y: 0, z: 0 };
      return item.id;
    },
    drop(character: EntityId, distance?: number): EntityId | null {
      const c = liveCharacter(character);
      const item = c && c.holding !== null ? byId.get(c.holding) : undefined;
      if (!c || !item) return null;
      // Solid bodies: let go right where the hands are and let it fall; no room there means the hands keep hold.
      const inPlace = rules !== null && mode === '3d';
      if (inPlace && !roomToLetGo(c, item)) return null;
      release(item);
      if (!inPlace) item.pos = dropSpot(c, item, distance);
      item.vel = { x: 0, y: 0, z: 0 };
      return item.id;
    },
    throwHeld(character: EntityId, power: number, lift?: number): EntityId | null {
      const c = liveCharacter(character);
      const item = c && c.holding !== null ? byId.get(c.holding) : undefined;
      if (!c || !item) return null;
      const p = Math.max(0, finiteOr(power, 0));
      release(item);
      item.thrownBy = c.id;
      Object.assign(item.pos, carryAt(c, item, mode, rules));
      item.vel = {
        x: c.facing.x * p,
        y: mode === '2d-top' ? 0 : p * (lift !== undefined && Number.isFinite(lift) ? Math.max(0, lift) : THROW_LIFT),
        z: mode === '2d-side' ? 0 : c.facing.z * p,
      };
      return item.id;
    },
    heldItem(character: EntityId): EntityId | null {
      const c = byId.get(character);
      return c && c.visible ? c.holding : null;
    },
    isHeld(item: EntityId): boolean {
      const e = byId.get(item);
      return !!e && e.visible && e.heldBy !== null && !e.inHand && e.cargoSeq === undefined;
    },
    interact(character: EntityId, reach: number): EntityId | null {
      const c = liveCharacter(character);
      if (!c) return null;
      const item = nearestItem(c, reach, (it) => it.heldBy !== c.id);
      if (!item) return null;
      pendingInteract.add(item.id);
      return item.id;
    },
    wasInteracted(item: EntityId): boolean {
      return interacted.has(item);
    },
    equip(character: EntityId, reach: number): EntityId | null {
      const c = liveCharacter(character);
      if (!c || c.handHolding !== null) return null;
      const tool = nearestItem(c, reach, (it) => it.carryable && it.heldBy === null && it.holdStyle === 'hand');
      if (!tool) return null;
      tool.heldBy = c.id;
      tool.inHand = true;
      c.handHolding = tool.id;
      Object.assign(tool.pos, handPosition(c, tool, mode));
      tool.vel = { x: 0, y: 0, z: 0 };
      return tool.id;
    },
    unequip(character: EntityId): EntityId | null {
      const c = liveCharacter(character);
      const tool = c && c.handHolding !== null ? byId.get(c.handHolding) : undefined;
      if (!c || !tool) return null;
      release(tool);
      tool.pos = dropSpot(c, tool);
      tool.vel = { x: 0, y: 0, z: 0 };
      return tool.id;
    },
    handItem(character: EntityId): EntityId | null {
      const c = byId.get(character);
      return c && c.visible ? c.handHolding : null;
    },
    isInHand(item: EntityId): boolean {
      const e = byId.get(item);
      return !!e && e.visible && e.heldBy !== null && e.inHand;
    },
    useTool(character: EntityId, reach: number): { target: EntityId | null } | null {
      const c = liveCharacter(character);
      if (!c || c.swingTime >= 0) return null;
      c.swingTime = 0;
      const target = useTarget(c, reach);
      if (target) {
        pendingUsed.add(target.id);
        const tool = c.handHolding !== null ? byId.get(c.handHolding) : undefined;
        combat.strike(target, tool ? itemDamage(tool) : PUNCH_DAMAGE, target.pos.x - c.pos.x, target.pos.z - c.pos.z);
      }
      return { target: target ? target.id : null };
    },
    wasUsedOn(id: EntityId): boolean {
      return usedOn.has(id);
    },
    setHealth(id: EntityId, maxHp: number, showBar: boolean): void {
      const e = byId.get(id);
      if (e) combat.register(e, maxHp, showBar);
    },
    heal(id: EntityId, amount: number): void {
      const e = byId.get(id);
      if (e) combat.heal(e, amount);
    },
    healthOf(id: EntityId): { hp: number; max: number; dead: boolean } | null {
      const k = byId.get(id)?.combat;
      return k ? { hp: k.hp, max: k.maxHp, dead: k.dead } : null;
    },
    wasHurt(id: EntityId): boolean {
      return combat.wasHurt(id);
    },
    solidAt(p: Vec3): boolean {
      for (const e of list) {
        if (!e.visible || !e.solid || e.kind !== 'block') continue;
        const b = colliderBox(e);
        if (
          Math.abs(p.x - b.pos.x) <= b.size.x / 2 &&
          Math.abs(p.y - b.pos.y) <= b.size.y / 2 &&
          Math.abs(p.z - b.pos.z) <= b.size.z / 2
        ) {
          return true;
        }
      }
      return false;
    },
    solidBoxes(): readonly SolidBox[] {
      const boxes: SolidBox[] = [];
      for (const e of list) {
        // Movers are left out: their place changes, so the static maps built from this list ignore them.
        if (e.visible && e.solid && e.kind === 'block' && !e.mover) {
          const b = colliderBox(e);
          boxes.push({ position: { ...b.pos }, size: { ...b.size } });
        }
      }
      return boxes;
    },
    solidRevision(): number {
      return solidRev;
    },
    cameraYaw(): number {
      return yaw;
    },
    setVehicleInput(id: EntityId, moveX: number, moveY: number, stop?: boolean): void {
      const body = byId.get(id)?.vehicle;
      if (!body) return;
      body.inputX = finiteOr(moveX, 0);
      body.inputY = finiteOr(moveY, 0);
      if (stop !== undefined) body.stop = stop;
    },
    setVehicleTrack(id: EntityId, pose: { x: number; z: number; heading: number; speed: number }): void {
      const body = byId.get(id)?.vehicle;
      if (!body || ![pose.x, pose.z, pose.heading, pose.speed].every(Number.isFinite)) return;
      body.trackTarget = { x: pose.x, z: pose.z, heading: pose.heading, speed: pose.speed };
    },
    setVehicleTow(id: EntityId, leader: EntityId | null, distance = 0): void {
      const body = byId.get(id)?.vehicle;
      if (!body) return;
      const lead = leader !== null && leader !== id ? byId.get(leader) : undefined;
      if (!lead?.vehicle) {
        body.tow = undefined;
        return;
      }
      body.tow = { leader: lead.id, distance: Number.isFinite(distance) ? Math.max(0, distance) : 0 };
    },
    probeAhead(id: EntityId, reach: number): { id: EntityId; distance: number } | null {
      const e = byId.get(id);
      if (!e || !e.visible) return null;
      return probeAhead(list, e, finiteOr(reach, 0));
    },
    lineOfSight(fromId: EntityId, toId: EntityId): boolean {
      return lineOfSight(list, mode, byId.get(fromId), byId.get(toId));
    },
    enterVehicle(character: EntityId, reach: number): EntityId | null {
      const c = liveCharacter(character);
      if (!c || c.seatedIn !== null) return null;
      const veh = nearestEnterable(list, c, Math.max(0, finiteOr(reach, 0)), mode);
      if (!veh || !veh.vehicle) return null;
      veh.vehicle.driver = c.id;
      c.seatedIn = veh.id;
      Object.assign(c.pos, seatPosition(veh, c));
      c.vel = { x: 0, y: 0, z: 0 };
      c.onGround = false;
      return veh.id;
    },
    exitVehicle(character: EntityId): EntityId | null {
      const c = byId.get(character);
      if (!c || c.kind !== 'character' || c.seatedIn === null) return null;
      return leaveSeat(c)?.id ?? null;
    },
    loadCargo(vehicle: EntityId, reach: number, capacity: number, tag?: string, layout?: CargoLayout): EntityId | null {
      const veh = byId.get(vehicle);
      if (!veh || veh.kind !== 'vehicle' || !veh.visible) return null;
      if (veh.vehicle && layout?.cellsPerLayer !== undefined) veh.vehicle.cargoCells = normalizeCells(layout.cellsPerLayer);
      const onBoard = cargoOn(list, veh.id);
      if (onBoard.length >= Math.max(0, Math.floor(finiteOr(capacity, 0)))) return null;
      const item = nearestLoadable(list, veh, Math.max(0, finiteOr(reach, 0)), mode, tag);
      if (!item) return null;
      item.heldBy = veh.id;
      item.cargoSeq = (onBoard.length > 0 ? onBoard[onBoard.length - 1]!.cargoSeq! : 0) + 1;
      item.vel = { x: 0, y: 0, z: 0 };
      return item.id;
    },
    unloadCargo(vehicle: EntityId, tag?: string, layout?: CargoLayout): EntityId | null {
      const veh = byId.get(vehicle);
      if (!veh || veh.kind !== 'vehicle' || !veh.visible) return null;
      if (veh.vehicle && layout?.cellsPerLayer !== undefined) veh.vehicle.cargoCells = normalizeCells(layout.cellsPerLayer);
      const top = cargoOn(list, veh.id, tag).pop();
      if (!top) return null;
      const spot = unloadSpot(list, veh, top, mode, layout?.unloadGap);
      if (!spot) return null;
      release(top);
      top.pos = spot;
      top.vel = { x: 0, y: 0, z: 0 };
      return top.id;
    },
    cargoOf(vehicle: EntityId): readonly EntityId[] {
      return cargoOn(list, vehicle).map((e) => e.id);
    },
    setCamera(owner: string, command: PlayCameraCommand | null): void {
      if (command === null) {
        cameraCmds.delete(owner);
        return;
      }
      const prev = cameraCmds.get(owner);
      cameraCmds.set(owner, { seq: prev ? prev.seq : ++cameraSeq, cmd: command });
    },
    cameraCommand(): PlayCameraCommand | null {
      let best: { seq: number; cmd: PlayCameraCommand } | null = null;
      for (const c of cameraCmds.values()) if (!best || c.seq > best.seq) best = c;
      return best ? best.cmd : null;
    },
    teleport(id: EntityId, to: Vec3, keepVelocity: boolean): Vec3 | null {
      return teleporter.teleport(id, to, keepVelocity);
    },
    setPortal(id: EntityId, link: PortalLink): void {
      teleporter.setPortal(id, link);
    },
    portalUser(id: EntityId): EntityId | null {
      return teleporter.portalUser(id);
    },
    moveBlock(id: EntityId, to: Vec3): boolean {
      const e = byId.get(id);
      if (!e || e.kind !== 'block' || !e.visible) return false;
      markMover(e);
      return moveBlockTo(list, e, to, mode);
    },
    setRobotWheel(body: EntityId, wheelId: string, wheel: RobotWheelSpec | null): void {
      const robot = byId.get(body)?.robot;
      if (robot) setWheel(robot, wheelId, wheel);
    },
    setRobotTuning(body: EntityId, tuning: { mass: number; friction: number }): void {
      const robot = byId.get(body)?.robot;
      if (!robot) return;
      const next = sanitizeRobotSpec({ ...robot.spec, mass: tuning.mass, friction: tuning.friction });
      robot.spec = next;
    },
    setBeltSpeed(id: EntityId, speed: number): void {
      const e = byId.get(id);
      if (e?.belt) e.belt.speed = finiteOr(speed, 0);
    },
    setBlockAngle(id: EntityId, rad: number): boolean {
      const e = byId.get(id);
      if (!e || e.kind !== 'block' || !e.visible) return false;
      const angle = finiteOr(rad, 0);
      markMover(e);
      if (e.solid) return turnSolidTo(list, e, angle / (Math.PI / 2), mode);
      spinBlockTo(e, angle, mode);
      return true;
    },
    shoot(shooter: EntityId, spec: ShotSpec): EntityId | null {
      const s = byId.get(shooter);
      if (!s || !s.visible || s.combat?.dead || countBullets(list) >= MAX_BULLETS) return null;
      const shot = clampShot(spec);
      const target = spec.aimAt != null ? byId.get(spec.aimAt) : undefined;
      const dir = aimDirection(s, target && target.visible ? target : undefined, mode);
      const id = api.spawn({
        kind: 'item',
        ownerNodeId: spec.ownerNodeId,
        position: muzzlePosition(s, dir, shot.size, mode),
        size: { x: shot.size, y: shot.size, z: shot.size },
        color: spec.color,
        solid: false,
        shape: 'ball',
        carryable: false,
        disposable: true,
      });
      const b = byId.get(id)!;
      b.vel = { x: dir.x * shot.speed, y: dir.y * shot.speed, z: dir.z * shot.speed };
      b.bullet = { owner: shooter, damage: shot.damage, ttl: shot.lifetime, gravity: spec.gravity === true };
      return id;
    },
    shotHits(shooter: EntityId): readonly EntityId[] {
      return shotHitsNow.get(shooter) ?? [];
    },
    step(dt: number): void {
      settleTurns(list, dt);
      if (ended) {
        // The game is over, but anyone mid-fall may finish tipping over.
        combat.update(list, dt);
        return;
      }
      prepareTrains(list, byId, dt, mode);
      for (const e of list) if (e.belt) syncWalls(e);
      advanceBelts(list, dt);
      stepPhysics(list, dt, mode, yaw, rules);
      if (rules?.respawnFallen) respawnFallen();
      shotHitsNow = stepBullets(list, dt, mode, {
        strike: (victim, damage, dx, dz) => combat.strike(victim, damage, dx, dz),
        hide: (id) => api.hide(id),
      });
      computeContacts();
      teleporter.step(dt);
      combat.update(list, dt);
      dropDisposed();
      if (import.meta.env.DEV && watcher) watcher.check(api);
      interacted = pendingInteract;
      pendingInteract = new Set();
      usedOn = pendingUsed;
      pendingUsed = new Set();
      for (const e of list) {
        if (e.swingTime < 0) continue;
        e.swingTime += dt;
        if (e.swingTime >= SWING_SECONDS) e.swingTime = -1;
      }
    },
    entities(): readonly EntityView[] {
      return list.map(viewOf);
    },
    listEntities(): readonly EntityView[] {
      return list.map(viewOf);
    },
    runSeed(): number {
      return seed;
    },
    hudItems(): readonly HudItem[] {
      return [...hud.values()].map((h) => ({ ...h }));
    },
    setCameraYaw(rad: number): void {
      yaw = Number.isFinite(rad) ? rad : 0;
    },
    // Development and tests only: the snapshot the physics checks read. Production builds leave it out.
    ...(import.meta.env.DEV ? { debugBodies: (): readonly BodySnapshot[] => debugSnapshot() } : {}),
  };
  return api;

  function debugSnapshot(): readonly BodySnapshot[] {
    return list.map((e) => {
      const b = colliderBox(e);
      return {
        id: e.id,
        kind: e.kind,
        owner: e.ownerNodeId,
        visible: e.visible,
        solid: e.solid,
        zone: e.zone === true,
        box: { pos: { ...b.pos }, size: { ...b.size } },
        pos: { ...e.pos },
        size: { ...e.size },
        carried: e.kind === 'item' && e.heldBy !== null,
        holder: e.heldBy,
        seated: e.seatedIn !== null,
        tag: e.tag ?? '',
      };
    });
  }
}
