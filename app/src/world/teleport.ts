import type { EntityId, PortalLink, Vec3, ViewMode } from '../engine/types';
import type { Entity } from './entity';
import { handPosition, holdPosition, overlapsSolid } from './physics';
import { seatPosition } from './vehicles';

/** Vertical search step and reach when the wanted spot is inside a block. */
const LIFT_STEP = 0.5;
const MAX_LIFT = 6;
/** How far a resting rigid crate may sink into what it rests on (m) before it counts as inside it. */
const REST_SKIN = 0.01;
/** Sideways search rings. */
const RING_STEP = 0.5;
const MAX_RING = 4;
const RING_DIRECTIONS = 8;

interface Deps {
  list: readonly Entity[];
  byId: ReadonlyMap<EntityId, Entity>;
  mode: ViewMode;
  isTouching(a: EntityId, b: EntityId): boolean;
  /** Called after a character moved: cached routes planned from the old place are stale. */
  invalidatePlans(): void;
}

interface PortalRec extends PortalLink {
  id: EntityId;
}

/** Candidate centers around `to`, nearest first: straight up, then rings outward (each ring also tried higher). */
function* candidates(to: Vec3, mode: ViewMode): Generator<Vec3> {
  const lifts = mode === '2d-top' ? [0] : Array.from({ length: Math.round(MAX_LIFT / LIFT_STEP) + 1 }, (_, i) => i * LIFT_STEP);
  for (const dy of lifts) yield { x: to.x, y: to.y + dy, z: to.z };
  const dirs =
    mode === '2d-side'
      ? [{ x: 1, z: 0 }, { x: -1, z: 0 }]
      : Array.from({ length: RING_DIRECTIONS }, (_, i) => ({
          x: Math.cos((i / RING_DIRECTIONS) * Math.PI * 2),
          z: Math.sin((i / RING_DIRECTIONS) * Math.PI * 2),
        }));
  for (let r = RING_STEP; r <= MAX_RING + 1e-9; r += RING_STEP) {
    for (const d of dirs) {
      for (const dy of lifts.slice(0, 7)) yield { x: to.x + d.x * r, y: to.y + dy, z: to.z + d.z * r };
    }
  }
}

/** The first candidate around `to` where `e` fits among the solid blocks (and solid vehicles, for people on foot). */
export function findFreeSpot(list: readonly Entity[], e: Entity, to: Vec3, mode: ViewMode): Vec3 | null {
  if (![to.x, to.y, to.z].every(Number.isFinite)) return null;
  const solids = list.filter(
    // A crate a gripper holds is part of that hand: the hand's own cubes never keep it from its place.
    (o) => o !== e && o.visible && o.solid && (o.kind === 'block' || (o.kind === 'vehicle' && e.kind === 'character')) && !(e.grippedBy !== undefined && o.ownerNodeId === e.grippedBy),
  );
  // A rigid crate ("Vật lý thật") that rests on or leans against something touches it within the engine's contact margin:
  // a resting contact is not an overlap, so it is tested with a thin skin taken off every face.
  const size = e.rigid === true ? { x: e.size.x - 2 * REST_SKIN, y: e.size.y - 2 * REST_SKIN, z: e.size.z - 2 * REST_SKIN } : e.size;
  for (const c of candidates(to, mode)) {
    const spot: Vec3 = { x: c.x, y: mode === '2d-top' ? e.pos.y : c.y, z: mode === '2d-side' ? 0 : c.z };
    if (!overlapsSolid({ ...e, pos: spot, size }, solids)) return spot;
  }
  return null;
}

