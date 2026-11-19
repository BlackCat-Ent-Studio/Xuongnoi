import type { ViewMode } from '../engine/types';
import { boundsBox, chassisOutline, chassisReach, colliderBox, overOutline, spanOverlap } from './collider';
import { obbBounds, type Obb } from './oriented-box';
import type { Entity } from './entity';
import { emptyReach, exceeds, growReach, planPush, type Box, type PushBody, type PushPlan } from './linear-actuator';
import { materialOf } from './material';
import { wheelSpeed } from './robot-drive';
import { GRAVITY_N, MIN_FRICTION } from './robot-traction';

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
 *
 * With real physics on, another solid chassis in the way is shoved by the same rule. What it resists with is not sliding
 * friction but its wheels (`holdForceN`): along its wheels  Σ min(brake force, grip)  (a brake force of 0 = only the grip
 * limits it; a wheel already asked to run that way at least as fast gives way), sideways its whole grip  μ · m · g  (wheels do
 * not roll sideways), in between the two mixed by the direction. Only MORE push than that moves it: with equal forces both
 * stop, so two equal robots meeting head-on stand still whichever of them is stepped first. A chassis that cannot be
 * shoved is a wall for this tick (the mover stops flush against it and may slide along it). A shoved chassis takes the
 * pusher's speed along its own wheels, so its speed read-out and its wheels (dragged against their brake, or slipping)
 * tell what really happens, and it rolls on by itself until its wheels stop it once the pusher lets go.
 * Not modelled between two chassis: the pusher slowing down under the load, and a shoved chassis being turned.
 *
 * A chassis on wheel traction takes part by its real outline, turned to its heading (`chassisOutline`): as the head, as a
 * chassis that is shoved or holds, and as the top that carries what rides on it.
 */

/** Overlap below this counts as touching (same value physics.ts uses). */
const SKIN = 1e-6;

/** How far below a chassis's top an item's bottom may sit and still be held up by it (it rides, it is not shoved). */
export const SUPPORT_SINK = 0.02;

/**
 * A chassis as `restsOnChassis` reads it: its collision box (whose top carries) and its bounds (whose footprint the item must be
 * over), or, for a chassis with a real outline, that outline.
 */
interface ChassisTop {
  top: Box;
  under: Box;
  outline: Obb | null;
}

const chassisTop = (chassis: Entity): ChassisTop => ({ top: colliderBox(chassis), under: boundsBox(chassis), outline: chassisOutline(chassis) });

/** `restsOnChassis` for an item whose bounds (`lying`) and a chassis whose boxes are already worked out. */
function restsOnTop(lying: Box, c: ChassisTop): boolean {
  const bottom = lying.pos.y - lying.size.y / 2;
  if (!(bottom >= c.top.pos.y + c.top.size.y / 2 - SUPPORT_SINK)) return false;
  if (c.outline) return overOutline(lying, c.outline, SKIN);
  return spanOverlap(lying, c.under, 'x') > SKIN && spanOverlap(lying, c.under, 'z') > SKIN;
}

/** The chassis as the head of a push: its collision box, with its real outline when it has one. */
function headOf(r: Entity): Box {
  const box = colliderBox(r);
  const outline = chassisOutline(r);
  return outline ? { pos: box.pos, size: box.size, outline } : box;
}

/** Another chassis as something solid in the way: its collision box, or the bounds of its real outline together with that outline. */
function solidOf(o: Entity): Box {
  const outline = chassisOutline(o);
  return outline ? { ...obbBounds(outline), outline } : colliderBox(o);
}

/** True when `item` lies on (or is landing on) the top of `chassis`. */
export function restsOnChassis(item: Entity, chassis: Entity): boolean {
  return restsOnTop(boundsBox(item), chassisTop(chassis));
}

