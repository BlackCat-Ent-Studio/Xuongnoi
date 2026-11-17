import type { ViewMode } from '../engine/types';
import { boxOverlap, colliderBox } from './collider';
import type { Entity } from './entity';
import { exceeds, planPush, type Box, type PushBody, type PushPlan } from './linear-actuator';
import { materialOf } from './material';

/**
 * A robot chassis shoving loose items on the floor. It uses the same push model as the linear actuator (`planPush`):
 * the chassis is the "head", every item it meets is pushed ahead of it, the items those meet in turn too, and items
 * standing on a pushed item ride along. The resistance is  F = Σ μ · (m + load above) · g  of the directly pushed bodies.
 * The motors give  Σ min(maximum push force × |power|, grip)  of the wheels that turn the way the chassis travels (the grip
 * limit, μ · weight on the wheel, applies only with real physics on: a wheel cannot push harder than it grips); when the
 * resistance is higher the chassis stalls against the item (the wheels keep turning, there is no slip model).
 * Pushed items never enter a solid block: the chassis stops just short of that instead.
 * Not modelled: slowing down while pushing (a strong enough motor keeps the chassis speed) and items thinner than the
 * distance one tick moves the chassis (about 0.03 m at 2 m/s).
 */

/** Overlap below this counts as touching (same value physics.ts uses). */
const SKIN = 1e-6;

/** How far below a chassis's top an item's bottom may sit and still be held up by it (it rides, it is not shoved). */
export const SUPPORT_SINK = 0.02;

/** True when `item` lies on (or is landing on) the top of `chassis`. */
export function restsOnChassis(item: Entity, chassis: Entity): boolean {
  const bottom = colliderBox(item).pos.y - colliderBox(item).size.y / 2;
  const rb = colliderBox(chassis);
  return bottom >= rb.pos.y + rb.size.y / 2 - SUPPORT_SINK && boxOverlap(item, chassis, 'x') > SKIN && boxOverlap(item, chassis, 'z') > SKIN;
}

/** What the chassis sets up before it moves, and needs again once it has moved. */
export interface ShoveState {
  /** Ground position (x, z) before the move. */
  before: { x: number; z: number };
  availableN: number;
  items: PushBody[];
}

/** Newtons the motors can push with: wheels turning the way the chassis travels, each at its maximum scaled by |power|. */
export function availablePushN(robot: NonNullable<Entity['robot']>, travel: number): number {
  if (travel === 0) return 0;
  let total = 0;
  for (const w of robot.wheels.values()) if (w.rpm * travel > 0) total += Math.min(w.pushN, w.traction?.gripN ?? Infinity);
  return total;
}

function pushBodies(r: Entity, entities: readonly Entity[], mode: ViewMode): PushBody[] {
  const out: PushBody[] = [];
  for (const e of entities) {
    if (e.kind !== 'item' || !e.visible || e.bullet || e.heldBy !== null || e.inHand) continue;
    if (mode !== '2d-top' && restsOnChassis(e, r)) continue;
    const m = materialOf(e);
    out.push({ id: e.id, box: colliderBox(e), massKg: m.massKg, mu: m.mu });
  }
  return out;
}

/** The top view ignores height between items, but the chassis still passes under or over a block it does not reach in height. */
function overlapsHeight(s: Box, head: Box): boolean {
  return (s.size.y + head.size.y) / 2 - Math.abs(s.pos.y - head.pos.y) > SKIN;
}

const flatOf = (mode: ViewMode): 'y' | 'z' | null => (mode === '2d-top' ? 'y' : mode === '2d-side' ? 'z' : null);

function planFor(head: Box, dir: { x: number; z: number }, step: number, items: PushBody[], solids: readonly Entity[], mode: ViewMode): PushPlan {
  return planPush({
    head,
    dir: { x: dir.x, y: 0, z: dir.z },
    step,
    bodies: items,
    solids: solids.map((s) => colliderBox(s)).filter((s) => mode !== '2d-top' || overlapsHeight(s, head)),
    flat: flatOf(mode),
  });
}

/**
 * Before the chassis moves this tick: finds what its step would push. Returns null when nothing is in the way (the move
 * is then exactly the usual one). A stall zeroes the ground velocity; a push cut short by a solid scales it down.
 */
export function beginShove(r: Entity, entities: readonly Entity[], solids: readonly Entity[], dt: number, mode: ViewMode): ShoveState | null {
  const body = r.robot;
  if (!body || body.spec.pushObjects !== true) return null;
  const dx = r.vel.x * dt;
  const dz = mode === '2d-side' ? 0 : r.vel.z * dt;
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return null;
  const items = pushBodies(r, entities, mode);
  if (items.length === 0) return null;
  const dir = { x: dx / len, z: dz / len };
  const plan = planFor(colliderBox(r), dir, len, items, solids, mode);
  if (plan.moves.length === 0) return null;
  const travel = mode === '2d-side' ? dx : dx * Math.cos(body.heading) + dz * Math.sin(body.heading);
  const availableN = availablePushN(body, travel);
  body.pushing = true;
  if (exceeds(plan.requiredN, availableN)) {
    body.pushForce = availableN;
    r.vel.x = 0;
    r.vel.z = 0;
    return null;
  }
  body.pushForce = plan.requiredN;
  if (plan.blocked) {
    const k = plan.advance / len;
    r.vel.x *= k;
    r.vel.z *= k;
  }
  return { before: { x: r.pos.x, z: r.pos.z }, availableN, items };
}

/** After the chassis moved: pushes the items by the distance it really travelled (a wall may have cut or bent the move). */
export function finishShove(r: Entity, state: ShoveState, byId: ReadonlyMap<string, Entity>, solids: readonly Entity[], mode: ViewMode): void {
  const body = r.robot;
  if (!body) return;
  const mx = r.pos.x - state.before.x;
  const mz = mode === '2d-side' ? 0 : r.pos.z - state.before.z;
  const len = Math.hypot(mx, mz);
  if (len < 1e-9) return;
  const dir = { x: mx / len, z: mz / len };
  const now = colliderBox(r);
  const head = { pos: { x: now.pos.x - mx, y: now.pos.y, z: now.pos.z - mz }, size: now.size };
  const plan = planFor(head, dir, len, state.items, solids, mode);
  const stop = (to: number): void => {
    r.pos.x = state.before.x + dir.x * to;
    if (mode !== '2d-side') r.pos.z = state.before.z + dir.z * to;
    r.vel.x = 0;
    r.vel.z = 0;
  };
  if (exceeds(plan.requiredN, state.availableN)) {
    body.pushForce = state.availableN;
    stop(0);
    return;
  }
  if (plan.blocked) stop(plan.advance);
  for (const m of plan.moves) {
    const e = byId.get(m.id);
    // A rigid crate is pushed by the engine through contact; the plan above only decided how far the chassis may go.
    if (!e || e.rigid) continue;
    e.pos.x += m.delta.x;
    e.pos.y += m.delta.y;
    e.pos.z += m.delta.z;
  }
}
