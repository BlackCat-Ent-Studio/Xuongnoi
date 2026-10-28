import type {
  CharacterIntent,
  EntityId,
  EntitySpec,
  EntityView,
  GameResult,
  HudItem,
  Vec3,
  ViewMode,
  World,
} from '../engine/types';
import { toView, type Entity } from './entity';
import { handPosition, holdPosition, overlapsSolid, stepPhysics, touching } from './physics';

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

export function createWorld(mode: ViewMode): World {
  const list: Entity[] = [];
  const byId = new Map<EntityId, Entity>();
  const hud = new Map<string, HudItem>();
  let contacts = new Set<string>();
  let ended: { result: GameResult; message: string } | null = null;
  let yaw = 0;
  let nextId = 1;
  /** Interactions requested this tick; they become visible (one tick) after the next step. */
  let pendingInteract = new Set<EntityId>();
  let interacted = new Set<EntityId>();
  /** Same one-tick pulse for tool use. */
  let pendingUsed = new Set<EntityId>();
  let usedOn = new Set<EntityId>();

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
    return e && e.kind === 'character' && e.visible ? e : undefined;
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
    return holder;
  }

  function viewOf(e: Entity): EntityView {
    const v = toView(e);
    if (e.kind !== 'character') return v;
    const tool = e.handHolding !== null ? byId.get(e.handHolding) : undefined;
    return {
      ...v,
      ...(tool && tool.shape !== undefined ? { tool: { shape: tool.shape, color: tool.color } } : {}),
      ...(e.swingTime >= 0 ? { swing: Math.min(1, e.swingTime / SWING_SECONDS) } : {}),
    };
  }

  /**
   * Nearest visible block / item / other character in a box ahead of the swinger: from its center out to
   * `reach`, as wide as the swinger, at the swinger's height. Closest gap along the facing wins.
   */
  function useTarget(c: Entity, reach: number): Entity | null {
    const r = Math.max(0, finiteOr(reach, 0));
    const fx = c.facing.x;
    const fz = c.facing.z;
    const halfWidth = Math.min(c.size.x, c.size.z) / 2 + USE_LATERAL_SLACK;
    let best: Entity | null = null;
    let bestGap = Infinity;
    let bestFwd = Infinity;
    for (const e of list) {
      if (e === c || !e.visible) continue;
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
      const gap = Math.max(0, fwd - fwdHalf);
      if (gap < bestGap - 1e-9 || (Math.abs(gap - bestGap) <= 1e-9 && fwd < bestFwd)) {
        best = e;
        bestGap = gap;
        bestFwd = fwd;
      }
    }
    return best;
  }

  /** A resting spot in front of (else behind, else at, else above) the character that is clear of solids. */
  function dropSpot(c: Entity, item: Entity): Vec3 {
    const solids = list.filter((e) => e.visible && e.solid && e.kind === 'block');
    const y = mode === '2d-top' ? c.pos.y : c.pos.y - c.size.y / 2 + item.size.y / 2;
    const gap = Math.max(c.size.x, c.size.z) / 2 + Math.max(item.size.x, item.size.z) / 2 + 0.05;
    const spots: Vec3[] = [
      { x: c.pos.x + c.facing.x * gap, y, z: c.pos.z + c.facing.z * gap },
      { x: c.pos.x - c.facing.x * gap, y, z: c.pos.z - c.facing.z * gap },
      { x: c.pos.x, y, z: c.pos.z },
    ];
    for (const spot of spots) {
      if (mode === '2d-side') spot.z = 0;
      if (!overlapsSolid({ ...item, pos: spot }, solids)) return spot;
    }
    return holdPosition(c, item, mode);
  }

  return {
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
      };
      if (mode === '2d-side') e.pos.z = 0;
      list.push(e);
      byId.set(id, e);
      return id;
    },
    setCharacterIntent(id: EntityId, intent: CharacterIntent): void {
      const e = byId.get(id);
      if (e && e.kind === 'character') e.intent = { ...intent };
    },
    hide(id: EntityId): void {
      const e = byId.get(id);
      if (!e) return;
      // Hiding a carried item, or a character holding one, lets go of it where it is.
      if (e.heldBy !== null) release(e);
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
      e.visible = false;
      e.onGround = false;
      for (const k of [...contacts]) if (k.split('|').includes(id)) contacts.delete(k);
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
      const item = nearestItem(c, reach, (it) => it.carryable && it.heldBy === null && it.holdStyle === 'head');
      if (!item) return null;
      item.heldBy = c.id;
      c.holding = item.id;
      Object.assign(item.pos, holdPosition(c, item, mode));
      item.vel = { x: 0, y: 0, z: 0 };
      return item.id;
    },
    drop(character: EntityId): EntityId | null {
      const c = liveCharacter(character);
      const item = c && c.holding !== null ? byId.get(c.holding) : undefined;
      if (!c || !item) return null;
      release(item);
      item.pos = dropSpot(c, item);
      item.vel = { x: 0, y: 0, z: 0 };
      return item.id;
    },
    throwHeld(character: EntityId, power: number): EntityId | null {
      const c = liveCharacter(character);
      const item = c && c.holding !== null ? byId.get(c.holding) : undefined;
      if (!c || !item) return null;
      const p = Math.max(0, finiteOr(power, 0));
      release(item);
      Object.assign(item.pos, holdPosition(c, item, mode));
      item.vel = {
        x: c.facing.x * p,
        y: mode === '2d-top' ? 0 : p * THROW_LIFT,
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
      return !!e && e.visible && e.heldBy !== null && !e.inHand;
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
      if (target) pendingUsed.add(target.id);
      return { target: target ? target.id : null };
    },
    wasUsedOn(id: EntityId): boolean {
      return usedOn.has(id);
    },
    solidAt(p: Vec3): boolean {
      for (const e of list) {
        if (!e.visible || !e.solid || e.kind !== 'block') continue;
        if (
          Math.abs(p.x - e.pos.x) <= e.size.x / 2 &&
          Math.abs(p.y - e.pos.y) <= e.size.y / 2 &&
          Math.abs(p.z - e.pos.z) <= e.size.z / 2
        ) {
          return true;
        }
      }
      return false;
    },
    cameraYaw(): number {
      return yaw;
    },
    step(dt: number): void {
      if (ended) return;
      stepPhysics(list, dt, mode, yaw);
      computeContacts();
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
    hudItems(): readonly HudItem[] {
      return [...hud.values()].map((h) => ({ ...h }));
    },
    setCameraYaw(rad: number): void {
      yaw = Number.isFinite(rad) ? rad : 0;
    },
  };
}