/** What the chassis sets up before it moves, and needs again once it has moved. */
export interface ShoveState {
  /** Ground position (x, z) before the move. */
  before: { x: number; z: number };
  availableN: number;
  items: PushBody[];
  /** Other chassis that could not be shoved this tick: solid like walls for whatever is pushed. */
  walls: Box[];
  /** Ids of the other chassis among `items` (they need more push than they hold with, not just as much). */
  chassis: ReadonlySet<string>;
  /** Other chassis this move shoves: they are moved once the chassis has moved, so they do not stop it on the way. */
  shoved: ReadonlySet<string>;
}

/**
 * Newtons a chassis resists with when it is pushed along the unit ground direction `dir` at `speed` m/s (see the file comment).
 * Its weight counts with what it carries. Without wheels, or without wheel traction, it is a box sliding on its grip.
 */
export function holdForceN(chassis: Entity, dir: { x: number; z: number }, speed: number, sideView: boolean): number {
  const body = chassis.robot;
  if (!body) return 0;
  const skid = Math.max(MIN_FRICTION, body.spec.friction) * (body.spec.mass + body.payload) * GRAVITY_N;
  const wheels = [...body.wheels.values()];
  if (!body.traction || wheels.length === 0) return skid;
  const along = sideView ? dir.x : dir.x * Math.cos(body.heading) + dir.z * Math.sin(body.heading);
  const across = Math.sqrt(Math.max(0, 1 - along * along));
  const pushed = speed * along;
  const grip = skid / wheels.length;
  let rolling = 0;
  for (const w of wheels) {
    const asked = body.overloaded ? 0 : wheelSpeed(w);
    // A wheel that is asked to run the way it is pushed, at least as fast, has nothing to hold back.
    if (asked * pushed > 0 && Math.abs(asked) >= Math.abs(pushed)) continue;
    rolling += Math.min(w.brakeN > 0 ? w.brakeN : Infinity, grip);
  }
  return Math.abs(along) * rolling + across * skid;
}

/** True when the push is not enough: loose things need as much force as they resist with, another chassis needs more. */
function cannotPush(plan: PushPlan, availableN: number, chassis: ReadonlySet<string>): boolean {
  if (exceeds(plan.requiredN, availableN)) return true;
  return plan.loadIds.some((id) => chassis.has(id)) && !(availableN > plan.requiredN + 1e-9);
}

/** Newtons the motors can push with: wheels turning the way the chassis travels, each at its maximum scaled by |power|. */
export function availablePushN(robot: NonNullable<Entity['robot']>, travel: number): number {
  if (travel === 0) return 0;
  let total = 0;
  for (const w of robot.wheels.values()) if (w.rpm * travel > 0) total += Math.min(w.pushN, w.traction?.gripN ?? Infinity);
  return total;
}

function pushBodies(r: Entity, entities: readonly Entity[], mode: ViewMode, others: readonly Entity[]): PushBody[] {
  const out: PushBody[] = [];
  // Every item is held against every chassis here, so the boxes are worked out once per body, not once per pair.
  const own = mode !== '2d-top' ? chassisTop(r) : null;
  const tops = mode !== '2d-top' ? others.map(chassisTop) : [];
  for (const e of entities) {
    if (e.kind !== 'item' || !e.visible || e.bullet || e.heldBy !== null || e.inHand) continue;
    const lying = boundsBox(e);
    if (own && restsOnTop(lying, own)) continue;
    // What rides on another solid chassis goes where that chassis goes (it is carried, not shoved off its top).
    if (tops.some((t) => restsOnTop(lying, t))) continue;
    const m = materialOf(e);
    out.push({ id: e.id, box: lying, massKg: m.massKg, mu: m.mu });
  }
  return out;
}

/** Another chassis as a body that may be shoved: its collision box, or the bounds of its real outline together with that outline. */
function shovedBox(o: Entity): Pick<PushBody, 'box' | 'outline'> {
  const outline = chassisOutline(o);
  return outline ? { box: obbBounds(outline), outline } : { box: colliderBox(o) };
}