/** Teleport and portal bookkeeping for one world. */
export function createTeleporter(deps: Deps) {
  const { list, byId, mode } = deps;
  const portals = new Map<EntityId, PortalRec>();
  /** Entities that just came through: seconds left; also held back while they still touch a portal. */
  const cooling = new Map<EntityId, number>();
  let used = new Map<EntityId, EntityId>();

  function carryAlong(c: Entity): void {
    for (const held of [c.holding, c.handHolding]) {
      const item = held !== null ? byId.get(held) : undefined;
      if (!item) continue;
      Object.assign(item.pos, item.inHand ? handPosition(c, item, mode) : holdPosition(c, item, mode));
      item.vel = { x: 0, y: 0, z: 0 };
    }
  }

  function place(e: Entity, to: Vec3, keepVelocity: boolean): Vec3 | null {
    const spot = findFreeSpot(list, e, to, mode);
    if (!spot) return null;
    e.pos = spot;
    if (!keepVelocity) {
      e.vel = { x: 0, y: 0, z: 0 };
      if (e.vehicle) e.vehicle.speed = 0;
    }
    e.onGround = false;
    if (e.vehicle?.driver != null) {
      const driver = byId.get(e.vehicle.driver);
      if (driver) {
        Object.assign(driver.pos, seatPosition(e, driver));
        carryAlong(driver);
      }
    }
    if (e.kind === 'character') {
      carryAlong(e);
      deps.invalidatePlans();
    }
    return { ...spot };
  }

  function teleport(id: EntityId, to: Vec3, keepVelocity: boolean): Vec3 | null {
    const e = byId.get(id);
    if (!e || !e.visible || e.kind === 'block' || e.heldBy !== null) return null;
    if (e.kind === 'character' && e.combat?.dead) return null;
    if (e.seatedIn !== null) {
      // A driver cannot leave the seat by teleport: the whole vehicle goes.
      const veh = byId.get(e.seatedIn);
      return veh && veh.visible ? place(veh, to, keepVelocity) : null;
    }
    return place(e, to, keepVelocity);
  }

  function usable(p: PortalRec | undefined): p is PortalRec {
    return !!p && p.enabled && byId.get(p.id)?.visible === true;
  }

  function partnerOf(p: PortalRec): PortalRec | null {
    const wired = p.partner !== null ? portals.get(p.partner) : undefined;
    if (usable(wired) && wired !== p) return wired;
    for (const q of portals.values()) {
      if (q === p || !usable(q)) continue;
      if (q.partner === p.id || (p.pair !== '' && q.pair === p.pair)) return q;
    }
    return null;
  }

  function arrival(portal: Entity, e: Entity): Vec3 {
    return {
      x: portal.pos.x,
      y: mode === '2d-top' ? e.pos.y : portal.pos.y - portal.size.y / 2 + e.size.y / 2,
      z: portal.pos.z,
    };
  }

  function touchesAnyPortal(id: EntityId): boolean {
    for (const p of portals.values()) if (usable(p) && deps.isTouching(p.id, id)) return true;
    return false;
  }

  return {
    teleport,
    setPortal(id: EntityId, link: PortalLink): void {
      const e = byId.get(id);
      if (!e || e.kind !== 'block') return;
      portals.set(id, {
        id,
        partner: link.partner,
        pair: link.pair.trim(),
        enabled: link.enabled,
        cooldown: Number.isFinite(link.cooldown) ? Math.max(0, link.cooldown) : 0.5,
      });
    },
    portalUser(id: EntityId): EntityId | null {
      return used.get(id) ?? null;
    },
    /** After contacts are known: sends everything touching a portal to its partner. */
    step(dt: number): void {
      used = new Map();
      for (const [id, left] of cooling) {
        const next = left - dt;
        // Free again once the time is up and the entity has stepped off every portal.
        if (next <= 0 && !touchesAnyPortal(id)) cooling.delete(id);
        else cooling.set(id, Math.max(next, 0));
      }
      if (portals.size === 0) return;
      for (const p of portals.values()) {
        const pe = byId.get(p.id);
        const q = usable(p) && pe?.visible ? partnerOf(p) : null;
        const qe = q ? byId.get(q.id) : undefined;
        if (!pe || !qe) continue;
        for (const e of list) {
          if (!e.visible || e.kind === 'block' || e.heldBy !== null || e.seatedIn !== null || cooling.has(e.id)) continue;
          if (!deps.isTouching(p.id, e.id)) continue;
          if (teleport(e.id, arrival(qe, e), true)) {
            cooling.set(e.id, p.cooldown);
            used.set(p.id, e.id);
          }
        }
      }
    },
  };
}