/** The top view ignores height between items, but the chassis still passes under or over a block it does not reach in height. */
function overlapsHeight(s: Box, head: Box): boolean {
  return (s.size.y + head.size.y) / 2 - Math.abs(s.pos.y - head.pos.y) > SKIN;
}

const flatOf = (mode: ViewMode): 'y' | 'z' | null => (mode === '2d-top' ? 'y' : mode === '2d-side' ? 'z' : null);

function planFor(head: Box, dir: { x: number; z: number }, step: number, items: PushBody[], solids: readonly Entity[], mode: ViewMode, walls: readonly Box[] = []): PushPlan {
  const fixed: Box[] = solids.map((s) => colliderBox(s));
  return planPush({
    head,
    dir: { x: dir.x, y: 0, z: dir.z },
    step,
    bodies: items,
    solids: (walls.length > 0 ? [...fixed, ...walls] : fixed).filter((s) => mode !== '2d-top' || overlapsHeight(s, head)),
    flat: flatOf(mode),
  });
}

/**
 * False only when the step of the chassis can meet no loose item and no other chassis: its box, on its way, stays clear of the
 * box round each of them along some axis the view shows. (An item's bounds, however it is turned, lie within its collision
 * box's offset plus half its diagonal of its position, along every axis; a chassis's real outline within half its own diagonal.)
 * Then nothing is shoved, whatever else is worked out.
 */
export function somethingOnTheWay(r: Entity, entities: readonly Entity[], others: readonly Entity[], move: { x: number; z: number }, mode: ViewMode): boolean {
  const reach = emptyReach(flatOf(mode));
  if (!growReach(reach, headOf(r), { x: move.x, y: 0, z: move.z })) return true;
  const clear = (e: Entity): boolean => {
    const b = colliderBox(e);
    const round = Math.max(chassisReach(e), Math.hypot(b.pos.x - e.pos.x, b.pos.y - e.pos.y, b.pos.z - e.pos.z) + Math.hypot(b.size.x, b.size.y, b.size.z) / 2);
    for (const k of reach.shown) if (e.pos[k] - round > reach.hi[k] || e.pos[k] + round < reach.lo[k]) return true;
    return false;
  };
  for (const o of others) if (!clear(o)) return true;
  for (const e of entities) {
    if (e.kind !== 'item' || !e.visible || e.bullet || e.heldBy !== null || e.inHand) continue;
    if (!clear(e)) return true;
  }
  return false;
}

/**
 * Before the chassis moves this tick: finds what its step would push. Returns null when nothing is in the way (the move
 * is then exactly the usual one). A stall zeroes the ground velocity; a push cut short by a solid scales it down.
 * `others` are the other solid chassis it may meet (real physics on; none otherwise).
 */
export function beginShove(r: Entity, entities: readonly Entity[], solids: readonly Entity[], dt: number, mode: ViewMode, others: readonly Entity[] = []): ShoveState | null {
  const body = r.robot;
  if (!body || body.spec.pushObjects !== true) return null;
  const dx = r.vel.x * dt;
  const dz = mode === '2d-side' ? 0 : r.vel.z * dt;
  const len = Math.hypot(dx, dz);
  if (len < 1e-9) return null;
  // The plan below would find nothing to move and give the same answer; this saves making it for every chassis on an open floor.
  if (!somethingOnTheWay(r, entities, others, { x: dx, z: dz }, mode)) return null;
  const loose = pushBodies(r, entities, mode, others);
  if (loose.length === 0 && others.length === 0) return null;
  const dir = { x: dx / len, z: dz / len };
  const travel = mode === '2d-side' ? dx : dx * Math.cos(body.heading) + dz * Math.sin(body.heading);
  const availableN = availablePushN(body, travel);
  const chassis = new Set(others.map((o) => o.id));
  let items = loose;
  let walls: Box[] = [];
  if (others.length > 0) {
    const sideView = mode === '2d-side';
    items = [...loose, ...others.map((o): PushBody => ({ id: o.id, ...shovedBox(o), massKg: o.robot?.spec.mass ?? 0, mu: o.robot?.spec.friction ?? 0, holdN: holdForceN(o, dir, len / dt, sideView) }))];
  }
  let plan = planFor(headOf(r), dir, len, items, solids, mode);
  let held = false;
  if (plan.loadIds.some((id) => chassis.has(id)) && cannotPush(plan, availableN, chassis)) {
    // The chassis ahead hold: for this tick they are walls, for this chassis (its usual move stops flush at them) and for what it pushes.
    held = true;
    items = loose;
    walls = others.map(solidOf);
    plan = planFor(headOf(r), dir, len, items, solids, mode, walls);
    body.pushing = true;
    body.pushForce = availableN;
  }
  if (plan.moves.length === 0) return null;
  body.pushing = true;
  if (cannotPush(plan, availableN, chassis)) {
    body.pushForce = availableN;
    r.vel.x = 0;
    r.vel.z = 0;
    return null;
  }
  if (!held) body.pushForce = plan.requiredN;
  if (plan.blocked) {
    const k = plan.advance / len;
    r.vel.x *= k;
    r.vel.z *= k;
  }
  return { before: { x: r.pos.x, z: r.pos.z }, availableN, items, walls, chassis, shoved: new Set(plan.loadIds.filter((id) => chassis.has(id))) };
}

/**
 * After the chassis moved: pushes the items by the distance it really travelled (a wall may have cut or bent the move).
 * Returns the other chassis it shoved and how far each went; `dt` turns the distance travelled into the speed they take.
 */
export function finishShove(r: Entity, state: ShoveState, byId: ReadonlyMap<string, Entity>, solids: readonly Entity[], mode: ViewMode, dt = 0): Map<Entity, { x: number; z: number }> {
  const shoved = new Map<Entity, { x: number; z: number }>();
  const body = r.robot;
  if (!body) return shoved;
  const mx = r.pos.x - state.before.x;
  const mz = mode === '2d-side' ? 0 : r.pos.z - state.before.z;
  const len = Math.hypot(mx, mz);
  if (len < 1e-9) return shoved;
  const dir = { x: mx / len, z: mz / len };
  const now = headOf(r);
  const back = { x: now.pos.x - mx, y: now.pos.y, z: now.pos.z - mz };
  const head: Box = { pos: back, size: now.size, ...(now.outline ? { outline: { ...now.outline, centre: { x: now.outline.centre.x - mx, y: now.outline.centre.y, z: now.outline.centre.z - mz } } } : {}) };
  const plan = planFor(head, dir, len, state.items, solids, mode, state.walls);
  const stop = (to: number): void => {
    r.pos.x = state.before.x + dir.x * to;
    if (mode !== '2d-side') r.pos.z = state.before.z + dir.z * to;
    r.vel.x = 0;
    r.vel.z = 0;
  };
  if (cannotPush(plan, state.availableN, state.chassis)) {
    body.pushForce = state.availableN;
    stop(0);
    return shoved;
  }
  if (plan.blocked) stop(plan.advance);
  const went = plan.blocked ? plan.advance : len;
  for (const m of plan.moves) {
    const e = byId.get(m.id);
    // A rigid crate is pushed by the engine through contact; the plan above only decided how far the chassis may go.
    if (!e || e.rigid) continue;
    e.pos.x += m.delta.x;
    e.pos.y += m.delta.y;
    e.pos.z += m.delta.z;
    const pushed = e.robot;
    if (!pushed || !state.chassis.has(e.id)) continue;
    shoved.set(e, { x: m.delta.x, z: m.delta.z });
    // It now travels with the pusher: along its own wheels at least at the pusher's speed that way.
    if (!(dt > 0)) continue;
    const along = (mode === '2d-side' ? dir.x : dir.x * Math.cos(pushed.heading) + dir.z * Math.sin(pushed.heading)) * (went / dt);
    if (along > 0) pushed.speed = Math.max(pushed.speed, along);
    else if (along < 0) pushed.speed = Math.min(pushed.speed, along);
  }
  return shoved;
}
